import { motion } from "motion/react";
import { Link } from "react-router";
import { MarketCard, SectionHead } from "../components/MarketBits";
import { useMarkets, useStandings } from "../lib/api";

const CARD = {
  blue: "linear-gradient(135deg,#1C4FD6,#10a5c9)",
  red: "linear-gradient(135deg,#C8102E,#ff8a00)",
  purple: "linear-gradient(135deg,#6b1fb1,#e33fa6)",
  green: "linear-gradient(135deg,#0B7A3B,#8BC34A)",
  gold: "linear-gradient(135deg,#9a6a1c,#F2B705)",
} as Record<string, string>;

export function Crust() {
  const { data } = useStandings();
  const markets = useMarkets();
  const crust = (markets.data?.markets ?? []).filter((m) => m.category === "crust");
  const st = data?.standings ?? [];

  return (
    <div className="grid gap-8">
      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section className="plate grid gap-3 p-5">
          <div>
            <p className="label text-basil">Pro Dough Toss League · Season '96</p>
            <h1 className="font-slab text-3xl">Da Standings</h1>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
              <thead>
                <tr className="label border-b-2 border-ink text-left text-ink-soft">
                  <th className="p-1.5 font-normal">Tosser</th>
                  <th className="p-1.5 font-normal">Joint</th>
                  <th className="p-1.5 text-right font-normal">Pies</th>
                  <th className="p-1.5 text-right font-normal">Tosses/Pie</th>
                  <th className="p-1.5 text-right font-normal">Best</th>
                  <th className="p-1.5 text-right font-normal">Ceilings</th>
                  <th className="p-1.5 text-right font-normal">Floor Pies</th>
                  <th className="p-1.5 text-right font-normal">Over %</th>
                </tr>
              </thead>
              <tbody>
                {st.map((s) => (
                  <tr key={s.id} className="border-b border-grout">
                    <td className="p-1.5">
                      <b>{s.name}</b> <span className="text-ink-soft">"{s.nick}"</span>
                    </td>
                    <td className="p-1.5 text-ink-soft">{s.joint}</td>
                    <td className="p-1.5 text-right">{s.pies}</td>
                    <td className="p-1.5 text-right font-led text-xl">{s.avg.toFixed(1)}</td>
                    <td className="p-1.5 text-right">{s.best || "—"}</td>
                    <td className="p-1.5 text-right">{s.ceilings}</td>
                    <td className={`p-1.5 text-right ${s.floors ? "font-bold text-sauce" : ""}`}>{s.floors}</td>
                    <td className="p-1.5 text-right">{s.pies ? `${Math.round((s.overs / s.pies) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-soft">
            Stats come from every live pie tossed in <Link to="/kitchen" className="text-sauce underline">Da Back Kitchen</Link>. A new pie goes up every 2½ minutes, all day, all night. Nobody sleeps.
          </p>
        </section>

        <section className="grid gap-4">
          <SectionHead title="Collect Da Tossers" aside="'96 series · comes with 1 stick of gum" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {st.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1, rotate: [-2, 1.5, -0.5, 2, -1][i % 5] }}
                whileHover={{ scale: 1.06, rotate: 0, zIndex: 2 }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 120 }}
                className="relative grid gap-1.5 rounded-lg p-2 shadow-lg"
                style={{ background: CARD[s.color] }}
              >
                <div
                  className="relative aspect-[3/3.2] max-w-full rounded"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 30%,#FFF1CC 0 22%,#F0C987 23% 27%,transparent 28%),radial-gradient(circle at 50% 110%,#f5f5f5 0 38%,transparent 39%),radial-gradient(circle at 50% 62%,#d9a47a 0 13%,transparent 14%),linear-gradient(#cfd8dc,#8fa3ad)",
                  }}
                >
                  <span className="absolute left-1.5 top-1 font-slab text-xs text-plate drop-shadow">#{i + 1}</span>
                </div>
                <div className="grid rounded-sm bg-plate px-1.5 py-1 leading-tight">
                  <b className="truncate font-slab text-[13px]">{s.name}</b>
                  <span className="font-hand text-xs text-sauce">"{s.nick}"</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  {[
                    [s.avg.toFixed(1), "TPP"],
                    [String(s.best || "—"), "BEST"],
                    [String(s.floors), "FLR"],
                  ].map(([v, k]) => (
                    <div key={k} className="rounded-sm bg-black/35 py-0.5 font-led text-lg leading-none text-plate">
                      {v}
                      <small className="block font-board text-[9px] tracking-widest">{k}</small>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-4">
        <SectionHead title="Events & Prop Bets" aside="resolved by Sal, who was there" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {crust.map((m, i) => (
            <MarketCard key={m.slug} m={m} i={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
