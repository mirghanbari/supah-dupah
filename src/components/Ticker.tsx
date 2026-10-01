import { useTicker } from "../lib/api";

const TONE = {
  up: "text-basil",
  dn: "text-sauce",
  halt: "rounded bg-sauce px-1.5 text-white",
  plain: "text-ink-soft",
};

export function Ticker() {
  const { data } = useTicker();
  const items = data?.items ?? [{ text: "Loading prices…", tone: "plain" as const }];
  const row = (
    <span className="inline-flex shrink-0 gap-8 pr-8">
      {items.map((it, i) => (
        <span key={i} className={TONE[it.tone]}>
          {it.text}
        </span>
      ))}
    </span>
  );
  return (
    <div className="overflow-hidden whitespace-nowrap border-b border-grout bg-plate py-1.5 text-[13px] font-semibold tabular-nums" aria-label="Price ticker">
      <div className="inline-flex w-max hover:[animation-play-state:paused]" style={{ animation: `marquee ${Math.max(60, items.length * 7)}s linear infinite` }}>
        {row}
        <span aria-hidden="true" className="inline-flex">
          {row}
        </span>
      </div>
    </div>
  );
}
