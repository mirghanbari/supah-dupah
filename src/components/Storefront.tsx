import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { api, useMe } from "../lib/api";
import { money } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";
import { toggleTheme, useTheme } from "../lib/theme";
import { Led } from "./Led";
import { Ticker } from "./Ticker";

const NAV = [
  { to: "/", label: "Markets", end: true },
  { to: "/kitchen", label: "Dough Toss" },
  { to: "/pick", label: "Pick A Number" },
  { to: "/van", label: "Truck Futures" },
  { to: "/crust", label: "Crust Sports" },
  { to: "/wall", label: "Leaderboard" },
];

const SECTIONS = [
  { to: "/section/truck", label: "Fell Off the Truck" },
  { to: "/section/hood", label: "Neighborhood" },
  { to: "/section/block", label: "Block Association" },
  { to: "/section/weather", label: "Weather (Inside)" },
];

function useSound() {
  return useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => `${sound.enabled}|${sound.voice}|${sound.jukebox}`,
  );
}

/** Sound, Tony's voice and the jukebox, as three switches. */
export function SoundControls() {
  useSound();
  const chip = (on: boolean) =>
    `label flex h-9 items-center rounded-full border px-3.5 transition-colors disabled:opacity-40 ${on ? "border-ink bg-ink text-plate" : "border-grout bg-plate text-ink"}`;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sound">
      <button
        className={chip(sound.enabled)}
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
        {sound.enabled ? "Sound on" : "Sound off"}
      </button>
      <button
        className={chip(sound.voice && sound.enabled)}
        aria-pressed={sound.voice}
        disabled={!sound.enabled}
        onClick={() => {
          sound.setVoice(!sound.voice);
          if (sound.voice) void sound.line("voice-on");
        }}
      >
        Tony's voice
      </button>
      <button className={chip(sound.jukebox)} aria-pressed={sound.jukebox} disabled={!sound.enabled} onClick={() => sound.toggleJukebox()}>
        {sound.jukebox ? "Jukebox playing" : "Jukebox"}
      </button>
    </div>
  );
}

const iconBtn = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-grout bg-plate text-ink transition-colors hover:bg-tile";

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m22 9-6 6M16 9l6 6" />}
    </svg>
  );
}

export function ThemeToggle({ className = iconBtn }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      className={className}
      onClick={() => {
        sound.click();
        toggleTheme();
      }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

/** Desktop: one speaker button that opens the sound switches. */
function SoundMenu() {
  useSound();
  return (
    <details className="relative">
      <summary className={`${iconBtn} list-none`} aria-label="Sound settings">
        <SpeakerIcon on={sound.enabled} />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-max rounded-2xl border border-grout bg-plate p-3 shadow-xl">
        <SoundControls />
      </div>
    </details>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Supah Dupah home">
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-sauce font-slab text-[19px] text-white">S</span>
      <span className="font-slab text-[21px] leading-none">supah dupah</span>
    </Link>
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
  fx.page("Tony: We don't take cards. Or cash. It's fake money, genius.");
}

function Credit({ cents, compact = false }: { cents: number; compact?: boolean }) {
  return (
    <Link
      to="/tab"
      id={compact ? undefined : "tab-target"}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-grout bg-plate px-3.5 font-bold tabular-nums"
      aria-label={`Your balance, ${money(cents)}. Open your tab`}
    >
      <span className="h-2 w-2 rounded-full bg-basil" aria-hidden="true" />
      <Led value={cents} text={money(cents)} />
    </Link>
  );
}

/** Phone menu: a sheet that slides in from the right. */
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

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between rounded-xl px-3 py-3 text-[17px] font-semibold ${isActive ? "bg-tile text-ink" : "text-ink hover:bg-tile"}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="shade" className="fixed inset-0 z-[60] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            key="menu"
            role="dialog"
            aria-label="Menu"
            className="fixed inset-y-0 right-0 z-[61] flex w-[min(360px,90vw)] flex-col overflow-y-auto border-l border-grout bg-bg text-ink shadow-2xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <Wordmark />
              <button onClick={onClose} className={iconBtn} aria-label="Close menu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="grid gap-5 px-4 pb-6">
              {me ? (
                <div className="grid gap-3 rounded-2xl border border-grout bg-plate p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{me.username}</span>
                    <span className="font-bold tabular-nums">{money(me.balanceCents)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/tab" className="btn btn-ink text-sm">
                      Your Tab
                    </Link>
                    <button className="btn btn-cheese text-sm" onClick={deposit}>
                      Deposit
                    </button>
                  </div>
                  {me.isBoss && (
                    <Link to="/office" className="btn btn-green text-sm">
                      Tony's Office
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/join?mode=login" className="btn btn-cheese">
                    Sign in
                  </Link>
                  <Link to="/join" className="btn btn-red">
                    Join free
                  </Link>
                </div>
              )}

              <nav aria-label="Sections" className="grid gap-0.5">
                {NAV.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} onClick={() => sound.click()} className={link}>
                    {n.label}
                    <span className="text-ink-soft" aria-hidden="true">
                      ›
                    </span>
                  </NavLink>
                ))}
              </nav>

              <div className="grid gap-0.5">
                <span className="label px-3 pb-1 text-ink-soft">Market sections</span>
                {SECTIONS.map((n) => (
                  <NavLink key={n.to} to={n.to} onClick={() => sound.click()} className={link}>
                    {n.label}
                    <span className="text-ink-soft" aria-hidden="true">
                      ›
                    </span>
                  </NavLink>
                ))}
              </div>

              <div className="grid gap-3 rounded-2xl border border-grout bg-plate p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Appearance</span>
                  <ThemeToggle />
                </div>
                <span className="label text-ink-soft">Sound</span>
                <SoundControls />
              </div>

              {me && (
                <button className="label justify-self-start px-3 text-ink-soft underline" onClick={signOut}>
                  Sign out
                </button>
              )}
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
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:gap-6">
        <Wordmark />

        <nav className="hidden gap-1 rounded-full border border-grout bg-plate p-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => sound.click()}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors xl:px-4 ${isActive ? "bg-ink text-plate" : "text-ink-soft hover:text-ink"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {me ? <Credit cents={me.balanceCents} /> : null}

        <div className="hidden items-center gap-2 lg:flex">
          <SoundMenu />
          <ThemeToggle />
          {me ? (
            <details className="relative">
              <summary className="flex h-11 list-none items-center gap-2 rounded-full border border-grout bg-plate pl-1.5 pr-3.5 font-semibold">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-tile text-sm">{me.username.slice(0, 1).toUpperCase()}</span>
                {me.username}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="absolute right-0 z-30 mt-2 grid w-52 gap-0.5 rounded-2xl border border-grout bg-plate p-2 shadow-xl">
                <Link className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-tile" to="/tab">
                  Your Tab
                </Link>
                <button className="rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-tile" onClick={deposit}>
                  Deposit (Cash Only)
                </button>
                {me.isBoss && (
                  <Link className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-tile" to="/office">
                    Tony's Office
                  </Link>
                )}
                <button className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-soft hover:bg-tile" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <>
              <Link to="/join?mode=login" className="btn btn-cheese h-11 text-sm">
                Sign in
              </Link>
              <Link to="/join" className="btn btn-red h-11 text-sm">
                Join free
              </Link>
            </>
          )}
        </div>

        {/* phone and tablet: join + menu */}
        <div className="flex items-center gap-2 lg:hidden">
          {!me && (
            <Link to="/join" className="btn btn-red h-10 px-4 text-sm">
              Join
            </Link>
          )}
          <button
            onClick={() => {
              sound.click();
              setMenu((m) => !m);
            }}
            className={iconBtn}
            aria-label="Open menu"
            aria-expanded={menu}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
      <MenuDrawer open={menu} onClose={closeMenu} />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-grout px-4 py-8 text-[13px] leading-relaxed text-ink-soft sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Wordmark />
          <span className="font-semibold text-ink">If you ain't Supah, you ain't Dupah!</span>
        </div>
        <p>
          <b className="font-semibold text-ink">Supah Dupah is a parody. It's play money. Nothing here is real. Wink, wink.</b> Not a registered anything. Not affiliated with dem
          other so-called "exchanges." All goods listed fell off a truck of their own free will. Past tosses do not guarantee future tosses. No real people are
          depicted; any resemblance to a real Tony is a coincidence, and there's a lotta Tonys.
        </p>
        <p>© 1994–forever, probably.</p>
      </div>
    </footer>
  );
}
