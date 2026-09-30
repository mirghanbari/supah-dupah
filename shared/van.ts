// Truck futures. Each contract's price is a random walk built from secret per-minute
// shocks (see worker/vanPricing.ts), so nobody can compute tomorrow's price from the code.
// This file only knows how to turn a stream of shocks into a price.

export type Contract = {
  symbol: string;
  goods: string;
  base: number;
  swing: number;
  chop: number;
  halted?: boolean;
};

export const CONTRACTS: Contract[] = [
  { symbol: "DISC-DEC96", goods: "Portable CD players (anti-skip, mostly)", base: 62, swing: 18, chop: 8 },
  { symbol: "TMGT-MAY97", goods: "Virtual pets (some still alive)", base: 78, swing: 16, chop: 10 },
  { symbol: "N64-NOV96", goods: "Game consoles, the gray kind", base: 80, swing: 10, chop: 5 },
  { symbol: "J11-SZ9½", goods: "Basketball sneakers, size 9½ only", base: 66, swing: 14, chop: 7 },
  { symbol: "STRT-FEB97", goods: "Team jackets, assorted (mostly Hornets)", base: 36, swing: 12, chop: 5 },
  { symbol: "BEAN-PRNC", goods: 'Bean-bag bears, purple, "limited"', base: 52, swing: 22, chop: 9 },
  { symbol: "PAGR-2WAY", goods: "Two-way pagers, clip included", base: 48, swing: 9, chop: 6 },
  { symbol: "BOOT-LEFT", goods: "Tan work boots, 6-inch, left feet only", base: 14, swing: 7, chop: 3 },
  { symbol: '"RLX"-SPOT', goods: '"Luxury" watches (quotation marks included)', base: 12, swing: 10, chop: 6 },
  { symbol: "VHS-TTNC", goods: "Big boat movie, 2-tape set, sealed-ish", base: 50, swing: 0, chop: 0, halted: true },
];

export const HALT_REASONS = [
  "HALTED: STILL FALLIN'",
  "HALTED: COPS ON DA BLOCK",
  "HALTED: VAN DOUBLE-PARKED",
  "HALTED: TONY'S ON DA PHONE",
  "HALTED: NOBODY KNOWS NOTHIN'",
];

export function contract(symbol: string): Contract | undefined {
  return CONTRACTS.find((c) => c.symbol === symbol);
}

/** Minute-level shocks decay slowly; half-hour "new shipment" shocks set the bigger swings. */
export const FAST = { lambda: 0.985, window: 300 };
export const SLOW = { lambda: 0.85, window: 30, minutes: 30 };
const FAST_STD = Math.sqrt(1 / 3 / (1 - FAST.lambda ** 2));
const SLOW_STD = Math.sqrt(1 / 3 / (1 - SLOW.lambda ** 2));

/** A shock in [-1, 1] for the given stream and index (minute for "fast", half-hour for "slow"). */
export type Shocks = (stream: "fast" | "slow", index: number) => number;

export const minuteOf = (t: number) => Math.floor(t / 60_000);

export function priceAt(c: Contract, minute: number, shock: Shocks): number {
  let fast = 0;
  let w = 1;
  for (let i = 0; i < FAST.window; i++, w *= FAST.lambda) fast += w * shock("fast", minute - i);
  const half = Math.floor(minute / SLOW.minutes);
  let slow = 0;
  w = 1;
  for (let j = 0; j < SLOW.window; j++, w *= SLOW.lambda) slow += w * shock("slow", half - j);
  const p = c.base + c.swing * 0.9 * (slow / SLOW_STD) + c.chop * 0.8 * (fast / FAST_STD);
  return Math.max(2, Math.min(98, Math.round(p)));
}

export function haltReason(t: number): string {
  return HALT_REASONS[Math.floor(t / 600_000) % HALT_REASONS.length];
}

export function heat(change: number, price: number): { label: string; level: 0 | 1 | 2 | 3 | 4 } {
  if (price <= 15 && change < 0) return { label: "Turned green", level: 0 };
  if (price >= 92) return { label: "Limit up", level: 4 };
  if (change >= 8) return { label: "Scorching", level: 3 };
  if (change >= 2) return { label: "Hot", level: 2 };
  if (change > -4) return { label: "Warm", level: 1 };
  return { label: "Cold", level: 0 };
}
