import { expect, test } from "@playwright/test";

test("SEO metadata and content survive direct requests in both languages", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AI 提示词库.*文生图/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI 提示词库");
  await expect(page.getByRole("navigation", { name: "按用途浏览提示词" })).toHaveCount(0);
  await expect(page.getByText("查看图片效果，复制文生图提示词，按场景与模型寻找适合你的 AI 生图灵感。", {exact: true})).toHaveCount(0);
  const headingBox = await page.getByRole("heading", {level: 1}).boundingBox();
  expect(headingBox?.width).toBeLessThanOrEqual(1);
  expect(headingBox?.height).toBeLessThanOrEqual(1);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(size[0]).toBeLessThanOrEqual(size[1]);
    await page.screenshot({ path: `/tmp/aigc-seo-${test.info().project.name}-${colorScheme}.png` });
  }
  await expect(page.locator('meta[name="google-site-verification"]')).toHaveAttribute("content", "local-google-code");
  await expect(page.locator('meta[name="baidu-site-verification"]')).toHaveAttribute("content", "local-baidu-code");
  const html = await (await request.get("/?page=2")).text();
  expect(html).toContain("SEO portrait 21");
  expect(html).toContain("page=3");
  expect(html).toContain('https://aigc-prompt.com/?page=2');
  await page.goto("/category/avatar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("头像提示词");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://aigc-prompt.com/category/avatar");
  await page.goto("/?q=portrait");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect((await sitemap.text()).match(/<loc>/g)).toHaveLength(94);
  expect((await request.get("/category/unknown")).status()).toBe(404);
  await page.goto("/en/prompt/seo-1");
  await expect(page.locator('link[hreflang="zh"]')).toHaveAttribute("href", "https://aigc-prompt.com/prompt/seo-1");
  expect(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}")).toMatchObject({ "@type": "CreativeWork", name: "SEO portrait 1" });
  const dimensions = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(dimensions[0]).toBeLessThanOrEqual(dimensions[1]);
});
