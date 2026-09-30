import { contract, CONTRACTS, haltReason, heat } from "../shared/van";
import type { VanPosition, VanRow } from "../shared/types";
import { clearGuard, guard, HttpError, isGuardFailure, type Env, type UserRow } from "./env";
import { vanHistory, vanPrice } from "./vanPricing";

type Row = { id: number; symbol: string; side: "long" | "short"; boxes: number; entry_cents: number; opened_at: number };

export const boxCost = (side: "long" | "short", price: number) => (side === "long" ? price : 100 - price);

export async function markPosition(env: Env, r: Row, now: number): Promise<VanPosition> {
  const c = contract(r.symbol)!;
  const mark = c.halted ? r.entry_cents : await vanPrice(env, c, now);
  const pnl = (boxCost(r.side, mark) - boxCost(r.side, r.entry_cents)) * r.boxes;
  return { id: r.id, symbol: r.symbol, side: r.side, boxes: r.boxes, entryCents: r.entry_cents, markCents: mark, pnlCents: pnl, openedAt: r.opened_at };
}

export async function vanBoard(env: Env, now: number): Promise<VanRow[]> {
  const oi = await env.DB.prepare(
    "SELECT symbol, SUM(boxes) AS boxes, COUNT(DISTINCT user_id) AS guys FROM van_positions WHERE closed_at IS NULL GROUP BY symbol",
  ).all<{ symbol: string; boxes: number; guys: number }>();
  const bySym = new Map(oi.results.map((r) => [r.symbol, r]));
  return Promise.all(CONTRACTS.map(async (c) => {
    const history = await vanHistory(env, c, now, 120);
    const price = history[history.length - 1];
    const change = price - history[history.length - 61];
    return {
      symbol: c.symbol,
      goods: c.goods,
      price,
      change: c.halted ? 0 : change,
      history,
      heat: c.halted ? { label: "Halted", level: 4 } : heat(change, price),
      halted: c.halted ? haltReason(now) : null,
      boxes: bySym.get(c.symbol)?.boxes ?? 0,
      guys: bySym.get(c.symbol)?.guys ?? 0,
    };
  }));
}

export async function myVan(env: Env, userId: number, now: number): Promise<VanPosition[]> {
  const rows = await env.DB.prepare(
    "SELECT id, symbol, side, boxes, entry_cents, opened_at FROM van_positions WHERE user_id = ? AND closed_at IS NULL ORDER BY id DESC",
  )
    .bind(userId)
    .all<Row>();
  return Promise.all(rows.results.map((r) => markPosition(env, r, now)));
}

export async function openVan(env: Env, user: UserRow, symbol: string, side: string, boxes: number) {
  const c = contract(symbol);
  if (!c) throw new HttpError(404, "We don't carry that.");
  if (c.halted) throw new HttpError(409, haltReason(Date.now()));
  if (side !== "long" && side !== "short") throw new HttpError(400, "Long or short. Pick one.");
  if (!Number.isInteger(boxes) || boxes < 1 || boxes > 500) throw new HttpError(400, "1 to 500 boxes. The van only holds so much.");
  const now = Date.now();
  const price = await vanPrice(env, c, now);
  const cost = boxCost(side, price) * boxes;
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance_cents = balance_cents - ?1 WHERE id = ?2 AND balance_cents >= ?1").bind(cost, user.id),
      guard(env.DB),
      env.DB.prepare("INSERT INTO van_positions (user_id, symbol, side, boxes, entry_cents, opened_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.id, symbol, side, boxes, price, now),
      clearGuard(env.DB),
    ]);
  } catch (e) {
    if (isGuardFailure(e)) throw new HttpError(409, "You ain't got the dough for that.");
    throw e;
  }
  return { price, cost };
}

export async function closeVan(env: Env, user: UserRow, id: number) {
  const r = await env.DB.prepare("SELECT id, symbol, side, boxes, entry_cents, opened_at FROM van_positions WHERE id = ? AND user_id = ? AND closed_at IS NULL")
    .bind(id, user.id)
    .first<Row>();
  if (!r) throw new HttpError(404, "No such position. You sure?");
  const c = contract(r.symbol)!;
  const now = Date.now();
  if (c.halted) throw new HttpError(409, haltReason(now));
  const mark = await markPosition(env, r, now);
  const proceeds = boxCost(r.side, mark.markCents) * r.boxes;
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE van_positions SET exit_cents = ?, closed_at = ?, pnl_cents = ? WHERE id = ? AND closed_at IS NULL")
        .bind(mark.markCents, now, mark.pnlCents, id),
      guard(env.DB),
      env.DB.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").bind(proceeds, user.id),
      env.DB.prepare("INSERT INTO ledger (user_id, kind, cents, memo, created_at) VALUES (?, 'van', ?, ?, ?)")
        .bind(user.id, mark.pnlCents, `${r.side.toUpperCase()} ${r.boxes} BX ${r.symbol} @${r.entry_cents}→${mark.markCents}`, now),
      clearGuard(env.DB),
    ]);
  } catch (e) {
    if (isGuardFailure(e)) throw new HttpError(409, "Already closed.");
    throw e;
  }
  return { ...mark, proceeds };
}
