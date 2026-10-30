import { useSyncExternalStore } from "react";

/**
 * "Install the app" support.
 *  - Android / desktop Chrome fire `beforeinstallprompt`; we keep the event and let the
 *    user trigger it from a button (browsers only allow it from a user tap).
 *  - iPhone/iPad Safari never fires it: the only way is Share -> Add to Home Screen, so
 *    we show those steps instead.
 * The listener is registered at import time (see main.tsx) because the event can fire
 * before any component has mounted.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true || installed;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as a Mac, so also check for touch support.
  return /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export type InstallState = {
  /** Already running as an installed app. */
  standalone: boolean;
  /** The browser can show its own install dialog right now. */
  canPrompt: boolean;
  /** iPhone/iPad: needs the manual Share steps. */
  ios: boolean;
};

let snapshot: InstallState = { standalone: false, canPrompt: false, ios: false };
function compute(): InstallState {
  const next = { standalone: isStandalone(), canPrompt: !!deferred, ios: isIOS() };
  // Keep the same object when nothing changed (required by useSyncExternalStore).
  if (next.standalone === snapshot.standalone && next.canPrompt === snapshot.canPrompt && next.ios === snapshot.ios) return snapshot;
  snapshot = next;
  return snapshot;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    compute,
    () => snapshot,
  );
}

/** Opens the browser's install dialog. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  notify();
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  return outcome === "accepted";
}
