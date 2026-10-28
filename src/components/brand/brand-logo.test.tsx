import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandLogo } from "./brand-logo";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(cleanup);

it("allows an approved page label without changing the original mark or default branding", () => {
  const { rerender } = render(<BrandLogo label="提示词创作" />);
  const studio = screen.getByRole("link", { name: "提示词创作" });
  expect(studio).toHaveAttribute("href", "/");
  const originalMark = studio.querySelector("svg")?.innerHTML;
  rerender(<BrandLogo />);
  const originalHome = screen.getByRole("link", { name: "homeAriaLabel" });
  expect(originalHome.querySelector("svg")?.innerHTML).toBe(originalMark);
  expect(screen.queryByText("提示词创作")).not.toBeInTheDocument();
  expect(screen.getByText("siteName")).toBeInTheDocument();
});

it.each(["default", "compact"] as const)("keeps %s branding as an accessible home link with a scalable graphic mark", (size) => {
  render(<BrandLogo size={size} />);
  const home = screen.getByRole("link", { name: "homeAriaLabel" });
  expect(home).toHaveAttribute("href", "/");
  expect(home.querySelector("svg")).toBeVisible();
  expect(screen.queryByText("AIGC")).not.toBeInTheDocument();
});
