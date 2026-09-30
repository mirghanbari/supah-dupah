export type Category = "truck" | "crust" | "hood" | "block" | "weather" | "toss";

export const CATEGORY_LABEL: Record<Category, string> = {
  truck: "Fell Off Da Truck",
  crust: "Crust Sports",
  hood: "Da Neighborhood",
  block: "Block Association",
  weather: "Weather (Inside)",
  toss: "Live Toss",
};

export type Me = {
  id: number;
  username: string;
  balanceCents: number;
  isBoss: boolean;
  hood: string;
  canBailout: boolean;
  lastLedger: { id: number; kind: string; cents: number; memo: string } | null;
};

export type MarketSummary = {
  slug: string;
  kind: "lmsr" | "toss";
  category: Category;
  title: string;
  blurb: string;
  outcomes: string[];
  prices: number[];
  change: number[]; // price change over last 24h, per outcome
  status: "open" | "resolved";
  winner: number | null;
  closesAt: number | null;
  volumeCents: number;
  featured: boolean;
};

export type Trade = {
  user: string;
  bot: boolean;
  outcome: number;
  shares: number;
  cents: number;
  at: number;
};

export type Comment = { id: number; user: string; isBoss: boolean; body: string; at: number; holding: string | null };

export type MarketDetail = MarketSummary & {
  rules: [string, string][];
  b: number;
  history: { at: number; prices: number[] }[];
  trades: Trade[];
  comments: Comment[];
  mine: { outcome: number; shares: number; costCents: number }[];
};

export type RoundInfo = {
  round: number;
  slug: string;
  tosser: { id: string; name: string; nick: string; joint: string; bio: string; color: string };
  line: number;
  startsAt: number;
  closesAt: number;
  endsAt: number;
  prices: number[];
  volumeCents: number;
  events: import("./toss").TossEvent[] | null; // revealed once tossing starts
  mine: { outcome: number; shares: number; costCents: number }[];
  trades: Trade[];
};

export type KitchenState = {
  now: number;
  current: RoundInfo;
  recent: { round: number; tosser: string; nick: string; line: number; count: number; floor: boolean; ceilings: number; over: boolean }[];
};

export type VanRow = {
  symbol: string;
  goods: string;
  price: number;
  change: number;
  history: number[];
  heat: { label: string; level: number };
  halted: string | null;
  boxes: number; // total open boxes across everyone
  guys: number; // distinct holders
};

export type VanPosition = {
  id: number;
  symbol: string;
  side: "long" | "short";
  boxes: number;
  entryCents: number;
  markCents: number;
  pnlCents: number;
  openedAt: number;
};

export type TabState = {
  balanceCents: number;
  netWorthCents: number;
  positions: { slug: string; title: string; outcome: string; shares: number; costCents: number; valueCents: number; price: number }[];
  van: VanPosition[];
  ledger: { kind: string; cents: number; memo: string; at: number }[];
  canBailout: boolean;
};

export type LeaderRow = { rank: number; user: string; hood: string; netWorthCents: number; bot: boolean; isBoss: boolean };

export type Standing = {
  id: string;
  name: string;
  nick: string;
  joint: string;
  color: string;
  bio: string;
  pies: number;
  avg: number;
  best: number;
  ceilings: number;
  floors: number;
  overs: number;
};

export type TickerItem = { text: string; tone: "up" | "dn" | "halt" | "plain" };
