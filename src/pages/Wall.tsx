import { motion } from "motion/react";
import { useLeaders, useMe } from "../lib/api";
import { avatarColor, initials, money, signedMoney } from "../lib/format";

const CAPTIONS = [
  "\"Best exchange in da five boroughs.\"",
  "\"I made 40 slices on da Discman spread.\"",
  "\"Tony's a genius. Don't tell him.\"",
  "\"My mother says hi.\"",
  "\"I only come for the garlic knots.\"",
  "\"Fuhgeddaboudit.\"",
];

export function Wall() {
  const { data } = useLeaders();
  const me = useMe();
  const rows = data?.leaders ?? [];
  const top = rows.slice(0, 6);

  return (
    <div className="grid gap-8">
      <div className="text-center">
        <h1 className="font-slab text-[clamp(36px,5vw,52px)] leading-none">Leaderboard</h1>
        <p className="mt-2 text-ink-soft">The Wall of Fame: our finest customers, ranked by net worth.</p>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        {top.map((r, i) => (
          <motion.figure
            key={r.user}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="plate relative overflow-visible p-3 pb-4"
          >
            <div className="grid aspect-square place-items-center rounded-2xl font-slab text-5xl text-white" style={{ background: avatarColor(r.user) }}>
              {initials(r.user)}
            </div>
            <figcaption className="mt-2 grid gap-0.5 text-center">
              <span className="truncate font-semibold leading-tight">{r.user}</span>
              <span className="font-led text-xl text-basil">{money(r.netWorthCents)}</span>
              <span className="text-[11px] italic text-ink-soft">{CAPTIONS[i % CAPTIONS.length]}</span>
            </figcaption>
            {i === 0 && <span className="pill absolute -right-2 -top-2 bg-sauce text-white">#1</span>}
          </motion.figure>
        ))}
      </div>

      <section className="plate overflow-x-auto p-4">
        <table className="w-full min-w-[480px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="label border-b border-grout text-left text-ink-soft">
              <th className="p-2 font-normal">#</th>
              <th className="p-2 font-normal">Customer</th>
              <th className="p-2 font-normal">Neighborhood</th>
              <th className="p-2 text-right font-normal">Net worth</th>
              <th className="p-2 text-right font-normal">vs. C-note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user} className={`border-b border-grout ${me?.username === r.user ? "bg-cheese-soft" : ""}`}>
                <td className="p-2 font-led text-xl">{r.rank}</td>
                <td className="p-2 font-bold">
                  {r.user} {r.isBoss && <span className="pill bg-sauce text-white">Tony</span>}
                </td>
                <td className="p-2 text-ink-soft">{r.hood || "—"}</td>
                <td className="p-2 text-right font-led text-xl">{money(r.netWorthCents)}</td>
                <td className={`p-2 text-right ${r.netWorthCents >= 10_000 ? "text-basil" : "text-sauce"}`}>{signedMoney(r.netWorthCents - 10_000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && rows.length === 0 && <p className="p-4 font-hand text-ink-soft">Wall's empty. Sign up and get your picture up there.</p>}
      </section>
    </div>
  );
}
