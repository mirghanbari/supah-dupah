import { describe, expect, it } from "vitest";
import { FRESH_PER_DAY, houseWriter, localMidnight, MAX_PER_SPOT, openingChance, SPOT_IDS, vet, winnerFor, type SpotForecast, type SpotId } from "./fresh";

const mild: SpotForecast = { high: 71.2, low: 58.4, rain: 0.03, gust: 22.4, snow: 0, rainChance: 30, utcOffsetSec: -4 * 3600 };
const forecasts = Object.fromEntries(SPOT_IDS.map((s) => [s, mild])) as Record<SpotId, SpotForecast>;
const DATE = "2026-10-15";

const fresh = () => ({ taken: new Set<string>(), perSpot: new Map<string, number>() });
const pick = (over: Partial<Parameters<typeof vet>[0]> = {}) => ({
  spot: "bensonhurst", metric: "high", threshold: 71.5, title: "Does Bensonhurst crack 71.5°F on Thursday?", blurb: "Tony's knee says no.", ...over,
});

describe("fresh markets: checking a pick", () => {
  it("accepts a fair pick and builds rules that settle it", () => {
    const { taken, perSpot } = fresh();
    const v = vet(pick(), DATE, forecasts, taken, perSpot);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.market.slug).toBe("wx-2026-10-15-bensonhurst-high");
    expect(v.market.closesAt).toBe(Date.parse("2026-10-15T04:00:00Z")); // midnight in New York
    expect(v.market.settleAfter - v.market.closesAt).toBe(26 * 3_600_000);
    expect(v.market.rules[0][1]).toContain("over 71.5°F");
  });

  it("rounds temperature lines to .5 so a reading can't tie", () => {
    const { taken, perSpot } = fresh();
    const v = vet(pick({ threshold: 72, title: "Bensonhurst over 72.5°F on Thursday?" }), DATE, forecasts, taken, perSpot);
    expect(v.ok && v.market.threshold).toBe(72.5);
  });

  it("throws out lines far from the forecast, unknown spots, and no-snow snow bets", () => {
    const { taken, perSpot } = fresh();
    expect(vet(pick({ threshold: 90.5, title: "Bensonhurst over 90.5°F?" }), DATE, forecasts, taken, perSpot).ok).toBe(false);
    expect(vet(pick({ spot: "paris" }), DATE, forecasts, taken, perSpot).ok).toBe(false);
    expect(vet(pick({ metric: "snow", threshold: 1, title: "More than 1 in of snow in Bensonhurst?" }), DATE, forecasts, taken, perSpot).ok).toBe(false);
  });

  it("throws out a title that doesn't state the line", () => {
    const { taken, perSpot } = fresh();
    expect(vet(pick({ title: "Is it gonna be hot in Bensonhurst Thursday?" }), DATE, forecasts, taken, perSpot).ok).toBe(false);
  });

  it("no repeats, and at most two per spot", () => {
    const { taken, perSpot } = fresh();
    expect(vet(pick(), DATE, forecasts, taken, perSpot).ok).toBe(true);
    expect(vet(pick(), DATE, forecasts, taken, perSpot).ok).toBe(false);
    expect(vet(pick({ metric: "low", threshold: 58.5, title: "Bensonhurst low over 58.5°F?" }), DATE, forecasts, taken, perSpot).ok).toBe(true);
    expect(vet(pick({ metric: "gust", threshold: 22.5, title: "Bensonhurst gust over 22.5 mph?" }), DATE, forecasts, taken, perSpot).ok).toBe(false);
  });
});

describe("fresh markets: odds and settling", () => {
  it("opens near a coin flip when the line sits on the forecast, and leans with it", () => {
    expect(openingChance("high", 71.5, mild)).toBeGreaterThan(0.4);
    expect(openingChance("high", 71.5, mild)).toBeLessThan(0.6);
    expect(openingChance("high", 66.5, mild)).toBeGreaterThan(0.8);
    expect(openingChance("high", 76.5, mild)).toBeLessThan(0.2);
    expect(openingChance("high", 40.5, mild)).toBe(0.9); // never a sure thing
  });

  it("YES only when the reading goes over the line", () => {
    expect(winnerFor(71.6, 71.5)).toBe(0);
    expect(winnerFor(71.5, 71.5)).toBe(1);
    expect(winnerFor(0, 0.01)).toBe(1);
  });

  it("knows midnight in other time zones", () => {
    expect(localMidnight("2026-10-15", -5 * 3600)).toBe(Date.parse("2026-10-15T05:00:00Z"));
  });
});

describe("fresh markets: the house writer", () => {
  it("fills a full day of picks that all pass the checks", () => {
    const { taken, perSpot } = fresh();
    const picks = houseWriter(DATE, forecasts, FRESH_PER_DAY, new Set());
    expect(picks).toHaveLength(FRESH_PER_DAY);
    for (const p of picks) {
      const v = vet(p, DATE, forecasts, taken, perSpot);
      expect(v.ok, v.ok ? "" : v.why).toBe(true);
    }
    expect(Math.max(...perSpot.values())).toBeLessThanOrEqual(MAX_PER_SPOT);
  });

  it("skips what's already on the board", () => {
    const taken = new Set(["bensonhurst|high", "boca|rain"]);
    const picks = houseWriter(DATE, forecasts, FRESH_PER_DAY, taken);
    expect(picks.some((p) => `${p.spot}|${p.metric}` === "bensonhurst|high")).toBe(false);
  });
});
