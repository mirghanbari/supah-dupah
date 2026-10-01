import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import type { PickResult } from "../../shared/types";
import { SectionHead } from "../components/MarketBits";
import { api, ApiError, useMe, usePickState } from "../lib/api";
import { ago, money, signedMoney } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

const ROLL_MS = 2600;
const MAX_BET = 100;

type Phase = "idle" | "rolling" | "done";

/** The "Now serving" display. Shows Tony's number. */
function NowServing({ value, phase, result }: { value: number | null; phase: Phase; result: PickResult | null }) {
  const color = phase === "done" && result ? (result.win ? "#45D49A" : "#FF7A5E") : "#FFFFFF";
  return (
    <div className="mx-auto w-full max-w-xs rounded-3xl bg-felt px-5 py-3.5 text-center text-white">
      <div className="text-[13px] font-bold tracking-[.2em] text-white/70">NOW SERVING</div>
      <motion.div
        key={phase === "done" ? `done-${value}` : "roll"}
        initial={phase === "done" ? { scale: 1.3 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 16 }}
        className="font-led text-[clamp(64px,16vw,88px)] leading-none"
        style={{ color, transition: "color .3s" }}
        aria-live="polite"
      >
        {value == null ? "--" : String(value).padStart(2, "0")}
      </motion.div>
      <div className="text-[11px] text-white/60">Please have your ticket ready</div>
    </div>
  );
}

/** One number to pick. */
function Ticket({ n, picked, disabled, onPick }: { n: number; picked: boolean; disabled: boolean; onPick: () => void }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-pressed={picked}
      aria-label={`Pick ${n}`}
      animate={picked ? { y: -4, scale: 1.04 } : { y: 0, scale: 1 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className={`grid h-14 place-items-center rounded-2xl border font-slab text-2xl transition-colors disabled:cursor-not-allowed ${
        picked ? "border-sauce bg-sauce text-white" : "border-grout bg-plate text-ink hover:border-ink-soft"
      }`}
    >
      {n}
    </motion.button>
  );
}

export function Pick() {
  const me = useMe();
  const qc = useQueryClient();
  const { data: board } = usePickState();
  const [pick, setPick] = useState<number | null>(null);
  const [amount, setAmount] = useState("5");
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState<number | null>(null);
  const [result, setResult] = useState<PickResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const raf = useRef(0);

  const cents = Math.round(parseFloat(amount || "0") * 100);
  const busy = phase === "rolling";

  /** Spin the sign through random numbers, slowing down, and land on Tony's draw. */
  const roll = (final: number) =>
    new Promise<void>((resolve) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setShown(final);
        return resolve();
      }
      const start = performance.now();
      let next = 0;
      const step = (now: number) => {
        const t = (now - start) / ROLL_MS;
        if (t >= 1) {
          setShown(final);
          return resolve();
        }
        if (now >= next) {
          setShown(1 + Math.floor(Math.random() * 10));
          sound.tick(false);
          next = now + 40 + 380 * t * t; // ticks slow down like a wheel losing steam
        }
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    });

  const play = async () => {
    if (pick == null || busy) return;
    setErr(null);
    setResult(null);
    sound.click();
    let r: PickResult;
    try {
      r = await api.pick(pick, cents);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Somethin' burned. Try again.");
      sound.buzzer();
      return;
    }
    setPhase("rolling");
    void sound.line("pick-draw");
    await roll(r.draw);
    sound.dingDong();
    setResult(r);
    setPhase("done");

    // the reveal
    setTimeout(() => {
      if (r.win) {
        fx.confetti();
        fx.stamp("WINNER!", "good", `+${money(r.payoutCents)}`);
        sound.register();
        sound.jingle();
        sound.ayyy(true);
        setTimeout(() => void sound.line("pick-winner"), 700);
      } else if (r.close) {
        sound.aww();
        fx.shake();
        void sound.line("so-close");
      } else {
        sound.buzzer();
        void sound.line("pay-to-play");
      }
      // only now let the header's store credit catch up, so it doesn't spoil the draw
      for (const k of ["me", "pick", "tab", "leaders"]) qc.invalidateQueries({ queryKey: [k] });
    }, 450);
  };

  const headline = result ? (result.win ? "WE GOT A WINNER!" : result.close ? "Oh, So Close." : "You Gotta Pay to Play.") : null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-4">
        <header className="plate relative grid gap-1.5 px-5 py-4 text-center">
          <p className="label text-sauce">Tony's Famous</p>
          <h1 className="font-slab text-[clamp(28px,4vw,38px)] leading-none">Pick A Number</h1>
          <p className="mx-auto max-w-[52ch] text-sm text-ink-soft">
            Pick a number, 1 to 10. If it matches Tony's number, you get paid <b className="text-ink">100 times</b> your bet.
          </p>
          <p className="mx-auto max-w-[52ch] text-xs text-ink-soft">
            *Tony's number is 1 to 10. Your odds of winning are 1 in 100. Don't ask how. It's in the fine print. This is the fine print.
          </p>
        </header>

        <NowServing value={shown} phase={phase} result={result} />

        <AnimatePresence mode="wait">
          {result && phase === "done" && (
            <motion.div
              key={`${result.pick}-${result.draw}-${shown}`}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`plate grid gap-1 p-4 text-center ${result.win ? "ring-4 ring-basil" : result.close ? "ring-4 ring-cheese/50" : ""}`}
            >
              <div className={`font-slab text-[clamp(22px,3.5vw,30px)] leading-tight ${result.win ? "text-basil" : result.close ? "text-cheese" : "text-sauce"}`}>{headline}</div>
              <div className="text-ink-soft">
                You took <b className="text-ink">#{result.pick}</b> · Tony drew <b className="text-ink">#{result.draw}</b>
                {!result.win && <> · off by {Math.abs(result.draw - result.pick)}</>}
              </div>
              <div className={`font-led text-3xl ${result.win ? "text-basil" : "text-sauce"}`}>{signedMoney(result.payoutCents - result.betCents)}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="plate grid gap-4 p-5">
          <SectionHead title="Pick your number" aside={pick ? `you're holdin' #${pick}` : "pick one, any one"} />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Ticket
                key={n}
                n={n}
                picked={pick === n}
                disabled={busy}
                onPick={() => {
                  sound.click();
                  setPick(n);
                  if (phase === "done") setPhase("idle");
                }}
              />
            ))}
          </div>

          {me ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1">
                <label htmlFor="pick-bet" className="label text-ink-soft">
                  Your bet ($1–${MAX_BET})
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="pick-bet"
                    inputMode="decimal"
                    className="field w-28 text-lg font-bold tabular-nums"
                    value={amount}
                    disabled={busy}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                  {[1, 5, 20, 100].map((d) => (
                    <button key={d} type="button" disabled={busy} onClick={() => setAmount(String(d))} className="h-11 rounded-xl border border-grout px-3 font-semibold hover:bg-tile">
                      ${d}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-ink-soft">
                  Hit it and Tony pays <b className="text-ink">{money(Math.max(0, cents) * 100)}</b>. Store credit: {money(me.balanceCents)}.
                </span>
              </div>
              <button
                type="button"
                onClick={play}
                disabled={pick == null || busy || cents < 1}
                className="btn btn-red h-12 px-6 text-base"
              >
                {busy ? "Drawin'…" : pick == null ? "Pick a number first" : "Take a number"}
              </button>
            </div>
          ) : (
            <div className="grid gap-2 text-center">
              <span className="font-semibold">Sign up to take a number. It's free, and it's fake money.</span>
              <Link to="/join" className="btn btn-red justify-self-center">
                Join free
              </Link>
            </div>
          )}
          {err && <p className="rounded-xl bg-no-soft px-3 py-2 text-center font-semibold text-sauce">{err}</p>}
        </section>
      </div>

      <aside className="grid gap-5 lg:sticky lg:top-4">
        {board?.mine && board.mine.plays > 0 && (
          <section className="plate grid gap-2 p-4">
            <h2 className="font-slab text-lg">Your Record</h2>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ["Tickets", String(board.mine.plays)],
                ["Winners", String(board.mine.wins)],
                ["So close", String(board.mine.closeCalls)],
                ["Net", signedMoney(board.mine.netCents)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-tile p-3">
                  <div className={`font-led text-3xl leading-none ${k === "Net" ? (board.mine!.netCents >= 0 ? "text-basil" : "text-sauce") : ""}`}>{v}</div>
                  <div className="label text-[10px] text-ink-soft">{k}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="plate grid gap-2 p-4">
          <h2 className="font-slab text-lg">Recent plays</h2>
          <p className="text-xs text-ink-soft">Every ticket, everybody. Tony's got nothin' to hide.</p>
          {(board?.recent ?? []).length === 0 && <p className="font-hand text-ink-soft">Nobody's taken a number yet.</p>}
          {(board?.recent ?? []).map((p, i) => {
            const win = p.payoutCents > 0;
            const close = !win && Math.abs(p.draw - p.pick) === 1;
            return (
              <div key={i} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] tabular-nums ${win ? "bg-yes-soft" : close ? "bg-cheese-soft" : ""}`}>
                <span className="min-w-0 truncate">
                  <b>{p.user}</b> took #{p.pick}, Tony drew #{p.draw}
                </span>
                <span className={`shrink-0 font-led text-lg leading-none ${win ? "text-basil" : "text-sauce"}`}>
                  {win ? `+${money(p.payoutCents - p.betCents)}` : close ? "so close" : money(-p.betCents)}
                </span>
                <span className="shrink-0 text-ink-soft">{ago(p.at)}</span>
              </div>
            );
          })}
        </section>
      </aside>
    </div>
  );
}
