import { useState } from "react";
import { Link } from "react-router";
import { sharesForSpend } from "../../shared/lmsr";
import { api, ApiError, useMe, useMoneyMutation } from "../lib/api";
import { money, shares as fmtShares } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

type Props = {
  slug: string;
  title: string;
  outcomes: string[];
  prices: number[];
  b: number;
  open: boolean;
  closedNote?: string;
  mine: { outcome: number; shares: number; costCents: number }[];
  pick: number;
  onPick: (i: number) => void;
  table?: string;
};

const TOPPINGS = [
  { id: "plain", label: "Regular", note: "the amount above" },
  { id: "cheese", label: "Double", note: "twice the amount" },
  { id: "stuffed", label: "All in", note: "everything you've got, up to $1,000. don't." },
] as const;

export function GuestCheck({ slug, title, outcomes, prices, b, open, closedNote, mine, pick, onPick, table = "B-12" }: Props) {
  const me = useMe();
  const [amount, setAmount] = useState("5");
  const [topping, setTopping] = useState<(typeof TOPPINGS)[number]["id"]>("plain");
  const [err, setErr] = useState<string | null>(null);

  const base = Math.max(0, Math.round(parseFloat(amount || "0") * 100));
  const spend =
    topping === "stuffed" ? Math.min(me?.balanceCents ?? 0, 100_000) : topping === "cheese" ? Math.min(base * 2, 100_000) : Math.min(base, 100_000);
  const q = prices.map((p) => b * Math.log(Math.max(p, 1e-9)));
  const est = spend > 0 ? sharesForSpend(q, b, pick, spend / 100) : 0;
  const avg = est > 0 ? spend / est : 0;

  const buy = useMoneyMutation((a: { outcome: number; cents: number }) => api.buy(slug, a.outcome, a.cents));
  const sell = useMoneyMutation((a: { outcome: number; shares: number }) => api.sell(slug, a.outcome, a.shares));

  const submit = async () => {
    setErr(null);
    sound.click();
    try {
      const r = await buy.mutateAsync({ outcome: pick, cents: spend });
      sound.bell();
      void sound.line(topping === "stuffed" ? "stuffed-crust" : "order-up");
      fx.ticket(
        `${fmtShares(r.shares)} × ${outcomes[pick]}`,
        [
          ["Your order", money(r.cents)],
          ["Avg price", `${Math.round((r.cents / r.shares) * 10) / 10}¢`],
          ["Coke", "on da house"],
        ],
        `pays ${money(Math.round(r.shares * 100))}`,
      );
      if (topping === "stuffed") fx.stamp("ALL IN!", "bad", "stuffed crust");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Somethin' burned.");
      sound.aww();
    }
  };

  const sendBack = async (outcome: number, s: number) => {
    setErr(null);
    try {
      const r = await sell.mutateAsync({ outcome, shares: s });
      sound.register();
      fx.page(`SENT BACK ${fmtShares(r.shares)} ${outcomes[outcome]} · GOT ${money(r.cents)}`, "info");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Somethin' burned.");
    }
  };

  return (
    <aside className="guest-check text-sm" aria-label="Bet slip">
      <div className="flex items-center justify-between border-b border-grout px-5 py-4">
        <b className="font-slab text-lg">Place a bet</b>
        <span className="pill bg-tile text-ink-soft">Ticket {table}</span>
      </div>
      <div className="grid gap-4 p-5">
        <div className="font-semibold leading-snug">{title}</div>

        <div className="grid gap-1.5">
          <span className="label text-ink-soft">Your pick</span>
          <div className={`grid gap-2 ${outcomes.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {outcomes.map((o, i) => {
              const no = i === 1 && outcomes.length === 2;
              const on = pick === i;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    sound.click();
                    onPick(i);
                  }}
                  className={`flex h-12 items-center justify-between gap-2 rounded-xl px-3.5 text-left font-bold transition-colors ${
                    on ? (no ? "bg-sauce text-white" : "bg-basil text-white") : no ? "bg-no-soft text-sauce" : "bg-yes-soft text-basil"
                  }`}
                >
                  <span className="truncate">{o}</span>
                  <span className="tabular-nums">{Math.round(prices[i] * 100)}¢</span>
                </button>
              );
            })}
          </div>
        </div>

        {!me ? (
          <div className="grid gap-3 rounded-2xl bg-tile p-4 text-center">
            <span className="font-semibold">Sign up to place bets. It's free, and it's fake money.</span>
            <Link to="/join" className="btn btn-red">
              Join free
            </Link>
          </div>
        ) : !open ? (
          <div className="rounded-2xl bg-tile p-4 text-center font-semibold">{closedNote ?? "Betting's closed on this one."}</div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <label htmlFor={`amt-${slug}`} className="label text-ink-soft">
                Amount ($)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`amt-${slug}`}
                  inputMode="decimal"
                  value={topping === "stuffed" ? (spend / 100).toFixed(2) : amount}
                  disabled={topping === "stuffed"}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="field min-w-0 flex-1 text-lg font-bold tabular-nums"
                />
                {[1, 5, 20].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="h-11 shrink-0 rounded-xl border border-grout px-3 font-semibold hover:bg-tile"
                    onClick={() => {
                      setTopping("plain");
                      setAmount(String(d));
                    }}
                  >
                    ${d}
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="grid gap-1.5">
              <legend className="label mb-1.5 text-ink-soft">Size</legend>
              {TOPPINGS.map((t) => (
                <label key={t.id} className="flex items-baseline gap-2">
                  <input type="radio" name={`top-${slug}`} checked={topping === t.id} onChange={() => setTopping(t.id)} className="accent-[var(--color-sauce)]" />
                  <span className="font-medium">{t.label}</span>
                  <small className="text-ink-soft">{t.note}</small>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-1.5 rounded-2xl bg-tile p-4 tabular-nums">
              <div className="flex justify-between">
                <span className="text-ink-soft">You pay</span>
                <span className="font-semibold">{money(spend)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Avg price</span>
                <span className="font-semibold">{avg ? `${avg.toFixed(1)}¢` : "—"}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-grout pt-2">
                <span className="font-semibold">Pays if right</span>
                <span className="font-slab text-xl text-basil">{money(Math.round(est * 100))}</span>
              </div>
            </div>

            <button type="button" className="btn btn-red h-[52px] w-full text-base" disabled={spend < 1 || buy.isPending} onClick={submit}>
              {buy.isPending ? "Placing…" : `Bet ${money(spend)} on ${outcomes[pick] ?? ""}`}
            </button>
          </>
        )}

        {err && <p className="rounded-xl bg-no-soft px-3 py-2 text-center font-semibold text-sauce">{err}</p>}

        {me && mine.length > 0 && (
          <div className="grid gap-2 border-t border-grout pt-3">
            <span className="label text-ink-soft">Your position</span>
            {mine.map((p) => (
              <div key={p.outcome} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{fmtShares(p.shares)}</b> × {outcomes[p.outcome]} <small className="text-ink-soft">(paid {money(p.costCents)})</small>
                </span>
                {open && (
                  <span className="flex gap-1.5">
                    <button className="h-9 rounded-lg border border-grout px-2.5 text-xs font-semibold hover:bg-tile" disabled={sell.isPending} onClick={() => sendBack(p.outcome, p.shares / 2)}>
                      Sell ½
                    </button>
                    <button className="h-9 rounded-lg bg-ink px-2.5 text-xs font-semibold text-plate" disabled={sell.isPending} onClick={() => sendBack(p.outcome, p.shares)}>
                      Sell all
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
