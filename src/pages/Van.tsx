import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import type { VanRow } from "../../shared/types";
import { Led } from "../components/Led";
import { SectionHead } from "../components/MarketBits";
import { Sparkline } from "../components/PriceChart";
import { api, ApiError, useMe, useMoneyMutation, useVan } from "../lib/api";
import { useNow } from "../lib/clock";
import { money, signedMoney } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

const HEAT = ["bg-yes-soft text-basil", "bg-cheese-soft text-cheese", "bg-no-soft text-sauce", "bg-sauce text-white", "bg-felt text-white"];

function Ticket({ row, onClose }: { row: VanRow; onClose: () => void }) {
  const me = useMe();
  const [side, setSide] = useState<"long" | "short">("long");
  const [boxes, setBoxes] = useState(5);
  const [err, setErr] = useState<string | null>(null);
  const open = useMoneyMutation((a: { side: "long" | "short"; boxes: number }) => api.vanOpen(row.symbol, a.side, a.boxes));
  const per = side === "long" ? row.price : 100 - row.price;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="grid grid-cols-1 gap-3 border-t border-grout bg-tile p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["long", "short"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`h-10 rounded-full border px-4 text-sm font-semibold ${side === s ? (s === "long" ? "border-basil bg-basil text-white" : "border-sauce bg-sauce text-white") : "border-grout bg-plate"}`}
              >
                {s === "long" ? "Long (it's goin' up)" : "Short (it's garbage)"}
              </button>
            ))}
          </div>
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="label text-ink-soft">Boxes</span>
            <input id={`boxes-${row.symbol}`} type="range" min={1} max={100} value={boxes} onChange={(e) => setBoxes(Number(e.target.value))} className="w-44 accent-[var(--color-sauce)]" />
            <b className="font-led text-2xl">{boxes}</b>
            <span className="text-ink-soft">
              × {per}¢ = <b className="text-ink">{money(per * boxes)}</b>
            </span>
          </label>
          <p className="text-xs text-ink-soft">
            {side === "long" ? `Pay ${row.price}¢ a box now, get the going price back when you close.` : `Pay ${100 - row.price}¢ a box now, get 100 minus the going price back when you close.`} Every point is a penny a box.
          </p>
          {err && <p className="text-sm font-semibold text-sauce">{err}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-cheese text-sm" onClick={onClose}>
            Nah
          </button>
          {me ? (
            <button
              className={`btn ${side === "long" ? "btn-green" : "btn-red"}`}
              disabled={open.isPending}
              onClick={async () => {
                setErr(null);
                try {
                  const r = await open.mutateAsync({ side, boxes });
                  sound.register();
                  void sound.line(side === "long" ? "van-long" : "van-short");
                  fx.ticket(`${side.toUpperCase()} ${boxes} BX ${row.symbol}`, [["Price", `${r.price}¢`], ["Boxes", String(boxes)]], money(r.cost));
                  onClose();
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : "Somethin' burned.");
                  sound.aww();
                }
              }}
            >
              Load Da Van
            </button>
          ) : (
            <Link to="/join" className="btn btn-red">
              Join free
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FragmentRow({ row, open, onToggle }: { row: VanRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-grout align-middle">
        <td className="whitespace-nowrap p-2.5 font-led text-2xl text-sauce">{row.symbol}</td>
        <td className="p-2.5 text-sm">{row.goods}</td>
        <td className="p-2.5">{!row.halted && <Sparkline data={row.history} />}</td>
        <td className="whitespace-nowrap p-2.5 text-right font-led text-2xl">{row.halted ? "—" : <Led value={row.price} text={`${row.price}¢`} />}</td>
        <td className={`whitespace-nowrap p-2.5 text-right font-led text-2xl ${row.change > 0 ? "text-basil" : row.change < 0 ? "text-sauce" : ""}`}>
          {row.halted ? "—" : `${row.change > 0 ? "+" : row.change < 0 ? "−" : "±"}${Math.abs(row.change)}`}
        </td>
        <td className="p-2.5 text-right font-led text-2xl">{row.halted ? "—" : row.boxes}</td>
        <td className="p-2.5 text-right font-led text-2xl">{row.halted ? "—" : row.guys}</td>
        <td className="p-2.5">
          <span className={`pill ${row.halted ? HEAT[3] : HEAT[row.heat.level]}`}>{row.halted ?? row.heat.label}</span>
        </td>
        <td className="p-2.5">
          {!row.halted && (
            <button
              className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${open ? "bg-ink text-plate" : "bg-basil text-white"}`}
              onClick={() => {
                sound.click();
                onToggle();
              }}
            >
              {open ? "Close" : "Trade"}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="p-0">
            <AnimatePresence>
              <Ticket row={row} onClose={onToggle} />
            </AnimatePresence>
          </td>
        </tr>
      )}
    </>
  );
}

export function Van() {
  const { data } = useVan();
  const now = useNow(1000);
  const [openSym, setOpenSym] = useState<string | null>(null);
  const close = useMoneyMutation((id: number) => api.vanClose(id));
  const doorsOpen = Math.floor(now / 30_000) % 7 !== 0;

  return (
    <div className="grid gap-6">
      <div className="plate flex flex-wrap items-end justify-between gap-4 p-6">
        <div className="grid max-w-2xl gap-1.5">
          <h1 className="font-slab text-[clamp(26px,3.4vw,40px)] leading-none">Back of the Van</h1>
          <p className="text-sm text-ink-soft">
            Futures on goods that fell off the truck. Contracts settle physically, at the back of a white van, 3rd &amp; Canal. Don't ask where it came from. Don't ask where it's going.
          </p>
        </div>
        <motion.span
          key={String(doorsOpen)}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${doorsOpen ? "bg-yes-soft text-basil" : "bg-no-soft text-sauce"}`}
        >
          ● Van doors: {doorsOpen ? "open" : "somebody's lookin'"}
        </motion.span>
      </div>

      <div className="plate overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse tabular-nums">
          <thead>
            <tr className="label border-b border-grout text-left text-ink-soft">
              <th className="p-2.5 font-normal">Contract</th>
              <th className="p-2.5 font-normal">Goods</th>
              <th className="p-2.5 font-normal">2 hrs</th>
              <th className="p-2.5 text-right font-normal">Last</th>
              <th className="p-2.5 text-right font-normal">1h Chg</th>
              <th className="p-2.5 text-right font-normal">Boxes Out</th>
              <th className="p-2.5 text-right font-normal">Guys Who Know a Guy</th>
              <th className="p-2.5 font-normal">Heat</th>
              <th className="p-2.5" />
            </tr>
          </thead>
          <tbody>
            {(data?.board ?? []).map((row) => (
              <FragmentRow key={row.symbol} row={row} open={openSym === row.symbol} onToggle={() => setOpenSym(openSym === row.symbol ? null : row.symbol)} />
            ))}
          </tbody>
        </table>
        {!data && <p className="p-6 text-ink-soft">Opening the van…</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Contract size", "1 box (contents may vary)"],
          ["Tick size", "1¢, or one \"you didn't see nothin'\""],
          ["Settlement", "Physical. Very physical."],
          ["Last trading day", "When da van leaves"],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-0.5 rounded-2xl border border-grout bg-plate px-4 py-3">
            <span className="label text-[10px] text-ink-soft">{k}</span>
            <b className="text-sm font-medium">{v}</b>
          </div>
        ))}
      </div>

      {data && data.mine.length > 0 && (
        <section className="grid gap-3">
          <SectionHead title="Your Boxes" aside="marked to market, every minute" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {data.mine.map((p) => (
                <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 120, rotate: 8 }} className="plate grid gap-2 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-led text-2xl text-sauce">{p.symbol}</span>
                    <span className={`pill ${p.side === "long" ? "bg-basil text-white" : "bg-sauce text-white"}`}>
                      {p.side} {p.boxes} bx
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-soft">
                      In at {p.entryCents}¢ · now {p.markCents}¢
                    </span>
                    <Led value={p.pnlCents} text={signedMoney(p.pnlCents)} className={`font-led text-2xl ${p.pnlCents >= 0 ? "text-basil" : "text-sauce"}`} flash={false} />
                  </div>
                  <button
                    className="btn btn-ink text-sm"
                    disabled={close.isPending}
                    onClick={async () => {
                      try {
                        const r = await close.mutateAsync(p.id);
                        if (r.pnlCents > 0) {
                          sound.register();
                          fx.page(`CLOSED ${r.symbol} · MADE ${money(r.pnlCents)}. NICE.`, "good");
                        } else {
                          sound.trombone();
                          fx.page(`CLOSED ${r.symbol} · ${money(r.pnlCents)}. IT HAPPENS.`, "bad");
                        }
                      } catch (e) {
                        fx.page(e instanceof ApiError ? e.message.toUpperCase() : "DIDN'T GO THROUGH", "bad");
                      }
                    }}
                  >
                    Unload ({money((p.side === "long" ? p.markCents : 100 - p.markCents) * p.boxes)})
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}
