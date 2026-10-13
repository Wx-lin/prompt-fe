import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { Menu } from "@base-ui/react/menu";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import type { ComponentProps } from "react";
import { UserMenu } from "./user-menu";
import { AccountPreferences } from "./account-preferences";
const setPreference = vi.fn();
const replace = vi.fn();
vi.mock("@/components/theme-provider/theme-provider", () => ({ useTheme: () => ({ preference: "system", setPreference }) }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} />, usePathname: () => "/my-works", useRouter: () => ({ replace }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("page=2") }));
beforeEach(() => {
  class Pointer extends MouseEvent { pointerType = "mouse"; }
  vi.stubGlobal("PointerEvent", Pointer);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function view() { render(<NextIntlClientProvider locale="zh" messages={messages}><Menu.Root defaultOpen><Menu.Trigger>Account</Menu.Trigger><Menu.Portal><Menu.Positioner><Menu.Popup><AccountPreferences /></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></NextIntlClientProvider>); }
it("collapses theme options into a submenu and marks the stored system preference", async () => {
  view();
  expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitem", { name: /外观/ }));
  expect(await screen.findByRole("menuitemradio", { name: /跟随系统/ })).toHaveAttribute("aria-checked", "true");
  await userEvent.click(screen.getByRole("menuitemradio", { name: /暗/ }));
  expect(setPreference).toHaveBeenCalledWith("dark");
});
it("offers both locales and preserves the current route query", async () => {
  view();
  await userEvent.click(screen.getByRole("menuitem", { name: /语言/ }));
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "English" }));
  expect(replace).toHaveBeenCalledWith("/my-works?page=2", { locale: "en" });
});
it("uses an internal options page on mobile and returns without closing the menu", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  view();
  await userEvent.click(screen.getByRole("menuitem", { name: /外观/ }));
  expect(await screen.findByRole("menuitemradio", { name: /跟随系统/ })).toHaveAttribute("aria-checked", "true");
  expect(screen.queryByRole("menuitem", { name: /语言/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitem", { name: "返回" }));
  expect(screen.getByRole("menuitem", { name: /语言/ })).toBeVisible();
  expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("restores account actions when resizing an open mobile selection page to desktop", async () => {
  let change!: () => void;
  const media = { matches: true, addEventListener: vi.fn((_event, listener) => { change = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  render(<NextIntlClientProvider locale="zh" messages={messages}><UserMenu user={{ id: "u", nickname: "Creator", email: "c@example.com", avatar_url: null, created_at: "2026-10-13" }} preferences={<AccountPreferences />} /></NextIntlClientProvider>);
  await userEvent.click(screen.getByRole("button", { name: messages.header.userMenuAriaLabel }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /外观/ }));
  expect(await screen.findByRole("menuitemradio", { name: /跟随系统/ })).toHaveFocus();
  expect(screen.queryByRole("menuitem", { name: messages.header.myWorks })).not.toBeInTheDocument();
  act(() => { media.matches = false; change(); });
  expect(await screen.findByRole("menuitem", { name: messages.header.myWorks })).toBeVisible();
  expect(screen.queryByRole("menuitem", { name: "返回" })).not.toBeInTheDocument();
});
