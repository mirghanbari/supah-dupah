import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncClock } from "./clock";
import type { KitchenState, LeaderRow, MarketDetail, MarketSummary, Me, Standing, TabState, TickerItem, VanPosition, VanRow } from "../../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Somethin' went wrong.");
  return data as T;
}

export const api = {
  me: () => call<{ user: Me | null }>("/me"),
  join: (b: { username: string; password: string; sentBy: string; hood: string; isCop: string }) => call<{ ok: true }>("/join", b),
  login: (b: { username: string; password: string }) => call<{ ok: true }>("/login", b),
  logout: () => call<{ ok: true }>("/logout", {}),
  markets: (status: "open" | "resolved" = "open") => call<{ markets: MarketSummary[] }>(`/markets?status=${status}`),
  market: (slug: string) => call<MarketDetail>(`/markets/${slug}`),
  buy: (slug: string, outcome: number, cents: number) =>
    call<{ shares: number; cents: number; prices: number[]; outcome: string }>(`/markets/${slug}/buy`, { outcome, cents }),
  sell: (slug: string, outcome: number, shares: number) => call<{ shares: number; cents: number }>(`/markets/${slug}/sell`, { outcome, shares }),
  comment: (slug: string, body: string) => call<{ ok: true }>(`/markets/${slug}/comments`, { body }),
  kitchen: () => call<KitchenState>("/kitchen").then((d) => (syncClock(d.now), d)),
  standings: () => call<{ standings: Standing[] }>("/standings"),
  van: () => call<{ now: number; board: VanRow[]; mine: VanPosition[] }>("/van").then((d) => (syncClock(d.now), d)),
  vanOpen: (symbol: string, side: "long" | "short", boxes: number) => call<{ price: number; cost: number }>("/van/open", { symbol, side, boxes }),
  vanClose: (id: number) => call<VanPosition & { proceeds: number }>("/van/close", { id }),
  tab: () => call<TabState>("/tab"),
  bailout: () => call<{ ok: true }>("/bailout", {}),
  leaderboard: () => call<{ leaders: LeaderRow[] }>("/leaderboard"),
  ticker: () => call<{ items: TickerItem[] }>("/ticker"),
  salCreate: (b: { title: string; blurb: string; category: string; outcomes: string[]; days: number }) => call<{ slug: string }>("/sal/markets", b),
  salResolve: (slug: string, winner: number) => call<{ ok: true }>(`/sal/markets/${slug}/resolve`, { winner }),
};

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: api.me, refetchInterval: 8_000 }).data?.user ?? null;
export const useMeQuery = () => useQuery({ queryKey: ["me"], queryFn: api.me, refetchInterval: 8_000 });
export const useMarkets = (status: "open" | "resolved" = "open") =>
  useQuery({ queryKey: ["markets", status], queryFn: () => api.markets(status), refetchInterval: 10_000 });
export const useMarket = (slug: string) => useQuery({ queryKey: ["market", slug], queryFn: () => api.market(slug), refetchInterval: 5_000 });
export const useKitchen = () => useQuery({ queryKey: ["kitchen"], queryFn: api.kitchen, refetchInterval: 2_500 });
export const useVan = () => useQuery({ queryKey: ["van"], queryFn: api.van, refetchInterval: 10_000 });
export const useTab = (enabled: boolean) => useQuery({ queryKey: ["tab"], queryFn: api.tab, refetchInterval: 8_000, enabled });
export const useStandings = () => useQuery({ queryKey: ["standings"], queryFn: api.standings, refetchInterval: 30_000 });
export const useLeaders = () => useQuery({ queryKey: ["leaders"], queryFn: api.leaderboard, refetchInterval: 20_000 });
export const useTicker = () => useQuery({ queryKey: ["ticker"], queryFn: api.ticker, refetchInterval: 30_000 });

/** Mutation that refreshes everything money-related afterwards. */
export function useMoneyMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const k of ["me", "tab", "market", "markets", "kitchen", "van", "leaders"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
