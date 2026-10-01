import { useTicker } from "../lib/api";

const TONE = {
  up: "text-up",
  dn: "text-dn",
  halt: "bg-sauce px-1 text-plate",
  plain: "text-led",
};

export function Ticker() {
  const { data } = useTicker();
  const items = data?.items ?? [{ text: "OVEN'S WARMIN' UP · TICKER COMIN' RIGHT UP", tone: "plain" as const }];
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
    <div className="overflow-hidden whitespace-nowrap border-b-2 border-[#332] bg-black py-[3px] font-led text-xl text-led" aria-label="Price ticker">
      <div className="inline-flex w-max hover:[animation-play-state:paused]" style={{ animation: `marquee ${Math.max(60, items.length * 7)}s linear infinite` }}>
        {row}
        <span aria-hidden="true" className="inline-flex">
          {row}
        </span>
      </div>
    </div>
  );
}
