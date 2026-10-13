import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";
import { getThemeBootstrapScript, THEME_STORAGE_KEY } from "@/lib/theme/theme";
let dark = false;
let change: () => void;
function Probe() {
  const { theme, preference, setPreference } = useTheme();
  return <button onClick={() => setPreference(preference === "system" ? "light" : "system")}>{preference}:{theme}</button>;
}
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.themePreference;
  dark = false;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: dark, addEventListener: (_: string, cb: () => void) => { change = cb; }, removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("tracks system changes unless explicitly overridden and can return to system", async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByRole("button")).toHaveTextContent("system:light");
  await act(async () => { dark = true; change(); });
  expect(screen.getByRole("button")).toHaveTextContent("system:dark");
  await act(async () => screen.getByRole("button").click());
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  await act(async () => change());
  expect(screen.getByRole("button")).toHaveTextContent("light:light");
  await act(async () => screen.getByRole("button").click());
  expect(screen.getByRole("button")).toHaveTextContent("system:dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
});
it("preserves existing stored preferences on bootstrap", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  window.eval(getThemeBootstrapScript());
  expect(document.documentElement.dataset.themePreference).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
});
it("uses system mode when storage is blocked", () => {
  dark = true;
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  window.eval(getThemeBootstrapScript());
  expect(document.documentElement.dataset.theme).toBe("dark");
  spy.mockRestore();
});

it("synchronizes stored preferences from other tabs and resets on clear", async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" })));
  expect(screen.getByRole("button")).toHaveTextContent("dark:dark");
  await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: null })));
  expect(screen.getByRole("button")).toHaveTextContent("system:light");
});
