import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { SearchPopover } from "./search-popover";

const push = vi.fn();
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor) Object.defineProperty(Element.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});
const view = (query: string) => <NextIntlClientProvider locale="zh" messages={messages}><SearchPopover query={query} filters="category=animal&models=FLUX&sort=latest" /></NextIntlClientProvider>;
it("clears the active search while preserving category, model and sort", async () => {
  render(view("宠物"));
  await userEvent.click(screen.getByRole("button", { name: messages.header.clearSearchAriaLabel }));
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(push).toHaveBeenCalledWith("/?category=animal&models=FLUX&sort=latest");
});
it("synchronizes the input with route changes and browser history", () => {
  const { rerender } = render(view("宠物"));
  rerender(view("城市"));
  expect(screen.getByRole("textbox")).toHaveValue("城市");
  rerender(view(""));
  expect(screen.getByRole("textbox")).toHaveValue("");
  rerender(view("宠物"));
  expect(screen.getByRole("textbox")).toHaveValue("宠物");
});

it("keeps the compact gallery search usable without crowding it with a keyboard badge", async () => {
  const user = userEvent.setup();
  render(<NextIntlClientProvider locale="zh" messages={messages}><SearchPopover query="" filters="category=animal&models=FLUX&sort=latest" appearance="gallery" /></NextIntlClientProvider>);
  expect(document.querySelector("kbd")).toBeNull();
  const input = screen.getByRole("textbox", { name: messages.header.searchAriaLabel });
  await user.type(input, "猫");
  expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal", "true");
  await user.keyboard("{Enter}");
  expect(push).toHaveBeenCalledWith("/?category=animal&models=FLUX&sort=latest&q=%E7%8C%AB");
});
