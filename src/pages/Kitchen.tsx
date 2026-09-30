import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { TOSS_B, tosserForRound } from "../../shared/toss";
import { DoughStage } from "../components/DoughStage";
import { GuestCheck } from "../components/GuestCheck";
import { SectionHead } from "../components/MarketBits";
import { useKitchen } from "../lib/api";
import { clockOffset, shopNow, useNow } from "../lib/clock";
import { ago, money, shares, vol } from "../lib/format";

export function Kitchen() {
  const { data } = useKitchen();
  const now = useNow(500);
  const [pick, setPick] = useState(0);
  const qc = useQueryClient();
  const round = data?.current.round;
  useEffect(() => setPick(0), [round]);

  // Don't wait for the next poll at the big moments: tossing starts, round ends.
  const closesAt = data?.current.closesAt;
  const endsAt = data?.current.endsAt;
  useEffect(() => {
    if (!closesAt || !endsAt) return;
    const timers = [closesAt + 250, endsAt + 250]
      .map((t) => t - shopNow())
      .filter((ms) => ms > 0)
      .map((ms) => setTimeout(() => qc.invalidateQueries({ queryKey: ["kitchen"] }), ms));
    return () => timers.forEach(clearTimeout);
  }, [closesAt, endsAt, qc]);

  if (!data) {
    return (
      <div className="grid place-items-center gap-3 p-16">
        <div className="h-16 w-16 animate-spin rounded-full border-8 border-cheese border-t-sauce" />
        <p className="font-hand text-lg">Flourin' da counter…</p>
      </div>
    );
  }
  const r = data.current;
  const betting = now < r.closesAt;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-basil">Pro Dough Toss League · Live, every 2½ minutes, forever</p>
          <h1 className="font-slab text-[clamp(26px,3.4vw,40px)] leading-tight">
            {r.tosser.name} <span className="text-sauce">"{r.tosser.nick}"</span>
          </h1>
          <p className="text-sm text-ink-soft">
            {r.tosser.joint} · {r.tosser.bio}
          </p>
        </div>
        <div className="led rounded px-3 py-1 text-xl">
          {vol(r.volumeCents)} ON DIS PIE
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid min-w-0 gap-5">
          <DoughStage round={r} clockOffset={clockOffset()} />

          <section className="grid gap-3">
            <SectionHead title="Last Few Pies" aside="the scoreboard don't lie" />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {data.recent.map((x, i) => (
                <motion.div
                  key={x.round}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`plate grid w-28 shrink-0 gap-0.5 p-2.5 text-center ${x.floor ? "ring-2 ring-sauce" : ""}`}
                >
                  <span className="label truncate text-[10px] text-ink-soft">{x.nick}</span>
                  <span className="font-led text-5xl leading-none">{x.count}</span>
                  <span className={`pill mx-auto ${x.over ? "bg-basil text-plate" : "bg-sauce text-plate"}`}>
                    {x.over ? "Over" : "Under"} {x.line}
                  </span>
                  {x.floor && <span className="label text-[10px] text-sauce">Floor pie</span>}
                  {x.ceilings > 0 && <span className="label text-[10px] text-ink-soft">{x.ceilings}× ceiling</span>}
                </motion.div>
              ))}
              {data.recent.length === 0 && <p className="font-hand text-ink-soft">First pie of the day. History starts now.</p>}
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:sticky lg:top-4">
          <GuestCheck
            slug={r.slug}
            title={`${r.tosser.nick}: over or under ${r.line}?`}
            outcomes={[`OVER ${r.line}`, `UNDER ${r.line}`]}
            prices={r.prices}
            b={TOSS_B}
            open={betting}
            closedNote="Dough's in da air. Orders closed. Watch!"
            mine={r.mine}
            pick={pick}
            onPick={setPick}
            table={`P-${r.round % 1000}`}
          />

          <section className="plate grid gap-2 p-4">
            <h2 className="font-slab text-lg">Da Line</h2>
            {r.trades.length === 0 && <p className="font-hand text-sm text-ink-soft">Nobody's bet yet. Suspicious.</p>}
            {r.trades.slice(0, 8).map((t, i) => (
              <div key={i} className="flex justify-between gap-2 text-[13px] tabular-nums">
                <span className="truncate">
                  <b>{t.user}</b> {t.shares > 0 ? "took" : "dumped"} {t.outcome === 0 ? "OVER" : "UNDER"} ×{shares(Math.abs(t.shares))}
                </span>
                <span className="shrink-0 text-ink-soft">
                  {money(Math.abs(t.cents))} · {ago(t.at, now)}
                </span>
              </div>
            ))}
          </section>

          <section className="plate grid gap-2 p-4">
            <h2 className="font-slab text-lg">On Deck</h2>
            {[1, 2, 3, 4].map((k) => {
              const t = tosserForRound(r.round + k);
              return (
                <div key={k} className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    <b>{t.name}</b> <span className="text-ink-soft">"{t.nick}"</span>
                  </span>
                  <span className="font-led text-lg text-ink-soft">in {Math.round((r.endsAt + (k - 1) * 150_000 - now) / 60_000)}m</span>
                </div>
              );
            })}
            <Link to="/crust" className="label mt-1 text-basil hover:text-sauce">
              Full standings →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
