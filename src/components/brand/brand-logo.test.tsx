import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandLogo } from "./brand-logo";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(cleanup);

it.each(["default", "compact"] as const)("keeps %s branding as an accessible home link with a scalable graphic mark", (size) => {
  render(<BrandLogo size={size} />);
  const home = screen.getByRole("link", { name: "homeAriaLabel" });
  expect(home).toHaveAttribute("href", "/");
  expect(home.querySelector("svg")).toBeVisible();
  expect(screen.queryByText("AIGC")).not.toBeInTheDocument();
});
