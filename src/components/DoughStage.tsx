import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TOSS_CALLS, type TossEvent } from "../../shared/toss";
import type { RoundInfo } from "../../shared/types";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

// Stage geometry (SVG user units)
const W = 800;
const H = 520;
const REST_Y = 250;
const CEIL_Y = 44;
const COUNTER_Y = 400;
const OVEN = { x: 690, y: 330 };

const SKIN = { blue: "#1C4FD6", red: "#C8102E", purple: "#6b1fb1", green: "#0B7A3B", gold: "#C98A3E" } as Record<string, string>;

function useFrameTime(offsetMs: number) {
  const [t, setT] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setT(Date.now() + offsetMs);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [offsetMs]);
  return t;
}

const pickLine = (lines: string[], seed: number) => lines[Math.abs(seed) % lines.length];

type Pose = { x: number; y: number; angle: number; squash: number; scale: number; hidden: boolean };

function poseAt(events: TossEvent[] | null, el: number): { pose: Pose; idx: number } {
  const rest: Pose = { x: 400, y: REST_Y, angle: 0, squash: 1, scale: 1, hidden: false };
  if (!events || el < 0) {
    // betting: dough sits on the hands and breathes
    return { pose: { ...rest, y: REST_Y + Math.sin(Date.now() / 400) * 2, angle: (Date.now() / 30) % 360 }, idx: -1 };
  }
  let idx = -1;
  for (let i = 0; i < events.length; i++) if (events[i].t <= el) idx = i;
  if (idx < 0) return { pose: { ...rest, angle: (el / 10) % 360 }, idx };
  const ev = events[idx];
  const next = events[idx + 1];
  const since = el - ev.t;
  const span = Math.max(500, Math.min(1600, (next?.t ?? ev.t + 1600) - ev.t - 120));
  const p = Math.min(1, since / span);
  switch (ev.kind) {
    case "toss": {
      const apex = REST_Y - ev.height * (REST_Y - CEIL_Y);
      const y = REST_Y - (REST_Y - apex) * Math.sin(Math.PI * p);
      const squash = ev.ceiling && Math.abs(p - 0.5) < 0.05 ? 0.55 : p < 0.08 || p > 0.92 ? 0.8 : 1;
      return { pose: { ...rest, y, angle: since * 0.9, squash }, idx };
    }
    case "spin":
      return { pose: { ...rest, y: REST_Y - 14 * Math.sin(Math.PI * p), angle: since * 2.2 }, idx };
    case "sneeze":
      return { pose: { ...rest, x: 400 + Math.sin(since / 30) * 6 * (1 - p), angle: since * 0.3 }, idx };
    case "floor": {
      const fall = Math.min(1, since / 900);
      return { pose: { ...rest, x: 400 + fall * 90, y: REST_Y + fall * fall * 360, angle: since * 1.5, squash: 1 - fall * 0.3 }, idx };
    }
    case "done": {
      if (events.some((e) => e.kind === "floor")) return { pose: { ...rest, hidden: true }, idx };
      const slide = Math.min(1, since / 1200);
      return {
        pose: { ...rest, x: 400 + (OVEN.x - 400) * slide, y: REST_Y + (OVEN.y - REST_Y) * slide, angle: since * 0.4, scale: 1 - slide * 0.45, hidden: since > 1400 },
        idx,
      };
    }
  }
}

export function DoughStage({ round, clockOffset }: { round: RoundInfo; clockOffset: number }) {
  const now = useFrameTime(clockOffset);
  const betting = now < round.closesAt;
  const el = now - round.closesAt;
  const events = round.events;
  const { pose, idx } = poseAt(betting ? null : events, el);
  const tosser = round.tosser;
  const firstName = tosser.nick;

  const current = idx >= 0 && events ? events[idx] : null;
  const count = events ? events.slice(0, idx + 1).reduce((n, e) => (e.kind === "toss" ? e.count : n), 0) : 0;
  const done = current?.kind === "done";
  const floor = events?.slice(0, idx + 1).some((e) => e.kind === "floor") ?? false;

  const [call, setCall] = useState<string>("");
  const [puffs, setPuffs] = useState<{ id: number; x: number; y: number; big: boolean }[]>([]);
  const [ceilingHit, setCeilingHit] = useState(0);
  const fired = useRef<{ round: number; idx: number } | null>(null);
  const secsLeft = Math.ceil((round.closesAt - now) / 1000);
  const lastTick = useRef<number>(-1);

  // Fire sounds and callouts for events as they happen (not for ones we missed before loading).
  useEffect(() => {
    if (!fired.current || fired.current.round !== round.round) {
      fired.current = { round: round.round, idx };
      if (betting) setCall(`${firstName} is preppin' da dough. Get your orders in.`);
      return;
    }
    if (idx <= fired.current.idx) return;
    for (let i = fired.current.idx + 1; i <= idx; i++) {
      const ev = events![i];
      const seed = round.round * 31 + i;
      const puff = (x: number, y: number, big = false) => setPuffs((ps) => [...ps.slice(-6), { id: Date.now() + i, x, y, big }]);
      if (ev.kind === "toss") {
        sound.whoosh(ev.height);
        if (ev.ceiling) {
          setTimeout(() => {
            sound.ceiling();
            setCeilingHit((c) => c + 1);
            puff(400, CEIL_Y + 10, true);
            fx.shake();
          }, 450);
          setCall(`${ev.count}! ${pickLine(TOSS_CALLS.ceiling, seed)}`);
        } else setCall(`${ev.count}! ${pickLine(TOSS_CALLS.toss, seed)}`);
        if (ev.count === Math.ceil(round.line)) setTimeout(() => sound.ayyy(false), 300);
      } else if (ev.kind === "spin") {
        sound.click();
        setCall(pickLine(TOSS_CALLS.spin, seed));
      } else if (ev.kind === "sneeze") {
        sound.sneeze();
        puff(400, 290, true);
        setCall(pickLine(TOSS_CALLS.sneeze, seed));
      } else if (ev.kind === "floor") {
        sound.splat();
        fx.shake();
        setCall(pickLine(TOSS_CALLS.floor, seed));
        setTimeout(() => puff(490, COUNTER_Y + 20, true), 700);
        void sound.line("floor-pie");
      } else if (ev.kind === "done") {
        const over = ev.count > round.line;
        setCall(pickLine(TOSS_CALLS.done, seed).replace("{n}", String(ev.count)));
        if (over) {
          sound.ayyy(true);
          void sound.line("over-hits", { num: ev.count });
        } else {
          sound.aww();
          void sound.line("under-hits", { num: ev.count });
        }
        fx.stamp(`${ev.count} TOSSES`, over ? "good" : "bad", over ? `OVER ${round.line}` : `UNDER ${round.line}`);
      }
    }
    fired.current.idx = idx;
  }, [idx, round.round, events, betting, firstName, round.line]);

  // intro callout + countdown ticks
  useEffect(() => {
    if (!betting && idx === -1 && events) setCall(pickLine(TOSS_CALLS.intro, round.round).replace("{nick}", firstName));
  }, [betting, idx, events, round.round, firstName]);

  useEffect(() => {
    if (!betting || secsLeft > 10 || secsLeft < 1 || lastTick.current === secsLeft) return;
    lastTick.current = secsLeft;
    sound.tick(secsLeft <= 3);
    if (secsLeft === 1)
      setTimeout(() => {
        sound.bell();
        void sound.line("tossin-starts");
      }, 900);
  }, [secsLeft, betting]);

  const skin = SKIN[tosser.color] ?? SKIN.blue;
  const crowd = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ x: 20 + i * 76 + (i % 2) * 14, s: 0.85 + ((i * 37) % 5) / 12, c: i % 3 })), []);
  const handsUp = current?.kind === "toss" && el - current.t < 180;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-grout bg-felt">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label={`Live dough toss: ${tosser.name}, ${count} tosses`}>
        <defs>
          <pattern id="stage-tile" width="48" height="24" patternUnits="userSpaceOnUse">
            <rect width="48" height="24" fill="#F3F5F2" />
            <path d="M0 0H48M0 12H48M0 24H48M0 0V12M24 12V24M48 0V12" stroke="#D5DBD5" strokeWidth="1.5" />
          </pattern>
          <pattern id="stage-ceiling" width="80" height="34" patternUnits="userSpaceOnUse">
            <rect width="80" height="34" fill="#ECE9E0" />
            <path d="M0 0V34M0 33H80" stroke="#BDB7A8" strokeWidth="2" />
            <circle cx="20" cy="12" r="1" fill="#CFC8B6" />
            <circle cx="52" cy="22" r="1" fill="#CFC8B6" />
          </pattern>
          <radialGradient id="stage-dough" cx="45%" cy="40%" r="60%">
            <stop offset="0" stopColor="#FFF6DD" />
            <stop offset=".7" stopColor="#F4DDA6" />
            <stop offset="1" stopColor="#D9AE62" />
          </radialGradient>
          <radialGradient id="stage-fire" cx="50%" cy="80%" r="70%">
            <stop offset="0" stopColor="#FFF3A6" />
            <stop offset=".4" stopColor="#FF9A1F" />
            <stop offset="1" stopColor="#7A1405" />
          </radialGradient>
          <linearGradient id="stage-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E7EAEC" />
            <stop offset=".5" stopColor="#B7BEC4" />
            <stop offset="1" stopColor="#8D969D" />
          </linearGradient>
        </defs>

        {/* wall + ceiling */}
        <rect width={W} height={H} fill="url(#stage-tile)" />
        <motion.g key={`ceil-${ceilingHit}`} initial={{ y: ceilingHit ? -6 : 0 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 600, damping: 8 }}>
          <rect width={W} height="34" fill="url(#stage-ceiling)" />
          <ellipse cx="560" cy="18" rx="26" ry="9" fill="#C9A86A" opacity=".45" />
          {ceilingHit > 0 && <ellipse cx="400" cy="30" rx="34" ry="6" fill="#FFF6DD" opacity=".9" />}
        </motion.g>
        <rect y="34" width={W} height="6" fill="#1D1A17" opacity=".15" />

        {/* ceiling fan */}
        <g transform="translate(150 34)">
          <rect x="-2" y="0" width="4" height="26" fill="#6b645c" />
          <g transform="translate(0 30)">
            <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "fan .45s linear infinite" }}>
              <ellipse cx="-38" cy="0" rx="36" ry="5" fill="#8a5a2b" />
              <ellipse cx="38" cy="0" rx="36" ry="5" fill="#8a5a2b" />
            </g>
            <circle r="7" fill="#C9A227" />
          </g>
        </g>

        {/* wall decor: PDTL sign and neon LIVE */}
        <g transform="translate(40 90)">
          <rect width="170" height="92" rx="4" fill="#171513" stroke="#5A3A1E" strokeWidth="6" />
          <text x="85" y="30" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="15" fill="#F2B705" letterSpacing="3">
            PDTL LIVE
          </text>
          <text x="85" y="54" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="13" fill="#F4F1EC" letterSpacing="1">
            {tosser.nick.toUpperCase()}
          </text>
          <text x="85" y="76" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="12" fill="#9d958b" letterSpacing="1">
            LINE {round.line}
          </text>
        </g>
        <text x="560" y="120" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="44" fill="#FFE3EA" style={{ filter: "drop-shadow(0 0 6px #FF3B6B) drop-shadow(0 0 14px #FF3B6B)" }} className="[animation:flicker_4s_infinite]">
          Live!
        </text>

        {/* oven */}
        <g>
          <rect x="610" y="236" width="190" height="170" fill="#8E3B22" />
          {Array.from({ length: 7 }).map((_, r) => (
            <path key={r} d={`M610 ${250 + r * 22}H800`} stroke="#6E2C18" strokeWidth="2" />
          ))}
          <path d="M640 404 V320 A50 50 0 0 1 760 320 V404 Z" fill="#2A0F08" />
          <path d="M652 404 V326 A40 40 0 0 1 748 326 V404 Z" fill="url(#stage-fire)" className="[animation:flicker_1.8s_infinite]" opacity={done ? 1 : 0.85} />
          <text x="705" y="228" textAnchor="middle" fontFamily="'Alfa Slab One', serif" fontSize="16" fill="#1D1A17">
            DA OVEN
          </text>
        </g>

        {/* tosser */}
        <motion.g animate={current?.kind === "sneeze" && el - current.t < 700 ? { rotate: [0, -8, 10, 0] } : { rotate: 0 }} style={{ transformOrigin: "400px 320px" }}>
          <path d={`M340 ${COUNTER_Y} Q340 330 400 324 Q460 330 460 ${COUNTER_Y} Z`} fill="#FFFFFF" stroke="#1D1A17" strokeWidth="4" />
          <path d="M372 336 L400 360 L428 336" fill="none" stroke={skin} strokeWidth="6" />
          <line x1="362" y1="342" x2={352} y2={handsUp ? 244 : 262} stroke="#F6C8A0" strokeWidth="16" strokeLinecap="round" />
          <line x1="438" y1="342" x2={448} y2={handsUp ? 244 : 262} stroke="#F6C8A0" strokeWidth="16" strokeLinecap="round" />
          <circle cx="400" cy="296" r="38" fill="#F6C8A0" stroke="#1D1A17" strokeWidth="4" />
          <path d="M362 290 Q400 244 438 290 Q400 278 362 290 Z" fill={skin} stroke="#1D1A17" strokeWidth="3" />
          <circle cx="386" cy="296" r="4" fill="#1D1A17" />
          <circle cx="414" cy="296" r="4" fill="#1D1A17" />
          <path d="M400 306 C392 318 372 318 364 310 C372 312 386 312 400 304 C414 312 428 312 436 310 C428 318 408 318 400 306 Z" fill="#1D1A17" />
          <circle cx="400" cy="303" r="7" fill="#E48C6E" />
        </motion.g>

        {/* the dough */}
        {!pose.hidden && (
          <g transform={`translate(${pose.x} ${pose.y}) scale(${pose.scale})`}>
            <ellipse cx="0" cy="10" rx={58 * pose.squash} ry="5" fill="#000" opacity={0.12} />
            <g transform={`scale(${(0.72 + 0.28 * Math.abs(Math.cos((pose.angle * Math.PI) / 180))) * (2 - pose.squash)} ${pose.squash})`}>
              <ellipse cx="0" cy="0" rx="62" ry="15" fill="url(#stage-dough)" stroke="#C98A3E" strokeWidth="3" />
              <ellipse cx={Math.cos((pose.angle * Math.PI) / 180) * 22} cy="-2" rx="6" ry="2" fill="#fff" opacity=".7" />
              <ellipse cx={Math.cos(((pose.angle + 140) * Math.PI) / 180) * 30} cy="2" rx="4" ry="1.5" fill="#D9AE62" opacity=".7" />
            </g>
          </g>
        )}

        {/* counter */}
        <rect x="0" y={COUNTER_Y} width={W} height="16" fill="url(#stage-steel)" />
        <rect x="0" y={COUNTER_Y + 16} width={W} height={H - COUNTER_Y - 16} fill="#6E4A2A" />
        <path d={`M0 ${COUNTER_Y + 16}H${W}`} stroke="#3d2814" strokeWidth="3" />
        <g fill="#FFFFFF" opacity=".5">
          <circle cx="300" cy={COUNTER_Y + 6} r="2" />
          <circle cx="312" cy={COUNTER_Y + 9} r="1.5" />
          <circle cx="520" cy={COUNTER_Y + 7} r="2" />
        </g>

        {/* flour puffs */}
        <AnimatePresence>
          {puffs.map((p) => (
            <motion.g key={p.id} initial={{ opacity: 0.95, scale: 0.3 }} animate={{ opacity: 0, scale: p.big ? 2.4 : 1.5 }} transition={{ duration: 1.4, ease: "easeOut" }} style={{ transformOrigin: `${p.x}px ${p.y}px` }} onAnimationComplete={() => setPuffs((ps) => ps.filter((x) => x.id !== p.id))}>
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <circle key={k} cx={p.x + Math.cos(k) * 22} cy={p.y + Math.sin(k * 1.7) * 14} r={14 + (k % 3) * 5} fill="#FFFDF5" />
              ))}
            </motion.g>
          ))}
        </AnimatePresence>

        {/* crowd */}
        {crowd.map((h, i) => (
          <motion.g
            key={i}
            animate={{ y: current?.kind === "toss" && el - current.t < 500 ? [0, -14 * h.s, 0] : done && count > round.line ? [0, -22, 0, -18, 0] : 0 }}
            transition={{ duration: done ? 1 : 0.45, delay: (i % 4) * 0.04 }}
          >
            <g transform={`translate(${h.x} ${H - 8}) scale(${h.s})`} fill={h.c === 0 ? "#1D1A17" : h.c === 1 ? "#2b2622" : "#3a332b"} opacity=".92">
              <ellipse cx="0" cy="0" rx="36" ry="30" />
              <circle cx="0" cy="-44" r="21" />
            </g>
          </motion.g>
        ))}

        {/* floor pie banner */}
        {floor && (
          <motion.g initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transformOrigin: "400px 200px" }}>
            <rect x="220" y="160" width="360" height="80" rx="8" fill="#C8102E" stroke="#fff" strokeWidth="6" transform="rotate(-6 400 200)" />
            <text x="400" y="215" textAnchor="middle" fontFamily="'Alfa Slab One', serif" fontSize="46" fill="#fff" transform="rotate(-6 400 200)">
              FLOOR PIE!
            </text>
          </motion.g>
        )}
      </svg>

      {/* scoreboard */}
      <div className="absolute right-2 top-12 grid gap-1 text-right sm:right-4 sm:top-14">
        <div className="led px-3 pb-1 pt-0.5 text-center shadow-lg">
          <div className="label text-[10px] text-ink-soft">Tosses</div>
          <motion.div key={count} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="text-6xl leading-[.8] sm:text-7xl">
            {String(count).padStart(2, "0")}
          </motion.div>
        </div>
        <div className="led px-2 text-center text-lg">LINE {round.line}</div>
      </div>

      {/* betting countdown */}
      {betting && (
        <div className="pointer-events-none absolute inset-x-0 top-[9%] grid place-items-center">
          <motion.div
            key={secsLeft <= 10 ? secsLeft : "long"}
            initial={secsLeft <= 10 ? { scale: 1.4 } : false}
            animate={{ scale: 1 }}
            className={`rounded-2xl border px-5 py-2.5 text-center shadow-2xl ${secsLeft <= 10 ? "border-sauce bg-sauce text-white" : "border-grout bg-plate/95 text-ink"}`}
          >
            <div className="label">Tossin' starts in</div>
            <div className="font-led text-6xl leading-none">
              {Math.floor(Math.max(0, secsLeft) / 60)}:{String(Math.max(0, secsLeft) % 60).padStart(2, "0")}
            </div>
          </motion.div>
        </div>
      )}

      {/* play-by-play */}
      <div className="flex items-center gap-3 bg-felt px-3 py-2 text-white">
        <span className={`pill ${betting ? "bg-white text-[#17171c]" : done ? "bg-white/15 text-white" : "bg-sauce text-white"}`}>
          {betting ? "Takin' orders" : done ? "Final" : "● Live"}
        </span>
        <AnimatePresence mode="wait">
          <motion.span key={call} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="min-w-0 truncate font-semibold">
            {call || " "}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
