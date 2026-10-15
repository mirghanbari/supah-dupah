import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router";
import { CATEGORY_LABEL, type FreshKind, type FreshRun } from "../../shared/types";
import { api, ApiError, useMarkets, useMe, useMoneyMutation } from "../lib/api";
import { cents } from "../lib/format";
import { fx } from "../lib/fx";
import { sound } from "../lib/sound";

const CATS = ["hood", "truck", "crust", "block", "weather"] as const;

export function Office() {
  const me = useMe();
  const { data } = useMarkets();
  const [f, setF] = useState({ title: "", blurb: "", category: "hood", outcomes: "YES\nNO", days: 7 });
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ slug: string; winner: number } | null>(null);
  const create = useMoneyMutation(() => api.bossCreate({ ...f, outcomes: f.outcomes.split("\n").map((o) => o.trim()).filter(Boolean) }));
  const resolve = useMoneyMutation((a: { slug: string; winner: number }) => api.bossResolve(a.slug, a.winner));

  if (me && !me.isBoss) return <Navigate to="/" replace />;
  if (!me) return <p className="font-hand text-lg">Only Tony gets in here.</p>;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="plate grid gap-3 p-5">
        <h1 className="font-slab text-2xl">Tony's Office</h1>
        <p className="text-sm text-ink-soft">Put a new special on the board.</p>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              const r = await create.mutateAsync(undefined);
              sound.bell();
              fx.page(`NEW SPECIAL ON DA BOARD: ${r.slug.toUpperCase()}`, "good");
              setF({ ...f, title: "", blurb: "" });
            } catch (e2) {
              setErr(e2 instanceof ApiError ? e2.message : "Didn't work.");
            }
          }}
        >
          <label className="grid gap-1">
            <span className="label text-ink-soft">Question</span>
            <input id="sal-title" className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Does Paulie finish the calzone?" />
          </label>
          <label className="grid gap-1">
            <span className="label text-ink-soft">Blurb</span>
            <input id="sal-blurb" className="field" value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} placeholder="It's a big calzone." />
          </label>
          <label className="grid gap-1">
            <span className="label text-ink-soft">Section</span>
            <select id="sal-cat" className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label text-ink-soft">Outcomes (one per line)</span>
            <textarea id="sal-outcomes" className="field min-h-20 font-mono text-sm" value={f.outcomes} onChange={(e) => setF({ ...f, outcomes: e.target.value })} />
          </label>
          <label className="grid gap-1">
            <span className="label text-ink-soft">Closes in (days)</span>
            <input id="sal-days" type="number" min={1} max={90} className="field" value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} />
          </label>
          {err && <p className="text-sm font-semibold text-sauce">{err}</p>}
          <button className="btn btn-red" disabled={create.isPending}>
            Put It On Da Board
          </button>
        </form>
      </section>

      <section className="plate grid gap-3 p-5">
        <h2 className="font-slab text-xl">Settle Up</h2>
        <p className="text-sm text-ink-soft">Pick what happened. Winners get paid a dollar a share on the spot. There's no undo, so be sure. You were standing right there.</p>
        {(data?.markets ?? []).filter((m) => !m.autoSettle).map((m) => (
          <div key={m.slug} className="grid gap-2 border-b border-grout py-2">
            <Link to={`/m/${m.slug}`} className="font-bold hover:text-sauce">
              {m.title}
            </Link>
            <div className="flex flex-wrap gap-1.5">
              {m.outcomes.map((o, i) => {
                const armed = confirm?.slug === m.slug && confirm.winner === i;
                return (
                  <button
                    key={i}
                    className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${armed ? "bg-sauce text-white" : "bg-tile hover:bg-cheese-soft"}`}
                    disabled={resolve.isPending}
                    onClick={async () => {
                      if (!armed) return setConfirm({ slug: m.slug, winner: i });
                      setConfirm(null);
                      try {
                        await resolve.mutateAsync({ slug: m.slug, winner: i });
                        sound.rimshot();
                        fx.stamp("SETTLED", "good", o);
                      } catch (e) {
                        fx.page(e instanceof ApiError ? e.message.toUpperCase() : "DIDN'T SETTLE", "bad");
                      }
                    }}
                  >
                    {armed ? `Tap again: ${o} wins` : `${o} (${cents(m.prices[i])})`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <FreshPanel />
    </div>
  );
}

const usd = (micros: number) => (micros === 0 ? "$0" : micros < 10_000 ? `$${(micros / 1e6).toFixed(4)}` : `$${(micros / 1e6).toFixed(2)}`);
const writerName = (w: string) => (w === "house" ? "House templates" : w === "claude-haiku-5-5" ? "Claude Haiku 5.5" : w);
const KIND_LABEL: Record<FreshKind, string> = { weather: "Weather", money: "Money" };
/** What a day costs on Claude Haiku 5.5 before there are real runs to go by: two calls, ~1,500 tokens in and ~2,000 out each. */
const EST_MICROS = 2 * (1_500 * 0.1 + 2_000 * 0.5);
const hourName = (h: number) => (h === 12 ? "noon" : h > 12 ? `${h - 12}pm` : `${h}am`);

/** The daily fresh markets: who writes them, what got made, and what it costs. */
function FreshPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["fresh"], queryFn: api.bossFresh, refetchInterval: 30_000 });
  const [busy, setBusy] = useState<FreshKind | null>(null);
  const [last, setLast] = useState<FreshRun | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // going rate: what Claude actually charged per day, from the last 30 days of real runs
  const paid = (data?.runs ?? []).filter((r) => r.writer !== "house" && r.inputTokens > 0);
  const perDay = paid.length
    ? (["weather", "money"] as const).reduce((s, k) => {
        const runs = paid.filter((r) => r.kind === k);
        return s + (runs.length ? runs.reduce((t, r) => t + r.costMicros, 0) / runs.length : EST_MICROS / 2);
      }, 0)
    : EST_MICROS;

  const cook = async (kind: FreshKind) => {
    setBusy(kind);
    setErr(null);
    try {
      const r = await api.bossFreshRun(kind);
      setLast(r);
      sound.bell();
      fx.page(r.made ? `${r.made} FRESH ONES ON DA BOARD` : "BOARD'S FULL FOR DAT DAY", r.made ? "good" : "bad");
      for (const k of ["fresh", "markets"]) qc.invalidateQueries({ queryKey: [k] });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Didn't work.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="plate grid gap-4 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-slab text-xl">Fresh Markets</h2>
          <p className="max-w-[64ch] text-sm text-ink-soft">
            {data ? (
              <>
                {data.perDay.weather} weather bets on tomorrow go up at {hourName(data.hours.weather)}, and {data.perDay.money} money bets on the next trading day go up at {hourName(data.hours.money)} (New York time). The computer settles them all from the real numbers.
              </>
            ) : (
              "Loading…"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["weather", "money"] as const).map((k) => (
            <button key={k} className="btn btn-red" disabled={busy != null} onClick={() => cook(k)}>
              {busy === k ? "Cookin'…" : `Cook ${KIND_LABEL[k].toLowerCase()} now`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Writer" value={data ? writerName(data.writer) : "…"} />
        <Stat label="Open on the board" value={data ? String(data.openOnBoard) : "…"} />
        <Stat label="Spent, last 30 days" value={data ? usd(data.last30.micros) : "…"} />
        <Stat label={paid.length ? "Per day, going rate" : "Per day, estimated"} value={`${usd(perDay)} · ${usd(perDay * 30)}/mo`} />
      </div>

      {data?.writer === "house" && (
        <p className="rounded-2xl bg-cheese-soft px-4 py-3 text-sm">
          No Claude API key yet, so the house templates are writing these for free. Add <code className="font-mono">ANTHROPIC_API_KEY</code> and Claude Haiku 5.5 takes over. Estimated cost for both batches: about {usd(EST_MICROS)} a day, {usd(EST_MICROS * 30)} a month.
        </p>
      )}
      {data && !data.hasPrices && (
        <p className="rounded-2xl bg-cheese-soft px-4 py-3 text-sm">
          No stock price keys, so the money batch only has crypto. Add <code className="font-mono">ALPHAVANTAGE_API_KEY</code> for the stocks and funds.
        </p>
      )}
      {data?.hasPrices && !data.hasBackup && (
        <p className="rounded-2xl bg-cheese-soft px-4 py-3 text-sm">
          Only one stock price source. Add <code className="font-mono">TWELVEDATA_API_KEY</code> as a backup for when Alpha Vantage runs out of calls.
        </p>
      )}
      {err && <p className="text-sm font-semibold text-sauce">{err}</p>}
      {last && (
        <div className="grid gap-1.5 rounded-2xl bg-tile px-4 py-3 text-sm">
          <span className="label text-ink-soft">
            Just made {last.made} {KIND_LABEL[last.kind].toLowerCase()} for {last.forDate} · {writerName(last.writer)}
            {last.writer !== "house" && ` wrote ${last.fromWriter}, house filled ${last.made - last.fromWriter}`}
          </span>
          {last.titles?.map((t) => <span key={t}>• {t}</span>)}
          {last.error && <span className="font-semibold text-sauce">Trouble: {last.error}</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="label text-ink-soft">
            <tr>
              <th className="py-2 pr-3 font-semibold">When</th>
              <th className="py-2 pr-3 font-semibold">Kind</th>
              <th className="py-2 pr-3 font-semibold">For</th>
              <th className="py-2 pr-3 font-semibold">Writer</th>
              <th className="py-2 pr-3 font-semibold">Made</th>
              <th className="py-2 pr-3 font-semibold">Tokens in / out</th>
              <th className="py-2 font-semibold">Cost</th>
            </tr>
          </thead>
          <tbody>
            {(data?.runs ?? []).map((r) => (
              <tr key={`${r.at}-${r.kind}`} className="border-t border-grout align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{r.trigger === "tony" && " · you"}</td>
                <td className="py-2 pr-3">{KIND_LABEL[r.kind]}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{r.forDate}</td>
                <td className="py-2 pr-3">
                  {writerName(r.writer)}
                  {r.error && <div className="text-xs text-sauce">{r.error}</div>}
                  {r.rejected.length > 0 && <div className="text-xs text-ink-soft" title={r.rejected.join("\n")}>{r.rejected.length} thrown out by the checks</div>}
                </td>
                <td className="py-2 pr-3 tabular-nums">{r.writer === "house" ? r.made : `${r.fromWriter} + ${r.made - r.fromWriter} house`}</td>
                <td className="py-2 pr-3 tabular-nums">{r.writer === "house" ? "—" : `${r.inputTokens.toLocaleString()} / ${r.outputTokens.toLocaleString()}`}</td>
                <td className="py-2 tabular-nums">{usd(r.costMicros)}</td>
              </tr>
            ))}
            {data && !data.runs.length && (
              <tr>
                <td colSpan={7} className="py-3 text-ink-soft">No batches yet. They go up on their own, or cook one now.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-2xl bg-tile px-4 py-3">
      <span className="label text-ink-soft">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
