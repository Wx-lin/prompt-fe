import { expect, test } from "@playwright/test";

const assetId = "00000000-0000-4000-8000-000000000004";
const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("首页图片转提示词入口提交提示词生成请求", async ({ page, context, baseURL }) => {
  test.skip(process.env.CHARACTER_AUTH_FIXTURE !== "1", "Requires isolated local auth fixture");
  await context.addCookies([{ name: "aigc_session", value: "character-test-session", url: baseURL! }]);
  await page.route("**/api/prompt-assets", route => route.fulfill({ json: { success: true, data: {
    id: assetId, width: 1, height: 1, byte_size: 68, preview_url: null, thumbnail_url: null, preview_expires_at: null,
  } } }));
  let submitted: unknown;
  await page.route("**/api/prompt-conversations", async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { success: false, error: { code: "TEST_INTERCEPTED" } } });
  });
  await page.goto("/");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "图片转提示词" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "reference.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64") });
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect.poll(() => submitted).toMatchObject({ mode: "generate", asset_id: assetId });
});
