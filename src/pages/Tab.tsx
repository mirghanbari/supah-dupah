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
        <div className="receipt mx-auto grid max-w-[400px] gap-0.5 px-5 pb-7 pt-5 text-lg leading-snug text-[#222] shadow-xl">
          <div className="text-center">
            SUPAH DUPAH EXCH &amp; PIZZ
            <br />
            BENSONHURST, NY · EST. 1994
            <br />
            CHK #{String(me.id).padStart(6, "0")} · {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            <br />
            GUEST: {me.username.toUpperCase()}
          </div>
          <div className="my-1.5 border-t-2 border-dashed border-[#999]" />
          {data.positions.length === 0 && data.van.length === 0 && <div className="text-center text-[#777]">NOTHIN' ON DA TAB</div>}
          {data.positions.map((p) => (
            <Link key={`${p.slug}-${p.outcome}`} to={`/m/${p.slug}`} className="grid hover:bg-tile">
              <span className="truncate">{p.title.toUpperCase()}</span>
              <span className="flex justify-between gap-2 pl-3">
                <span>
                  {shares(p.shares)} {p.outcome} @{Math.round(p.price * 100)}¢
                </span>
                <span className={p.valueCents >= p.costCents ? "text-basil" : "text-sauce"}>{signedMoney(p.valueCents - p.costCents)}</span>
              </span>
            </Link>
          ))}
          {data.van.map((v) => (
            <Link key={v.id} to="/van" className="flex justify-between gap-2 hover:bg-tile">
              <span>
                {v.side.toUpperCase()} {v.boxes}BX {v.symbol}
              </span>
              <span className={v.pnlCents >= 0 ? "text-basil" : "text-sauce"}>{signedMoney(v.pnlCents)}</span>
            </Link>
          ))}
          <div className="my-1.5 border-t-2 border-dashed border-[#999]" />
          <div className="flex justify-between">
            <span>STORE CREDIT</span>
            <span>{money(data.balanceCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>COKE</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between text-2xl">
            <b>NET WORTH</b>
            <b>{money(data.netWorthCents)}</b>
          </div>
          <div className="flex justify-between">
            <span>VS. TONY'S C-NOTE</span>
            <span className={pl >= 0 ? "text-basil" : "text-sauce"}>{signedMoney(pl)}</span>
          </div>
          <div className="mt-3 text-center font-slab text-sm tracking-wider text-[#1b4fa0]">
            WE ARE HAPPY
            <br />
            TO SERVE YOU
          </div>
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
          <h2 className="font-slab text-xl">Da Ledger</h2>
          {data.ledger.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-grout py-1 text-sm">
              <span className="min-w-0">
                <span className={`pill mr-2 ${l.kind === "payout" ? "bg-basil text-plate" : l.kind === "loss" ? "bg-sauce text-plate" : "bg-tile text-ink"}`}>{l.kind}</span>
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
