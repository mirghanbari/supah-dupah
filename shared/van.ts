import { hashStr, mulberry32 } from "./rng";

// Truck futures. Prices are public and deterministic: a slow wave, a faster wave,
// and hashed noise knotted every 5 minutes, all in cents between 2 and 98.

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
  "HALTED: SAL'S ON DA PHONE",
  "HALTED: NOBODY KNOWS NOTHIN'",
];

export function contract(symbol: string): Contract | undefined {
  return CONTRACTS.find((c) => c.symbol === symbol);
}

function knot(symbol: string, k: number): number {
  return mulberry32(hashStr(symbol) ^ Math.imul(k, 2654435761))() * 2 - 1;
}

export function vanPrice(c: Contract, t: number): number {
  const m = t / 60_000;
  const phase = (hashStr(c.symbol) % 1000) / 159;
  const k = Math.floor(m / 5);
  const f = m / 5 - k;
  const smooth = f * f * (3 - 2 * f);
  const noise = knot(c.symbol, k) * (1 - smooth) + knot(c.symbol, k + 1) * smooth;
  const p = c.base + c.swing * Math.sin(m / 180 + phase) + c.swing * 0.5 * Math.sin(m / 23 + phase * 2) + c.chop * noise;
  return Math.max(2, Math.min(98, Math.round(p)));
}

export function haltReason(t: number): string {
  return HALT_REASONS[Math.floor(t / 600_000) % HALT_REASONS.length];
}

/** Minute-by-minute history ending at t. */
export function vanHistory(c: Contract, t: number, minutes: number): number[] {
  const end = Math.floor(t / 60_000) * 60_000;
  const out: number[] = [];
  for (let i = minutes - 1; i >= 0; i--) out.push(vanPrice(c, end - i * 60_000));
  return out;
}

export function heat(change: number, price: number): { label: string; level: 0 | 1 | 2 | 3 | 4 } {
  if (price <= 15 && change < 0) return { label: "Turned green", level: 0 };
  if (price >= 92) return { label: "Limit up", level: 4 };
  if (change >= 8) return { label: "Scorching", level: 3 };
  if (change >= 2) return { label: "Hot", level: 2 };
  if (change > -4) return { label: "Warm", level: 1 };
  return { label: "Cold", level: 0 };
}
