import { useParams } from "react-router";
import { CATEGORY_LABEL, type Category } from "../../shared/types";
import { MarketCard, SectionHead } from "../components/MarketBits";
import { useMarkets } from "../lib/api";
import { NotFound } from "./NotFound";

const ASIDE: Partial<Record<Category, string>> = {
  truck: "don't ask where it came from. don't ask where it's going.",
  crust: "pizza chores, but it's a sport now",
  hood: "stuff nobody asked anybody to predict",
  block: "democracy, stoop-style",
  weather: "the only forecast that matters: inside da shop",
};

export function Section() {
  const { cat } = useParams();
  const open = useMarkets("open");
  const done = useMarkets("resolved");
  if (!cat || !(cat in ASIDE)) return <NotFound />;
  const c = cat as Category;
  const live = (open.data?.markets ?? []).filter((m) => m.category === c);
  const settled = (done.data?.markets ?? []).filter((m) => m.category === c);
  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <SectionHead title={CATEGORY_LABEL[c]} aside={ASIDE[c]} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((m, i) => (
            <MarketCard key={m.slug} m={m} i={i} />
          ))}
        </div>
        {open.data && !live.length && <p className="font-hand text-ink-soft">Nothin' on the menu here right now. Ask Tony.</p>}
      </section>
      {settled.length > 0 && (
        <section className="grid gap-4">
          <SectionHead title="Already Settled" aside="Tony has spoken" />
          <div className="grid grid-cols-1 gap-4 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
            {settled.map((m, i) => (
              <MarketCard key={m.slug} m={m} i={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
