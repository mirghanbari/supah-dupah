import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HttpError, type AppEnv, type UserRow } from "./env";

const COOKIE = "sd_session";
const SESSION_MS = 30 * 24 * 3600 * 1000;

const hex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? unhex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  if (hash === "!") return false; // bots can't log in
  const h = await hashPassword(password, salt);
  return timingSafeEqual(h.hash, hash);
}

export async function startSession(c: Context<AppEnv>, userId: number) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await c.env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, Date.now() + SESSION_MS)
    .run();
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function currentUser(c: Context<AppEnv>): Promise<UserRow | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  return c.env.DB.prepare(
    `SELECT u.id, u.username, u.balance_cents, u.is_boss, u.is_bot, u.hood, u.last_bailout
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
  )
    .bind(token, Date.now())
    .first<UserRow>();
}

export function requireUser(user: UserRow | null): UserRow {
  if (!user) throw new HttpError(401, "Who are you? Sign in first.");
  return user;
}

export function requireBoss(user: UserRow | null): UserRow {
  const u = requireUser(user);
  if (!u.is_boss) throw new HttpError(403, "Only Tony does dat.");
  return u;
}

// ---------- sign-in rate limits ----------

const WINDOW_MS = 15 * 60_000;
const LIMITS = { user: 10, ip: 30 };

function attemptKeys(c: Context<AppEnv>, username: string) {
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  return [
    { key: `u:${username.toLowerCase()}`, max: LIMITS.user },
    { key: `ip:${ip}`, max: LIMITS.ip },
  ];
}

export async function checkLoginLimit(c: Context<AppEnv>, username: string) {
  const now = Date.now();
  for (const { key, max } of attemptKeys(c, username)) {
    const row = await c.env.DB.prepare("SELECT fails, window_start FROM login_attempts WHERE key = ?").bind(key).first<{ fails: number; window_start: number }>();
    if (row && now - row.window_start < WINDOW_MS && row.fails >= max) {
      throw new HttpError(429, "Too many tries. Go get a slice and come back in 15 minutes.");
    }
  }
}

export async function recordLoginFailure(c: Context<AppEnv>, username: string) {
  const now = Date.now();
  await c.env.DB.batch(
    attemptKeys(c, username).map(({ key }) =>
      c.env.DB.prepare(
        `INSERT INTO login_attempts (key, fails, window_start) VALUES (?1, 1, ?2)
         ON CONFLICT (key) DO UPDATE SET
           fails = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE fails + 1 END,
           window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END`,
      ).bind(key, now, WINDOW_MS),
    ),
  );
}

export async function clearLoginFailures(c: Context<AppEnv>, username: string) {
  await c.env.DB.prepare("DELETE FROM login_attempts WHERE key = ?").bind(`u:${username.toLowerCase()}`).run();
}
