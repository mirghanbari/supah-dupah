import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { api, useMe } from "../lib/api";
import { money } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";
import { Led } from "./Led";
import { Logo } from "./Logo";
import { Ticker } from "./Ticker";

const NAV = [
  { to: "/", label: "Hot Right Now", end: true },
  { to: "/kitchen", label: "Da Back Kitchen" },
  { to: "/pick", label: "Pick A Number" },
  { to: "/section/truck", label: "Fell Off Da Truck" },
  { to: "/van", label: "Truck Futures" },
  { to: "/crust", label: "Crust Sports" },
  { to: "/section/hood", label: "Da Neighborhood" },
  { to: "/section/block", label: "Block Association" },
  { to: "/section/weather", label: "Weather (Inside)" },
  { to: "/wall", label: "Wall of Fame" },
];

function useSound() {
  return useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => `${sound.enabled}|${sound.voice}|${sound.jukebox}`,
  );
}

export function SoundControls() {
  useSound();
  const chip = "label rounded border-2 px-2 py-1 transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Sound">
      <button
        className={`${chip} ${sound.enabled ? "border-cheese bg-cheese text-ink" : "border-plate/40 text-plate/70"}`}
        aria-pressed={sound.enabled}
        onClick={() => {
          sound.unlock();
          sound.setEnabled(!sound.enabled);
          if (!sound.enabled) return;
          setTimeout(() => {
            sound.bell();
            void sound.line("sound-on");
          }, 30);
        }}
      >
        {sound.enabled ? "🔊 Sound on" : "🔇 Sound off"}
      </button>
      <button
        className={`${chip} ${sound.voice && sound.enabled ? "border-plate bg-plate text-ink" : "border-plate/40 text-plate/70"}`}
        aria-pressed={sound.voice}
        disabled={!sound.enabled}
        onClick={() => {
          sound.setVoice(!sound.voice);
          if (sound.voice) void sound.line("voice-on");
        }}
      >
        Tony's voice
      </button>
      <button
        className={`${chip} ${sound.jukebox ? "border-neon bg-neon text-plate" : "border-plate/40 text-plate/70"}`}
        aria-pressed={sound.jukebox}
        disabled={!sound.enabled}
        onClick={() => sound.toggleJukebox()}
      >
        {sound.jukebox ? "♫ Jukebox playin'" : "♫ Jukebox"}
      </button>
    </div>
  );
}

/** A little hero sandwich. The top bun lifts when the menu's open. */
function SandwichIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 40 32" className="h-7 w-9" aria-hidden="true">
      <motion.g animate={open ? { y: -5, rotate: -14 } : { y: 0, rotate: 0 }} style={{ transformOrigin: "6px 12px" }} transition={{ type: "spring", stiffness: 400, damping: 14 }}>
        <path d="M3 12 Q3 2 20 2 Q37 2 37 12 Z" fill="#E7A94F" stroke="#1D1A17" strokeWidth="2" strokeLinejoin="round" />
        <g fill="#FFF6DD">
          <ellipse cx="13" cy="7" rx="1.6" ry="0.9" />
          <ellipse cx="21" cy="5" rx="1.6" ry="0.9" />
          <ellipse cx="28" cy="8" rx="1.6" ry="0.9" />
        </g>
      </motion.g>
      <path d="M2 15 q3 -3 6 0 t6 0 t6 0 t6 0 t6 0 t6 0" fill="none" stroke="#3FA34D" strokeWidth="3" strokeLinecap="round" />
      <rect x="4" y="16.5" width="32" height="3.5" rx="1" fill="#C8102E" />
      <path d="M4 20.5 H36 L33 24 H7 Z" fill="#F2B705" />
      <path d="M3 23 H37 Q37 30 20 30 Q3 30 3 23 Z" fill="#E7A94F" stroke="#1D1A17" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function useSignOut() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return async () => {
    await api.logout();
    await qc.invalidateQueries();
    void sound.line("ciao");
    nav("/");
  };
}

function deposit() {
  sound.register();
  void sound.line("deposit");
  fx.page("TONY: WE DON'T TAKE CARDS. OR CASH. IT'S FAKE MONEY, GENIUS.");
}

function Credit({ cents, compact = false }: { cents: number; compact?: boolean }) {
  return (
    <Link to="/tab" id={compact ? undefined : "tab-target"} className={`led flex items-baseline gap-2 ${compact ? "px-2 text-xl" : "px-3 py-0.5 text-2xl"}`} aria-label="Your tab">
      <Led value={cents} text={money(cents)} />
      <small className={`text-[#b99a5a] ${compact ? "text-xs" : "text-sm"}`}>{compact ? "CREDIT" : "STORE CREDIT"}</small>
    </Link>
  );
}

/** The phone menu: a takeout menu that slides in from the side. */
function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const signOut = useSignOut();
  const loc = useLocation();

  useEffect(() => onClose(), [loc.pathname, onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="shade" className="fixed inset-0 z-[60] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            key="menu"
            role="dialog"
            aria-label="Menu"
            className="fixed inset-y-0 right-0 z-[61] flex w-[min(340px,88vw)] flex-col overflow-y-auto bg-plate text-ink shadow-2xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            initial={{ x: "100%", rotate: 3 }}
            animate={{ x: 0, rotate: 0 }}
            exit={{ x: "100%", rotate: 3 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between bg-sauce px-4 py-3 text-plate">
              <div>
                <div className="font-neon text-3xl leading-none">Da Menu</div>
                <div className="label text-plate/80">Supah Dupah · Est. 1994</div>
              </div>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border-2 border-plate/60 font-slab text-xl" aria-label="Close menu">
                ✕
              </button>
            </div>
            <div className="h-3 bg-[repeating-linear-gradient(90deg,var(--color-sauce)_0_12px,var(--color-plate)_12px_24px)]" />

            <div className="grid gap-4 p-4">
              {me ? (
                <div className="grid gap-2 rounded-md bg-felt p-3 text-plate">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-board uppercase tracking-wider">{me.username}</span>
                    <Credit cents={me.balanceCents} compact />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/tab" className="btn btn-cheese text-center text-sm">
                      Your Tab
                    </Link>
                    <button className="btn btn-red text-sm" onClick={deposit}>
                      Deposit (Cash Only)
                    </button>
                  </div>
                  {me.isBoss && (
                    <Link to="/office" className="btn btn-green text-center text-sm">
                      Tony's Office
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/join?mode=login" className="btn border-2 border-ink/20 bg-plate text-center text-sm">
                    Sign in
                  </Link>
                  <Link to="/join" className="btn btn-red text-center text-sm">
                    I Know A Guy →
                  </Link>
                </div>
              )}

              <nav aria-label="Sections" className="grid">
                {NAV.map((n, i) => (
                  <motion.div key={n.to} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 + i * 0.03 }}>
                    <NavLink
                      to={n.to}
                      end={n.end}
                      onClick={() => sound.click()}
                      className={({ isActive }) =>
                        `flex items-baseline gap-2 border-b border-dotted border-ink/25 py-2.5 font-board text-lg uppercase tracking-wide ${isActive ? "text-sauce" : "text-ink"}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="min-w-0 flex-1">{n.label}</span>
                          <span className={isActive ? "text-sauce" : "text-ink/30"}>{isActive ? "●" : "›"}</span>
                        </>
                      )}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>

              <div className="grid gap-2 rounded-md bg-basil-dk p-3">
                <span className="label text-plate/70">Sound</span>
                <SoundControls />
              </div>

              {me && (
                <button className="label justify-self-start text-ink-soft underline" onClick={signOut}>
                  Sign out
                </button>
              )}
              <p className="font-neon text-xl text-sauce">If you ain't Supah, you ain't Dupah!</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Storefront() {
  const me = useMe();
  const signOut = useSignOut();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);

  return (
    <header>
      <Ticker />
      <div
        className="bg-basil-dk text-plate"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.18) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,.18) 2px, transparent 2px)",
          backgroundSize: "56px 28px",
        }}
      >
        <div className="awning" />
        <div className="scallop" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-6 gap-y-3 px-4 pb-3 pt-1 md:flex-wrap md:pb-4">
          <Link to="/" className="flex min-w-0 items-center gap-4" aria-label="Supah Dupah home">
            <Logo className="w-[150px] shrink-0 min-[400px]:w-[180px] md:w-[270px]" />
            <div className="hidden min-w-0 flex-col gap-2 md:flex">
              <span className="neon text-3xl leading-none">If you ain't Supah,</span>
              <span className="neon text-3xl leading-none">you ain't Dupah!</span>
              <span className="neon-open self-start text-sm">OPEN</span>
            </div>
          </Link>

          {/* phone: credit + sandwich */}
          <div className="flex items-center gap-2 md:hidden">
            {me ? (
              <Credit cents={me.balanceCents} compact />
            ) : (
              <Link to="/join" className="btn btn-red px-2.5 py-1.5 text-xs">
                Join
              </Link>
            )}
            <button
              onClick={() => {
                sound.click();
                setMenu((m) => !m);
              }}
              className="flex flex-col items-center rounded-md bg-plate px-1.5 pb-0.5 pt-1 text-ink shadow-[0_3px_0_rgba(0,0,0,.35)] active:translate-y-0.5"
              aria-label="Open menu"
              aria-expanded={menu}
            >
              <SandwichIcon open={menu} />
              <span className="label text-[9px] leading-none">Menu</span>
            </button>
          </div>

          {/* desktop: everything out on the counter */}
          <div className="hidden flex-col items-end gap-2 md:flex">
            {me ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Credit cents={me.balanceCents} />
                <button className="btn btn-cheese text-sm" onClick={deposit}>
                  Deposit (Cash Only)
                </button>
                <details className="relative">
                  <summary className="label list-none rounded border-2 border-plate/50 px-2 py-1.5 text-plate">
                    {me.username} ▾
                  </summary>
                  <div className="absolute right-0 z-30 mt-1 grid w-44 gap-1 rounded bg-plate p-2 text-ink shadow-xl">
                    <Link className="label rounded px-2 py-1.5 text-sm hover:bg-tile" to="/tab">
                      Your Tab
                    </Link>
                    {me.isBoss && (
                      <Link className="label rounded px-2 py-1.5 text-sm hover:bg-tile" to="/office">
                        Tony's Office
                      </Link>
                    )}
                    <button className="label rounded px-2 py-1.5 text-left text-sm hover:bg-tile" onClick={signOut}>
                      Sign out
                    </button>
                  </div>
                </details>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/join?mode=login" className="label rounded border-2 border-plate/60 px-3 py-2 text-plate">
                  Sign in
                </Link>
                <Link to="/join" className="btn btn-red text-sm">
                  I Know A Guy →
                </Link>
              </div>
            )}
            <SoundControls />
          </div>
        </div>
        <nav className="hidden gap-1 overflow-x-auto bg-basil px-3 md:flex" aria-label="Sections">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => sound.click()}
              className={({ isActive }) =>
                `shrink-0 border-b-4 px-3 py-2.5 font-board text-sm uppercase tracking-wider ${
                  isActive ? "border-cheese text-cheese" : "border-transparent text-plate hover:text-cheese"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        {/* phone: the tagline gets its own neon sign under the logo */}
        <div className="flex items-center justify-center gap-3 px-4 pb-3 md:hidden">
          <span className="neon text-center text-[22px] leading-none min-[400px]:text-2xl">If you ain't Supah, you ain't Dupah!</span>
          <span className="neon-open shrink-0 text-xs">OPEN</span>
        </div>
        {/* phone: a thin strip naming where you are */}
        <PhoneSectionStrip />
      </div>
      <MenuDrawer open={menu} onClose={closeMenu} />
    </header>
  );
}

function PhoneSectionStrip() {
  const loc = useLocation();
  const here = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  return <div className="bg-basil px-4 py-1.5 font-board text-sm uppercase tracking-wider text-cheese md:hidden">{here?.label ?? "Supah Dupah"}</div>;
}

export function Footer() {
  return (
    <footer className="mt-10 bg-felt px-4 py-8 text-xs leading-relaxed text-[#9d958b]">
      <div className="mx-auto grid max-w-7xl gap-3">
        <p className="font-neon text-2xl text-plate">If you ain't Supah, you ain't Dupah!</p>
        <p>
          <b className="text-[#d8d0c5]">Supah Dupah is a parody. It's play money. Nothing here is real.</b> Not a registered anything. Not
          affiliated with dem other so-called "exchanges" (they use spoons). All goods listed fell off a truck of their own free will. Past
          tosses do not guarantee future tosses. Every contract pays out one (1) dollar slice. No real people are depicted; any resemblance to
          a real Tony is a coincidence, and there's a lotta Tonys.
        </p>
        <p>Cash only. No substitutions. Bathroom is for customers. © 1994–forever, probably.</p>
      </div>
    </footer>
  );
}
