import { prices, proceedsForSell, sharesForSpend } from "../shared/lmsr";
import type { Comment, MarketDetail, MarketSummary, Trade } from "../shared/types";
import { clearGuard, guard, HttpError, isGuardFailure, type Env, type MarketRow, type UserRow } from "./env";

export const MAX_ORDER_CENTS = 100_000;

export function parseQ(m: MarketRow): number[] {
  return JSON.parse(m.q);
}

export async function getMarket(env: Env, slug: string): Promise<MarketRow> {
  const m = await env.DB.prepare("SELECT * FROM markets WHERE slug = ?").bind(slug).first<MarketRow>();
  if (!m) throw new HttpError(404, "Never heard of it.");
  return m;
}

function isTradable(m: MarketRow, now: number) {
  return m.status === "open" && (m.closes_at == null || now < m.closes_at);
}

/** Price per outcome 24h ago, keyed by market id. */
async function pricesAt(env: Env, cutoff: number): Promise<Map<number, number[]>> {
  const rows = await env.DB.prepare(
    `SELECT market_id, prices FROM trades WHERE id IN (
       SELECT MAX(id) FROM trades WHERE created_at < ? GROUP BY market_id)`,
  )
    .bind(cutoff)
    .all<{ market_id: number; prices: string }>();
  return new Map(rows.results.map((r) => [r.market_id, JSON.parse(r.prices)]));
}

export function summarize(m: MarketRow, before?: number[]): MarketSummary {
  const q = parseQ(m);
  const p = prices(q, m.b);
  const base = before ?? (m.q0 ? prices(JSON.parse(m.q0), m.b) : p);
  return {
    slug: m.slug,
    kind: m.kind,
    category: m.category as MarketSummary["category"],
    title: m.title,
    blurb: m.blurb,
    outcomes: JSON.parse(m.outcomes),
    prices: p,
    change: p.map((x, i) => x - (base[i] ?? x)),
    status: m.status,
    winner: m.winner,
    closesAt: m.closes_at,
    volumeCents: m.volume_cents,
    featured: !!m.featured,
  };
}

export async function listMarkets(env: Env, status: "open" | "resolved" = "open"): Promise<MarketSummary[]> {
  const rows = await env.DB.prepare(
    "SELECT * FROM markets WHERE kind = 'lmsr' AND status = ? ORDER BY featured DESC, volume_cents DESC",
  )
    .bind(status)
    .all<MarketRow>();
  const before = await pricesAt(env, Date.now() - 86_400_000);
  return rows.results.map((m) => summarize(m, before.get(m.id)));
}

export async function recentTrades(env: Env, marketId: number, limit = 20): Promise<Trade[]> {
  const rows = await env.DB.prepare(
    `SELECT u.username AS user, u.is_bot AS bot, t.outcome, t.shares, t.cents, t.created_at AS at
     FROM trades t JOIN users u ON u.id = t.user_id
     WHERE t.market_id = ? ORDER BY t.id DESC LIMIT ?`,
  )
    .bind(marketId, limit)
    .all<Omit<Trade, "bot"> & { bot: number }>();
  return rows.results.map((r) => ({ ...r, bot: !!r.bot }));
}

export async function myPositions(env: Env, userId: number | undefined, marketId: number) {
  if (!userId) return [];
  const rows = await env.DB.prepare(
    "SELECT outcome, shares, cost_cents AS costCents FROM positions WHERE user_id = ? AND market_id = ? AND shares > 0.000001",
  )
    .bind(userId, marketId)
    .all<{ outcome: number; shares: number; costCents: number }>();
  return rows.results;
}

export async function marketDetail(env: Env, slug: string, user: UserRow | null): Promise<MarketDetail> {
  const m = await getMarket(env, slug);
  const [hist, trades, comments, mine, before] = await Promise.all([
    env.DB.prepare(
      "SELECT created_at AS at, prices FROM (SELECT * FROM trades WHERE market_id = ? ORDER BY id DESC LIMIT 400) ORDER BY id",
    )
      .bind(m.id)
      .all<{ at: number; prices: string }>(),
    recentTrades(env, m.id),
    env.DB.prepare(
      `SELECT c.id, u.username AS user, u.is_sal AS isSal, c.body, c.created_at AS at,
         (SELECT o.value FROM positions p, json_each(?2) o
            WHERE p.user_id = c.user_id AND p.market_id = c.market_id AND p.shares > 0.5 AND o.key = p.outcome
            ORDER BY p.shares DESC LIMIT 1) AS holding
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.market_id = ?1 ORDER BY c.id DESC LIMIT 60`,
    )
      .bind(m.id, m.outcomes)
      .all<Omit<Comment, "isSal"> & { isSal: number }>(),
    myPositions(env, user?.id, m.id),
    pricesAt(env, Date.now() - 86_400_000),
  ]);
  const history = hist.results.map((h) => ({ at: h.at, prices: JSON.parse(h.prices) as number[] }));
  if (m.q0) history.unshift({ at: m.created_at, prices: prices(JSON.parse(m.q0), m.b) });
  return {
    ...summarize(m, before.get(m.id)),
    rules: JSON.parse(m.rules),
    b: m.b,
    history,
    trades,
    comments: comments.results.map((c) => ({ ...c, isSal: !!c.isSal })),
    mine,
  };
}

export async function buy(env: Env, user: UserRow, slug: string, outcome: number, cents: number) {
  if (!Number.isInteger(cents) || cents < 1) throw new HttpError(400, "Gotta spend at least a penny.");
  if (cents > MAX_ORDER_CENTS) throw new HttpError(400, "Whoa whoa. Max order is $1,000.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const m = await getMarket(env, slug);
    const now = Date.now();
    if (!isTradable(m, now)) throw new HttpError(409, "Kitchen's closed on dis one.");
    const outcomes: string[] = JSON.parse(m.outcomes);
    if (!Number.isInteger(outcome) || outcome < 0 || outcome >= outcomes.length) throw new HttpError(400, "That ain't on the menu.");
    const q = parseQ(m);
    const shares = sharesForSpend(q, m.b, outcome, cents / 100);
    const nq = q.slice();
    nq[outcome] += shares;
    const after = prices(nq, m.b);
    try {
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET balance_cents = balance_cents - ?1 WHERE id = ?2 AND balance_cents >= ?1").bind(cents, user.id),
        guard(env.DB),
        env.DB.prepare("UPDATE markets SET q = ?, volume_cents = volume_cents + ? WHERE id = ? AND q = ? AND status = 'open'")
          .bind(JSON.stringify(nq), cents, m.id, m.q),
        guard(env.DB),
        env.DB.prepare(
          `INSERT INTO positions (user_id, market_id, outcome, shares, cost_cents) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, market_id, outcome) DO UPDATE SET shares = shares + excluded.shares, cost_cents = cost_cents + excluded.cost_cents`,
        ).bind(user.id, m.id, outcome, shares, cents),
        env.DB.prepare("INSERT INTO trades (user_id, market_id, outcome, shares, cents, prices, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(user.id, m.id, outcome, shares, cents, JSON.stringify(after), now),
        clearGuard(env.DB),
      ]);
      return { shares, cents, prices: after, outcome: outcomes[outcome] };
    } catch (e) {
      if (!isGuardFailure(e)) throw e;
      const bal = await env.DB.prepare("SELECT balance_cents FROM users WHERE id = ?").bind(user.id).first<number>("balance_cents");
      if ((bal ?? 0) < cents) throw new HttpError(409, "You ain't got the dough for that.");
      // someone else traded first; recompute against the new price
    }
  }
  throw new HttpError(409, "It's a madhouse in here. Try again.");
}

export async function sell(env: Env, user: UserRow, slug: string, outcome: number, sharesReq: number) {
  if (!(sharesReq > 0)) throw new HttpError(400, "Sell how many?");
  for (let attempt = 0; attempt < 4; attempt++) {
    const m = await getMarket(env, slug);
    const now = Date.now();
    if (!isTradable(m, now)) throw new HttpError(409, "Kitchen's closed on dis one.");
    const held = await env.DB.prepare("SELECT shares, cost_cents FROM positions WHERE user_id = ? AND market_id = ? AND outcome = ?")
      .bind(user.id, m.id, outcome)
      .first<{ shares: number; cost_cents: number }>();
    if (!held || held.shares < 1e-6) throw new HttpError(409, "You don't own any of dat.");
    const shares = Math.min(sharesReq, held.shares);
    const all = held.shares - shares < 1e-6;
    const q = parseQ(m);
    const cents = Math.floor(proceedsForSell(q, m.b, outcome, shares) * 100);
    const costOut = all ? held.cost_cents : Math.round((held.cost_cents * shares) / held.shares);
    const nq = q.slice();
    nq[outcome] -= shares;
    const after = prices(nq, m.b);
    try {
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE positions SET shares = shares - ?1, cost_cents = cost_cents - ?2 WHERE user_id = ?3 AND market_id = ?4 AND outcome = ?5 AND shares >= ?1 - 0.000001",
        ).bind(shares, costOut, user.id, m.id, outcome),
        guard(env.DB),
        env.DB.prepare("UPDATE markets SET q = ?, volume_cents = volume_cents + ? WHERE id = ? AND q = ? AND status = 'open'")
          .bind(JSON.stringify(nq), cents, m.id, m.q),
        guard(env.DB),
        env.DB.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").bind(cents, user.id),
        env.DB.prepare("INSERT INTO trades (user_id, market_id, outcome, shares, cents, prices, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(user.id, m.id, outcome, -shares, -cents, JSON.stringify(after), now),
        env.DB.prepare("DELETE FROM positions WHERE user_id = ? AND market_id = ? AND outcome = ? AND shares < 0.000001")
          .bind(user.id, m.id, outcome),
        clearGuard(env.DB),
      ]);
      return { shares, cents, prices: after };
    } catch (e) {
      if (!isGuardFailure(e)) throw e;
    }
  }
  throw new HttpError(409, "It's a madhouse in here. Try again.");
}

/** Pay out winners, record losers, close the market. Safe to call twice. */
export async function settle(env: Env, m: MarketRow, winner: number, result?: unknown) {
  const now = Date.now();
  const outcomes: string[] = JSON.parse(m.outcomes);
  const pos = await env.DB.prepare("SELECT user_id, outcome, shares, cost_cents FROM positions WHERE market_id = ? AND shares > 0.000001")
    .bind(m.id)
    .all<{ user_id: number; outcome: number; shares: number; cost_cents: number }>();
  const short = m.title.length > 60 ? m.title.slice(0, 57) + "…" : m.title;
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE markets SET status = 'resolved', winner = ?, resolved_at = ?, result = ? WHERE id = ? AND status = 'open'")
      .bind(winner, now, result === undefined ? null : JSON.stringify(result), m.id),
    guard(env.DB),
  ];
  for (const p of pos.results) {
    if (p.outcome === winner) {
      const pay = Math.round(p.shares * 100);
      stmts.push(env.DB.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").bind(pay, p.user_id));
      stmts.push(
        env.DB.prepare("INSERT INTO ledger (user_id, kind, cents, memo, created_at) VALUES (?, 'payout', ?, ?, ?)")
          .bind(p.user_id, pay, `WON ${outcomes[winner]} · ${short}`, now),
      );
    } else {
      stmts.push(
        env.DB.prepare("INSERT INTO ledger (user_id, kind, cents, memo, created_at) VALUES (?, 'loss', ?, ?, ?)")
          .bind(p.user_id, -p.cost_cents, `LOST ${outcomes[p.outcome]} · ${short}`, now),
      );
    }
  }
  stmts.push(env.DB.prepare("DELETE FROM positions WHERE market_id = ?").bind(m.id));
  stmts.push(clearGuard(env.DB));
  try {
    await env.DB.batch(stmts);
    return true;
  } catch (e) {
    if (isGuardFailure(e)) return false; // already settled by someone else
    throw e;
  }
}

export async function addComment(env: Env, user: UserRow, slug: string, body: string) {
  const text = body.trim().slice(0, 280);
  if (!text) throw new HttpError(400, "Say somethin'.");
  const m = await getMarket(env, slug);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?")
    .bind(user.id, Date.now() - 60_000)
    .first<number>("n");
  if ((recent ?? 0) >= 5) throw new HttpError(409, "Easy, chatterbox. Wait a minute.");
  await env.DB.prepare("INSERT INTO comments (market_id, user_id, body, created_at) VALUES (?, ?, ?, ?)")
    .bind(m.id, user.id, text, Date.now())
    .run();
}
