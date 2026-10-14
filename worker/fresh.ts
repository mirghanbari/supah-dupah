import Anthropic from "@anthropic-ai/sdk";
import {
  costMicros, dayName, FRESH_PER_DAY, houseWriter, METRIC_IDS, METRICS, metricInPlay, SPOT_IDS, SPOTS, vet, winnerFor, WRITER_MODEL,
  type MetricId, type Pick, type SpotForecast, type SpotId,
} from "../shared/fresh";
import { qForPrices } from "../shared/lmsr";
import {
  ASSET_IDS, ASSETS, FUNDS, isTradingDay, MONEY_PER_DAY, moneyHouseWriter, nextTradingDay, nyTime, vetMoney,
  type AssetId, type MoneyPick, type Quote,
} from "../shared/money";
import type { FreshKind, FreshReport, FreshRun } from "../shared/types";
import type { Env, MarketRow } from "./env";
import { settle } from "./markets";

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** The weather batch goes up at 9am New York time, the money batch at 6pm once the market's closed. */
const WEATHER_HOUR = 9;
const MONEY_HOUR = 18;

const nyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });

function nyParts(now: number) {
  const p = Object.fromEntries(nyFormat.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** The day each kind of batch bets on: tomorrow for weather, the next trading day for money. */
export const nextFor = (now: number, kind: FreshKind) => (kind === "weather" ? nyParts(now + DAY).date : nextTradingDay(nyParts(now).date));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- the writer (shared by both kinds) ----------

const VOICE = `You write the daily bets for Supah Dupah, a parody prediction market run out of a 1990s Brooklyn pizza shop by a guy named Tony. It's play money only. Each bet is a yes/no question: will a real number come in over a line you set?

Voice: a wisecracking regular at the counter. Short, warm, a little ridiculous: Tony's Buick, the guy from Jersey, the stoop, the ceiling fan, cousins with opinions. Never mention real people or other betting sites. Nothing mean about a place, a company, or the people in them. Never give advice; the jokes are about the shop, not about anybody's money.

Titles sound like somebody asking the room, in the shop's voice, and no two start the same way. Mix it up: "Does Bensonhurst crack 71.5°F Thursday?", "Tesla over $368.50 at the bell Thursday?", "Gonna get a gust over 30.5 mph in Bay Ridge Friday?". Use the day name only, never the date.`;

type Asked = { json: unknown; inputTokens: number; outputTokens: number; error: string | null };

async function askClaude(apiKey: string, system: string, prompt: string, schema: Record<string, unknown>): Promise<Asked> {
  const client = new Anthropic({ apiKey, timeout: 90_000 });
  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model: WRITER_MODEL,
      max_tokens: 10_000,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    const why =
      e instanceof Anthropic.AuthenticationError ? "API key was turned down"
      : e instanceof Anthropic.RateLimitError ? "rate limited"
      : e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}`
      : String(e);
    return { json: null, inputTokens: 0, outputTokens: 0, error: why.slice(0, 300) };
  }
  const used = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  if (res.stop_reason === "refusal") return { json: null, ...used, error: "Claude declined this one" };
  if (res.stop_reason === "max_tokens") return { json: null, ...used, error: "ran out of room before finishing" };
  try {
    return { json: JSON.parse(res.content.find((b) => b.type === "text")?.text ?? ""), ...used, error: null };
  } catch {
    return { json: null, ...used, error: "answer wasn't readable JSON" };
  }
}

const betsSchema = (props: Record<string, unknown>) => ({
  type: "object",
  properties: {
    bets: {
      type: "array",
      items: { type: "object", properties: { ...props, threshold: { type: "number" }, title: { type: "string" }, blurb: { type: "string" } }, required: [...Object.keys(props), "threshold", "title", "blurb"], additionalProperties: false },
    },
  },
  required: ["bets"],
  additionalProperties: false,
});

const betsOf = <T,>(a: Asked): T[] => {
  const bets = (a.json as { bets?: unknown } | null)?.bets;
  return Array.isArray(bets) ? (bets as T[]) : [];
};

/** Open the markets and log the run in one batch. */
async function openAndLog(
  env: Env, now: number, kind: FreshKind, trigger: FreshRun["trigger"], date: string, writer: string, asked: Asked,
  markets: { slug: string; title: string; blurb: string; rules: [string, string][]; chance: number; closesAt: number; auto: object }[],
  fromWriter: number, rejected: string[], category: string,
): Promise<FreshRun> {
  const cost = costMicros(asked.inputTokens, asked.outputTokens);
  const stmts = markets.map((m) => {
    const q = JSON.stringify(qForPrices([m.chance, 1 - m.chance], 80));
    return env.DB.prepare(
      `INSERT OR IGNORE INTO markets (slug, kind, category, title, blurb, rules, outcomes, q, q0, b, closes_at, created_at, auto)
       VALUES (?, 'lmsr', ?, ?, ?, ?, '["YES","NO"]', ?, ?, 80, ?, ?, ?)`,
    ).bind(m.slug, category, m.title, m.blurb, JSON.stringify(m.rules), q, q, m.closesAt, now, JSON.stringify(m.auto));
  });
  stmts.push(
    env.DB.prepare(
      `INSERT INTO fresh_runs (created_at, kind, for_date, trigger, writer, made, from_writer, rejected, input_tokens, output_tokens, cost_micros, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(now, kind, date, trigger, writer, markets.length, fromWriter, JSON.stringify(rejected), asked.inputTokens, asked.outputTokens, cost, asked.error),
  );
  await env.DB.batch(stmts);
  return {
    at: now, kind, forDate: date, trigger, writer, made: markets.length, fromWriter, rejected,
    inputTokens: asked.inputTokens, outputTokens: asked.outputTokens, costMicros: cost, error: asked.error, titles: markets.map((m) => m.title),
  };
}

const noCall: Asked = { json: null, inputTokens: 0, outputTokens: 0, error: null };

// ---------- weather: Open-Meteo ----------

const DAILY_FIELDS = [...new Set([...METRIC_IDS.map((m) => METRICS[m].field), "precipitation_probability_max"])];

type MeteoDay = { utc_offset_seconds: number; daily: Record<string, (number | null)[]> };

/** One day of daily numbers for some spots. Works for tomorrow (forecast) and yesterday (what happened). */
async function meteo(spots: SpotId[], date: string): Promise<Map<SpotId, MeteoDay>> {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", spots.map((s) => SPOTS[s].lat).join(","));
  u.searchParams.set("longitude", spots.map((s) => SPOTS[s].lon).join(","));
  u.searchParams.set("daily", DAILY_FIELDS.join(","));
  u.searchParams.set("temperature_unit", "fahrenheit");
  u.searchParams.set("precipitation_unit", "inch");
  u.searchParams.set("wind_speed_unit", "mph");
  u.searchParams.set("timezone", "auto");
  u.searchParams.set("start_date", date);
  u.searchParams.set("end_date", date);
  const res = await fetch(u, { headers: { "user-agent": "supahdupah.com fresh markets" } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as MeteoDay | MeteoDay[];
  const list = Array.isArray(body) ? body : [body];
  return new Map(spots.map((s, i) => [s, list[i]]));
}

async function forecastsFor(date: string) {
  const raw = await meteo(SPOT_IDS, date);
  const out: Partial<Record<SpotId, SpotForecast>> = {};
  for (const [spot, d] of raw) {
    const v = (field: string) => d?.daily?.[field]?.[0];
    const nums = METRIC_IDS.map((m) => v(METRICS[m].field));
    if (nums.some((x) => x == null || !Number.isFinite(x))) continue; // skip a spot with gaps rather than guess
    out[spot] = {
      ...(Object.fromEntries(METRIC_IDS.map((m, i) => [m, nums[i]])) as Record<MetricId, number>),
      rainChance: v("precipitation_probability_max") ?? 0,
      utcOffsetSec: d.utc_offset_seconds,
    };
  }
  return out;
}

const WEATHER_SYSTEM = `${VOICE}

These are weather bets. Making a good one:
- Set the line close to the forecast so it's a real coin flip, not a sure thing. Mix it up so the forecast leans YES on some and NO on others.
- Temperature and wind lines end in .5 (like 71.5) so a reading can't tie the line. Rain lines are inches with two decimals (like 0.10). Snow lines are inches with one decimal.
- The title is the question, under 90 characters. It names the spot and the day, and writes the line exactly as the threshold number, with its unit (like "71.5°F", "0.25 in", "30.5 mph").
- The blurb is one funny line, under 120 characters. It can mention the forecast.
- Spread the bets around different spots and different measurements, at most two per spot. Don't repeat a spot and measurement that's already on the board.`;

const r1 = (x: number) => Math.round(x * 10) / 10;

function weatherPrompt(date: string, forecasts: Partial<Record<SpotId, SpotForecast>>, taken: Set<string>, n: number) {
  const lines = SPOT_IDS.filter((s) => forecasts[s]).map((s) => {
    const f = forecasts[s]!;
    return `- ${s}: ${SPOTS[s].name} (${SPOTS[s].note}). high ${r1(f.high)}°F, low ${r1(f.low)}°F, rain ${f.rain.toFixed(2)} in (${f.rainChance}% chance), top gust ${r1(f.gust)} mph, snow ${r1(f.snow)} in`;
  });
  const snowy = SPOT_IDS.filter((s) => forecasts[s] && metricInPlay("snow", forecasts[s]!));
  return `Write ${n} bets for ${dayName(date)}, ${date}.

Forecast for that day, by spot id:
${lines.join("\n")}

Measurements: high (high temp, °F), low (overnight low, °F), rain (rain total, inches), gust (top wind gust, mph), snow (snowfall, inches; only for: ${snowy.length ? snowy.join(", ") : "nowhere, skip snow"}).

Already on the board for that day: ${taken.size ? [...taken].map((k) => k.replace("|", " ")).join(", ") : "nothing yet"}.`;
}

async function cookWeather(env: Env, now: number, trigger: FreshRun["trigger"]): Promise<FreshRun> {
  const date = nextFor(now, "weather");
  const forecasts = await forecastsFor(date); // throws if Open-Meteo is down; nothing's spent yet
  const existing = await env.DB.prepare("SELECT auto FROM markets WHERE slug LIKE ?").bind(`wx-${date}-%`).all<{ auto: string }>();
  const taken = new Set<string>();
  const perSpot = new Map<string, number>();
  for (const r of existing.results) {
    const a = JSON.parse(r.auto) as { spot: string; metric: string };
    taken.add(`${a.spot}|${a.metric}`);
    perSpot.set(a.spot, (perSpot.get(a.spot) ?? 0) + 1);
  }
  const writer = env.ANTHROPIC_API_KEY ? WRITER_MODEL : "house";
  const asked = env.ANTHROPIC_API_KEY
    ? await askClaude(env.ANTHROPIC_API_KEY, WEATHER_SYSTEM, weatherPrompt(date, forecasts, taken, FRESH_PER_DAY), betsSchema({ spot: { type: "string", enum: SPOT_IDS }, metric: { type: "string", enum: METRIC_IDS } }))
    : noCall;
  const made = [];
  const rejected: string[] = [];
  for (const p of betsOf<Pick>(asked)) {
    if (made.length >= FRESH_PER_DAY) break;
    const v = vet(p, date, forecasts, taken, perSpot);
    if (v.ok) made.push(v.market);
    else rejected.push(v.why);
  }
  const fromWriter = writer === "house" ? 0 : made.length;
  // top up with the house templates so the board always gets its share
  for (const p of houseWriter(date, forecasts, FRESH_PER_DAY - made.length, taken)) {
    const v = vet(p, date, forecasts, taken, perSpot);
    if (v.ok) made.push(v.market);
  }
  const markets = made.map((m) => ({ ...m, auto: { kind: "weather", spot: m.spot, metric: m.metric, date: m.date, threshold: m.threshold, settleAfter: m.settleAfter } }));
  return openAndLog(env, now, "weather", trigger, date, writer, asked, markets, fromWriter, rejected, "outside");
}

// ---------- money: Alpha Vantage (stocks, funds) and Coinbase (crypto) ----------

/** Thrown when the free key's 25 calls are used up, so callers stop trying the rest. */
class AlphaLimit extends Error {
  constructor() {
    super("Alpha Vantage daily limit reached (25 calls)");
  }
}

/** Daily closes, newest first, from the cache when it was fetched after `freshAfter`. */
async function alphaCloses(env: Env, symbol: string, freshAfter: number): Promise<[string, number][]> {
  const hit = await env.DB.prepare("SELECT fetched_at, data FROM price_cache WHERE symbol = ?").bind(symbol).first<{ fetched_at: number; data: string }>();
  if (hit && hit.fetched_at >= freshAfter) return Object.entries(JSON.parse(hit.data));
  if (!env.ALPHAVANTAGE_API_KEY) throw new Error("no Alpha Vantage key");
  const u = new URL("https://www.alphavantage.co/query");
  u.searchParams.set("function", "TIME_SERIES_DAILY");
  u.searchParams.set("symbol", symbol);
  u.searchParams.set("apikey", env.ALPHAVANTAGE_API_KEY);
  const res = await fetch(u);
  const body = (await res.json().catch(() => ({}))) as { "Time Series (Daily)"?: Record<string, Record<string, string>>; Information?: string; Note?: string; "Error Message"?: string };
  const series = body["Time Series (Daily)"];
  if (!series) {
    // their messages can quote the API key back, so never pass them along as-is
    const msg = body.Information ?? body.Note ?? body["Error Message"] ?? "";
    if (/rate limit|requests per day|premium/i.test(msg)) throw new AlphaLimit();
    throw new Error(`Alpha Vantage ${symbol}: ${body["Error Message"] ? "unknown symbol" : `no data (HTTP ${res.status})`}`);
  }
  const closes = Object.entries(series)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 10)
    .map(([d, bar]) => [d, Number(bar["4. close"])] as [string, number]);
  await env.DB.prepare("INSERT INTO price_cache (symbol, fetched_at, data) VALUES (?1, ?2, ?3) ON CONFLICT (symbol) DO UPDATE SET fetched_at = ?2, data = ?3")
    .bind(symbol, Date.now(), JSON.stringify(Object.fromEntries(closes)))
    .run();
  return closes;
}

/** Crypto bars as [startSeconds, close], newest first. Coinbase first (one retry), then Kraken. */
async function cryptoBars(asset: AssetId, granularity: 3600 | 86_400, start: number, end: number): Promise<[number, number][]> {
  const cb = new URL(`https://api.exchange.coinbase.com/products/${ASSETS[asset].symbol}/candles`);
  cb.searchParams.set("granularity", String(granularity));
  cb.searchParams.set("start", new Date(start).toISOString());
  cb.searchParams.set("end", new Date(end).toISOString());
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await wait(1_500);
    const res = await fetch(cb, { headers: { "user-agent": "supahdupah.com fresh markets" } }).catch(() => null);
    if (res?.ok) return ((await res.json()) as number[][]).map((b) => [b[0], b[4]]);
  }
  // Kraken: [time, open, high, low, close, ...] oldest first, prices as strings
  const kr = new URL("https://api.kraken.com/0/public/OHLC");
  kr.searchParams.set("pair", asset === "btc" ? "XBTUSD" : "ETHUSD");
  kr.searchParams.set("interval", String(granularity / 60));
  kr.searchParams.set("since", String(Math.floor(start / 1000) - 1));
  const res = await fetch(kr);
  const body = (await res.json().catch(() => ({}))) as { error?: string[]; result?: Record<string, unknown> };
  const bars = Object.values(body.result ?? {}).find(Array.isArray) as (string | number)[][] | undefined;
  if (!bars) throw new Error(`no ${ASSETS[asset].ticker} price from Coinbase or Kraken`);
  return bars
    .filter((b) => Number(b[0]) * 1000 >= start && Number(b[0]) * 1000 < end)
    .map((b) => [Number(b[0]), Number(b[4])] as [number, number])
    .reverse();
}

/** Last completed close for every asset we can get. Missing ones are left out, with why. */
async function quotesFor(env: Env, now: number) {
  const { date: today } = nyParts(now);
  const quotes: Partial<Record<AssetId, Quote>> = {};
  const problems: string[] = [];
  // a bar for today only counts once the market's closed
  const closedToday = !isTradingDay(today) || now >= nyTime(today, 16, 30);
  let calls = 0;
  let limited = false;
  if (!env.ALPHAVANTAGE_API_KEY) problems.push("no Alpha Vantage key, so crypto only");
  for (const a of ASSET_IDS) {
    const A = ASSETS[a];
    if (A.source === "alpha" && (!env.ALPHAVANTAGE_API_KEY || limited)) continue;
    try {
      if (A.source === "alpha") {
        if (calls++) await wait(1_200); // the free key wants about a call a second
        const closes = (await alphaCloses(env, A.symbol, now - 2 * HOUR)).filter(([d]) => closedToday || d < today);
        if (!closes.length) throw new Error(`${A.symbol}: no closes`);
        quotes[a] = { close: closes[0][1], date: closes[0][0], weekAgo: closes[5]?.[1] ?? null };
      } else {
        const bars = await cryptoBars(a, 86_400, now - 8 * DAY, now + HOUR);
        if (!bars.length) throw new Error(`${A.ticker}: no bars`);
        quotes[a] = { close: bars[0][1], date: today, weekAgo: bars[7]?.[1] ?? null };
      }
    } catch (e) {
      if (e instanceof AlphaLimit) limited = true; // the rest would fail too; don't spend anything on them
      problems.push(String(e instanceof Error ? e.message : e).slice(0, 160));
    }
  }
  return { quotes, problems };
}

const MONEY_SYSTEM = `${VOICE}

These are money bets: will a real price close over a line on the next trading day? Making a good one:
- Set the line close to the last close so it's a real coin flip. Some lines right at the last close ("does it close up?"), some a bit above or below. Big movers (Nvidia, Tesla, crypto) can take lines further out than the funds.
- Stock and fund lines end in .50 (like 683.50) so a close can't tie the line. Crypto lines are whole hundreds (like 83,500).
- The title is the question, under 90 characters. It names the ticker or the name and the day, and writes the line in dollars exactly as the threshold (like "$683.50" or "$83,500").
- Call the funds by their ticker alone: SPY, DIA, QQQ, USO, GLD (like "Does SPY close over $769.50 Thursday?"), never "the S&P fund SPY" or "the gold fund".
- Stocks and funds settle on the closing price. Crypto never closes: it settles on the price at 4pm New York time, so crypto titles say "at 4pm", never "close".
- The blurb is one funny line, under 120 characters, about the shop and its regulars, not a prediction or a tip.
- Spread the bets across the assets, at most two per asset, and never two lines on one asset that are close together.`;

function moneyPrompt(date: string, quotes: Partial<Record<AssetId, Quote>>, taken: Set<string>, n: number) {
  const lines = ASSET_IDS.filter((a) => quotes[a]).map((a) => {
    const q = quotes[a]!;
    const A = ASSETS[a];
    const week = q.weekAgo ? `, ${q.close >= q.weekAgo ? "up" : "down"} ${Math.abs(((q.close - q.weekAgo) / q.weekAgo) * 100).toFixed(1)}% on the week` : "";
    return `- ${a}: ${A.ticker}${FUNDS.includes(a) ? ` (a fund: ${A.name.replace(/^the /, "")})` : `, ${A.name}`} (${A.note}). last close $${q.close} on ${q.date}${week}; a normal day moves it about ${(A.vol * 100).toFixed(1)}%`;
  });
  return `Write ${n} bets on the closing prices for ${dayName(date)}, ${date}.

Assets, by id:
${lines.join("\n")}

Already on the board for that day: ${taken.size ? [...taken].map((k) => k.replace("|", " at ")).join(", ") : "nothing yet"}.`;
}

async function cookMoney(env: Env, now: number, trigger: FreshRun["trigger"]): Promise<FreshRun> {
  const date = nextFor(now, "money");
  const { quotes, problems } = await quotesFor(env, now);
  if (!Object.keys(quotes).length) throw new Error(`no prices: ${problems.join("; ")}`);
  const existing = await env.DB.prepare("SELECT auto FROM markets WHERE slug LIKE ?").bind(`mx-${date}-%`).all<{ auto: string }>();
  const taken = new Set<string>();
  const perAsset = new Map<string, number>();
  for (const r of existing.results) {
    const a = JSON.parse(r.auto) as { asset: string; threshold: number };
    taken.add(`${a.asset}|${a.threshold}`);
    perAsset.set(a.asset, (perAsset.get(a.asset) ?? 0) + 1);
  }
  const writer = env.ANTHROPIC_API_KEY ? WRITER_MODEL : "house";
  const asked = env.ANTHROPIC_API_KEY
    ? await askClaude(env.ANTHROPIC_API_KEY, MONEY_SYSTEM, moneyPrompt(date, quotes, taken, MONEY_PER_DAY), betsSchema({ asset: { type: "string", enum: ASSET_IDS.filter((a) => quotes[a]) } }))
    : noCall;
  const made = [];
  const rejected: string[] = [];
  for (const p of betsOf<MoneyPick>(asked)) {
    if (made.length >= MONEY_PER_DAY) break;
    const v = vetMoney(p, date, quotes, taken, perAsset);
    if (v.ok) made.push(v.market);
    else rejected.push(v.why);
  }
  const fromWriter = writer === "house" ? 0 : made.length;
  for (const p of moneyHouseWriter(date, quotes, MONEY_PER_DAY - made.length, taken)) {
    const v = vetMoney(p, date, quotes, taken, perAsset);
    if (v.ok) made.push(v.market);
  }
  const markets = made.map((m) => ({ ...m, auto: { kind: "money", asset: m.asset, date: m.date, threshold: m.threshold, settleAfter: m.settleAfter } }));
  // a missing price is worth knowing about even when the batch went fine
  const note = problems.length ? `missing prices: ${problems.join("; ")}` : null;
  return openAndLog(env, now, "money", trigger, date, writer, { ...asked, error: [asked.error, note].filter(Boolean).join(" · ") || null }, markets, fromWriter, rejected, "money");
}

// ---------- batches ----------

export function cookBatch(env: Env, now: number, trigger: FreshRun["trigger"], kind: FreshKind) {
  return kind === "weather" ? cookWeather(env, now, trigger) : cookMoney(env, now, trigger);
}

/** The once-a-day batches, each claimed through meta so only one isolate cooks it. */
export async function maybeFresh(env: Env, now: number) {
  const { hour } = nyParts(now);
  for (const kind of ["weather", "money"] as const) {
    if (hour < (kind === "weather" ? WEATHER_HOUR : MONEY_HOUR)) continue;
    const key = `fresh_for_${kind}`;
    const date = nextFor(now, kind);
    const prev = await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first<string>("value");
    if (prev === date) continue;
    const waitUntil = await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(`fresh_wait_${kind}`).first<string>("value");
    if (now < Number(waitUntil ?? 0)) continue;
    const claimed = await env.DB.prepare("INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2 WHERE meta.value IS NOT ?2")
      .bind(key, date)
      .run();
    if (!claimed.meta.changes) continue;
    try {
      await cookBatch(env, now, "daily", kind);
    } catch (e) {
      // the data feed was down before anything was spent; try again in half an hour, not every minute
      console.error(`fresh ${kind} batch`, e);
      await env.DB.batch([
        env.DB.prepare("UPDATE meta SET value = ? WHERE key = ?").bind(prev ?? "", key),
        env.DB.prepare("INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2").bind(`fresh_wait_${kind}`, String(now + 30 * 60_000)),
      ]);
    }
  }
}

// ---------- settling ----------

type Auto =
  | { kind?: "weather"; spot: SpotId; metric: MetricId; date: string; threshold: number; settleAfter: number }
  | { kind: "money"; asset: AssetId; date: string; threshold: number; settleAfter: number };

/** Settle any fresh market whose day is over, from what actually happened. */
export async function settleFresh(env: Env, now: number) {
  const due = (
    await env.DB.prepare("SELECT * FROM markets WHERE auto IS NOT NULL AND status = 'open' AND json_extract(auto, '$.settleAfter') <= ? LIMIT 40")
      .bind(now)
      .all<MarketRow & { auto: string }>()
  ).results;
  if (!due.length) return;
  const list = due.map((m) => ({ m, a: JSON.parse(m.auto) as Auto }));

  // weather, one Open-Meteo call per day
  const weather = new Map<string, { m: MarketRow; a: Extract<Auto, { spot: SpotId }> }[]>();
  for (const x of list) if (x.a.kind !== "money") weather.set(x.a.date, [...(weather.get(x.a.date) ?? []), x as { m: MarketRow; a: Extract<Auto, { spot: SpotId }> }]);
  for (const [date, group] of weather) {
    try {
      const readings = await meteo([...new Set(group.map((x) => x.a.spot))], date);
      for (const { m, a } of group) {
        const actual = readings.get(a.spot)?.daily?.[METRICS[a.metric].field]?.[0];
        if (actual == null || !Number.isFinite(actual)) continue; // not in yet; try again later
        await settle(env, m, winnerFor(actual, a.threshold), { actual, line: a.threshold, metric: a.metric });
      }
    } catch (e) {
      console.error("settle weather", date, e);
    }
  }

  // money, one price lookup per asset and day
  const money = new Map<string, { m: MarketRow; a: Extract<Auto, { kind: "money" }> }[]>();
  for (const x of list) if (x.a.kind === "money") money.set(`${x.a.asset}|${x.a.date}`, [...(money.get(`${x.a.asset}|${x.a.date}`) ?? []), x as { m: MarketRow; a: Extract<Auto, { kind: "money" }> }]);
  let calls = 0;
  for (const [key, group] of money) {
    const [asset, date] = key.split("|") as [AssetId, string];
    const A = ASSETS[asset];
    try {
      let actual: number | undefined;
      if (A.source === "alpha") {
        if (calls++) await wait(1_200);
        // refetch at most hourly while waiting for the close to show up
        const closes = await alphaCloses(env, A.symbol, Math.max(group[0].a.settleAfter, now - HOUR));
        actual = closes.find(([d]) => d === date)?.[1];
      } else {
        const bars = await cryptoBars(asset, 3600, nyTime(date, 15, 0), nyTime(date, 16, 0) + 1);
        actual = bars.find((b) => b[0] * 1000 === nyTime(date, 15, 0))?.[1]; // the bar from 3 to 4pm closes at 4
      }
      if (actual == null || !Number.isFinite(actual)) continue;
      for (const { m, a } of group) await settle(env, m, winnerFor(actual, a.threshold), { actual, line: a.threshold, asset });
    } catch (e) {
      console.error("settle money", key, e);
    }
  }
}

// ---------- Tony's view ----------

export async function freshReport(env: Env, now: number): Promise<FreshReport> {
  const rows = await env.DB.prepare("SELECT * FROM fresh_runs ORDER BY id DESC LIMIT 20").all<{
    created_at: number; kind: FreshKind; for_date: string; trigger: FreshRun["trigger"]; writer: string; made: number; from_writer: number;
    rejected: string; input_tokens: number; output_tokens: number; cost_micros: number; error: string | null;
  }>();
  const month = await env.DB.prepare("SELECT COUNT(*) AS runs, COALESCE(SUM(cost_micros), 0) AS micros, COALESCE(SUM(made), 0) AS made FROM fresh_runs WHERE created_at > ?")
    .bind(now - 30 * DAY)
    .first<{ runs: number; micros: number; made: number }>();
  const board = await env.DB.prepare("SELECT COUNT(*) AS n FROM markets WHERE auto IS NOT NULL AND status = 'open'").first<number>("n");
  return {
    writer: env.ANTHROPIC_API_KEY ? WRITER_MODEL : "house",
    hasPrices: !!env.ALPHAVANTAGE_API_KEY,
    next: { weather: nextFor(now, "weather"), money: nextFor(now, "money") },
    hours: { weather: WEATHER_HOUR, money: MONEY_HOUR },
    perDay: { weather: FRESH_PER_DAY, money: MONEY_PER_DAY },
    openOnBoard: board ?? 0,
    last30: month ?? { runs: 0, micros: 0, made: 0 },
    runs: rows.results.map((r) => ({
      at: r.created_at, kind: r.kind, forDate: r.for_date, trigger: r.trigger, writer: r.writer, made: r.made, fromWriter: r.from_writer,
      rejected: JSON.parse(r.rejected), inputTokens: r.input_tokens, outputTokens: r.output_tokens, costMicros: r.cost_micros, error: r.error,
    })),
  };
}
