"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { normalizeThemePreference, resolveThemePreference, THEME_STORAGE_KEY, type Theme, type ThemePreference } from "@/lib/theme/theme";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function applyPreference(preference: ThemePreference) {
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = resolveThemePreference(preference, window.matchMedia(MEDIA_QUERY).matches);
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-preference"] });
  const media = window.matchMedia(MEDIA_QUERY);
  const updateSystem = () => applyPreference(normalizeThemePreference(document.documentElement.dataset.themePreference));
  const updateStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) applyPreference(normalizeThemePreference(event.newValue));
  };
  updateSystem();
  media.addEventListener("change", updateSystem);
  window.addEventListener("storage", updateStorage);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", updateSystem);
    window.removeEventListener("storage", updateStorage);
  };
}

function getThemeSnapshot() {
  return `${normalizeThemePreference(document.documentElement.dataset.themePreference)}:${document.documentElement.dataset.theme === "dark" ? "dark" : "light"}`;
}

function getServerThemeSnapshot() { return "system:light"; }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const [preference, theme] = snapshot.split(":") as [ThemePreference, Theme];
  const setPreference = useCallback((next: ThemePreference) => {
    const normalized = normalizeThemePreference(next);
    applyPreference(normalized);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch {
      // Storage can be disabled; the active preference still works for this page.
    }
  }, []);
  return <ThemeContext.Provider value={{ theme, preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
