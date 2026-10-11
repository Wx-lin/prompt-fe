import { describe, expect, it } from "vitest";
import { getThemeBootstrapScript, resolveThemePreference } from "@/lib/theme/theme";

describe("resolveThemePreference", () => {
  it("uses a saved light or dark theme when available", () => {
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference("light", true)).toBe("light");
  });

  it("falls back to the system preference when storage is empty or invalid", () => {
    expect(resolveThemePreference(null, true)).toBe("dark");
    expect(resolveThemePreference("sepia", false)).toBe("light");
  });
});

it("initializes the document color mode before the first paint", () => {
  const script = getThemeBootstrapScript();
  expect(script).toContain('localStorage.getItem("aigc-prompt-theme")');
  expect(script).toContain('document.documentElement.dataset.theme = theme');
  expect(script).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
});
