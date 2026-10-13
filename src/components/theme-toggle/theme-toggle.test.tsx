import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";
import messages from "../../../messages/zh.json";

it("offers system, light and dark preferences with the current selection", async () => {
  const user = userEvent.setup();
  const onPreferenceChange = vi.fn();
  render(<NextIntlClientProvider locale="zh" messages={messages}>
    <ThemeToggle theme="light" preference="system" onPreferenceChange={onPreferenceChange} />
  </NextIntlClientProvider>);
  await user.click(screen.getByRole("combobox", { name: /主题/ }));
  expect(await screen.findByRole("option", { name: "跟随系统" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("option", { name: "浅色模式" })).toBeVisible();
  await user.click(screen.getByRole("option", { name: "暗黑模式" }));
  expect(onPreferenceChange).toHaveBeenCalledWith("dark");
});
