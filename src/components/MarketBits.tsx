import { motion } from "motion/react";
import { Link } from "react-router";
import { CATEGORY_LABEL, type Category, type MarketSummary } from "../../shared/types";
import { cents, until, vol } from "../lib/format";
import { sound } from "../lib/sound";

const PILL: Record<Category, string> = {
  truck: "bg-felt text-cheese",
  crust: "bg-basil text-plate",
  hood: "bg-cheese text-ink",
  block: "bg-pen text-plate",
  weather: "bg-crust text-plate",
  toss: "bg-sauce text-plate",
};

export function CategoryPill({ c }: { c: Category }) {
  return <span className={`pill ${PILL[c]}`}>{CATEGORY_LABEL[c]}</span>;
}

export function Change({ d, className = "" }: { d: number; className?: string }) {
  const c = Math.round(d * 100);
  if (c === 0) return <span className={`font-led text-ink-soft ${className}`}>±0</span>;
  return <span className={`font-led ${c > 0 ? "text-basil" : "text-sauce"} ${className}`}>{c > 0 ? `▲${c}` : `▼${-c}`}</span>;
}

/** Big two-button YES/NO (or first two outcomes) row. */
export function YesNo({ m, onPick }: { m: MarketSummary; onPick?: (i: number) => void }) {
  if (m.outcomes.length > 2) {
    const top = m.outcomes.map((o, i) => ({ o, i, p: m.prices[i] })).sort((a, b) => b.p - a.p).slice(0, 3);
    return (
      <div className="grid gap-1.5">
        {top.map(({ o, i, p }) => (
          <div key={i} className="relative flex items-center justify-between overflow-hidden rounded bg-tile px-2 py-1 text-sm">
            <motion.div className="absolute inset-y-0 left-0 bg-cheese/35" initial={false} animate={{ width: `${p * 100}%` }} />
            <span className="relative truncate font-medium">{o}</span>
            <span className="relative font-led text-xl text-ink">{cents(p)}</span>
          </div>
        ))}
        {m.outcomes.length > 3 && <span className="label text-ink-soft">+{m.outcomes.length - 3} more on da menu</span>}
      </div>
    );
  }
  const btn = "flex flex-1 items-baseline justify-between gap-2 rounded px-3 py-2 font-slab text-sm transition-transform active:scale-95";
  return (
    <div className="flex gap-2">
      <button type="button" className={`${btn} bg-[#E3F4EA] text-basil shadow-[inset_0_0_0_2px_var(--color-basil)]`} onClick={() => onPick?.(0)}>
        <span className="truncate">{m.outcomes[0]}</span>
        <b className="font-led text-2xl font-normal leading-none">{cents(m.prices[0])}</b>
      </button>
      <button type="button" className={`${btn} bg-[#FBE5E8] text-sauce shadow-[inset_0_0_0_2px_var(--color-sauce)]`} onClick={() => onPick?.(1)}>
        <span className="truncate">{m.outcomes[1]}</span>
        <b className="font-led text-2xl font-normal leading-none">{cents(m.prices[1])}</b>
      </button>
    </div>
  );
}

export function MarketCard({ m, i = 0 }: { m: MarketSummary; i?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24, rotate: i % 2 ? 1.5 : -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      whileHover={{ rotate: i % 2 ? -0.8 : 0.8, y: -3 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: Math.min(i, 10) * 0.035 }}
      className={`plate ${i % 3 !== 1 ? "greasy" : ""} grid grid-rows-[auto_1fr_auto_auto] gap-2.5 p-4`}
    >
      <div className="flex items-center justify-between gap-2">
        <CategoryPill c={m.category} />
        {m.status === "resolved" ? (
          <span className="pill bg-ink text-plate">Settled: {m.winner != null ? m.outcomes[m.winner] : "?"}</span>
        ) : (
          <Change d={m.change[0]} className="text-lg" />
        )}
      </div>
      <Link to={`/m/${m.slug}`} onClick={() => sound.click()} className="font-bold leading-snug hover:text-sauce">
        {m.title}
      </Link>
      <Link to={`/m/${m.slug}`} tabIndex={-1}>
        <YesNo m={m} />
      </Link>
      <div className="flex flex-wrap gap-x-3 text-xs text-ink-soft">
        <span>{vol(m.volumeCents)} traded</span>
        {m.closesAt && m.status === "open" && <span>closes in {until(m.closesAt)}</span>}
      </div>
    </motion.article>
  );
}

/** Section heading with a handwritten aside. */
export function SectionHead({ title, aside, className = "" }: { title: string; aside?: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-2 ${className}`}>
      <h2 className="font-slab text-2xl text-sauce">{title}</h2>
      {aside && <span className="font-hand text-sm text-ink-soft">{aside}</span>}
    </div>
  );
}
