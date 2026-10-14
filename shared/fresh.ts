// Fresh markets: every day the shop puts up new bets on tomorrow's real weather.
// A writer (Claude, or the house templates when there's no API key) picks the
// spot, the measurement and the line. Code checks every pick and settles it from
// Open-Meteo, so nothing the writer says can change the money.

export type SpotId = "bensonhurst" | "bay-ridge" | "staten-island" | "arthur-ave" | "hoboken" | "atlantic-city" | "boca" | "columbus";
export type MetricId = "high" | "low" | "rain" | "gust" | "snow";

export const SPOTS: Record<SpotId, { name: string; lat: number; lon: number; note: string }> = {
  bensonhurst: { name: "Bensonhurst", lat: 40.6045, lon: -73.9967, note: "home of the shop" },
  "bay-ridge": { name: "Bay Ridge", lat: 40.634, lon: -74.0287, note: "right by the water, gets the wind" },
  "staten-island": { name: "Staten Island", lat: 40.5795, lon: -74.1502, note: "where Da Kid is from" },
  "arthur-ave": { name: "Arthur Ave", lat: 40.8546, lon: -73.888, note: "the Bronx, Cousin Nicky's turf" },
  hoboken: { name: "Hoboken", lat: 40.744, lon: -74.0324, note: '"Jersey." Frankie\'s side of the river' },
  "atlantic-city": { name: "Atlantic City", lat: 39.3643, lon: -74.4229, note: "where the boardwalk money goes" },
  boca: { name: "Boca", lat: 26.3683, lon: -80.1289, note: "where Tony's aunt retired. always hot" },
  columbus: { name: "Columbus, Ohio", lat: 39.9612, lon: -82.9988, note: "where Some Tourist is from" },
};

export const SPOT_IDS = Object.keys(SPOTS) as SpotId[];

type Metric = {
  label: string; // "high temp"
  field: string; // Open-Meteo daily variable
  unit: string;
  /** How far the line may sit from the forecast and still be a fair bet. */
  window: (forecast: number) => [number, number];
  /** Rough forecast error, for the opening odds. */
  spread: (forecast: number) => number;
  round: (x: number) => number;
};

const half = (x: number) => Math.round(x - 0.5) + 0.5; // 71.2 -> 71.5, so a reading never ties the line

export const METRICS: Record<MetricId, Metric> = {
  high: { label: "high temp", field: "temperature_2m_max", unit: "°F", window: (f) => [f - 6, f + 6], spread: () => 3, round: half },
  low: { label: "overnight low", field: "temperature_2m_min", unit: "°F", window: (f) => [f - 6, f + 6], spread: () => 3, round: half },
  rain: {
    label: "rain total", field: "precipitation_sum", unit: " in",
    window: (f) => [0.01, Math.max(0.5, f * 3)], spread: (f) => Math.max(0.12, f * 0.8), round: (x) => Math.round(x * 100) / 100,
  },
  gust: { label: "top wind gust", field: "wind_gusts_10m_max", unit: " mph", window: (f) => [f - 10, f + 10], spread: () => 5, round: half },
  snow: {
    label: "snowfall", field: "snowfall_sum", unit: " in",
    window: (f) => [0.1, Math.max(1, f * 3)], spread: (f) => Math.max(0.3, f * 0.8), round: (x) => Math.round(x * 10) / 10,
  },
};

export const METRIC_IDS = Object.keys(METRICS) as MetricId[];

/** Tomorrow's forecast for one spot. */
export type SpotForecast = Record<MetricId, number> & { rainChance: number; utcOffsetSec: number };

/** What a writer hands back, before code checks it. */
export type Pick = { spot: string; metric: string; threshold: number; title: string; blurb: string };

/** A pick that passed every check, with everything needed to open and settle it. */
export type FreshMarket = {
  slug: string;
  spot: SpotId;
  metric: MetricId;
  date: string; // YYYY-MM-DD, local to the spot
  threshold: number;
  title: string;
  blurb: string;
  chance: number; // opening price of YES
  closesAt: number;
  settleAfter: number;
  rules: [string, string][];
};

export const FRESH_PER_DAY = 5;
export const MAX_PER_SPOT = 2;

export const fmt = (m: MetricId, x: number) => (m === "high" || m === "low" ? `${x}°F` : `${x}${METRICS[m].unit}`);

/** Snow bets only make sense when it might actually snow. */
export function metricInPlay(m: MetricId, f: SpotForecast) {
  return m !== "snow" || f.snow > 0 || f.low < 34;
}

export const slugFor = (date: string, spot: SpotId, metric: MetricId) => `wx-${date}-${spot}-${metric}`;

/** Day name for a YYYY-MM-DD date, e.g. "Thursday". */
export function dayName(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

/** Normal CDF, close enough for opening odds. */
function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Chance the reading lands over the line, from the forecast. Kept off the extremes so there's a bet. */
export function openingChance(metric: MetricId, line: number, f: SpotForecast) {
  const fc = f[metric];
  let p = phi((fc - line) / METRICS[metric].spread(fc));
  // a "any real rain" line leans on the forecast's own rain chance
  if (metric === "rain" && line <= 0.05) p = (p + f.rainChance / 100) / 2;
  return Math.min(0.9, Math.max(0.1, Math.round(p * 100) / 100));
}

/** Midnight at the start of `date` in a place `utcOffsetSec` from UTC. */
export function localMidnight(date: string, utcOffsetSec: number) {
  return Date.parse(`${date}T00:00:00Z`) - utcOffsetSec * 1000;
}

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Check one pick against the forecast. Returns the market to open, or why it was thrown out.
 * `taken` holds "spot|metric" pairs already on the board for this date; it's updated on success.
 */
export function vet(p: Pick, date: string, forecasts: Partial<Record<SpotId, SpotForecast>>, taken: Set<string>, perSpot: Map<string, number>):
  | { ok: true; market: FreshMarket }
  | { ok: false; why: string } {
  if (!(p.spot in SPOTS)) return { ok: false, why: `unknown spot "${p.spot}"` };
  if (!(p.metric in METRICS)) return { ok: false, why: `unknown measurement "${p.metric}"` };
  const spot = p.spot as SpotId;
  const metric = p.metric as MetricId;
  const f = forecasts[spot];
  if (!f) return { ok: false, why: `no forecast for ${spot}` };
  if (!metricInPlay(metric, f)) return { ok: false, why: `no snow coming in ${spot}` };
  const key = `${spot}|${metric}`;
  if (taken.has(key)) return { ok: false, why: `${key} already on the board` };
  if ((perSpot.get(spot) ?? 0) >= MAX_PER_SPOT) return { ok: false, why: `too many for ${spot}` };
  if (!Number.isFinite(p.threshold)) return { ok: false, why: "line isn't a number" };
  const M = METRICS[metric];
  const line = M.round(p.threshold);
  const [lo, hi] = M.window(f[metric]);
  if (line < lo || line > hi) return { ok: false, why: `line ${line} too far from forecast ${f[metric]}` };
  const title = clean(p.title, 110);
  const blurb = clean(p.blurb, 160);
  if (title.length < 12) return { ok: false, why: "title too short" };
  if (!title.includes(String(line))) return { ok: false, why: `title doesn't state the line ${line}` };
  taken.add(key);
  perSpot.set(spot, (perSpot.get(spot) ?? 0) + 1);
  const closesAt = localMidnight(date, f.utcOffsetSec);
  const S = SPOTS[spot];
  return {
    ok: true,
    market: {
      slug: slugFor(date, spot, metric), spot, metric, date, threshold: line, title, blurb,
      chance: openingChance(metric, line, f),
      closesAt,
      settleAfter: closesAt + 26 * 3_600_000, // the whole day, plus two hours for the numbers to land
      rules: [
        ["Resolves YES", `${S.name}'s ${M.label} on ${dayName(date)} ${date} comes in over ${fmt(metric, line)}.`],
        ["Resolves NO", `It comes in at ${fmt(metric, line)} or under.`],
        ["Source", `Open-Meteo, for ${S.lat.toFixed(2)}, ${S.lon.toFixed(2)}. Tony checks the window, but the computer decides.`],
        ["Trading stops", `Midnight, ${S.name} time, when ${dayName(date)} starts.`],
        ["Settled by", "The computer, automatic. Tony don't touch it."],
      ],
    },
  };
}

/** YES (0) if the reading went over the line, NO (1) otherwise. */
export const winnerFor = (actual: number, line: number) => (actual > line ? 0 : 1);

// ---------- the house writer: templates, used with no API key or when Claude falls over ----------

const TEMPLATES: Record<MetricId, [string, string][]> = {
  high: [
    ["Does {spot} crack {line} on {day}?", "Forecast says {fc}. Tony's knee says different."],
    ["{spot} over {line} on {day}?", "Somebody's gonna be in shorts. Question is who."],
  ],
  low: [
    ["Does {spot} stay over {line} overnight into {day}?", "Low's supposed to be {fc}. Close your windows or don't."],
    ["{spot} overnight low over {line} on {day}?", "The radiator's been making that noise again."],
  ],
  rain: [
    ["More than {line} of rain in {spot} on {day}?", "Forecast says {fc}. Bring the good umbrella, not the bodega one."],
    ["Does {spot} get over {line} of rain on {day}?", "Every time Tony washes the Buick. Every time."],
  ],
  gust: [
    ["Wind gust over {line} in {spot} on {day}?", "Hold onto the pizza boxes. Forecast says {fc}."],
    ["Does {spot} get a gust over {line} on {day}?", "Somebody's awning is goin' for a ride."],
  ],
  snow: [
    ["More than {line} of snow in {spot} on {day}?", "Forecast says {fc}. Tony's already salting the stoop."],
    ["Does {spot} get over {line} of snow on {day}?", "Shovel's in the back. Nobody touch it."],
  ],
};

/** Lines a little off the forecast so they're real bets, not sure things. */
function houseLine(metric: MetricId, fc: number, salt: number) {
  const nudge = { high: [-1.5, 1, 2], low: [-2, 1, -1], rain: [0.05, 0.1, 0.25], gust: [-3, 2, 4], snow: [0.5, 1, 2] }[metric][salt % 3];
  if (metric === "rain") return METRICS.rain.round(Math.max(0.01, fc > 0.05 ? fc + (salt % 2 ? 0.1 : -0.05) : nudge));
  if (metric === "snow") return METRICS.snow.round(Math.max(0.1, fc > 0.3 ? fc : nudge));
  return METRICS[metric].round(fc + nudge);
}

/** Picks from templates, one per spot first, in a shuffle seeded by the date so each day's board differs. */
export function houseWriter(date: string, forecasts: Partial<Record<SpotId, SpotForecast>>, n: number, taken: Set<string>): Pick[] {
  const seed = hash([date], 7);
  const combos: [SpotId, MetricId][] = [];
  for (const s of SPOT_IDS) for (const m of METRIC_IDS) if (forecasts[s] && metricInPlay(m, forecasts[s]!) && !taken.has(`${s}|${m}`)) combos.push([s, m]);
  combos.sort((a, b) => hash(a, seed) - hash(b, seed));
  const out: Pick[] = [];
  const perSpot = new Map<string, number>();
  for (const cap of [1, MAX_PER_SPOT]) {
    for (const [spot, metric] of combos) {
      if (out.length >= n) return out;
      if ((perSpot.get(spot) ?? 0) >= cap || out.some((p) => p.spot === spot && p.metric === metric)) continue;
      perSpot.set(spot, (perSpot.get(spot) ?? 0) + 1);
      const f = forecasts[spot]!;
      const salt = hash([spot, metric], seed);
      const line = houseLine(metric, f[metric], salt);
      const [t, b] = TEMPLATES[metric][salt % TEMPLATES[metric].length];
      const fill = (x: string) =>
        x.replace("{spot}", SPOTS[spot].name).replace("{line}", fmt(metric, line)).replace("{day}", dayName(date)).replace("{fc}", fmt(metric, METRICS[metric].round(f[metric])));
      out.push({ spot, metric, threshold: line, title: fill(t), blurb: fill(b) });
    }
  }
  return out;
}

function hash(parts: string[], seed: number) {
  return [...parts.join("|")].reduce((s, c) => (s * 33 + c.charCodeAt(0)) >>> 0, seed);
}

// ---------- what it costs ----------

export const WRITER_MODEL = "claude-haiku-5-5";
/** Claude Haiku 5.5, prompts up to 100K tokens: dollars per million tokens. */
export const PRICE_PER_MTOK = { input: 0.1, output: 0.5 };

/** Cost of one call in millionths of a dollar. */
export const costMicros = (inputTokens: number, outputTokens: number) =>
  Math.round(inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output);
