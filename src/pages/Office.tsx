import { useState } from "react";
import { Link, Navigate } from "react-router";
import { CATEGORY_LABEL } from "../../shared/types";
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
    <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
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
          {err && <p className="font-hand text-sauce">{err}</p>}
          <button className="btn btn-red" disabled={create.isPending}>
            Put It On Da Board
          </button>
        </form>
      </section>

      <section className="plate grid gap-3 p-5">
        <h2 className="font-slab text-xl">Settle Up</h2>
        <p className="text-sm text-ink-soft">Pick what happened. Winners get paid a dollar a share on the spot. There's no undo, so be sure. You were standing right there.</p>
        {(data?.markets ?? []).map((m) => (
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
                    className={`label rounded px-2.5 py-1.5 ${armed ? "bg-sauce text-plate" : "bg-tile hover:bg-cheese/40"}`}
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
    </div>
  );
}
