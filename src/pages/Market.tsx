import { motion } from "motion/react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { CATEGORY_LABEL } from "../../shared/types";
import { GuestCheck } from "../components/GuestCheck";
import { CategoryPill, Change } from "../components/MarketBits";
import { PriceChart } from "../components/PriceChart";
import { api, ApiError, useMarket, useMe } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { ago, avatarColor, initials, money, pct, shares, until, vol } from "../lib/format";
import { shopNow } from "../lib/clock";
import { sound } from "../lib/sound";
import { NotFound } from "./NotFound";

export function Market() {
  const { slug = "" } = useParams();
  const { data: m, error } = useMarket(slug);
  const me = useMe();
  const qc = useQueryClient();
  const [pick, setPick] = useState(0);
  const [draft, setDraft] = useState("");
  const [cErr, setCErr] = useState<string | null>(null);

  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (!m) return <div className="plate greasy h-96 animate-pulse" />;

  const open = m.status === "open" && (m.closesAt == null || shopNow() < m.closesAt);
  const lead = m.prices.indexOf(Math.max(...m.prices));

  const post = async () => {
    setCErr(null);
    try {
      await api.comment(slug, draft);
      setDraft("");
      sound.click();
      qc.invalidateQueries({ queryKey: ["market", slug] });
    } catch (e) {
      setCErr(e instanceof ApiError ? e.message : "Didn't go through.");
    }
  };

  return (
    <div className="grid gap-5">
      <div className="label text-ink-soft">
        <Link to="/" className="hover:text-sauce">
          Lobby
        </Link>{" "}
        ›{" "}
        <Link to={`/section/${m.category}`} className="hover:text-sauce">
          {CATEGORY_LABEL[m.category]}
        </Link>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-5">
          <header className="plate grid gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryPill c={m.category} />
              {m.status === "resolved" ? (
                <span className="pill bg-ink text-plate">Settled: {m.winner != null ? m.outcomes[m.winner] : "?"}</span>
              ) : (
                m.closesAt && <span className="pill bg-tile text-ink-soft">Closes in {until(m.closesAt)}</span>
              )}
            </div>
            <h1 className="font-slab text-[clamp(24px,3vw,36px)] leading-tight">{m.title}</h1>
            {m.blurb && <p className="text-ink-soft">{m.blurb}</p>}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
              <div>
                <div className="label text-ink-soft">{m.outcomes[lead]}</div>
                <span className="font-led text-6xl leading-[.85] text-basil">{Math.round(m.prices[lead] * 100)}¢</span>{" "}
                <Change d={m.change[lead]} className="text-2xl" />
              </div>
              <div>
                <div className="label text-ink-soft">Chance</div>
                <span className="font-led text-6xl leading-[.85]">{pct(m.prices[lead])}</span>
              </div>
              <div>
                <div className="label text-ink-soft">Traded</div>
                <span className="font-led text-4xl leading-[.85]">{vol(m.volumeCents)}</span>
              </div>
            </div>
          </header>

          <section className="plate greasy p-4">
            <PriceChart history={m.history} outcomes={m.outcomes} />
          </section>

          {m.outcomes.length > 2 && (
            <section className="plate grid gap-2 p-4">
              <h2 className="font-slab text-lg">Da Whole Menu</h2>
              {m.outcomes.map((o, i) => (
                <button key={i} onClick={() => setPick(i)} className={`relative flex items-center justify-between overflow-hidden rounded px-3 py-2 text-left ${pick === i ? "ring-2 ring-basil" : ""} bg-tile`}>
                  <motion.span className="absolute inset-y-0 left-0 bg-cheese/35" initial={false} animate={{ width: `${m.prices[i] * 100}%` }} />
                  <span className="relative font-medium">{o}</span>
                  <span className="relative flex items-baseline gap-3">
                    <Change d={m.change[i]} />
                    <b className="font-led text-2xl font-normal">{Math.round(m.prices[i] * 100)}¢</b>
                  </span>
                </button>
              ))}
            </section>
          )}

          <section className="plate grid gap-2.5 p-5">
            <h2 className="font-slab text-lg text-sauce">Da Rules</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
              {m.rules.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="label pt-0.5 text-ink-soft">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <dt className="label pt-0.5 text-ink-soft">Payout</dt>
              <dd>Every winning share pays one (1) dollar slice. Losers get nothin'. Fees: none. Coke: on da house.</dd>
            </dl>
          </section>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <section className="plate grid content-start gap-2 p-4">
              <h2 className="font-slab text-lg">Da Line</h2>
              <p className="text-xs text-ink-soft">Who just ordered, and what they got</p>
              {m.trades.length === 0 && <p className="font-hand text-ink-soft">Nobody yet. Be da first guy.</p>}
              {m.trades.map((t, i) => (
                <div key={i} className={`relative grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 rounded px-2 py-1 text-[13px] tabular-nums ${t.shares > 0 ? "bg-[#E3F4EA]" : "bg-[#FBE5E8]"}`}>
                  <span className="truncate">
                    <b>{t.user}</b> {t.shares > 0 ? "got" : "sent back"} {shares(Math.abs(t.shares))} {m.outcomes[t.outcome]}
                  </span>
                  <span className="font-led text-lg leading-none">{money(Math.abs(t.cents))}</span>
                  <span className="text-ink-soft">{ago(t.at)}</span>
                </div>
              ))}
            </section>

            <section className="plate grid content-start gap-3 p-4">
              <h2 className="font-slab text-lg">Da Counter</h2>
              <p className="text-xs text-ink-soft">Talk. Keep it clean, there's kids.</p>
              {me ? (
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void post();
                  }}
                >
                  <textarea id="comment" className="field min-h-16 resize-y text-sm" maxLength={280} placeholder="Say somethin'…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="flex items-center justify-between gap-2">
                    {cErr ? <span className="text-xs text-sauce">{cErr}</span> : <span className="text-xs text-ink-soft">{280 - draft.length} left</span>}
                    <button className="btn btn-ink text-sm" disabled={!draft.trim()}>
                      Yell it
                    </button>
                  </div>
                </form>
              ) : (
                <Link to="/join" className="font-hand text-sauce">
                  Sign in to run your mouth →
                </Link>
              )}
              {m.comments.map((c) => (
                <div key={c.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2.5 text-[13px]">
                  <div className="grid h-[34px] w-[34px] place-items-center rounded-full font-slab text-sm text-plate" style={{ background: avatarColor(c.user) }}>
                    {initials(c.user)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold">
                      {c.user} {c.isBoss && <span className="label rounded-sm bg-sauce px-1 text-[10px] text-plate">Resolver</span>}{" "}
                      <span className="font-normal text-ink-soft">· {ago(c.at)}</span>
                    </div>
                    <p className="break-words">{c.body}</p>
                    {c.holding && <div className="label text-[10px] text-basil">holds {c.holding}</div>}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <GuestCheck
            slug={m.slug}
            title={m.title}
            outcomes={m.outcomes}
            prices={m.prices}
            b={m.b}
            open={open}
            closedNote={m.status === "resolved" ? `Settled: ${m.winner != null ? m.outcomes[m.winner] : "?"}. Kitchen's closed.` : undefined}
            mine={m.mine}
            pick={pick}
            onPick={setPick}
          />
        </div>
      </div>
    </div>
  );
}
