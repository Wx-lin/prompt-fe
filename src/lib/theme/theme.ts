export type Theme = "light" | "dark";

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
    try {
      const saved = window.localStorage.getItem("${THEME_STORAGE_KEY}");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  })();`;
}
