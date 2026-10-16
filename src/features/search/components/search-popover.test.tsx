import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { SearchPopover } from "./search-popover";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
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
