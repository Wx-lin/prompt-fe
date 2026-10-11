import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import messages from "../../../messages/zh.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="zh" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ThemeToggle", () => {
  it("announces the next theme and requests a toggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderWithIntl(<ThemeToggle theme="light" onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: "切换到暗黑模式" }));

    expect(onToggle).toHaveBeenCalledOnce();
  });
});
