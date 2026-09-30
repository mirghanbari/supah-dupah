import { prices } from "../shared/lmsr";
import { fairOver, tosserForRound } from "../shared/toss";
import { CONTRACTS } from "../shared/van";
import type { Env, MarketRow, UserRow } from "./env";
import { ensureRound, roundNow, settleDueRounds } from "./kitchen";
import { buy, sell } from "./markets";
import { closeVan, openVan } from "./van";

const TICK_MS = 15_000;

const CHATTER = [
  "i got a guy who says YES. my guy is never wrong. except the one time",
  "whoever's on the other side of this, i feel bad for ya",
  "sal if you're reading this, the garlic knots were cold yesterday",
  "this is a lock. LOCK. put the house on it (don't put the house on it)",
  "my cousin works at the dmv he says this is fixed",
  "fuhgeddaboudit. easy money",
  "i been watchin this since '81, trust me",
  "who keeps buyin the other side?? show yourself",
  "bada bing. that's all i'm gonna say",
  "ma if you see this call me back",
  "is dis the line for the bathroom",
  "the price on this is a disgrace. a DISGRACE",
  "all in. well, half in. ok like a quarter",
  "i asked the lady by the window. she nodded. that's a yes",
  "somebody tell the tourist he's doin it wrong",
];

const TOSS_CHATTER = [
  "he's got that look in his eye today",
  "his wrists r shot since the softball thing. UNDER",
  "watch the ceiling fan, it's on HIGH",
  "flour on the counter is thin today. that's bad for tossin",
  "he tossed 11 on tuesday. ELEVEN",
];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const dollars = (lo: number, hi: number) => Math.round((lo + Math.random() * (hi - lo)) * 100);

export async function maybeTick(env: Env, now: number) {
  const last = await env.DB.prepare("SELECT value FROM meta WHERE key = 'last_tick'").first<string>("value");
  if (last == null || now - Number(last) < TICK_MS) return;
  const claimed = await env.DB.prepare("UPDATE meta SET value = ? WHERE key = 'last_tick' AND value = ?").bind(String(now), last).run();
  if (!claimed.meta.changes) return;
  await tick(env, now);
}

export async function tick(env: Env, now: number) {
  const round = roundNow(now);
  await ensureRound(env, round);
  await settleDueRounds(env, now);

  const bots = (
    await env.DB.prepare("SELECT id, username, balance_cents, is_sal, is_bot, hood, last_bailout FROM users WHERE is_bot = 1").all<UserRow>()
  ).results;
  if (!bots.length) return;
  await env.DB.prepare("UPDATE users SET balance_cents = 500000 WHERE is_bot = 1 AND balance_cents < 50000").run();

  const jobs: Promise<unknown>[] = [];

  // The live toss: regulars push the price toward what they think is fair.
  // One at a time, re-reading the price, so they don't all pile onto the same side.
  let toss = await env.DB.prepare("SELECT * FROM markets WHERE round_no = ?").bind(round).first<MarketRow>();
  if (toss && now < toss.closes_at! - 3000) {
    const fair = fairOver(tosserForRound(round));
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n && toss; i++) {
      const belief = fair + (Math.random() - 0.5) * 0.3;
      const p = prices(JSON.parse(toss.q), toss.b)[0];
      if (Math.abs(belief - p) > 0.03) await buy(env, pick(bots), toss.slug, belief > p ? 0 : 1, dollars(1, 12)).catch(() => {});
      toss = await env.DB.prepare("SELECT * FROM markets WHERE round_no = ?").bind(round).first<MarketRow>();
    }
    if (toss && Math.random() < 0.15) jobs.push(comment(env, pick(bots), toss.id, pick(TOSS_CHATTER), now));
  }

  // Regular markets drift as the regulars change their minds.
  const open = (await env.DB.prepare("SELECT * FROM markets WHERE kind = 'lmsr' AND status = 'open' AND (closes_at IS NULL OR closes_at > ?)").bind(now).all<MarketRow>()).results;
  for (let i = 0; i < 2 && open.length; i++) {
    const m = pick(open);
    const bot = pick(bots);
    const outcomes = JSON.parse(m.outcomes) as string[];
    if (Math.random() < 0.2) {
      const held = await env.DB.prepare("SELECT outcome, shares FROM positions WHERE user_id = ? AND market_id = ? AND shares > 1 LIMIT 1")
        .bind(bot.id, m.id)
        .first<{ outcome: number; shares: number }>();
      if (held) {
        jobs.push(sell(env, bot, m.slug, held.outcome, held.shares * (0.3 + Math.random() * 0.7)));
        continue;
      }
    }
    jobs.push(buy(env, bot, m.slug, Math.floor(Math.random() * outcomes.length), dollars(1, 9)));
  }
  if (open.length && Math.random() < 0.08) {
    const m = pick(open);
    jobs.push(comment(env, pick(bots), m.id, pick(CHATTER), now));
  }

  // A few guys work the van.
  if (Math.random() < 0.35) {
    const c = pick(CONTRACTS.filter((x) => !x.halted));
    jobs.push(openVan(env, pick(bots), c.symbol, Math.random() < 0.6 ? "long" : "short", 1 + Math.floor(Math.random() * 12)));
  }
  const stale = await env.DB.prepare(
    "SELECT v.id, v.user_id FROM van_positions v JOIN users u ON u.id = v.user_id WHERE u.is_bot = 1 AND v.closed_at IS NULL AND v.opened_at < ? LIMIT 2",
  )
    .bind(now - 40 * 60_000)
    .all<{ id: number; user_id: number }>();
  for (const s of stale.results) {
    const bot = bots.find((b) => b.id === s.user_id);
    if (bot) jobs.push(closeVan(env, bot, s.id));
  }

  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected" && !(r.reason instanceof Error && "status" in r.reason)) console.error("bot job failed", r.reason);
}

async function comment(env: Env, bot: UserRow, marketId: number, body: string, now: number) {
  await env.DB.prepare("INSERT INTO comments (market_id, user_id, body, created_at) VALUES (?, ?, ?, ?)").bind(marketId, bot.id, body, now).run();
}
