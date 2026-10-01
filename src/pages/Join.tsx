import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

const HOODS = ["Bensonhurst", "Bay Ridge", "Dyker Heights", "Arthur Ave", "Howard Beach", "Staten Island", "Carroll Gardens", "\"Jersey\" (we'll allow it)", "Out of town (tourist)"];

export function Join() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "login" ? "login" : "join";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ username: "", password: "", sentBy: "", hood: HOODS[0], isCop: "no", maiden: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const finish = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await api.login({ username: f.username, password: f.password });
      else await api.join(f);
      await qc.invalidateQueries();
      sound.bell();
      if (mode === "join") {
        fx.confetti();
        fx.stamp("WELCOME!", "good", "+$100.00");
        void sound.line("welcome");
        sound.jingle();
      } else void sound.line("welcome-back");
      nav("/");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Somethin' went wrong.");
      if (e instanceof ApiError && e.status === 403) {
        sound.trombone();
        void sound.line("cop");
        fx.stamp("CLOSED", "bad", "(always)");
      } else sound.aww();
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    {
      title: "Before we let you in the back…",
      sub: "Federal law doesn't require this. Tony does.",
      body: (
        <>
          <Field id="sentBy" label="Who sent you?">
            <input id="sentBy" className="field" value={f.sentBy} onChange={set("sentBy")} placeholder="Frankie from the laundromat" />
          </Field>
          <Field id="hood" label="What neighborhood?">
            <select id="hood" className="field" value={f.hood} onChange={set("hood")}>
              {HOODS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </Field>
          <fieldset className="grid gap-1">
            <legend className="label mb-1 text-ink-soft">You a cop?</legend>
            <div className="flex gap-4">
              {[
                ["yes", "Yes"],
                ["no", "No"],
                ["retired", "Retired"],
              ].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name="cop" checked={f.isCop === v} onChange={() => setF({ ...f, isCop: v })} className="accent-[var(--color-sauce)]" /> {l}
                </label>
              ))}
            </div>
            {f.isCop === "yes" && <span className="font-hand text-sm text-sauce">…you sure about dat?</span>}
          </fieldset>
          <Field id="maiden" label="Mother's maiden name">
            <input id="maiden" className="field" value={f.maiden} onChange={set("maiden")} placeholder="Esposito" />
            <span className="font-hand text-xs text-sauce">we're gonna ask her</span>
          </Field>
        </>
      ),
    },
    {
      title: "What do we call ya?",
      sub: "Pick a name for the Wall of Fame. Pick a password nobody's gonna guess.",
      body: (
        <>
          <Field id="username" label="Name (letters, numbers, underscores)">
            <input id="username" className="field" autoComplete="username" value={f.username} onChange={set("username")} placeholder="BigAnge_Jr" />
          </Field>
          <Field id="password" label="Password (6+)">
            <input id="password" type="password" className="field" autoComplete="new-password" value={f.password} onChange={set("password")} />
          </Field>
          <p className="rounded-xl bg-cheese-soft p-3 text-[13px]">Tony starts everybody with a C-note ($100) in store credit. It's play money. You can't spend it anywhere, including here, on pizza.</p>
        </>
      ),
    },
  ];

  if (mode === "login") {
    return (
      <Shell title="Ayyy, you're back." sub="Sign in to your tab." onSwitch={() => setParams({})} switchLabel="New here? I know a guy →">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void finish();
          }}
        >
          <Field id="lu" label="Name">
            <input id="lu" className="field" autoComplete="username" value={f.username} onChange={set("username")} />
          </Field>
          <Field id="lp" label="Password">
            <input id="lp" type="password" className="field" autoComplete="current-password" value={f.password} onChange={set("password")} />
          </Field>
          {err && <p className="rounded-xl bg-no-soft px-3 py-2 font-semibold text-sauce">{err}</p>}
          <button className="btn btn-red h-12 text-base" disabled={busy}>
            {busy ? "Checkin'…" : "Lemme In"}
          </button>
        </form>
      </Shell>
    );
  }

  const s = steps[step];
  return (
    <Shell title={s.title} sub={s.sub} onSwitch={() => setParams({ mode: "login" })} switchLabel="Already got a tab? Sign in →" step={step}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < steps.length - 1) {
            sound.click();
            setStep(step + 1);
          } else void finish();
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} className="grid gap-3">
            {s.body}
          </motion.div>
        </AnimatePresence>
        {err && <p className="rounded-xl bg-no-soft px-3 py-2 font-semibold text-sauce">{err}</p>}
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" className="btn btn-cheese h-12" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          )}
          <button className="btn btn-red h-12 flex-1 text-base" disabled={busy}>
            {step < steps.length - 1 ? "Keep Goin' →" : busy ? "Checkin' wit' Tony…" : "I Know A Guy →"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="label text-ink-soft">
        {label}
      </label>
      {children}
    </div>
  );
}

function Shell({ title, sub, children, onSwitch, switchLabel, step }: { title: string; sub: string; children: React.ReactNode; onSwitch: () => void; switchLabel: string; step?: number }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="plate rounded-3xl">
        <div className="grid gap-5 p-6 sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-sauce font-slab text-[19px] text-white">S</span>
              <span className="font-slab text-[21px] leading-none">supah dupah</span>
            </span>
            {step != null && <span className="label text-ink-soft">Step {step + 1} of 2</span>}
          </div>
          {step != null && (
            <div className="flex gap-1">
              {[0, 1].map((i) => (
                <i key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-sauce" : "bg-tile"}`} />
              ))}
            </div>
          )}
          <div>
            <h1 className="font-slab text-2xl leading-tight">{title}</h1>
            <p className="text-sm text-ink-soft">{sub}</p>
          </div>
          {children}
          <button type="button" onClick={onSwitch} className="justify-self-center text-sm font-semibold text-sauce hover:underline">
            {switchLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
