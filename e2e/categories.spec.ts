import { test, expect } from "@playwright/test";
// python3 e2e/helpers/categories-fixture.py
// API_BASE_URL=http://127.0.0.1:8027 AIGC_DEMO_MODE=false npm run dev -- --port 3027
// PLAYWRIGHT_BASE_URL=http://127.0.0.1:3027 npm run test:e2e -- e2e/categories.spec.ts --workers=1
test("all categories retain search filters, inventories, legacy notice and both languages", async ({ page }) => {
 for (const locale of ["zh", "en"]) {
  for (const dark of [false, true]) {
   await page.goto(`/${locale}?q=cat&models=FLUX&sort=hot&page=3`);
   await page.evaluate(dark => document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"), dark);
   const trigger = page.getByRole("combobox", {name: locale === "zh" ? "全部分类" : "All categories"});
   await trigger.scrollIntoViewIfNeeded();
   await trigger.click();
   await expect(page.getByRole("option")).toHaveCount(12);
   const zero = page.getByRole("option", {name: locale === "zh" ? /商品与电商.*暂无内容/ : /Products.*No content/});
   await expect(zero).toHaveAttribute("aria-disabled", "true");
   await page.getByRole("option", {name: locale === "zh" ? /壁纸与背景/ : /Wallpapers/}).click();
   await expect(page).toHaveURL(/category=wallpaper/);
   const url = new URL(page.url());
   expect(url.searchParams.get("q")).toBe("cat");
   expect(url.searchParams.get("models")).toBe("FLUX");
   expect(url.searchParams.get("sort")).toBe("hot");
   expect(url.searchParams.has("page")).toBe(false);
  }
  await page.goto(`/${locale}?category=photography`);
  await expect(page.getByRole("status").filter({hasText: locale === "zh" ? "此分类已调整" : "This category has changed"})).toContainText(locale === "zh" ? "此分类已调整" : "This category has changed");
 }
});
