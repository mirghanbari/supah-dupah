import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { CATEGORY_LABEL, type Category } from "../../shared/types";
import { Letterboard } from "../components/Letterboard";
import { MarketCard, SectionHead } from "../components/MarketBits";
import { useKitchen, useMarkets } from "../lib/api";
import { useNow } from "../lib/clock";
import { cents, vol } from "../lib/format";
import { sound } from "../lib/sound";

function LiveTossCard() {
  const { data } = useKitchen();
  const now = useNow(500);
  if (!data) return <div className="plate greasy min-h-64 animate-pulse p-5" />;
  const r = data.current;
  const betting = now < r.closesAt;
  const secs = Math.max(0, Math.ceil(((betting ? r.closesAt : r.endsAt) - now) / 1000));
  const last = data.recent[0];
  return (
    <article className="plate greasy grid gap-3.5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill bg-sauce text-plate">● Live from da back</span>
        <span className="pill bg-basil text-plate">Crust Sports</span>
        <span className="pill bg-tile text-ink-soft">Round #{r.round % 10000}</span>
      </div>
      <h2 className="font-slab text-[clamp(22px,2.6vw,30px)] leading-tight">
        {r.tosser.name} "{r.tosser.nick}": over or under {r.line} tosses?
      </h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="led rounded px-4 pb-1.5 pt-2 text-center leading-[.8]">
          <div className="text-6xl">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </div>
          <small className="label text-[#b99a5a]">{betting ? "till tossin'" : "tossin' NOW"}</small>
        </div>
        <p className="max-w-[40ch] text-sm text-ink-soft">{r.tosser.bio}</p>
      </div>
      <div className="flex gap-2">
        <Link to="/kitchen" onClick={() => sound.click()} className="flex flex-1 items-baseline justify-between rounded bg-[#E3F4EA] px-3 py-2.5 font-slab text-basil shadow-[inset_0_0_0_2px_var(--color-basil)]">
          OVER {r.line} <b className="font-led text-2xl font-normal">{cents(r.prices[0])}</b>
        </Link>
        <Link to="/kitchen" onClick={() => sound.click()} className="flex flex-1 items-baseline justify-between rounded bg-[#FBE5E8] px-3 py-2.5 font-slab text-sauce shadow-[inset_0_0_0_2px_var(--color-sauce)]">
          UNDER <b className="font-led text-2xl font-normal">{cents(r.prices[1])}</b>
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
        <span>
          {vol(r.volumeCents)} in slices this round{last ? ` · last pie: ${last.nick} tossed ${last.count}${last.floor ? " (FLOOR PIE)" : ""}` : ""}
        </span>
        <Link to="/kitchen" className="btn btn-red text-sm">
          Watch it live →
        </Link>
      </div>
    </article>
  );
}

const CATS: (Category | "all")[] = ["all", "truck", "crust", "hood", "block", "weather"];

export function Lobby() {
  const { data } = useMarkets();
  const [cat, setCat] = useState<Category | "all">("all");
  const markets = data?.markets ?? [];
  const featured = markets.filter((m) => m.featured).slice(0, 7);
  const shown = cat === "all" ? markets : markets.filter((m) => m.category === cat);

  return (
    <div className="grid gap-8">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <LiveTossCard />
        {featured.length > 0 ? <Letterboard markets={featured} /> : <div className="letterboard min-h-64" />}
      </div>

      <section className="grid gap-4">
        <SectionHead title="Fresh Out Da Oven" aside="every market we got. still hot, don't touch." />
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => {
                sound.click();
                setCat(c);
              }}
              className={`label rounded-full border-2 px-3 py-1.5 text-xs ${cat === c ? "border-ink bg-ink text-plate" : "border-ink/20 bg-plate text-ink hover:border-ink"}`}
            >
              {c === "all" ? "Everything" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m, i) => (
            <MarketCard key={m.slug} m={m} i={i} />
          ))}
        </motion.div>
        {!data && <p className="font-hand text-ink-soft">Warmin' up da oven…</p>}
      </section>
    </div>
  );
}
