import type { PickResult, PickState } from "../shared/types";
import { clearGuard, guard, HttpError, isGuardFailure, type Env, type UserRow } from "./env";

// You pick 1-10 and the sign only ever shows 1-10, but only 1 play in `odds` wins.
export const PICK = { lo: 1, hi: 10, odds: 100, multiplier: 100, maxCents: 10_000 };

/** Uniform 1..n from the platform CSPRNG (rejection sampling, no modulo bias). */
function draw(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return (buf[0] % n) + 1;
}

export async function playPick(env: Env, user: UserRow, pick: number, cents: number): Promise<PickResult> {
  if (!Number.isInteger(pick) || pick < PICK.lo || pick > PICK.hi) throw new HttpError(400, `Pick a number, ${PICK.lo} to ${PICK.hi}. It ain't hard.`);
  if (!Number.isInteger(cents) || cents < 1) throw new HttpError(400, "Gotta bet at least a penny.");
  if (cents > PICK.maxCents) throw new HttpError(400, "Max bet's a hundred bucks. Tony ain't made of money. (He is.)");

  const win = draw(PICK.odds) === 1;
  // on a loss, Tony "draws" one of the other nine numbers, evenly
  const other = draw(PICK.hi - PICK.lo);
  const tony = win ? pick : other >= pick ? other + 1 : other;
  const payout = win ? cents * PICK.multiplier : 0;
  const now = Date.now();
  const memo = win ? `PICK ${pick} · TONY DREW ${tony} · WINNER` : `PICK ${pick} · TONY DREW ${tony}`;
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance_cents = balance_cents - ?1 + ?2 WHERE id = ?3 AND balance_cents >= ?1").bind(cents, payout, user.id),
      guard(env.DB),
      env.DB.prepare("INSERT INTO picks (user_id, pick, draw, bet_cents, payout_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.id, pick, tony, cents, payout, now),
      env.DB.prepare("INSERT INTO ledger (user_id, kind, cents, memo, created_at) VALUES (?, 'pick', ?, ?, ?)").bind(user.id, payout - cents, memo, now),
      clearGuard(env.DB),
    ]);
  } catch (e) {
    if (isGuardFailure(e)) throw new HttpError(409, "You ain't got the dough for that.");
    throw e;
  }
  const bal = await env.DB.prepare("SELECT balance_cents FROM users WHERE id = ?").bind(user.id).first<number>("balance_cents");
  return { pick, draw: tony, win, close: Math.abs(tony - pick) === 1, betCents: cents, payoutCents: payout, balanceCents: bal ?? 0 };
}

export async function pickState(env: Env, user: UserRow | null): Promise<PickState> {
  const [recent, mine] = await Promise.all([
    env.DB.prepare(
      `SELECT u.username AS user, p.pick, p.draw, p.bet_cents AS betCents, p.payout_cents AS payoutCents, p.created_at AS at
       FROM picks p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 12`,
    ).all<PickState["recent"][number]>(),
    user
      ? env.DB.prepare(
          `SELECT COUNT(*) AS plays, COALESCE(SUM(payout_cents > 0), 0) AS wins,
             COALESCE(SUM(ABS(draw - pick) = 1), 0) AS closeCalls, COALESCE(SUM(payout_cents - bet_cents), 0) AS netCents
           FROM picks WHERE user_id = ?`,
        )
          .bind(user.id)
          .first<NonNullable<PickState["mine"]>>()
      : Promise.resolve(null),
  ]);
  return { recent: recent.results, mine };
}
