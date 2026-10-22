import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { OutputLanguage } from "./language-select";

afterEach(cleanup);

it("changes the selected output language using the accessible language menu", async () => {
  const onChange = vi.fn();
  function ControlledLanguage() {
    const [language, setLanguage] = useState<"zh" | "en">("zh");
    return <OutputLanguage value={language} onChange={value => { onChange(value); setLanguage(value); }} />;
  }
  const user = userEvent.setup();
  render(<NextIntlClientProvider locale="zh" messages={messages}><ControlledLanguage /></NextIntlClientProvider>);
  expect(screen.getByRole("combobox", { name: "输出语言" })).toHaveTextContent("中文");
  await user.click(screen.getByRole("combobox", { name: "输出语言" }));
  expect(await screen.findByRole("option", { name: "中文" })).toHaveAttribute("aria-selected", "true");
  await user.click(screen.getByRole("option", { name: "English" }));
  expect(screen.getByRole("combobox", { name: "输出语言" })).toHaveTextContent("English");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("en");
});

it("keeps the selected language when the user dismisses the menu", async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<NextIntlClientProvider locale="zh" messages={messages}><OutputLanguage value="en" onChange={onChange} /></NextIntlClientProvider>);
  await user.click(screen.getByRole("combobox", { name: "输出语言" }));
  expect(await screen.findByRole("option", { name: "English" })).toHaveAttribute("aria-selected", "true");
  await user.keyboard("{Escape}");
  expect(screen.getByRole("combobox", { name: "输出语言" })).toHaveTextContent("English");
  expect(onChange).not.toHaveBeenCalled();
});
