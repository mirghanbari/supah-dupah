import { shopNow } from "./clock";

export const money = (cents: number) => {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const signedMoney = (cents: number) => (cents > 0 ? "+" : "") + money(cents);

export const cents = (p: number) => `${Math.round(p * 100)}¢`;

export const pct = (p: number) => `${Math.round(p * 100)}%`;

export const vol = (c: number) => {
  const d = c / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}K`;
  return `$${d.toFixed(0)}`;
};

export const shares = (s: number) => (s >= 100 ? s.toFixed(0) : s.toFixed(1));

export function ago(at: number, now = shopNow()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function until(at: number, now = shopNow()) {
  const s = Math.max(0, Math.round((at - now) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export function initials(name: string) {
  const parts = name.replace(/_/g, " ").split(/(?=[A-Z])|\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const AVATAR = ["#C8102E", "#0B7A3B", "#1D1A17", "#C98A3E", "#1F3FA0", "#8E0B20"];
export function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}
