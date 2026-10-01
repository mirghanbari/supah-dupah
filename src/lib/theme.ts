import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "sd-theme";
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function apply(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0f0f13" : "#f5f5f7");
  listeners.forEach((l) => l());
}

// Follow the device setting until the visitor picks one themselves.
const media = window.matchMedia("(prefers-color-scheme: dark)");
media.addEventListener("change", (e) => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (!saved) apply(e.matches ? "dark" : "light");
});
apply(current());

export function toggleTheme() {
  const next: Theme = current() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: still switch for this visit */
  }
  apply(next);
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    current,
  );
}
