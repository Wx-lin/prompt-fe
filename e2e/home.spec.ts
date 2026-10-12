import { expect, test } from "@playwright/test";

test("gallery renders the reference brand and artwork cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "AIGC 绘图提示词库首页" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "提示词分类" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看提示词：春日樱花少女，电影感人像" })).toBeVisible();
  await expect(page.locator('article img:visible')).toHaveCount(10);
  if (test.info().project.name === "mobile") {
    await expect(page.locator('[data-layout="mobile"] [data-card-hover]').first()).toBeVisible();
  }
  await page.screenshot({ path: `/tmp/aigc-home-${test.info().project.name}.png`, fullPage: true });
});

test("gallery fits a narrow mobile viewport without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "AIGC 绘图提示词库首页" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    columns: getComputedStyle(document.querySelector('[data-layout="mobile"]')!).gridTemplateColumns,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.columns.split(" ")).toHaveLength(2);
});

test("search input, login and prompt URLs resolve", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "搜索关键词" })).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "欢迎来到 AI 绘图提示词库" })).toBeVisible();
  await page.goto("/prompt/00000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "春日樱花少女，电影感人像" })).toBeVisible();
  const copyButton = page.locator('[data-testid="prompt-copy"]:visible');
  await expect(copyButton).toBeVisible();
  await page.screenshot({ path: `/tmp/aigc-detail-${test.info().project.name}.png`, fullPage: true });
});

test("theme toggle updates the shared root theme token", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "外观与语言设置" }).click();
  await page.getByRole("menuitem", { name: "切换到暗黑模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "外观与语言设置" }).click();
  await expect(page.getByRole("menuitem", { name: "切换到浅色模式" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `/tmp/aigc-home-dark-${test.info().project.name}.png`, fullPage: true });
});

test("detail dismissal returns to the gallery and search stays inline, not a dialog", async ({ page }) => {
  await page.goto("/");
  const firstPrompt = test.info().project.name === "mobile"
    ? page.locator('[data-layout="mobile"] a[href*="00000000-0000-4000-8000-000000000001"]').first()
    : page.getByTestId("prompt-view-link").first();
  await firstPrompt.click();
  await expect(page).toHaveURL(/\/prompt\//);
  await expect(page.getByRole("navigation", { name: "提示词分类" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "春日樱花少女，电影感人像" })).toBeVisible();
  const closePrompt = test.info().project.name === "mobile"
    ? page.getByRole("link", { name: "返回画廊" })
    : page.locator('a[aria-label="关闭详情"]:visible').last();
  await closePrompt.click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("textbox", { name: "搜索关键词" }).click();
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: `/tmp/aigc-search-${test.info().project.name}.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "欢迎来到 AI 绘图提示词库" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "提示词分类" })).toBeVisible();
  await page.screenshot({ path: `/tmp/aigc-login-${test.info().project.name}.png`, fullPage: true });
});

test("language toggle switches UI text to English", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "外观与语言设置" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.getByRole("textbox", { name: "Search keyword" })).toBeVisible();
});
