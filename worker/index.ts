import { Hono } from "hono";
import { prices } from "../shared/lmsr";
import type { LeaderRow, Me, TabState, TickerItem } from "../shared/types";
import { contract } from "../shared/van";
import {
  checkLoginLimit,
  clearLoginFailures,
  currentUser,
  endSession,
  hashPassword,
  recordLoginFailure,
  requireBoss,
  requireUser,
  startSession,
  timingSafeEqual,
  verifyPassword,
} from "./auth";
import { maybeTick, tick } from "./bots";
import { HttpError, type AppEnv, type Env, type MarketRow, type UserRow } from "./env";
import { kitchenState, standings } from "./kitchen";
import { addComment, buy, getMarket, listMarkets, marketDetail, sell, settle } from "./markets";
import { ensureSeeded } from "./seed";
import { boxCost, closeVan, myVan, openVan, vanBoard } from "./van";
import { vanPrice } from "./vanPricing";

const app = new Hono<AppEnv>().basePath("/api");

const BAILOUT_CENTS = 2_000;
const BAILOUT_BELOW = 500;
const DAY = 86_400_000;

const canBailout = (u: UserRow, now: number) => u.balance_cents < BAILOUT_BELOW && now - u.last_bailout > DAY;

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Somethin' burned in the oven. Try again." }, 500);
});

app.use("*", async (c, next) => {
  await ensureSeeded(c.env);
  c.set("user", await currentUser(c));
  c.executionCtx.waitUntil(maybeTick(c.env, Date.now()).catch((e) => console.error("tick", e)));
  await next();
});

async function body<T>(c: { req: { json: () => Promise<unknown> } }): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, "Couldn't read dat order.");
  }
}

async function me(env: Env, u: UserRow): Promise<Me> {
  const last = await env.DB.prepare("SELECT id, kind, cents, memo FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .bind(u.id)
    .first<{ id: number; kind: string; cents: number; memo: string }>();
  return {
    id: u.id, username: u.username, balanceCents: u.balance_cents, isBoss: !!u.is_boss, hood: u.hood,
    canBailout: canBailout(u, Date.now()), lastLedger: last ?? null,
  };
}

// ---------- auth ----------

app.get("/me", async (c) => {
  const u = c.get("user");
  return c.json({ user: u ? await me(c.env, u) : null });
});

app.post("/join", async (c) => {
  const b = await body<{ username?: string; password?: string; sentBy?: string; hood?: string; isCop?: string }>(c);
  const username = (b.username ?? "").trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, "Name's gotta be 3 to 20 letters, numbers, or underscores.");
  if ((b.password ?? "").length < 6) throw new HttpError(400, "Password's gotta be 6 or more. Your mother's maiden name don't count.");
  if (b.isCop === "yes") throw new HttpError(403, "Sorry officer, we're closed. We been closed. Always closed.");
  const taken = "Somebody already goes by dat name around here.";
  const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
  if (exists) throw new HttpError(409, taken);
  const { hash, salt } = await hashPassword(b.password!);
  const sentBy = (b.sentBy ?? "").trim();
  const isBoss = c.env.BOSS_CODE && timingSafeEqual(sentBy, c.env.BOSS_CODE) ? 1 : 0;
  const now = Date.now();
  let res: number | null;
  try {
    res = await c.env.DB.prepare(
      "INSERT INTO users (username, pass_hash, salt, sent_by, hood, is_cop, is_boss, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
      .bind(username, hash, salt, isBoss ? "" : sentBy.slice(0, 60), (b.hood ?? "").slice(0, 40), b.isCop === "retired" ? "retired" : "no", isBoss, now)
      .first<number>("id");
  } catch (e) {
    // two people grabbed the same name at the same moment
    if (String(e).includes("UNIQUE constraint failed")) throw new HttpError(409, taken);
    throw e;
  }
  await c.env.DB.prepare("INSERT INTO ledger (user_id, kind, cents, memo, created_at) VALUES (?, 'welcome', 10000, 'C-NOTE FROM TONY · WELCOME', ?)")
    .bind(res, now)
    .run();
  await startSession(c, res!);
  return c.json({ ok: true });
});

app.post("/login", async (c) => {
  const b = await body<{ username?: string; password?: string }>(c);
  const username = (b.username ?? "").trim().slice(0, 40);
  await checkLoginLimit(c, username);
  const row = await c.env.DB.prepare("SELECT id, pass_hash, salt FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number; pass_hash: string; salt: string }>();
  if (!row || !(await verifyPassword(b.password ?? "", row.pass_hash, row.salt))) {
    await recordLoginFailure(c, username);
    throw new HttpError(401, "I don't know you. Try again.");
  }
  await clearLoginFailures(c, username);
  await startSession(c, row.id);
  return c.json({ ok: true });
});

app.post("/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

// ---------- markets ----------

app.get("/markets", async (c) => c.json({ markets: await listMarkets(c.env, c.req.query("status") === "resolved" ? "resolved" : "open") }));

app.get("/markets/:slug", async (c) => c.json(await marketDetail(c.env, c.req.param("slug"), c.get("user"))));

app.post("/markets/:slug/buy", async (c) => {
  const u = requireUser(c.get("user"));
  const b = await body<{ outcome: number; cents: number }>(c);
  return c.json(await buy(c.env, u, c.req.param("slug"), b.outcome, b.cents));
});

app.post("/markets/:slug/sell", async (c) => {
  const u = requireUser(c.get("user"));
  const b = await body<{ outcome: number; shares: number }>(c);
  return c.json(await sell(c.env, u, c.req.param("slug"), b.outcome, b.shares));
});

app.post("/markets/:slug/comments", async (c) => {
  const u = requireUser(c.get("user"));
  const b = await body<{ body: string }>(c);
  await addComment(c.env, u, c.req.param("slug"), String(b.body ?? ""));
  return c.json({ ok: true });
});

// ---------- kitchen, van, sports ----------

app.get("/kitchen", async (c) => c.json(await kitchenState(c.env, c.get("user"), Date.now())));

app.get("/standings", async (c) => c.json({ standings: await standings(c.env) }));

app.get("/van", async (c) => {
  const now = Date.now();
  const u = c.get("user");
  return c.json({ now, board: await vanBoard(c.env, now), mine: u ? await myVan(c.env, u.id, now) : [] });
});

app.post("/van/open", async (c) => {
  const u = requireUser(c.get("user"));
  const b = await body<{ symbol: string; side: string; boxes: number }>(c);
  return c.json(await openVan(c.env, u, b.symbol, b.side, b.boxes));
});

app.post("/van/close", async (c) => {
  const u = requireUser(c.get("user"));
  const b = await body<{ id: number }>(c);
  return c.json(await closeVan(c.env, u, b.id));
});

// ---------- your tab ----------

app.get("/tab", async (c) => {
  const u = requireUser(c.get("user"));
  const now = Date.now();
  const [pos, van, ledger] = await Promise.all([
    c.env.DB.prepare(
      `SELECT m.slug, m.title, m.outcomes, m.q, m.b, p.outcome, p.shares, p.cost_cents
       FROM positions p JOIN markets m ON m.id = p.market_id
       WHERE p.user_id = ? AND p.shares > 0.000001 AND m.status = 'open' ORDER BY m.kind DESC, p.cost_cents DESC`,
    )
      .bind(u.id)
      .all<{ slug: string; title: string; outcomes: string; q: string; b: number; outcome: number; shares: number; cost_cents: number }>(),
    myVan(c.env, u.id, now),
    c.env.DB.prepare("SELECT kind, cents, memo, created_at AS at FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 30")
      .bind(u.id)
      .all<{ kind: string; cents: number; memo: string; at: number }>(),
  ]);
  const positions = pos.results.map((p) => {
    const price = prices(JSON.parse(p.q), p.b)[p.outcome];
    return {
      slug: p.slug,
      title: p.title,
      outcome: (JSON.parse(p.outcomes) as string[])[p.outcome],
      shares: p.shares,
      costCents: p.cost_cents,
      valueCents: Math.round(p.shares * price * 100),
      price,
    };
  });
  const vanValue = van.reduce((s, v) => s + boxCost(v.side, v.markCents) * v.boxes, 0);
  const tab: TabState = {
    balanceCents: u.balance_cents,
    netWorthCents: u.balance_cents + positions.reduce((s, p) => s + p.valueCents, 0) + vanValue,
    positions,
    van,
    ledger: ledger.results,
    canBailout: canBailout(u, now),
  };
  return c.json(tab);
});

app.get("/ledger", async (c) => {
  const u = requireUser(c.get("user"));
  const after = Number(c.req.query("after") ?? 0) || 0;
  const rows = await c.env.DB.prepare("SELECT id, kind, cents, memo FROM ledger WHERE user_id = ? AND id > ? ORDER BY id LIMIT 50")
    .bind(u.id, after)
    .all<{ id: number; kind: string; cents: number; memo: string }>();
  return c.json({ entries: rows.results });
});

app.post("/bailout", async (c) => {
  const u = requireUser(c.get("user"));
  const now = Date.now();
  if (!canBailout(u, now)) throw new HttpError(409, "Tony says you're doin' fine. Come back when you're broke.");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET balance_cents = balance_cents + ?, last_bailout = ? WHERE id = ?").bind(BAILOUT_CENTS, now, u.id),
    c.env.DB.prepare("INSERT INTO ledger (user_id, kind, cents, memo, created_at) VALUES (?, 'bailout', ?, 'TONY SPOTS YOU A TWENTY', ?)").bind(u.id, BAILOUT_CENTS, now),
  ]);
  return c.json({ ok: true });
});

// ---------- wall of fame ----------

app.get("/leaderboard", async (c) => {
  const now = Date.now();
  const [users, pos, van] = await Promise.all([
    c.env.DB.prepare("SELECT id, username, hood, balance_cents, is_bot, is_boss FROM users").all<{ id: number; username: string; hood: string; balance_cents: number; is_bot: number; is_boss: number }>(),
    c.env.DB.prepare(
      "SELECT p.user_id, p.outcome, p.shares, m.q, m.b FROM positions p JOIN markets m ON m.id = p.market_id WHERE m.status = 'open' AND p.shares > 0.000001",
    ).all<{ user_id: number; outcome: number; shares: number; q: string; b: number }>(),
    c.env.DB.prepare("SELECT user_id, symbol, side, boxes, entry_cents FROM van_positions WHERE closed_at IS NULL").all<{ user_id: number; symbol: string; side: "long" | "short"; boxes: number; entry_cents: number }>(),
  ]);
  const worth = new Map(users.results.map((u) => [u.id, u.balance_cents]));
  const priceCache = new Map<string, number[]>();
  for (const p of pos.results) {
    const key = `${p.q}|${p.b}`;
    if (!priceCache.has(key)) priceCache.set(key, prices(JSON.parse(p.q), p.b));
    worth.set(p.user_id, (worth.get(p.user_id) ?? 0) + Math.round(p.shares * priceCache.get(key)![p.outcome] * 100));
  }
  const marks = new Map<string, number>();
  for (const sym of new Set(van.results.map((v) => v.symbol))) {
    const ct = contract(sym);
    if (ct && !ct.halted) marks.set(sym, await vanPrice(c.env, ct, now));
  }
  for (const v of van.results) {
    const mark = marks.get(v.symbol) ?? v.entry_cents;
    worth.set(v.user_id, (worth.get(v.user_id) ?? 0) + boxCost(v.side, mark) * v.boxes);
  }
  const rows: LeaderRow[] = users.results
    .filter((u) => !u.is_bot)
    .map((u) => ({ rank: 0, user: u.username, hood: u.hood, netWorthCents: worth.get(u.id) ?? 0, bot: false, isBoss: !!u.is_boss }))
    .sort((a, b) => b.netWorthCents - a.netWorthCents)
    .slice(0, 50)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return c.json({ leaders: rows });
});

// ---------- ticker ----------

app.get("/ticker", async (c) => {
  const now = Date.now();
  const [board, markets] = await Promise.all([vanBoard(c.env, now), listMarkets(c.env)]);
  const items: TickerItem[] = [];
  for (const v of board) {
    if (v.halted) items.push({ text: `${v.symbol} ${v.halted}`, tone: "halt" });
    else items.push({ text: `${v.symbol} ${v.price}¢ ${v.change >= 0 ? "▲" : "▼"}${Math.abs(v.change)}`, tone: v.change >= 0 ? "up" : "dn" });
  }
  for (const m of markets.slice(0, 8)) {
    const p = Math.round(m.prices[0] * 100);
    const ch = Math.round(m.change[0] * 100);
    const label = m.slug.toUpperCase().replace(/-/g, "-");
    items.push({ text: `${label} ${p}¢ ${ch >= 0 ? "▲" : "▼"}${Math.abs(ch)}`, tone: ch >= 0 ? "up" : "dn" });
  }
  // interleave so the van and the neighborhood alternate
  const van = items.slice(0, board.length);
  const hood = items.slice(board.length);
  const mixed: TickerItem[] = [];
  for (let i = 0; i < Math.max(van.length, hood.length); i++) {
    if (van[i]) mixed.push(van[i]);
    if (hood[i]) mixed.push(hood[i]);
  }
  return c.json({ items: mixed });
});

// ---------- Tony's office ----------

app.post("/boss/markets", async (c) => {
  requireBoss(c.get("user"));
  const b = await body<{ title: string; blurb?: string; category: string; outcomes?: string[]; days?: number; rules?: [string, string][] }>(c);
  const title = (b.title ?? "").trim();
  if (title.length < 8) throw new HttpError(400, "Give it a real question.");
  if (!["truck", "crust", "hood", "block", "weather"].includes(b.category)) throw new HttpError(400, "Pick a section.");
  const outcomes = (b.outcomes?.length ? b.outcomes : ["YES", "NO"]).map((o) => o.trim()).filter(Boolean).slice(0, 8);
  if (outcomes.length < 2) throw new HttpError(400, "Need at least two outcomes.");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) + "-" + Math.random().toString(36).slice(2, 6);
  const q = JSON.stringify(outcomes.map(() => 0));
  const now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO markets (slug, kind, category, title, blurb, rules, outcomes, q, q0, b, closes_at, created_at) VALUES (?, 'lmsr', ?, ?, ?, ?, ?, ?, ?, 80, ?, ?)",
  )
    .bind(slug, b.category, title, (b.blurb ?? "").trim(), JSON.stringify(b.rules ?? [["Resolved by", "Tony, who will be standing right there."]]), JSON.stringify(outcomes), q, q, now + Math.max(1, Math.min(90, b.days ?? 7)) * DAY, now)
    .run();
  return c.json({ slug });
});

app.post("/boss/markets/:slug/resolve", async (c) => {
  requireBoss(c.get("user"));
  const b = await body<{ winner: number }>(c);
  const m: MarketRow = await getMarket(c.env, c.req.param("slug"));
  if (m.kind !== "lmsr") throw new HttpError(400, "Toss rounds resolve themselves.");
  const n = (JSON.parse(m.outcomes) as string[]).length;
  if (!Number.isInteger(b.winner) || b.winner < 0 || b.winner >= n) throw new HttpError(400, "Pick a winner from the list.");
  const ok = await settle(c.env, m, b.winner);
  if (!ok) throw new HttpError(409, "Already settled.");
  return c.json({ ok: true });
});

export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await ensureSeeded(env);
        await tick(env, Date.now());
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
