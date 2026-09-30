import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Link, NavLink, useNavigate } from "react-router";
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

export function Storefront() {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();

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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pb-4 pt-1">
          <Link to="/" className="flex min-w-0 items-center gap-4" aria-label="Supah Dupah home">
            <Logo className="w-[210px] shrink-0 sm:w-[270px]" />
            <div className="hidden min-w-0 flex-col gap-2 md:flex">
              <span className="neon text-3xl leading-none">If you ain't Supah,</span>
              <span className="neon text-3xl leading-none">you ain't Dupah.</span>
              <span className="neon-open self-start text-sm">OPEN</span>
            </div>
          </Link>

          <div className="flex flex-col items-end gap-2">
            {me ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link to="/tab" id="tab-target" className="led flex items-baseline gap-2 px-3 py-0.5 text-2xl">
                  <Led value={me.balanceCents} text={money(me.balanceCents)} />
                  <small className="text-sm text-[#b99a5a]">STORE CREDIT</small>
                </Link>
                <button
                  className="btn btn-cheese text-sm"
                  onClick={() => {
                    sound.register();
                    void sound.line("deposit");
                    fx.page("TONY: WE DON'T TAKE CARDS. OR CASH. IT'S FAKE MONEY, GENIUS.");
                  }}
                >
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
                    <button
                      className="label rounded px-2 py-1.5 text-left text-sm hover:bg-tile"
                      onClick={async () => {
                        await api.logout();
                        await qc.invalidateQueries();
                        void sound.line("ciao");
                        nav("/");
                      }}
                    >
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
        <nav className="flex gap-1 overflow-x-auto bg-basil px-3" aria-label="Sections">
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
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 bg-felt px-4 py-8 text-xs leading-relaxed text-[#9d958b]">
      <div className="mx-auto grid max-w-7xl gap-3">
        <p className="font-neon text-2xl text-plate">If you ain't Supah, you ain't Dupah.</p>
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
