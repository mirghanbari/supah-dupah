import { motion } from "motion/react";
import { Link, Navigate } from "react-router";
import { api, useMeQuery, useMoneyMutation, useTab } from "../lib/api";
import { money, shares, signedMoney } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

export function Tab() {
  const meQ = useMeQuery();
  const me = meQ.data?.user ?? null;
  const { data } = useTab(!!me);
  const bail = useMoneyMutation(() => api.bailout());

  if (meQ.isSuccess && !me) return <Navigate to="/join?mode=login" replace />;
  if (!data || !me) return <div className="mx-auto h-96 max-w-md animate-pulse bg-plate" />;

  const pl = data.netWorthCents - 10_000;
  const now = new Date();

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
      <motion.div initial={{ y: -40, opacity: 0, clipPath: "inset(0 0 100% 0)" }} animate={{ y: 0, opacity: 1, clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 1.1, ease: "easeOut" }}>
        <div className="plate mx-auto grid max-w-[400px] gap-1 p-6 text-[15px] leading-snug tabular-nums">
          <div className="text-center text-[13px] text-ink-soft">
            <b className="font-slab text-lg text-ink">Statement</b>
            <br />
            Supah Dupah · Est. 1994
            <br />
            #{String(me.id).padStart(6, "0")} · {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            <br />
            {me.username}
          </div>
          <div className="my-2 border-t border-grout" />
          {data.positions.length === 0 && data.van.length === 0 && <div className="text-center text-ink-soft">Nothin' on your tab yet.</div>}
          {data.positions.map((p) => (
            <Link key={`${p.slug}-${p.outcome}`} to={`/m/${p.slug}`} className="grid rounded-lg px-1 py-0.5 hover:bg-tile">
              <span className="truncate font-medium">{p.title}</span>
              <span className="flex justify-between gap-2 pl-3">
                <span>
                  {shares(p.shares)} {p.outcome} @{Math.round(p.price * 100)}¢
                </span>
                <span className={p.valueCents >= p.costCents ? "text-basil" : "text-sauce"}>{signedMoney(p.valueCents - p.costCents)}</span>
              </span>
            </Link>
          ))}
          {data.van.map((v) => (
            <Link key={v.id} to="/van" className="flex justify-between gap-2 rounded-lg px-1 py-0.5 hover:bg-tile">
              <span>
                {v.side.toUpperCase()} {v.boxes}BX {v.symbol}
              </span>
              <span className={v.pnlCents >= 0 ? "text-basil" : "text-sauce"}>{signedMoney(v.pnlCents)}</span>
            </Link>
          ))}
          <div className="my-2 border-t border-grout" />
          <div className="flex justify-between">
            <span className="text-ink-soft">Cash</span>
            <span>{money(data.balanceCents)}</span>
          </div>
          <div className="flex justify-between font-slab text-xl">
            <b>Net worth</b>
            <b>{money(data.netWorthCents)}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">vs. your starting $100</span>
            <span className={pl >= 0 ? "text-basil" : "text-sauce"}>{signedMoney(pl)}</span>
          </div>
          <div className="mt-3 text-center text-[13px] text-ink-soft">We are happy to serve you.</div>
        </div>
      </motion.div>

      <div className="grid gap-6">
        <div className="plate grid gap-3 p-5">
          <h1 className="font-slab text-3xl">Your Tab</h1>
          <p className="text-sm text-ink-soft">
            Everything you got going, marked at today's prices. Money comes in when Tony settles a market, or when a live pie hits the oven.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-cheese"
              onClick={() => {
                void sound.line("cash-out");
                fx.page("TAKE IT TO GO? IT'S PLAY MONEY. YOU CAN'T TAKE NOTHIN' NOWHERE.");
              }}
            >
              Take It To Go (Cash Out)
            </button>
            {data.canBailout && (
              <button
                className="btn btn-green"
                disabled={bail.isPending}
                onClick={async () => {
                  await bail.mutateAsync(undefined);
                  sound.register();
                  void sound.line("bailout");
                  fx.stamp("TONY SPOTTED YA", "good", "+$20.00");
                }}
              >
                Ask Tony for a twenty
              </button>
            )}
          </div>
          {!data.canBailout && data.balanceCents < 500 && <p className="font-hand text-sauce">Tony already spotted you today. Come back tomorrow.</p>}
        </div>

        <section className="plate grid gap-2 p-5">
          <h2 className="font-slab text-xl">Ledger</h2>
          {data.ledger.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-grout py-1 text-sm">
              <span className="min-w-0">
                <span className={`pill mr-2 ${l.kind === "payout" ? "bg-basil text-white" : l.kind === "loss" ? "bg-sauce text-white" : "bg-tile text-ink"}`}>{l.kind}</span>
                {l.memo}
              </span>
              <span className={`shrink-0 font-led text-xl ${l.cents >= 0 ? "text-basil" : "text-sauce"}`}>{signedMoney(l.cents)}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
