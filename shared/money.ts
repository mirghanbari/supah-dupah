// Money markets: every trading-day evening the shop puts up bets on where real prices close
// the next trading day. Stocks and funds come from Alpha Vantage, crypto from Coinbase.
// Same deal as the weather: a writer picks the lines, code checks them, the computer settles.

export type AssetId = "spy" | "dia" | "qqq" | "uso" | "gld" | "aapl" | "msft" | "nvda" | "tsla" | "amzn" | "btc" | "eth";

type Asset = {
  ticker: string;
  name: string;
  source: "alpha" | "coinbase";
  symbol: string; // what the source calls it
  vol: number; // rough daily move, as a fraction of price
  note: string;
};

export const ASSETS: Record<AssetId, Asset> = {
  spy: { ticker: "SPY", name: "the S&P 500 fund", source: "alpha", symbol: "SPY", vol: 0.01, note: "the whole market, more or less" },
  dia: { ticker: "DIA", name: "the Dow fund", source: "alpha", symbol: "DIA", vol: 0.009, note: "what Tony's father called 'the market'" },
  qqq: { ticker: "QQQ", name: "the Nasdaq fund", source: "alpha", symbol: "QQQ", vol: 0.013, note: "tech stocks" },
  uso: { ticker: "USO", name: "the oil fund", source: "alpha", symbol: "USO", vol: 0.02, note: "oil. the Buick drinks it" },
  gld: { ticker: "GLD", name: "the gold fund", source: "alpha", symbol: "GLD", vol: 0.01, note: "gold, like Tony's chain" },
  aapl: { ticker: "AAPL", name: "Apple", source: "alpha", symbol: "AAPL", vol: 0.016, note: "phones" },
  msft: { ticker: "MSFT", name: "Microsoft", source: "alpha", symbol: "MSFT", vol: 0.014, note: "computers" },
  nvda: { ticker: "NVDA", name: "Nvidia", source: "alpha", symbol: "NVDA", vol: 0.03, note: "computer chips, moves a lot" },
  tsla: { ticker: "TSLA", name: "Tesla", source: "alpha", symbol: "TSLA", vol: 0.035, note: "electric cars, moves a lot" },
  amzn: { ticker: "AMZN", name: "Amazon", source: "alpha", symbol: "AMZN", vol: 0.018, note: "the boxes on everybody's stoop" },
  btc: { ticker: "BTC", name: "Bitcoin", source: "coinbase", symbol: "BTC-USD", vol: 0.025, note: "Cousin Nicky's 'investment'" },
  eth: { ticker: "ETH", name: "Ethereum", source: "coinbase", symbol: "ETH-USD", vol: 0.035, note: "the other one" },
};

export const ASSET_IDS = Object.keys(ASSETS) as AssetId[];

/** The funds go by their ticker alone in titles: "Does SPY close over…", not "the S&P 500 fund". */
export const FUNDS: AssetId[] = ["spy", "dia", "qqq", "uso", "gld"];
const titleName = (a: AssetId) => (FUNDS.includes(a) ? ASSETS[a].ticker : ASSETS[a].name);

export const MONEY_PER_DAY = 15;
export const MAX_PER_ASSET = 2;

/** What the writer sees, and what the opening odds come from. */
export type Quote = { close: number; date: string; weekAgo: number | null };

export type MoneyPick = { asset: string; threshold: number; title: string; blurb: string };

export type MoneyMarket = {
  slug: string;
  asset: AssetId;
  date: string; // the trading day it settles on, New York
  threshold: number;
  title: string;
  blurb: string;
  chance: number;
  closesAt: number;
  settleAfter: number;
  rules: [string, string][];
};

// ---------- the trading calendar (New York) ----------

/** NYSE full-day closures. Add next year's before it starts. */
export const MARKET_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function isTradingDay(date: string) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !MARKET_HOLIDAYS.has(date);
}

/** The first trading day after `date`. */
export function nextTradingDay(date: string) {
  let d = addDays(date, 1);
  while (!isTradingDay(d)) d = addDays(d, 1);
  return d;
}

/** New York's offset from UTC on a date, in hours (-4 in summer, -5 in winter). */
export function nyOffsetHours(date: string) {
  const noon = new Date(`${date}T12:00:00Z`);
  const ny = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(noon));
  return ny - 12;
}

/** A New York wall-clock time on `date`, as ms since epoch. */
export const nyTime = (date: string, hour: number, minute = 0) =>
  Date.parse(`${date}T00:00:00Z`) + ((hour - nyOffsetHours(date)) * 60 + minute) * 60_000;

// ---------- checking a pick ----------

/** Lines end in .50 for stocks and funds, whole hundreds for crypto, so a close can't tie. */
export function roundLine(asset: AssetId, x: number) {
  if (ASSETS[asset].source === "coinbase") return Math.round(x / 100) * 100;
  return Math.round(x - 0.5) + 0.5;
}

export const money = (asset: AssetId, x: number) =>
  "$" + x.toLocaleString("en-US", { minimumFractionDigits: ASSETS[asset].source === "coinbase" ? 0 : 2, maximumFractionDigits: 2 });

/** Normal CDF, close enough for opening odds. */
function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function moneyChance(asset: AssetId, line: number, q: Quote) {
  const p = phi((q.close - line) / (q.close * ASSETS[asset].vol));
  return Math.min(0.9, Math.max(0.1, Math.round(p * 100) / 100));
}

export const moneySlug = (date: string, asset: AssetId, line: number) => `mx-${date}-${asset}-${String(line).replace(".", "-")}`;

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const digits = (s: string) => s.replace(/[$,]/g, "");

/**
 * Check one pick against the last close. `taken` holds "asset|line" already on the board for
 * that day, and `perAsset` counts them; both are updated when the pick passes.
 */
export function vetMoney(p: MoneyPick, date: string, quotes: Partial<Record<AssetId, Quote>>, taken: Set<string>, perAsset: Map<string, number>):
  | { ok: true; market: MoneyMarket }
  | { ok: false; why: string } {
  if (!(p.asset in ASSETS)) return { ok: false, why: `unknown asset "${p.asset}"` };
  const asset = p.asset as AssetId;
  const q = quotes[asset];
  if (!q) return { ok: false, why: `no price for ${asset}` };
  if ((perAsset.get(asset) ?? 0) >= MAX_PER_ASSET) return { ok: false, why: `too many for ${asset}` };
  if (!Number.isFinite(p.threshold)) return { ok: false, why: "line isn't a number" };
  const line = roundLine(asset, p.threshold);
  const A = ASSETS[asset];
  // within about two days' normal move, so it's a bet and not a sure thing
  if (Math.abs(line - q.close) > q.close * A.vol * 2) return { ok: false, why: `${asset} line ${line} too far from last close ${q.close}` };
  if (taken.has(`${asset}|${line}`)) return { ok: false, why: `${asset} ${line} already on the board` };
  for (const k of taken) {
    const [a, l] = k.split("|");
    if (a === asset && Math.abs(Number(l) - line) < q.close * A.vol * 0.5) return { ok: false, why: `${asset} ${line} too close to the other line` };
  }
  const title = clean(p.title, 110);
  const blurb = clean(p.blurb, 160);
  if (title.length < 12) return { ok: false, why: "title too short" };
  const lineText = A.source === "coinbase" ? String(line) : line.toFixed(2);
  if (!digits(title).includes(lineText) && !digits(title).includes(String(line))) return { ok: false, why: `title doesn't state the line ${line}` };
  taken.add(`${asset}|${line}`);
  perAsset.set(asset, (perAsset.get(asset) ?? 0) + 1);
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const what = A.source === "coinbase" ? `${A.name}'s price on Coinbase at 4:00pm New York time` : `${A.ticker} (${A.name})'s closing price`;
  return {
    ok: true,
    market: {
      slug: moneySlug(date, asset, line), asset, date, threshold: line, title, blurb,
      chance: moneyChance(asset, line, q),
      closesAt: nyTime(date, 9, 30),
      settleAfter: nyTime(date, 18, 0),
      rules: [
        ["Resolves YES", `${what} on ${day} ${date} is over ${money(asset, line)}.`],
        ["Resolves NO", `It's ${money(asset, line)} or under.`],
        ["Source", A.source === "coinbase" ? "Coinbase's public price, the hourly bar that ends at 4:00pm." : "Alpha Vantage daily closing price."],
        ["Trading stops", "9:30am New York time, when the stock market opens."],
        ["Settled by", "The computer, automatic, after 6pm. Tony don't touch it."],
        ["Fine print", "Play money. Not investment advice. Tony has never once been right about the market."],
      ],
    },
  };
}

// ---------- the house writer ----------

const TEMPLATES: Record<Asset["source"], [string, string][]> = {
  alpha: [
    ["Does {ticker} close over {line} on {day}?", "Last close: {close}. Tony's cousin's broker says it's a lock. The broker sells cars."],
    ["{name} over {line} at the {day} close?", "It's {close} right now. Paulie bought at the top. Paulie always buys at the top."],
    ["{ticker} over {line} when the bell rings {day}?", "Closed at {close}. Tony checks it on the TV over the counter, between innings."],
  ],
  coinbase: [
    ["{name} over {line} at 4pm {day}?", "It's {close} right now. Cousin Nicky keeps the password on a napkin."],
    ["Is {ticker} over {line} at 4pm on {day}?", "Sitting at {close}. Nicky says it's goin' to the moon. Nicky's never left Brooklyn."],
  ],
};

/** Picks from templates: the last close (up or down?) and a line a little off it, spread across assets. */
export function moneyHouseWriter(date: string, quotes: Partial<Record<AssetId, Quote>>, n: number, taken: Set<string>): MoneyPick[] {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const seed = [...date].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const assets = ASSET_IDS.filter((a) => quotes[a]).sort((a, b) => ((seed ^ hash(a)) % 101) - ((seed ^ hash(b)) % 101));
  const out: MoneyPick[] = [];
  for (const nudge of [0, 0.75]) {
    for (const asset of assets) {
      if (out.length >= n) return out;
      const q = quotes[asset]!;
      const A = ASSETS[asset];
      const line = roundLine(asset, q.close * (1 + (nudge ? ((hash(asset) + seed) % 2 ? nudge : -nudge) * A.vol : 0)));
      if (taken.has(`${asset}|${line}`) || out.some((p) => p.asset === asset && p.threshold === line)) continue;
      const set = TEMPLATES[A.source];
      const [t, b] = set[(hash(asset) + seed + out.length) % set.length];
      const fill = (s: string) =>
        s.replace("{ticker}", A.ticker).replace("{name}", titleName(asset)).replace("{line}", money(asset, line)).replace("{day}", day).replace("{close}", money(asset, q.close));
      out.push({ asset, threshold: line, title: fill(t), blurb: fill(b) });
    }
  }
  return out;
}

function hash(s: string) {
  return [...s].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381);
}
