import { describe, expect, it } from "vitest";
import { ASSET_IDS, MAX_PER_ASSET, MONEY_PER_DAY, moneyChance, moneyHouseWriter, nextTradingDay, nyTime, roundLine, vetMoney, type AssetId, type Quote } from "./money";

const PRICES: Record<AssetId, number> = {
  spy: 683.12, dia: 462.4, qqq: 601.77, uso: 74.31, gld: 312.06, aapl: 251.9, msft: 512.33, nvda: 188.45, tsla: 431.2, amzn: 226.7, btc: 83461.97, eth: 3120.5,
};
const quotes = Object.fromEntries(ASSET_IDS.map((a) => [a, { close: PRICES[a], date: "2026-10-14", weekAgo: PRICES[a] * 0.98 }])) as Record<AssetId, Quote>;
const DATE = "2026-10-15"; // a Thursday

const fresh = () => ({ taken: new Set<string>(), perAsset: new Map<string, number>() });

describe("money markets: the calendar", () => {
  it("skips weekends and market holidays", () => {
    expect(nextTradingDay("2026-10-14")).toBe("2026-10-15");
    expect(nextTradingDay("2026-10-16")).toBe("2026-10-19"); // Friday -> Monday
    expect(nextTradingDay("2026-11-25")).toBe("2026-11-27"); // over Thanksgiving
  });

  it("knows New York time in summer and winter", () => {
    expect(nyTime("2026-10-15", 9, 30)).toBe(Date.parse("2026-10-15T13:30:00Z"));
    expect(nyTime("2026-12-15", 9, 30)).toBe(Date.parse("2026-12-15T14:30:00Z"));
  });
});

describe("money markets: checking a pick", () => {
  it("accepts a fair pick, closing at the open and settling after 6pm", () => {
    const { taken, perAsset } = fresh();
    const v = vetMoney({ asset: "spy", threshold: 683.5, title: "Does SPY close over $683.50 on Thursday?", blurb: "Paulie's in." }, DATE, quotes, taken, perAsset);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.market.closesAt).toBe(Date.parse("2026-10-15T13:30:00Z"));
    expect(v.market.settleAfter).toBe(Date.parse("2026-10-15T22:00:00Z"));
    expect(v.market.rules[0][1]).toContain("over $683.50");
  });

  it("rounds lines so a close can't tie, and reads crypto lines with commas", () => {
    expect(roundLine("spy", 683)).toBe(683.5);
    expect(roundLine("btc", 83_461)).toBe(83_500);
    const { taken, perAsset } = fresh();
    expect(vetMoney({ asset: "btc", threshold: 83_500, title: "Bitcoin over $83,500 at 4pm Thursday?", blurb: "" }, DATE, quotes, taken, perAsset).ok).toBe(true);
  });

  it("throws out far-off lines, lines crowding another, and a third bet on one asset", () => {
    const { taken, perAsset } = fresh();
    const p = (threshold: number) => ({ asset: "aapl", threshold, title: `AAPL over $${threshold.toFixed(2)} on Thursday?`, blurb: "" });
    expect(vetMoney(p(300.5), DATE, quotes, taken, perAsset).ok).toBe(false); // way off
    expect(vetMoney(p(251.5), DATE, quotes, taken, perAsset).ok).toBe(true);
    expect(vetMoney(p(252.5), DATE, quotes, taken, perAsset).ok).toBe(false); // too close to 251.50
    expect(vetMoney(p(255.5), DATE, quotes, taken, perAsset).ok).toBe(true);
    expect(vetMoney(p(248.5), DATE, quotes, taken, perAsset).ok).toBe(false); // already two
  });

  it("opens near a coin flip at the last close", () => {
    expect(moneyChance("spy", 683.5, quotes.spy)).toBeGreaterThan(0.4);
    expect(moneyChance("spy", 683.5, quotes.spy)).toBeLessThan(0.6);
    expect(moneyChance("spy", 700.5, quotes.spy)).toBe(0.1);
  });
});

describe("money markets: the house writer", () => {
  it("fills a full day of picks that all pass the checks", () => {
    const { taken, perAsset } = fresh();
    const picks = moneyHouseWriter(DATE, quotes, MONEY_PER_DAY, new Set());
    expect(picks).toHaveLength(MONEY_PER_DAY);
    for (const p of picks) {
      const v = vetMoney(p, DATE, quotes, taken, perAsset);
      expect(v.ok, v.ok ? "" : v.why).toBe(true);
    }
    expect(Math.max(...perAsset.values())).toBeLessThanOrEqual(MAX_PER_ASSET);
  });

  it("still makes picks with only crypto prices", () => {
    const only = { btc: quotes.btc, eth: quotes.eth };
    expect(moneyHouseWriter(DATE, only, MONEY_PER_DAY, new Set())).toHaveLength(4);
  });
});
