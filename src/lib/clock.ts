import { useEffect, useRef, useState } from "react";

let offset = 0;

/** Call with a server timestamp to keep every countdown on the shop's clock. */
export function syncClock(serverNow: number) {
  offset = serverNow - Date.now();
}

export const shopNow = () => Date.now() + offset;
export const clockOffset = () => offset;

/** Re-renders every `ms` with the server-synced time. */
export function useNow(ms = 250) {
  const [now, setNow] = useState(shopNow);
  useEffect(() => {
    const id = setInterval(() => setNow(shopNow()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Runs `fn` once each time `value` changes after the first render. */
export function useOnChange<T>(value: T, fn: (next: T, prev: T) => void) {
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      fn(value, prev.current);
      prev.current = value;
    }
  });
}
