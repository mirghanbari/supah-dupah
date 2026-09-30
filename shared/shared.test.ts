import { describe, expect, it } from "vitest";
import { cost, prices, proceedsForSell, qForPrices, sharesForSpend } from "./lmsr";
import { fairOver, INTRO_MS, SHOW_MS, simulateRound, TOSSERS } from "./toss";
import { CONTRACTS, vanPrice } from "./van";

describe("lmsr", () => {
  it("prices sum to one and match the opening odds", () => {
    const q = qForPrices([0.74, 0.26], 80);
    const p = prices(q, 80);
    expect(p[0] + p[1]).toBeCloseTo(1, 10);
    expect(p[0]).toBeCloseTo(0.74, 6);
  });

  it("spending $X costs exactly $X", () => {
    const q = qForPrices([0.3, 0.5, 0.2], 60);
    const s = sharesForSpend(q, 60, 1, 12.5);
    const after = q.slice();
    after[1] += s;
    expect(cost(after, 60) - cost(q, 60)).toBeCloseTo(12.5, 8);
  });

  it("buying then selling the same shares is a wash", () => {
    const q = [0, 0];
    const s = sharesForSpend(q, 40, 0, 10);
    const after = [s, 0];
    expect(proceedsForSell(after, 40, 0, s)).toBeCloseTo(10, 8);
  });

  it("buying pushes the price up", () => {
    const q = [0, 0];
    const s = sharesForSpend(q, 40, 0, 10);
    expect(prices([s, 0], 40)[0]).toBeGreaterThan(0.5);
  });
});

describe("toss simulator", () => {
  it("is deterministic per seed", () => {
    expect(simulateRound(1234, TOSSERS[0])).toEqual(simulateRound(1234, TOSSERS[0]));
  });

  it("fits every show inside the round and counts tosses correctly", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const t = TOSSERS[seed % TOSSERS.length];
      const r = simulateRound(seed * 7919, t);
      const last = r.events[r.events.length - 1];
      expect(last.kind).toBe("done");
      expect(last.t).toBeLessThan(SHOW_MS);
      expect(r.events[0].t).toBe(INTRO_MS);
      const tosses = r.events.filter((e) => e.kind === "toss").length;
      expect(tosses).toBe(r.count);
      expect(r.floor).toBe(r.events.some((e) => e.kind === "floor"));
    }
  });

  it("gives the bots a sensible fair price", () => {
    for (const t of TOSSERS) {
      const f = fairOver(t);
      expect(f).toBeGreaterThan(0.05);
      expect(f).toBeLessThan(0.95);
    }
  });
});

describe("van prices", () => {
  it("stay between 2¢ and 98¢", () => {
    for (const c of CONTRACTS) {
      for (let m = 0; m < 5000; m += 7) {
        const p = vanPrice(c, 1_790_000_000_000 + m * 60_000);
        expect(p).toBeGreaterThanOrEqual(2);
        expect(p).toBeLessThanOrEqual(98);
      }
    }
  });
});
