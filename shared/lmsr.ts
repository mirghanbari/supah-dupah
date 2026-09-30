// Logarithmic market scoring rule. Every share pays $1 (100¢) if its outcome wins.
// Quantities and costs are in dollars here; callers convert to cents at the edges.

function logSumExp(xs: number[]): number {
  const m = Math.max(...xs);
  return m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0));
}

export function cost(q: number[], b: number): number {
  return b * logSumExp(q.map((x) => x / b));
}

export function prices(q: number[], b: number): number[] {
  const m = Math.max(...q.map((x) => x / b));
  const e = q.map((x) => Math.exp(x / b - m));
  const s = e.reduce((a, c) => a + c, 0);
  return e.map((x) => x / s);
}

/** Shares of outcome i that `dollars` buys. */
export function sharesForSpend(q: number[], b: number, i: number, dollars: number): number {
  const m = Math.max(...q.map((x) => x / b));
  const e = q.map((x) => Math.exp(x / b - m));
  const s = e.reduce((a, c) => a + c, 0);
  const ratio = (s * Math.exp(dollars / b) - s + e[i]) / e[i];
  return b * Math.log(ratio);
}

/** Dollars received for selling `shares` of outcome i. */
export function proceedsForSell(q: number[], b: number, i: number, shares: number): number {
  const after = q.slice();
  after[i] -= shares;
  return cost(q, b) - cost(after, b);
}

/** Starting quantities that produce the given probabilities. */
export function qForPrices(p: number[], b: number): number[] {
  return p.map((x) => b * Math.log(Math.max(x, 1e-6)));
}
