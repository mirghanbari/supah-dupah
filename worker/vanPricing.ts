import { FAST, minuteOf, priceAt, SLOW, type Contract, type Shocks } from "../shared/van";
import type { Env } from "./env";

// Each HMAC gives 32 bytes = 32 shocks. Knowing past shocks says nothing about the next one.
const CHUNK = 32;
const cache = new Map<string, Uint8Array>();
let keyCache: { secret: string; key: CryptoKey } | null = null;

async function key(env: Env) {
  if (!env.TOSS_SECRET) throw new Error("TOSS_SECRET is not set");
  if (keyCache?.secret !== env.TOSS_SECRET) {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TOSS_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache = { secret: env.TOSS_SECRET, key: k };
  }
  return keyCache.key;
}

async function load(env: Env, symbol: string, stream: "fast" | "slow", chunk: number) {
  const id = `${symbol}|${stream}|${chunk}`;
  if (cache.has(id)) return;
  const sig = await crypto.subtle.sign("HMAC", await key(env), new TextEncoder().encode(`van:${id}`));
  if (cache.size > 20_000) cache.clear();
  cache.set(id, new Uint8Array(sig));
}

/** Fetch every shock needed to price minutes [from, to], then hand back a synchronous reader. */
async function prepare(env: Env, c: Contract, from: number, to: number): Promise<Shocks> {
  const jobs: Promise<void>[] = [];
  for (let k = Math.floor((from - FAST.window) / CHUNK); k <= Math.floor(to / CHUNK); k++) jobs.push(load(env, c.symbol, "fast", k));
  const h0 = Math.floor(from / SLOW.minutes) - SLOW.window;
  const h1 = Math.floor(to / SLOW.minutes);
  for (let k = Math.floor(h0 / CHUNK); k <= Math.floor(h1 / CHUNK); k++) jobs.push(load(env, c.symbol, "slow", k));
  await Promise.all(jobs);
  return (stream, i) => {
    const bytes = cache.get(`${c.symbol}|${stream}|${Math.floor(i / CHUNK)}`);
    return bytes ? (bytes[((i % CHUNK) + CHUNK) % CHUNK] / 255) * 2 - 1 : 0;
  };
}

export async function vanPrice(env: Env, c: Contract, t: number): Promise<number> {
  const m = minuteOf(t);
  return priceAt(c, m, await prepare(env, c, m, m));
}

/** Minute-by-minute history ending at t. */
export async function vanHistory(env: Env, c: Contract, t: number, minutes: number): Promise<number[]> {
  const end = minuteOf(t);
  const shock = await prepare(env, c, end - minutes + 1, end);
  const out: number[] = [];
  for (let m = end - minutes + 1; m <= end; m++) out.push(priceAt(c, m, shock));
  return out;
}
