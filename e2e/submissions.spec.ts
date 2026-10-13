import { expect, test } from "@playwright/test";

test("publish entry requires login and preserves its destination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "发布作品", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=(?:%2F|\/)publish/);
  await expect(page.getByRole("heading", { name: "欢迎来到 AI 绘图提示词库" })).toBeVisible();
});

test("private works require login, including English locale", async ({ page }) => {
  await page.goto("/en/my-works");
  await expect(page).toHaveURL(/\/en\/login\?returnTo=(?:%2F|\/)my-works/);
});
