import { motion } from "motion/react";
import { Link } from "react-router";
import type { MarketSummary } from "../../shared/types";

function FlipText({ text, delay }: { text: string; delay: number }) {
  return (
    <span aria-label={text}>
      {[...text].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="inline-block"
          style={{ transformOrigin: "50% 0%", whiteSpace: "pre" }}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ delay: delay + i * 0.012, type: "spring", stiffness: 400, damping: 18 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/** Felt letterboard menu. Every hot market reads like a special. */
export function Letterboard({ markets, title = "Today's Specials" }: { markets: MarketSummary[]; title?: string }) {
  return (
    <aside className="letterboard grid content-start gap-2 p-4 sm:p-5" aria-label={title}>
      <h2 className="text-center text-lg font-semibold tracking-[.25em] text-cheese">{title}</h2>
      {markets.map((m, i) => {
        const p = Math.round(m.prices[0] * 100);
        const short = m.title.replace(/\?$/, "").replace(/^(Will|Does|Is) (the )?/i, "");
        return (
          <Link key={m.slug} to={`/m/${m.slug}`} className="group flex items-baseline gap-2 text-[15px] tracking-wide hover:text-cheese">
            <span className="min-w-0 truncate">
              <FlipText text={short} delay={i * 0.18} />
            </span>
            <span className="min-w-3 flex-1 -translate-y-1 border-b-2 border-dotted border-[#6d665e]" />
            <b className="whitespace-nowrap font-semibold">
              {m.outcomes[0].length <= 4 ? m.outcomes[0] : m.outcomes[0].split(" ")[0]} <em className="not-italic text-up">{p}¢</em>
            </b>
          </Link>
        );
      })}
      <p className="mt-1 text-center text-[11px] tracking-[.12em] text-[#9d958b]">No substitutions · Prices subject to Sal</p>
    </aside>
  );
}
