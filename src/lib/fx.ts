import { useSyncExternalStore } from "react";

// A tiny effects bus: pages fire effects, the overlay layer in <Effects/> renders them.

export type Page = { id: number; text: string; tone: "good" | "bad" | "info" };
export type Stamp = { id: number; text: string; sub?: string; tone: "good" | "bad" };
export type Ticket = { id: number; lines: [string, string][]; title: string; total: string };

type State = { pages: Page[]; stamp: Stamp | null; ticket: Ticket | null; confetti: number; shake: number };

let state: State = { pages: [], stamp: null, ticket: null, confetti: 0, shake: 0 };
let seq = 1;
const subs = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const s of subs) s();
}

export const fx = {
  /** Pager message in the corner. */
  page(text: string, tone: Page["tone"] = "info") {
    const p = { id: seq++, text, tone };
    set({ pages: [...state.pages.slice(-2), p] });
    setTimeout(() => set({ pages: state.pages.filter((x) => x.id !== p.id) }), 6500);
  },
  /** Big rubber-stamp slam across the screen. */
  stamp(text: string, tone: Stamp["tone"] = "good", sub?: string) {
    const s = { id: seq++, text, sub, tone };
    set({ stamp: s });
    setTimeout(() => state.stamp?.id === s.id && set({ stamp: null }), 2200);
  },
  /** Guest check that tears off and flies to Your Tab. */
  ticket(title: string, lines: [string, string][], total: string) {
    const t = { id: seq++, title, lines, total };
    set({ ticket: t });
    setTimeout(() => state.ticket?.id === t.id && set({ ticket: null }), 2000);
  },
  confetti() {
    set({ confetti: state.confetti + 1 });
  },
  shake() {
    set({ shake: state.shake + 1 });
  },
};

export function useFx() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}
