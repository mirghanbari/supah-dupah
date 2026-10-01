import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { CATEGORY_LABEL, type Category, type MarketSummary } from "../../shared/types";
import { Change, MarketCard, SectionHead, YesNo } from "../components/MarketBits";
import { useKitchen, useMarkets, useMe, useVan } from "../lib/api";
import { useNow } from "../lib/clock";
import { until, vol } from "../lib/format";
import { sound } from "../lib/sound";

function Donut({ p }: { p: number }) {
  const C = 2 * Math.PI * 50;
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label={`${Math.round(p * 100)}% chance`}>
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-tile)" strokeWidth="14" />
      <motion.circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="var(--color-basil)"
        strokeWidth="14"
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - p) }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <text x="60" y="60" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="30" fill="var(--color-ink)">
        {Math.round(p * 100)}%
      </text>
      <text x="60" y="80" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="12" fill="var(--color-ink-soft)">
        chance
      </text>
    </svg>
  );
}

function Featured({ m }: { m: MarketSummary }) {
  return (
    <article className="plate grid gap-5 rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="pill bg-tile text-ink">{CATEGORY_LABEL[m.category]}</span>
        {m.closesAt && <span className="text-ink-soft">Closes in {until(m.closesAt)}</span>}
      </div>
      <Link to={`/m/${m.slug}`} onClick={() => sound.click()} className="font-slab text-[clamp(22px,2.4vw,26px)] leading-tight hover:text-sauce">
        {m.title}
      </Link>
      <div className="flex items-center gap-5">
        <Donut p={m.prices[0]} />
        <div className="grid gap-1 text-sm">
          <span className="text-ink-soft">
            Chance of <b className="text-ink">{m.outcomes[0]}</b>
          </span>
          <Change d={m.change[0]} className="text-base" />
          <span className="text-ink-soft">{vol(m.volumeCents)} traded</span>
        </div>
      </div>
      <Link to={`/m/${m.slug}`} tabIndex={-1}>
        <YesNo m={m} />
      </Link>
    </article>
  );
}

function TossTile() {
  const { data } = useKitchen();
  const now = useNow(500);
  const r = data?.current;
  const betting = r ? now < r.closesAt : false;
  const secs = r ? Math.max(0, Math.ceil(((betting ? r.closesAt : r.endsAt) - now) / 1000)) : 0;
  return (
    <Link to="/kitchen" onClick={() => sound.click()} className="grid min-h-48 content-start gap-3 rounded-[22px] bg-tile-a p-6 text-tile-a-ink transition-transform hover:-translate-y-0.5">
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          {betting ? "LIVE · BETTING OPEN" : "LIVE · TOSSING NOW"}
        </span>
        <span className="font-led text-3xl leading-none">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
      </span>
      <span className="font-slab text-2xl">The Dough Toss</span>
      <span className="leading-snug opacity-85">
        {r ? `${r.tosser.name} "${r.tosser.nick}": over or under ${r.line} tosses?` : "Over or under? A new round every 2½ minutes."}
      </span>
    </Link>
  );
}

function PickTile() {
  return (
    <Link to="/pick" onClick={() => sound.click()} className="grid min-h-48 content-start gap-3 rounded-[22px] bg-tile-b p-6 text-tile-b-ink transition-transform hover:-translate-y-0.5">
      <span className="flex gap-1.5" aria-hidden="true">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-tile-b-ink font-bold text-tile-b">3</span>
        <span className="grid h-9 w-9 place-items-center rounded-[10px] border-2 border-current font-bold">7</span>
        <span className="grid h-9 w-9 place-items-center rounded-[10px] border-2 border-current font-bold">9</span>
      </span>
      <span className="font-slab text-2xl">Pick A Number</span>
      <span className="leading-snug opacity-85">Choose 1 to 10. Hit Tony's number and it pays 100× your bet.</span>
    </Link>
  );
}

function VanTile() {
  const { data } = useVan();
  const mover = (data?.board ?? []).filter((r) => !r.halted).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  return (
    <Link to="/van" onClick={() => sound.click()} className="grid min-h-48 content-start gap-3 rounded-[22px] bg-tile-c p-6 text-tile-c-ink transition-transform hover:-translate-y-0.5">
      <span className="flex h-9 items-center justify-between text-[13px] font-bold">
        {mover ? (
          <span>
            {mover.symbol} · {mover.change >= 0 ? "▲" : "▼"} {Math.abs(mover.change)}¢
          </span>
        ) : (
          <span>BACK OF THE VAN</span>
        )}
        <svg viewBox="0 0 80 24" className="h-6 w-20" aria-hidden="true">
          <path d="M0 20 L12 18 L24 19 L36 12 L48 14 L60 8 L80 3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-slab text-2xl">Truck Futures</span>
      <span className="leading-snug opacity-85">Go long or short on whatever's in the back of the van.</span>
    </Link>
  );
}

const CATS: (Category | "all")[] = ["all", "truck", "crust", "hood", "block", "weather"];

export function Lobby() {
  const me = useMe();
  const { data } = useMarkets();
  const [cat, setCat] = useState<Category | "all">("all");
  const markets = data?.markets ?? [];
  const feat = markets.find((m) => m.featured && m.outcomes.length === 2) ?? markets[0];
  // the featured market already has the spotlight up top, so "All" skips it
  const shown = cat === "all" ? markets.filter((m) => m !== feat) : markets.filter((m) => m.category === cat);

  return (
    <div className="grid gap-14">
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="grid justify-items-start gap-5">
          <span className="rounded-full bg-sauce-soft px-3 py-1.5 text-[13px] font-semibold text-sauce-dk dark:text-sauce">Play money. Zero risk. Maximum opinions.</span>
          <h1 className="font-slab text-[clamp(40px,6vw,64px)] leading-[1.02] tracking-[-0.035em]">
            Bet on everything.
            <br />
            With fake money.
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-ink-soft">
            Trade on neighborhood drama, back-room sports and suspiciously cheap electronics. Everybody starts with $100 in play money.
          </p>
          <div className="flex flex-wrap gap-3">
            {me ? (
              <>
                <Link to="/kitchen" className="btn btn-red h-[52px] px-6 text-base">
                  Watch the Dough Toss
                </Link>
                <Link to="/tab" className="btn btn-cheese h-[52px] px-6 text-base">
                  Your Tab
                </Link>
              </>
            ) : (
              <>
                <Link to="/join" className="btn btn-red h-[52px] px-6 text-base">
                  Get your $100
                </Link>
                <Link to="/join?mode=login" className="btn btn-cheese h-[52px] px-6 text-base">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
        {feat ? <Featured m={feat} /> : <div className="plate min-h-80 animate-pulse rounded-3xl" />}
      </section>

      <section className="grid gap-5">
        <SectionHead title="Quick games" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <TossTile />
          <PickTile />
          <VanTile />
        </div>
      </section>

      <section className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHead title="Trending markets" />
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  sound.click();
                  setCat(c);
                }}
                className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${cat === c ? "border-ink bg-ink text-plate" : "border-grout bg-plate text-ink hover:border-ink-soft"}`}
              >
                {c === "all" ? "All" : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m, i) => (
            <MarketCard key={m.slug} m={m} i={i} />
          ))}
        </motion.div>
        {!data && <p className="text-ink-soft">Loading markets…</p>}
      </section>
    </div>
  );
}
