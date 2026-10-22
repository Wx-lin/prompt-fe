import { expect, test, type Page } from "@playwright/test";

async function expectSearch(page: Page, keyword: string) {
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(keyword);
  expect(new URL(page.url()).pathname).toBe("/");
}

test("⌘K / Ctrl+K focuses the search input and opens the dropdown in place", async ({ page }) => {
  await page.goto("/");
  // Prove the client has hydrated before sending a shortcut to its window listener.
  const input = page.getByRole("textbox", { name: "搜索关键词" });
  await input.click();
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
  await input.press("Escape");
  await page.locator("body").click({ position: { x: 8, y: 8 } });
  await page.locator("body").press("ControlOrMeta+k");
  await expect(page.getByRole("textbox", { name: "搜索关键词" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("Enter navigates to results and keeps the search box as a plain input, not a dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "搜索关键词" }).click();
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
  await page.getByRole("textbox", { name: "搜索关键词" }).fill("猫咪");
  await page.getByRole("textbox", { name: "搜索关键词" }).press("Enter");
  await expectSearch(page, "猫咪");
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "提示词分类" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "搜索关键词" })).toHaveValue("猫咪");
  await expect(page.locator("article img:visible")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "查看提示词：墙头的猫咪" })).toBeVisible();
  await page.reload();
  await expect(page.locator("article img:visible")).toHaveCount(1);
});

test("Escape closes the dropdown without leaving the page", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "搜索关键词" });
  await input.click();
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
  await input.press("Escape");
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test("empty results belong to the homepage and clearing search restores the feed", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("找不到的关键词xyz");
  await input.press("Enter");
  await expectSearch(page, "找不到的关键词xyz");
  await expect(page.getByRole("status")).toContainText("没有找到相关提示词");
  await page.getByRole("link", { name: "清除搜索" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("latest");
  await expect(page.locator("article img:visible")).toHaveCount(10);
});

test("legacy /search links redirect to the homepage and recent/trending terms search in place", async ({ page }) => {
  await page.goto("/search?q=猫咪");
  await expectSearch(page, "猫咪");
  await expect(page.locator("article img:visible")).toHaveCount(1);

  const input = page.getByRole("textbox", { name: "搜索关键词" });
  await input.click();
  await input.fill("拉面");
  await input.press("Enter");
  await expect(page.getByRole("link", { name: "查看提示词：深夜食堂 · 日式拉面" })).toBeVisible();

  await input.click();
  await input.fill("");
  // cmdk renders Command.Item as role="option"
  await page.getByRole("option", { name: "01 电影感人像" }).click();
  await expectSearch(page, "电影感人像");
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeHidden();
});

test("search retains filters and detail dismissal returns to its results", async ({ page }) => {
  await page.goto("/?category=scene&models=FLUX.1&sort=popular");
  const input = page.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("拉面");
  await input.press("Enter");
  await expect(page.locator("article img:visible")).toHaveCount(1);
  const params = new URL(page.url()).searchParams;
  expect(params.get("q")).toBe("拉面");
  expect(params.get("category")).toBe("scene");
  expect(params.get("models")).toBe("FLUX.1");
  expect(params.get("sort")).toBe("popular");
  await page.getByRole("link", { name: "深夜食堂 · 日式拉面", exact: true }).click();
  await expect(page).toHaveURL(/\/prompt\//);
  await page.goBack();
  await expect(page).toHaveURL(/q=/);
  await expect(input).toHaveValue("拉面");
  await page.getByRole("link", { name: "清除搜索" }).click();
  await expect(page.locator("article img:visible")).toHaveCount(2);
});
