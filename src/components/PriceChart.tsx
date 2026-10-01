import { shopNow } from "../lib/clock";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

const LINE = ["var(--color-basil)", "var(--color-sauce)", "var(--color-pen)", "var(--color-cheese)", "var(--color-ink)", "#8E5BD9", "#0E9AA7", "var(--color-crust)"];

type Pt = { at: number; prices: number[] };

/** Step chart of every outcome's price, drawn on a paper plate. */
export function PriceChart({ history, outcomes, now = shopNow() }: { history: Pt[]; outcomes: string[]; now?: number }) {
  const [range, setRange] = useState<"1h" | "1d" | "all">("all");
  const W = 640;
  const H = 240;
  const L = 44;
  const R = 16;
  const T = 14;
  const B = 28;

  const pts = useMemo(() => {
    const cutoff = range === "1h" ? now - 3_600_000 : range === "1d" ? now - 86_400_000 : 0;
    const before = [...history].reverse().find((h) => h.at < cutoff);
    const inside = history.filter((h) => h.at >= cutoff);
    const out = before ? [{ at: cutoff, prices: before.prices }, ...inside] : inside;
    if (out.length) out.push({ at: now, prices: out[out.length - 1].prices });
    return out;
  }, [history, range, now]);

  if (pts.length < 2) return <div className="p-6 text-center text-ink-soft">No trades yet. Be the first.</div>;

  const t0 = pts[0].at;
  const t1 = Math.max(pts[pts.length - 1].at, t0 + 1);
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const series = outcomes.map((_, i) => {
    let d = "";
    pts.forEach((p, k) => {
      const X = x(p.at).toFixed(1);
      const Y = y(p.prices[i] ?? 0).toFixed(1);
      d += k === 0 ? `M${X},${Y}` : `H${X}V${Y}`;
    });
    return d;
  });
  const last = pts[pts.length - 1];
  const fmt = (t: number) => {
    const d = new Date(t);
    return t1 - t0 > 86_400_000 * 1.5 ? `${d.getMonth() + 1}/${d.getDate()}` : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  const shown = outcomes.length > 2 ? outcomes.map((_, i) => i) : [0];

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-xs">
          {shown.map((i) => (
            <span key={i} className="flex items-center gap-1.5">
              <i className="inline-block h-1 w-4 rounded" style={{ background: LINE[i % LINE.length] }} />
              {outcomes[i]} <b className="font-semibold tabular-nums">{Math.round((last.prices[i] ?? 0) * 100)}¢</b>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {(["1h", "1d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`label rounded-full px-3 py-1.5 ${range === r ? "bg-ink text-plate" : "text-ink-soft hover:bg-tile"}`}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Price history for ${outcomes[0]}`}>
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-grout)" />
            <text x={L - 8} y={y(g) + 5} textAnchor="end" fontFamily="DM Sans, sans-serif" fontSize="12" fill="var(--color-ink-soft)">
              {g * 100}¢
            </text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--color-grout)" strokeWidth="1.5" />
        <text x={L} y={H - 6} fontFamily="DM Sans, sans-serif" fontSize="12" fill="var(--color-ink-soft)">
          {fmt(t0)}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" fontFamily="DM Sans, sans-serif" fontSize="12" fill="var(--color-ink-soft)">
          now
        </text>
        {shown.length === 1 && <path d={`${series[0]}V${y(0)}H${L}Z`} fill="var(--color-basil)" fillOpacity={0.12} />}
        {shown.map((i) => (
          <motion.path
            key={`${i}-${range}`}
            d={series[i]}
            fill="none"
            stroke={LINE[i % LINE.length]}
            strokeWidth={shown.length === 1 ? 3 : 2.2}
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        ))}
        {shown.map((i) => (
          <circle key={i} cx={x(last.at)} cy={y(last.prices[i] ?? 0)} r="5.5" fill={LINE[i % LINE.length]} stroke="var(--color-plate)" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

/** Tiny sparkline for the van board. */
export function Sparkline({ data, w = 120, h = 32 }: { data: number[]; w?: number; h?: number }) {
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = Math.max(1, hi - lo);
  const d = data.map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join("");
  const up = data[data.length - 1] >= data[0];
  const color = up ? "var(--color-basil)" : "var(--color-sauce)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={`${d}L${w - 2},${h}L2,${h}Z`} fill={color} fillOpacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx={w - 2} cy={h - 3 - ((data[data.length - 1] - lo) / span) * (h - 6)} r="2.5" fill={color} />
    </svg>
  );
}
