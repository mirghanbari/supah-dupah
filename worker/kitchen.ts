import { prices } from "../shared/lmsr";
import { BET_MS, lineFor, ROUND_MS, simulateRound, TOSS_B, tosserForRound, TOSSERS, type TossResult } from "../shared/toss";
import type { KitchenState, Standing } from "../shared/types";
import type { Env, MarketRow, UserRow } from "./env";
import { myPositions, recentTrades, settle } from "./markets";

let keyCache: { secret: string; key: CryptoKey } | null = null;

async function roundSeed(env: Env, round: number): Promise<number> {
  if (!env.TOSS_SECRET) throw new Error("TOSS_SECRET is not set");
  if (keyCache?.secret !== env.TOSS_SECRET) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TOSS_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache = { secret: env.TOSS_SECRET, key };
  }
  const sig = await crypto.subtle.sign("HMAC", keyCache.key, new TextEncoder().encode(`round:${round}`));
  return new DataView(sig).getUint32(0);
}

export async function roundResult(env: Env, round: number): Promise<TossResult> {
  return simulateRound(await roundSeed(env, round), tosserForRound(round));
}

export const roundNow = (now: number) => Math.floor(now / ROUND_MS);

export async function ensureRound(env: Env, round: number) {
  const t = tosserForRound(round);
  const line = lineFor(t);
  const start = round * ROUND_MS;
  const q = JSON.stringify([0, 0]);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO markets (slug, kind, category, title, blurb, rules, outcomes, q, q0, b, closes_at, round_no, created_at)
     VALUES (?, 'toss', 'toss', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `toss-${round}`,
      `${t.name} "${t.nick}": over or under ${line} tosses?`,
      `Live from da back kitchen. ${t.joint}.`,
      JSON.stringify([
        ["What's a toss", "The dough leaves both hands and comes back down. Knuckle spins don't count."],
        ["Ceiling contact", "Toss counts. He gets yelled at. Both are final."],
        ["Floor pie", "Dropped dough ends the round at the current count."],
        ["Resolved by", "Tony, standing right there."],
      ]),
      JSON.stringify([`OVER ${line}`, `UNDER ${line}`]),
      q, q, TOSS_B, start + BET_MS, round, start,
    )
    .run();
}

/** Settle every toss round whose show has finished. */
export async function settleDueRounds(env: Env, now: number) {
  const due = await env.DB.prepare(
    "SELECT * FROM markets WHERE kind = 'toss' AND status = 'open' AND round_no < ? ORDER BY round_no LIMIT 10",
  )
    .bind(roundNow(now))
    .all<MarketRow>();
  for (const m of due.results) {
    const round = m.round_no!;
    const t = tosserForRound(round);
    const r = await roundResult(env, round);
    const line = lineFor(t);
    await settle(env, m, r.count > line ? 0 : 1, { tosser: t.id, line, count: r.count, ceilings: r.ceilings, floor: r.floor });
  }
}

export async function kitchenState(env: Env, user: UserRow | null, now: number): Promise<KitchenState> {
  const round = roundNow(now);
  // Reads only, unless this is the first request of a new round.
  let m = await env.DB.prepare("SELECT * FROM markets WHERE round_no = ?").bind(round).first<MarketRow>();
  if (!m) {
    await ensureRound(env, round);
    await settleDueRounds(env, now);
    m = (await env.DB.prepare("SELECT * FROM markets WHERE round_no = ?").bind(round).first<MarketRow>())!;
  }
  const t = tosserForRound(round);
  const showing = now >= m.closes_at!;
  const [trades, mine, recent] = await Promise.all([
    recentTrades(env, m.id, 12),
    myPositions(env, user?.id, m.id),
    env.DB.prepare("SELECT round_no, result FROM markets WHERE kind = 'toss' AND status = 'resolved' AND result IS NOT NULL ORDER BY round_no DESC LIMIT 12")
      .all<{ round_no: number; result: string }>(),
  ]);
  return {
    now,
    current: {
      round,
      slug: m.slug,
      tosser: { id: t.id, name: t.name, nick: t.nick, joint: t.joint, bio: t.bio, color: t.color },
      line: lineFor(t),
      startsAt: round * ROUND_MS,
      closesAt: m.closes_at!,
      endsAt: (round + 1) * ROUND_MS,
      prices: prices(JSON.parse(m.q), m.b),
      volumeCents: m.volume_cents,
      events: showing ? (await roundResult(env, round)).events : null,
      mine,
      trades,
    },
    recent: recent.results.map((r) => {
      const x = JSON.parse(r.result) as { tosser: string; line: number; count: number; floor: boolean; ceilings: number };
      const tt = TOSSERS.find((s) => s.id === x.tosser)!;
      return { round: r.round_no, tosser: tt.name, nick: tt.nick, line: x.line, count: x.count, floor: x.floor, ceilings: x.ceilings, over: x.count > x.line };
    }),
  };
}

export async function standings(env: Env): Promise<Standing[]> {
  const rows = await env.DB.prepare(
    "SELECT result FROM markets WHERE kind = 'toss' AND status = 'resolved' AND result IS NOT NULL ORDER BY round_no DESC LIMIT 2000",
  ).all<{ result: string }>();
  const acc = new Map<string, { pies: number; total: number; best: number; ceilings: number; floors: number; overs: number }>();
  for (const r of rows.results) {
    const x = JSON.parse(r.result) as { tosser: string; line: number; count: number; floor: boolean; ceilings: number };
    const a = acc.get(x.tosser) ?? { pies: 0, total: 0, best: 0, ceilings: 0, floors: 0, overs: 0 };
    a.pies++;
    a.total += x.count;
    a.best = Math.max(a.best, x.count);
    a.ceilings += x.ceilings;
    a.floors += x.floor ? 1 : 0;
    a.overs += x.count > x.line ? 1 : 0;
    acc.set(x.tosser, a);
  }
  return TOSSERS.map((t) => {
    const a = acc.get(t.id) ?? { pies: 0, total: 0, best: 0, ceilings: 0, floors: 0, overs: 0 };
    return {
      id: t.id, name: t.name, nick: t.nick, joint: t.joint, color: t.color, bio: t.bio,
      pies: a.pies, avg: a.pies ? a.total / a.pies : t.mean, best: a.best, ceilings: a.ceilings, floors: a.floors, overs: a.overs,
    };
  }).sort((x, y) => y.avg - x.avg);
}
