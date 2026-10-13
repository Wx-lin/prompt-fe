import { expect, test } from "@playwright/test";

for (const route of ["/prompt/00000000-0000-4000-8000-000000000001", "/login"]) {
  test(`${route} locks background scrolling and releases it on close`, async ({ page }) => {
    await page.goto("/");
    // Ensure there is enough background content to expose scroll leakage on both viewports.
    await page.evaluate(() => { document.body.style.minHeight = "3000px"; });
    if (route === "/login") {
      await page.getByRole("link", { name: "登录", exact: true }).click();
    } else {
      const link = test.info().project.name === "mobile"
        ? page.locator('[data-layout="mobile"] a[href*="00000000-0000-4000-8000-000000000001"]').first()
        : page.getByTestId("prompt-view-link").first();
      await link.click();
    }
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
    await expect(page.locator("body")).toHaveCSS("overflow-y", "hidden");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(2, 2);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    const close = route === "/login"
      ? page.getByRole("link", { name: "关闭登录" })
      : test.info().project.name === "mobile"
        ? page.getByRole("link", { name: "返回画廊" })
        : page.locator('a[aria-label="关闭详情"]:visible').last();
    await close.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-scroll-locked", "true");
    await page.mouse.move(2, 400);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });
}

test("short login viewport keeps the complete form scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/login");
  const terms = page.locator('a[href="#"]').last();
  await terms.scrollIntoViewIfNeeded();
  await expect(terms).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "邮箱地址" })).toBeAttached();
});
