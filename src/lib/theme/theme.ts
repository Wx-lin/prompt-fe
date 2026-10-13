export type Theme = "light" | "dark";

export type ThemePreference = Theme | "system";

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export const THEME_STORAGE_KEY = "aigc-prompt-theme";

export function resolveThemePreference(
  storedTheme: string | null,
  prefersDark: boolean,
): Theme {
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return prefersDark ? "dark" : "light";
}

export function getThemeBootstrapScript(): string {
  return `(() => {
    let saved;
    try { saved = window.localStorage.getItem("${THEME_STORAGE_KEY}"); } catch {}
    const preference = saved === "light" || saved === "dark" ? saved : "system";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = theme;
  })();`;
}
