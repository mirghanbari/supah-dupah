import { qForPrices } from "../shared/lmsr";
import type { Category } from "../shared/types";
import type { Env } from "./env";

type Seed = {
  slug: string;
  category: Category;
  title: string;
  blurb: string;
  outcomes?: string[];
  p: number[];
  rules: [string, string][];
  days: number;
  featured?: boolean;
  b?: number;
};

const TONY = ["Resolved by", "Tony, who will be standing right there."] as [string, string];

export const SEED_MARKETS: Seed[] = [
  // Fell off da truck
  { slug: "canal-pallet", category: "truck", featured: true, days: 5, p: [0.74, 0.26],
    title: "Will the pallet of 400 portable CD players on Canal St. be gone by Friday?",
    blurb: "Somebody's moving them. Question is who, and how fast.",
    rules: [["Resolves YES", "The pallet is gone. Not moved. Gone."], ["Resolves NO", "Pallet still there at close of business Friday."], ["Source", "My cousin's beeper."], TONY] },
  { slug: "box-says-tvs", category: "truck", days: 7, p: [0.31, 0.69],
    title: 'Box says "TVs." Does the box contain TVs?',
    blurb: "Historically, it's been bricks.",
    rules: [["Resolves YES", "At least one working television comes out of the box."], ["Resolves NO", "Bricks, phone books, or a smaller box."], TONY] },
  { slug: "vcr-tape", category: "truck", days: 3, p: [0.88, 0.12],
    title: "Does Cousin Nicky's \"brand new\" VCR already have a tape in it?",
    blurb: "Settles on the first press of EJECT.",
    rules: [["Resolves YES", "A tape comes out. Any tape. We don't ask what's on it."], TONY] },
  { slug: "truck-comes-back", category: "truck", days: 30, p: [0.09, 0.91],
    title: "Does the truck come back for it?",
    blurb: "Resolves NO after 30 days or one (1) visit from a guy.",
    rules: [["Resolves YES", "Same truck, same driver, looking around."], ["Resolves NO", "30 days pass, or a guy stops by and says it's handled."], TONY] },

  // Crust sports (Tony-resolved; live tosses are separate)
  { slug: "cheese-pull-22", category: "crust", days: 4, p: [0.39, 0.61],
    title: "Cheese Pull Invitational: longest pull over 22 inches?",
    blurb: "Measured with Tony's tape. Tony's tape has been disputed.",
    outcomes: ["OVER 22\"", "UNDER 22\""],
    rules: [["Measurement", "Plate edge to break point, straight up. No lateral pulls."], ["Equipment", "Tony's tape. The one from the hardware store that closed."], TONY] },
  { slug: "counter-curling", category: "crust", days: 6, p: [0.35, 0.22, 0.18, 0.15, 0.1],
    title: "Who wins the Counter Curling championship?",
    blurb: "Slide a slice down the counter. Closest to the register wins.",
    outcomes: ["Carmine", "Big Ange", "Dom", "Little Joey", "Da Field"],
    rules: [["Format", "Three slides each. Slice must stay cheese-side up."], ["Penalty", "Knocking over the parm shaker is a two-slide penalty."], TONY] },
  { slug: "oregano-shakeoff", category: "crust", days: 5, p: [0.6, 0.4],
    title: "Oregano Shake-Off: does anybody break 300 flakes in one shake?",
    blurb: "Clogged lids are a forfeit. Bring your own lid.",
    rules: [["Counting", "Flakes on the plate, counted by the kid on the register. He's fair."], TONY] },
  { slug: "carmine-fan", category: "crust", days: 2, p: [0.47, 0.53],
    title: "Will Carmine hit the ceiling fan during the Lunch Rush Series finale?",
    blurb: "Fan speed: HIGH (it's August).",
    rules: [["Resolves YES", "Dough makes contact with any part of the fan, including the pull chain."], TONY] },
  { slug: "plate-translucency", category: "crust", days: 3, p: [0.5, 0.5],
    title: "Does the paper plate go see-through before bite 3?",
    blurb: "Paper Plate Translucency Index. Held up to the window.",
    rules: [["Test", "Plate is held up to the front window. If you can read the OPEN sign through it, it's see-through."], TONY] },

  // Da neighborhood
  { slug: "jersey-fork", category: "hood", featured: true, days: 2, p: [0.81, 0.19],
    title: "Will the guy from Jersey use a fork and knife?",
    blurb: "Resolves YES on first cut. Everybody sees.",
    rules: [["Resolves YES", "Any cutting utensil touches the slice."], ["Resolves NO", "He folds it like a person."], TONY] },
  { slug: "pigeon-crust", category: "hood", featured: true, days: 1, p: [0.44, 0.56],
    title: "Does a pigeon steal a crust off an outdoor table before 1PM?",
    blurb: "Pigeon must fly off with it. Walking away does not count.",
    rules: [["Resolves YES", "Pigeon, crust, airborne, before 1:00PM."], TONY] },
  { slug: "tony-buick", category: "hood", featured: true, days: 1, p: [0.67, 0.33],
    title: "Does Tony's Buick get an alternate-side ticket?",
    blurb: "Tony's been \"moving it in a minute\" since 8AM.",
    rules: [["Resolves YES", "Orange envelope on the windshield."], ["Resolves NO", "Tony moves it, or the street sweeper skips the block again."], ["Resolved by", "Tony. Yes, it's his car. He says it's fine."]] },
  { slug: "fuhgeddaboudit", category: "hood", days: 2, p: [0.55, 0.45], outcomes: ["OVER 2.5", "UNDER 2.5"],
    title: "How many \"fuhgeddaboudit\"s on a single phone order?",
    blurb: "Counted by the kid on the register.",
    rules: [["What counts", "Any spelling. \"Forget about it\" said slow does not count."], TONY] },
  { slug: "esposito-sendback", category: "hood", days: 3, p: [0.93, 0.07],
    title: "Does Mrs. Esposito send back her slice?",
    blurb: "Reason must be \"too hot,\" \"not hot enough,\" or \"your father made it better.\"",
    rules: [["Resolves YES", "The slice goes back over the counter for any listed reason."], TONY] },
  { slug: "delivery-lost", category: "hood", featured: true, days: 2, p: [0.9, 0.1],
    title: "Does the delivery kid get lost on the way to 86th St. again?",
    blurb: "It's a straight line. He's done it four times.",
    rules: [["Resolves YES", "Customer calls asking where the pie is."], TONY] },
  { slug: "blackout-story", category: "hood", featured: true, days: 7, p: [0.96, 0.04],
    title: "Does Tony tell the blackout story 3+ times this week?",
    blurb: "The one where he kept the ovens going with a car battery.",
    rules: [["Counting", "Full tellings only. Starting it and getting interrupted counts as half."], ["Resolved by", "Not Tony, for obvious reasons. The lady by the window."]] },

  // Block association politics
  { slug: "block-president", category: "block", days: 14, p: [0.28, 0.24, 0.16, 0.18, 0.08, 0.06],
    title: "Who's the next block association president?",
    blurb: "Election is at the stoop meeting, if the stoop meeting happens.",
    outcomes: ["Guy w/ da leaf blower", "Mrs. Esposito", "Vito (double-parked)", "Whoever brings cannoli", "Nobody (meeting cancelled)", "Tony (write-in)"],
    rules: [["Voting", "Hands up. Kids don't count. Dogs don't count."], TONY] },
  { slug: "stoop-yelling", category: "block", featured: true, days: 10, p: [0.97, 0.03],
    title: "Does the stoop meeting end in yelling?",
    blurb: "Yelling threshold: two people, one window opened.",
    rules: [["Resolves YES", "Two people yelling AND somebody on the block opens a window to yell back."], TONY] },
  { slug: "real-original", category: "block", days: 60, p: [0.24, 0.24, 0.2, 0.18, 0.14],
    title: "Which \"Famous Original Tony's\" is the real original?",
    blurb: "Open since 1981. Will never resolve. Trade it anyway.",
    outcomes: ["Famous Original Tony's", "Original Famous Tony's", "World-Famous Tony's", "Tony's Original", "Da Real Tony's"],
    rules: [["Resolution", "When the lawyers finish. They will not finish."], TONY] },

  // Weather inside da shop
  { slug: "oven-105", category: "weather", days: 1, p: [0.72, 0.28],
    title: "Oven room over 105°F by noon?",
    blurb: "Measured on the thermometer shaped like a pizza.",
    rules: [["Source", "The pizza thermometer by the walk-in. It's a little generous."], TONY] },
  { slug: "fan-august", category: "weather", days: 20, p: [0.4, 0.6],
    title: "Does the ceiling fan survive August?",
    blurb: "It's been wobbling since the Mets were good.",
    rules: [["Resolves NO", "Fan stops, falls, or Tony duct-tapes it."], TONY] },
  { slug: "tv-signal", category: "weather", days: 1, p: [0.71, 0.29],
    title: "Does the TV over the counter lose signal in the 4th quarter?",
    blurb: "Somebody's gotta go up on the chair and fix the rabbit ears.",
    rules: [["Resolves YES", "Snow on the screen for 10+ seconds during the 4th quarter."], TONY] },
];

export const BOTS: { name: string; hood: string }[] = [
  { name: "Paulie", hood: "Bensonhurst" },
  { name: "MrsEsposito", hood: "Bensonhurst" },
  { name: "DaKidFromStatenIsland", hood: "Staten Island" },
  { name: "GuyInDaStarterJacket", hood: "Bay Ridge" },
  { name: "LadyByDaWindow", hood: "Bensonhurst" },
  { name: "Vito_DoubleParked", hood: "Dyker Heights" },
  { name: "CousinNicky", hood: "Arthur Ave" },
  { name: "Frankie_Laundromat", hood: "Bensonhurst" },
  { name: "SomeTourist", hood: "Ohio" },
  { name: "Jersey_Frankie", hood: '"Jersey"' },
];

let seededInIsolate = false;

export async function ensureSeeded(env: Env) {
  if (seededInIsolate) return;
  const done = await env.DB.prepare("SELECT value FROM meta WHERE key = 'seeded'").first();
  if (done) {
    seededInIsolate = true;
    return;
  }
  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];
  for (const b of BOTS) {
    stmts.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO users (username, pass_hash, salt, hood, balance_cents, is_bot, created_at) VALUES (?, '!', '', ?, 500000, 1, ?)",
      ).bind(b.name, b.hood, now),
    );
  }
  for (const m of SEED_MARKETS) {
    const b = m.b ?? 80;
    const q = JSON.stringify(qForPrices(m.p, b));
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO markets (slug, kind, category, title, blurb, rules, outcomes, q, q0, b, closes_at, featured, created_at)
         VALUES (?, 'lmsr', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        m.slug, m.category, m.title, m.blurb, JSON.stringify(m.rules),
        JSON.stringify(m.outcomes ?? ["YES", "NO"]), q, q, b,
        now + m.days * 86_400_000, m.featured ? 1 : 0, now,
      ),
    );
  }
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('last_tick', '0')"));
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', ?)").bind(String(now)));
  await env.DB.batch(stmts);
  seededInIsolate = true;
}
