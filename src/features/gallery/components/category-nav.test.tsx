import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { CategoryNav } from "./category-nav";
import { fallbackCategories } from "../data/categories";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({push}), Link: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(cleanup);
it("pins the four recommended categories and exposes all twelve with counts and disabled empty categories", async () => {
 render(<CategoryNav categories={fallbackCategories.map(c => ({ ...c, count: c.key === "product" ? 0 : 2 }))} activeCategory="all" categoryHref={key => `/?category=${key}&q=cat&models=FLUX&sort=hot`} categoriesAriaLabel="categories" />);
 expect(screen.getAllByRole("link").map(link => link.textContent)).toEqual(["allCategory", "portrait", "avatar", "poster", "illustration"]);
 await userEvent.click(screen.getByRole("combobox", {name: "allCategoriesTrigger"}));
 expect(await screen.findByRole("option", {name: /product.*noContent/})).toHaveAttribute("aria-disabled", "true");
 expect(screen.getAllByRole("option")).toHaveLength(12);
 await userEvent.click(screen.getByRole("option", {name: /wallpaper.*2/}));
 expect(push).toHaveBeenCalledWith("/?category=wallpaper&q=cat&models=FLUX&sort=hot");
});
it("keeps empty pinned categories visible without a link and marks an active category", async () => {
 const view = render(<CategoryNav categories={fallbackCategories.map(c => ({...c, count: c.key === "portrait" ? 0 : 1}))} activeCategory="avatar" categoryHref={key => `/?category=${key}`} categoriesAriaLabel="categories" />);
 expect(screen.getByText("portrait")).toHaveAttribute("aria-disabled", "true");
 expect(screen.queryByRole("link", {name: "portrait"})).not.toBeInTheDocument();
 expect(screen.getByRole("link", {name: "avatar"})).toHaveAttribute("aria-current", "page");
 view.rerender(<CategoryNav categories={fallbackCategories.map(c => ({...c,count:1}))} activeCategory="wallpaper" categoryHref={key => `/?category=${key}`} categoriesAriaLabel="categories" />);
 await userEvent.click(screen.getByRole("combobox", {name:"allCategoriesTrigger"}));
 // Select portals become accessible after Base UI finishes mounting and positioning.
 expect(await screen.findByRole("option", {name:/wallpaper/})).toHaveAttribute("aria-selected", "true");
});
