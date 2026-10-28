import type { ComponentProps, ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GalleryToolbar } from "./gallery-toolbar";
import { SiteHeader } from "./site-header";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} />, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/select-field/select-field", () => ({ SelectField: ({ name, options }: { name: string; options: { label: string; value: string }[] }) => <select aria-label={name}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));
vi.mock("@/components/theme-provider/theme-toggle-control", () => ({ ThemeToggleControl: () => <button>theme</button> }));
vi.mock("@/features/auth/components/account-preferences", () => ({ AccountPreferences: () => <span>account preferences</span> }));
vi.mock("@/features/auth/components/user-menu", () => ({ UserMenu: ({ preferences }: { preferences: ReactNode }) => <div><button>account</button>{preferences}</div> }));
vi.mock("./category-nav", () => ({ CategoryNav: ({ categoryHref }: { categoryHref: (value: string) => string }) => <nav aria-label="categories"><a href={categoryHref("avatar")}>avatar</a><a href={categoryHref("all")}>all</a></nav> }));
vi.mock("./search-trigger-group", () => ({ SearchTriggerGroup: ({ query, filters }: { query: string; filters: string }) => <input aria-label="search" defaultValue={query} data-filters={filters} /> }));
// eslint-disable-next-line @next/next/no-html-link-for-pages -- test-only stub; product uses the locale-aware Link.
vi.mock("./language-toggle", () => ({ LanguageToggle: () => <a href="/en">language</a> }));
afterEach(cleanup);

const props = { categories: [], models: [], activeCategory: "portrait", activeSort: "hot", activeModel: "FLUX", query: "cat" };

it("keeps theme and language in the account menu instead of the header for signed-in users", () => {
  render(<SiteHeader {...props} user={{ id: "u", nickname: "Creator", email: "c@example.com", avatar_url: null, created_at: "2026-10-13" }} />);
  expect(screen.queryByRole("button", { name: "theme" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "language" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "account" })).toBeVisible();
  expect(screen.getByText("account preferences")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "publish" })).toBeVisible();
});

it("retains theme and language controls when signed out", () => {
  render(<SiteHeader {...props} />);
  expect(screen.getByRole("button", { name: "theme" })).toBeVisible();
  expect(screen.getByRole("link", { name: "language" })).toBeVisible();
  expect(screen.getByRole("link", { name: "login" })).toBeVisible();
});

it("places the existing search with category and filter controls rather than the brand row", () => {
  render(<SiteHeader {...props} />);
  const header = screen.getByRole("banner");
  expect(within(header).getByRole("link", { name: "creationBrand" })).toBeVisible();
  const search = screen.getByRole("textbox", { name: "search" });
  expect(search.closest('[data-gallery-toolbar]')).not.toBeNull();
  expect(search.closest('[data-site-topbar]')).toBeNull();
  expect(screen.queryByText("图片转提示词")).not.toBeInTheDocument();
});

it("retains keywords and the other filters in category and clear-category links", () => {
  render(<GalleryToolbar {...props} />);
  expect(screen.getByRole("link", { name: "avatar" })).toHaveAttribute("href", "/?q=cat&category=avatar&sort=hot&models=FLUX");
  expect(screen.getByRole("link", { name: "all" })).toHaveAttribute("href", "/?q=cat&sort=hot&models=FLUX");
  expect(screen.getByRole("textbox", { name: "search" })).toHaveAttribute("data-filters", "category=portrait&sort=hot&models=FLUX");
});

it("allows the top header to omit the gallery toolbar for a separate gallery layout", () => {
  render(<SiteHeader {...props} showNavigationRow={false} />);
  expect(screen.queryByRole("textbox", { name: "search" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "publish" })).toHaveAttribute("href", "/publish");
});

it("clears default filters from gallery links while keeping real model options available", () => {
  render(<GalleryToolbar categories={[]} models={[{ key: "FLUX", label: "Flux", group: "Image" }]} activeCategory="all" activeSort="recommended" activeModel="all" compact />);
  expect(screen.getByRole("link", { name: "all" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "avatar" })).toHaveAttribute("href", "/?category=avatar");
  expect(screen.getByRole("textbox", { name: "search" })).toHaveAttribute("data-filters", "");
  expect(screen.getByRole("option", { name: "Flux" })).toHaveValue("FLUX");
});
