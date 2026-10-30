import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const KEY = "questly_theme";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // storage unavailable: fall through
  }
  return "system";
}

export function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#120f0d" : "#faf7f2");
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // ignore
  }
  applyTheme(pref);
  window.dispatchEvent(new Event("questly:theme"));
}

/** Current preference + whether dark is active; follows system changes live. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const sync = () => {
      setPref(getThemePreference());
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (getThemePreference() === "system") {
        applyTheme("system");
        sync();
      }
    };
    window.addEventListener("questly:theme", sync);
    mq.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("questly:theme", sync);
      mq.removeEventListener("change", onSystem);
    };
  }, []);

  return { pref, isDark, setPref: setThemePreference };
}
