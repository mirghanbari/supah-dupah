import { gaussian, mulberry32 } from "./rng";

// A dough-toss round: betting runs for BET_MS, then the pie is tossed live for SHOW_MS.
export const ROUND_MS = 150_000;
export const BET_MS = 110_000;
export const SHOW_MS = ROUND_MS - BET_MS;
export const INTRO_MS = 3_500;
/** LMSR liquidity for toss rounds. */
export const TOSS_B = 40;

export type Tosser = {
  id: string;
  name: string;
  nick: string;
  joint: string;
  mean: number; // average tosses per pie
  spread: number;
  ceilingRate: number;
  floorRate: number;
  color: "blue" | "red" | "purple" | "green" | "gold";
  bio: string;
};

export const TOSSERS: Tosser[] = [
  { id: "vinny", name: "Vinny Bruschetti", nick: "Hands", joint: "Supah Dupah", mean: 8.2, spread: 2.0, ceilingRate: 0.08, floorRate: 0.03, color: "blue", bio: "Wrists haven't been the same since the softball thing. Still the house favorite." },
  { id: "carmine", name: "Carmine Lucatelli", nick: "Da Centrifuge", joint: "Two Bros. (the other ones)", mean: 9.6, spread: 2.6, ceilingRate: 0.2, floorRate: 0.06, color: "red", bio: "Tosses like he's mad at the dough. Has hit every ceiling fan in Brooklyn." },
  { id: "ange", name: "Big Ange Mozzarelli", nick: "Da Glacier", joint: "Ange's", mean: 6.1, spread: 1.3, ceilingRate: 0.01, floorRate: 0.01, color: "green", bio: "Slow. Steady. Two full seconds of airtime. Has never once dropped a pie." },
  { id: "dom", name: "Dom Ferraro", nick: "Flour Power", joint: "Famous Original Dom's", mean: 7.4, spread: 2.2, ceilingRate: 0.1, floorRate: 0.07, color: "gold", bio: "Uses so much flour the smoke detector goes off. Showman. Unreliable." },
  { id: "joey", name: "Little Joey", nick: "Two-Pies", joint: "Joey's (both locations)", mean: 11.8, spread: 3.2, ceilingRate: 0.04, floorRate: 0.1, color: "purple", bio: "Fifteen years old. Tosses two pies at once when nobody's looking. Disqualified twice." },
];

export function tosserForRound(round: number): Tosser {
  return TOSSERS[((round % TOSSERS.length) + TOSSERS.length) % TOSSERS.length];
}

export function lineFor(t: Tosser): number {
  return Math.floor(t.mean) + 0.5;
}

export type TossEvent =
  | { t: number; kind: "toss"; count: number; ceiling: boolean; height: number }
  | { t: number; kind: "spin" } // knuckle spin: doesn't count
  | { t: number; kind: "sneeze" }
  | { t: number; kind: "floor"; count: number }
  | { t: number; kind: "done"; count: number };

export type TossResult = {
  count: number;
  ceilings: number;
  floor: boolean;
  events: TossEvent[];
};

/** Deterministic round outcome from a (secret-derived) seed. Times are ms after the show starts. */
export function simulateRound(seed: number, t: Tosser): TossResult {
  const rand = mulberry32(seed);
  const target = Math.max(2, Math.min(18, Math.round(t.mean + gaussian(rand) * t.spread)));
  const floorAt = rand() < t.floorRate * 3 ? 1 + Math.floor(rand() * target) : -1;

  const steps: ({ kind: "toss"; ceiling: boolean; height: number } | { kind: "spin" } | { kind: "sneeze" } | { kind: "floor" })[] = [];
  let count = 0;
  while (count < target) {
    if (rand() < 0.12) steps.push({ kind: "spin" });
    if (rand() < 0.05) steps.push({ kind: "sneeze" });
    count++;
    if (count === floorAt) {
      steps.push({ kind: "floor" });
      count--; // the dropped one doesn't count
      break;
    }
    const ceiling = rand() < t.ceilingRate;
    steps.push({ kind: "toss", ceiling, height: ceiling ? 1 : 0.45 + rand() * 0.45 });
  }

  const dur = (s: (typeof steps)[number]) =>
    s.kind === "toss" ? 1900 : s.kind === "spin" ? 1500 : s.kind === "sneeze" ? 2200 : 2600;
  const total = steps.reduce((a, s) => a + dur(s), 0);
  const room = SHOW_MS - INTRO_MS - 6_000;
  const scale = total > room ? room / total : 1;

  const events: TossEvent[] = [];
  let clock = INTRO_MS;
  let n = 0;
  let ceilings = 0;
  for (const s of steps) {
    if (s.kind === "toss") {
      n++;
      if (s.ceiling) ceilings++;
      events.push({ t: Math.round(clock), kind: "toss", count: n, ceiling: s.ceiling, height: s.height });
    } else if (s.kind === "floor") {
      events.push({ t: Math.round(clock), kind: "floor", count: n });
    } else {
      events.push({ t: Math.round(clock), kind: s.kind });
    }
    clock += dur(s) * scale;
  }
  const floor = steps.some((s) => s.kind === "floor");
  events.push({ t: Math.round(clock + 400), kind: "done", count: n });
  return { count: n, ceilings, floor, events };
}

/** Normal-approximation chance the tosser goes over the line. Bots use this as "fair". */
export function fairOver(t: Tosser): number {
  const line = lineFor(t);
  const z = (line - t.mean) / t.spread;
  // Abramowitz-Stegun erf approximation
  const x = z / Math.SQRT2;
  const s = Math.sign(x);
  const a = Math.abs(x);
  const k = 1 / (1 + 0.3275911 * a);
  const erf = s * (1 - ((((1.061405429 * k - 1.453152027) * k + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a));
  const cdf = 0.5 * (1 + erf);
  return Math.min(0.95, Math.max(0.05, (1 - cdf) * (1 - t.floorRate)));
}

export const TOSS_CALLS = {
  intro: ["{nick} flours da counter…", "{nick} cracks his knuckles.", "{nick} says a little prayer to San Gennaro.", "{nick} slaps da dough. Crowd goes quiet."],
  toss: ["Up she goes!", "Beautiful!", "Look at dat spin!", "Madonna mia!", "Clean hands!", "Dat's a toss!", "He's cookin' now!"],
  ceiling: ["HIT DA CEILING! Counts!", "CEILING! Tony is yellin'!", "Ceiling tile's got flour on it now!"],
  spin: ["Knuckle spin. Don't count.", "Just showin' off. No toss."],
  sneeze: ["He sneezed! Flour everywhere!", "Bless you! Toss clock keeps runnin'."],
  floor: ["FLOOR PIE!!! Oh no. Oh no no no.", "IT'S ON DA FLOOR! Five-second rule does NOT apply!"],
  done: ["Into da oven! Final count: {n}.", "Pie's on da peel. That's {n}."],
};
