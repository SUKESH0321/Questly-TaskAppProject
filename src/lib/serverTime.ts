import { useSyncExternalStore } from "react";

/**
 * Countdowns must follow the SERVER's clock, not the phone's (a phone that is
 * 3 minutes fast would otherwise show a task as expired early).
 * The API returns `serverNow`; we keep the difference from the local clock.
 */
let offsetMs = 0;

export function syncServerTime(serverNowIso?: string) {
  if (!serverNowIso) return;
  const t = Date.parse(serverNowIso);
  if (!Number.isNaN(t)) offsetMs = t - Date.now();
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

// One shared 1-second ticker for every countdown on screen.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current server time in ms, re-rendering the caller once per second. */
export function useServerNow(): number {
  return useSyncExternalStore(subscribe, () => Math.floor(serverNow() / 1000) * 1000);
}

/** "12:05" under an hour, "2h 05m" under a day, "1d 3h" beyond. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
