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
  { id: "plain", label: "Plain", note: "regular order" },
  { id: "cheese", label: "Extra Cheese", note: "doubles it" },
  { id: "stuffed", label: "Stuffed Crust", note: "everything you got, up to $1,000. don't." },
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
      sound.say(topping === "stuffed" ? "Stuffed crust! You're crazy!" : "Order up!");
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
    <aside className="guest-check text-sm" aria-label="Order ticket">
      <div className="flex items-baseline justify-between bg-basil px-4 py-2.5 font-board uppercase tracking-widest text-check">
        <b className="font-slab text-lg normal-case tracking-normal">Guest Check</b>
        <span className="text-[11px]">
          Table <span className="bg-check px-1.5 font-led text-lg tracking-normal text-sauce">{table}</span>
        </span>
      </div>
      <div className="grid gap-3 px-4 pb-5 pt-3">
        <div className="font-hand text-base leading-tight text-pen">{title}</div>

        <div className="grid gap-1">
          <span className="label text-check-line">Whaddaya want</span>
          <div className={`grid gap-1.5 ${outcomes.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {outcomes.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  sound.click();
                  onPick(i);
                }}
                className={`flex items-baseline justify-between gap-2 rounded border-2 px-2 py-1.5 text-left font-slab text-sm transition-colors ${
                  pick === i
                    ? i === 1 && outcomes.length === 2
                      ? "border-sauce bg-sauce text-plate"
                      : "border-basil bg-basil text-plate"
                    : "border-check-line bg-transparent text-check-ink"
                }`}
              >
                <span className="truncate">{o}</span>
                <span className="font-led text-xl font-normal">{Math.round(prices[i] * 100)}¢</span>
              </button>
            ))}
          </div>
        </div>

        {!me ? (
          <div className="grid gap-2 rounded bg-plate/70 p-3 text-center">
            <span className="font-hand text-lg text-sauce">We don't serve strangers.</span>
            <Link to="/join" className="btn btn-red">
              I Know A Guy →
            </Link>
          </div>
        ) : !open ? (
          <div className="rounded bg-plate/70 p-3 text-center font-hand text-lg text-sauce">{closedNote ?? "Kitchen's closed on dis one."}</div>
        ) : (
          <>
            <div className="grid gap-1">
              <label htmlFor={`amt-${slug}`} className="label text-check-line">
                How much ($)
              </label>
              <div className="flex items-end gap-2">
                <input
                  id={`amt-${slug}`}
                  inputMode="decimal"
                  value={topping === "stuffed" ? (spend / 100).toFixed(2) : amount}
                  disabled={topping === "stuffed"}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full border-0 border-b-2 border-check-line bg-transparent px-0 py-0.5 font-hand text-2xl text-pen outline-none"
                />
                {[1, 5, 20].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="label rounded border border-check-line px-1.5 py-1 text-check-ink hover:bg-plate"
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

            <fieldset className="grid gap-1">
              <legend className="label mb-1 text-check-line">Toppings</legend>
              {TOPPINGS.map((t) => (
                <label key={t.id} className="flex items-baseline gap-2">
                  <input type="radio" name={`top-${slug}`} checked={topping === t.id} onChange={() => setTopping(t.id)} className="accent-[var(--color-basil)]" />
                  <span>{t.label}</span>
                  <small className="text-check-line">({t.note})</small>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-1 border-t-2 border-check-line pt-2 tabular-nums">
              <div className="flex justify-between">
                <span>You pay</span>
                <span>{money(spend)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg price</span>
                <span>{avg ? `${avg.toFixed(1)}¢` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Coke</span>
                <span>on da house</span>
              </div>
              <div className="flex justify-between font-slab text-base">
                <span>Pays if right</span>
                <span className="font-hand text-2xl text-pen">{money(Math.round(est * 100))}</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full rounded bg-sauce py-3.5 font-slab text-xl tracking-wide text-plate shadow-[0_4px_0_var(--color-sauce-dk)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60"
              disabled={spend < 1 || buy.isPending}
              onClick={submit}
            >
              {buy.isPending ? "Cookin'…" : "ORDER UP!"}
            </button>
          </>
        )}

        {err && <p className="rounded bg-sauce px-2 py-1.5 text-center font-hand text-plate">{err}</p>}

        {me && mine.length > 0 && (
          <div className="grid gap-1.5 border-t-2 border-dashed border-check-line pt-2">
            <span className="label text-check-line">On your tab</span>
            {mine.map((p) => (
              <div key={p.outcome} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{fmtShares(p.shares)}</b> × {outcomes[p.outcome]} <small className="text-check-line">(paid {money(p.costCents)})</small>
                </span>
                {open && (
                  <span className="flex gap-1">
                    <button className="label rounded bg-check-ink px-2 py-1 text-check" disabled={sell.isPending} onClick={() => sendBack(p.outcome, p.shares / 2)}>
                      Send back ½
                    </button>
                    <button className="label rounded bg-sauce px-2 py-1 text-plate" disabled={sell.isPending} onClick={() => sendBack(p.outcome, p.shares)}>
                      All
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-center text-[11px] text-check-line">Thank you · Come again · No refunds on tosses already tossed</p>
      </div>
    </aside>
  );
}
