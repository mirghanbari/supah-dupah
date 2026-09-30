import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api, useMe } from "../lib/api";
import { money } from "../lib/format";
import { fx, useFx } from "../lib/fx";
import { sound } from "../lib/sound";

/** Pepperoni, basil and mozzarella raining down. */
function Confetti({ burst }: { burst: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!burst) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number; kind: 0 | 1 | 2 };
    const ps: P[] = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -8 - Math.random() * 14,
      r: 7 + Math.random() * 9,
      a: Math.random() * 6,
      va: (Math.random() - 0.5) * 0.3,
      kind: (Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2) as 0 | 1 | 2,
    }));
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += 0.42;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        if (p.kind === 0) {
          ctx.fillStyle = "#C8102E";
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8E0B20";
          for (const [dx, dy] of [[-0.35, -0.2], [0.3, 0.25], [0.05, -0.45]]) {
            ctx.beginPath();
            ctx.arc(dx * p.r, dy * p.r, p.r * 0.14, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (p.kind === 1) {
          ctx.fillStyle = "#1E8A3E";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.1, p.r * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0A3B24";
          ctx.beginPath();
          ctx.moveTo(-p.r, 0);
          ctx.lineTo(p.r, 0);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#FFF6DA";
          ctx.strokeStyle = "#E9D9A6";
          ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
          ctx.strokeRect(-p.r / 2, -p.r / 2, p.r, p.r);
        }
        ctx.restore();
      }
      if (now - t0 < 4000) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [burst]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[70] h-full w-full" aria-hidden="true" />;
}

/** Watches the ledger for payouts and losses and throws a party (or doesn't). */
function useLedgerWatcher() {
  const me = useMe();
  const seen = useRef<{ user: number; id: number } | null>(null);
  const userId = me?.id;
  const lastId = me?.lastLedger?.id ?? 0;
  useEffect(() => {
    if (userId == null) {
      seen.current = null;
      return;
    }
    // first look at this user (fresh load or someone else just signed in): nothing to celebrate yet
    if (!seen.current || seen.current.user !== userId) {
      seen.current = { user: userId, id: lastId };
      return;
    }
    if (lastId <= seen.current.id) return;
    const after = seen.current.id;
    seen.current = { user: userId, id: lastId };
    void api.ledgerAfter(after).then(({ entries }) => {
      const wins = entries.filter((e) => e.kind === "payout");
      const losses = entries.filter((e) => e.kind === "loss");
      if (wins.length) {
        const total = wins.reduce((s, e) => s + e.cents, 0);
        fx.confetti();
        fx.stamp("BADA BING!", "good", `+${money(total)}`);
        sound.win(total);
        for (const w of wins.slice(0, 3)) fx.page(`YOU WON ${money(w.cents)} · ${w.memo.replace(/^WON /, "")}`, "good");
      } else if (losses.length) {
        sound.aww();
        setTimeout(() => void sound.line("lost"), 900);
      }
      for (const l of losses.slice(0, 3)) fx.page(`${l.memo} · ${money(-l.cents)} DOWN DA DRAIN`, "bad");
      if (entries.some((e) => e.kind === "bailout")) fx.page("TONY SPOTTED YOU A TWENTY. DON'T TELL NOBODY.", "good");
    });
  }, [userId, lastId]);
}

/** Type "ayyy" anywhere. */
function useAyyy(onAyyy: () => void) {
  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest("input, textarea, select")) return;
      buf = (buf + e.key.toLowerCase()).slice(-4);
      if (buf === "ayyy") onAyyy();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAyyy]);
}

export function Effects() {
  const s = useFx();
  const [chef, setChef] = useState(0);
  useLedgerWatcher();
  useAyyy(() => {
    setChef((c) => c + 1);
    sound.ayyy(true);
    setTimeout(() => void sound.line("ayyy"), 300);
  });

  useEffect(() => {
    if (s.pages.length) sound.beep();
  }, [s.pages.length]);

  useEffect(() => {
    if (!s.shake) return;
    document.body.classList.remove("shake");
    void document.body.offsetWidth;
    document.body.classList.add("shake");
  }, [s.shake]);

  const tabEl = typeof document !== "undefined" ? document.getElementById("tab-target") : null;
  const tabRect = tabEl?.getBoundingClientRect();

  return (
    <>
      <Confetti burst={s.confetti} />

      {/* pager */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] grid w-[min(360px,calc(100vw-32px))] gap-2" aria-live="polite">
        <AnimatePresence>
          {s.pages.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: 80, opacity: 0, rotate: 0 }}
              animate={{ y: 0, opacity: 1, rotate: [0, -3, 3, -2, 2, 0] }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="pointer-events-auto rounded-xl border-[3px] border-black bg-[#2B3A2A] p-2 shadow-2xl"
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="label text-[10px] text-[#9FB38A]">SUPAH-PAGE 2000</span>
                <span className={`h-2 w-2 rounded-full ${p.tone === "bad" ? "bg-dn" : p.tone === "good" ? "bg-up" : "bg-led"} animate-pulse`} />
              </div>
              <div className="rounded bg-[#9FB38A] px-2 py-1.5 font-led text-lg leading-tight text-[#1d2a16] shadow-[inset_0_2px_4px_rgba(0,0,0,.35)]">
                *BEEP* 212-555-PIE
                <br />
                {p.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* rubber stamp */}
      <AnimatePresence>
        {s.stamp && (
          <motion.div
            key={s.stamp.id}
            className="pointer-events-none fixed inset-0 z-[75] grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 3.2, rotate: -24, opacity: 0 }}
              animate={{ scale: 1, rotate: -9, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              onAnimationComplete={() => fx.shake()}
              className={`rounded-lg border-[10px] px-8 py-4 text-center font-slab ${
                s.stamp.tone === "good" ? "border-basil bg-plate/90 text-basil" : "border-sauce bg-plate/90 text-sauce"
              }`}
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
            >
              <div className="text-[clamp(48px,10vw,120px)] leading-none">{s.stamp.text}</div>
              {s.stamp.sub && <div className="mt-2 font-led text-5xl">{s.stamp.sub}</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* order ticket flying to the tab */}
      <AnimatePresence>
        {s.ticket && (
          <motion.div
            key={s.ticket.id}
            className="guest-check pointer-events-none fixed left-1/2 top-1/2 z-[72] w-72 -translate-x-1/2 -translate-y-1/2"
            initial={{ y: 300, rotate: 8, opacity: 0, scale: 0.8 }}
            animate={{
              y: [300, 0, 0, tabRect ? tabRect.top - innerHeight / 2 : -innerHeight / 2],
              x: [0, 0, 0, tabRect ? tabRect.left + tabRect.width / 2 - innerWidth / 2 : innerWidth / 3],
              rotate: [8, -3, -3, 25],
              scale: [0.8, 1, 1, 0.15],
              opacity: [0, 1, 1, 0.6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, times: [0, 0.2, 0.6, 1], ease: "easeInOut" }}
          >
            <div className="flex items-baseline justify-between bg-basil px-4 py-2 font-board uppercase tracking-widest text-check">
              <b className="font-slab text-lg normal-case tracking-normal">Guest Check</b>
              <span className="text-xs">ORDER UP!</span>
            </div>
            <div className="grid gap-1 px-4 py-3 text-sm">
              <div className="font-hand text-xl text-pen">{s.ticket.title}</div>
              {s.ticket.lines.map(([a, b], i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>{a}</span>
                  <span className="font-hand text-pen">{b}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t-2 border-check-line pt-1 font-slab">
                <span>Total</span>
                <span className="font-hand text-xl text-pen">{s.ticket.total}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the "ayyy" chef */}
      <AnimatePresence>
        {chef > 0 && (
          <motion.div
            key={chef}
            className="pointer-events-none fixed bottom-0 left-4 z-[78]"
            initial={{ y: 260 }}
            animate={{ y: [260, 0, 0, 260] }}
            transition={{ duration: 2.6, times: [0, 0.2, 0.8, 1] }}
            onAnimationComplete={() => setChef(0)}
          >
            <svg viewBox="60 20 260 320" className="h-60 w-auto" aria-hidden="true">
              <g transform="translate(58,34) rotate(-10)">
                <path d="M 0,0 L 118,0 Q 124,0 124,6 L 124,44 Q 124,50 118,50 L 40,50 L 22,70 L 26,50 L 6,50 Q 0,50 0,44 Z" fill="#FFFFFF" stroke="#1D1A17" strokeWidth="4" />
                <text x="62" y="36" textAnchor="middle" fontFamily="'Alfa Slab One', Georgia, serif" fontSize="26" fill="#C8102E">
                  AYYY!
                </text>
              </g>
              <circle cx="190" cy="100" r="32" fill="#FFF" stroke="#1D1A17" strokeWidth="4" />
              <circle cx="150" cy="118" r="30" fill="#FFF" stroke="#1D1A17" strokeWidth="4" />
              <circle cx="230" cy="118" r="30" fill="#FFF" stroke="#1D1A17" strokeWidth="4" />
              <rect x="132" y="120" width="116" height="38" rx="4" fill="#FFF" stroke="#1D1A17" strokeWidth="4" />
              <circle cx="190" cy="232" r="82" fill="#F6C8A0" stroke="#1D1A17" strokeWidth="5" />
              <path d="M 132,196 Q 158,178 180,196" stroke="#1D1A17" strokeWidth="10" fill="none" strokeLinecap="round" />
              <path d="M 202,190 Q 226,172 250,188" stroke="#1D1A17" strokeWidth="10" fill="none" strokeLinecap="round" />
              <path d="M 140,216 Q 157,226 174,216" stroke="#1D1A17" strokeWidth="6" fill="none" strokeLinecap="round" />
              <ellipse cx="226" cy="216" rx="14" ry="16" fill="#FFF" stroke="#1D1A17" strokeWidth="4" />
              <circle cx="230" cy="219" r="6" fill="#1D1A17" />
              <path d="M 150,296 Q 190,340 230,296 Z" fill="#8E0B20" stroke="#1D1A17" strokeWidth="4" />
              <path d="M 190,272 C 176,300 132,304 104,284 C 84,270 88,242 110,246 C 100,256 106,272 124,274 C 150,278 168,262 190,266 Z" fill="#1D1A17" />
              <path d="M 190,272 C 176,300 132,304 104,284 C 84,270 88,242 110,246 C 100,256 106,272 124,274 C 150,278 168,262 190,266 Z" fill="#1D1A17" transform="translate(380,0) scale(-1,1)" />
              <circle cx="190" cy="254" r="21" fill="#E48C6E" stroke="#1D1A17" strokeWidth="4" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
