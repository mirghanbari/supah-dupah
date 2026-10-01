import { motion } from "motion/react";
import { Link } from "react-router";
import { CATEGORY_LABEL, type Category, type MarketSummary } from "../../shared/types";
import { cents, until, vol } from "../lib/format";
import { sound } from "../lib/sound";

export function CategoryPill({ c }: { c: Category }) {
  return <span className="pill bg-tile text-ink">{CATEGORY_LABEL[c]}</span>;
}

export function Change({ d, className = "" }: { d: number; className?: string }) {
  const c = Math.round(d * 100);
  if (c === 0) return <span className={`font-semibold tabular-nums text-ink-soft ${className}`}>±0</span>;
  return <span className={`font-semibold tabular-nums ${c > 0 ? "text-basil" : "text-sauce"} ${className}`}>{c > 0 ? `▲ ${c}` : `▼ ${-c}`}</span>;
}

/** Yes/No buttons (or the top three outcomes for a multi-way market). */
export function YesNo({ m, onPick }: { m: MarketSummary; onPick?: (i: number) => void }) {
  if (m.outcomes.length > 2) {
    const top = m.outcomes.map((o, i) => ({ o, i, p: m.prices[i] })).sort((a, b) => b.p - a.p).slice(0, 3);
    return (
      <div className="grid gap-1.5">
        {top.map(({ o, i, p }) => (
          <div key={i} className="relative flex items-center justify-between overflow-hidden rounded-xl bg-tile px-3 py-2 text-sm">
            <motion.div className="absolute inset-y-0 left-0 bg-basil/15" initial={false} animate={{ width: `${p * 100}%` }} />
            <span className="relative truncate font-medium">{o}</span>
            <span className="relative font-bold tabular-nums">{cents(p)}</span>
          </div>
        ))}
        {m.outcomes.length > 3 && <span className="label text-ink-soft">+{m.outcomes.length - 3} more</span>}
      </div>
    );
  }
  const btn = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-transform active:scale-95";
  return (
    <div className="flex gap-2">
      <button type="button" className={`${btn} bg-yes-soft text-basil`} onClick={() => onPick?.(0)}>
        <span className="truncate">{m.outcomes[0]}</span>
        <span className="tabular-nums">{cents(m.prices[0])}</span>
      </button>
      <button type="button" className={`${btn} bg-no-soft text-sauce`} onClick={() => onPick?.(1)}>
        <span className="truncate">{m.outcomes[1]}</span>
        <span className="tabular-nums">{cents(m.prices[1])}</span>
      </button>
    </div>
  );
}

/** Chance bar: green share is the first outcome's price. */
export function ChanceBar({ p }: { p: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-no-soft">
        <motion.div className="rounded-full bg-basil" initial={false} animate={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums">{Math.round(p * 100)}%</span>
    </div>
  );
}

export function MarketCard({ m, i = 0 }: { m: MarketSummary; i?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03 }}
      className="plate grid grid-rows-[auto_1fr_auto_auto_auto] gap-3.5 p-5"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <CategoryPill c={m.category} />
        {m.status === "resolved" ? (
          <span className="pill bg-ink text-plate">Settled: {m.winner != null ? m.outcomes[m.winner] : "?"}</span>
        ) : (
          m.closesAt && <span className="text-ink-soft">{until(m.closesAt)} left</span>
        )}
      </div>
      <Link to={`/m/${m.slug}`} onClick={() => sound.click()} className="font-slab text-lg font-bold leading-snug tracking-[-0.01em] hover:text-sauce">
        {m.title}
      </Link>
      {m.outcomes.length === 2 && <ChanceBar p={m.prices[0]} />}
      <Link to={`/m/${m.slug}`} tabIndex={-1}>
        <YesNo m={m} />
      </Link>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-ink-soft">
        <span>{vol(m.volumeCents)} traded</span>
        {m.status === "open" && <Change d={m.change[0]} />}
      </div>
    </motion.article>
  );
}

/** Section heading with an optional aside. */
export function SectionHead({ title, aside, className = "" }: { title: string; aside?: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${className}`}>
      <h2 className="font-slab text-[clamp(22px,2.4vw,28px)] leading-tight">{title}</h2>
      {aside && <span className="text-sm text-ink-soft">{aside}</span>}
    </div>
  );
}
