import { expect, test } from "@playwright/test";
import sharp from "sharp";

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("生成中点阵覆盖预览并随时间变化，支持浅色、深色和减少动态效果", async ({ page, context, baseURL }, info) => {
  test.skip(process.env.CHARACTER_AUTH_FIXTURE !== "1", "Requires isolated character auth fixture");
  test.setTimeout(90_000);
  await context.addCookies([{ name: "aigc_session", value: "character-test-session", url: baseURL! }]);
  let release: (() => void) | undefined;
  await page.route("**/api/character-preview", async (route) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: { data: { image_base64: pixel, mime_type: "image/png" } } });
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
  await page.goto("/character-setting?preset=urban-woman");
  const workbench = page.getByRole("region", { name: "角色造型工作台" });
  await expect(workbench.getByText("登录后可生成")).toHaveCount(0);
  await workbench.getByRole("button", { name: "确认生成" }).click();
  const overlay = workbench.getByRole("status").filter({ hasText: "正在生成角色" });
  await expect(overlay).toBeVisible();
  await overlay.scrollIntoViewIfNeeded();
  const dots = overlay.locator(':scope > span[aria-hidden="true"]').first();
  const [frame, background] = await Promise.all([overlay.boundingBox(), dots.boundingBox()]);
  expect(frame).not.toBeNull();
  expect(background).not.toBeNull();
  for (const key of ["x", "y", "width", "height"] as const) expect(background![key]).toBeCloseTo(frame![key], 0);
  await page.screenshot({ path: info.outputPath("generation-dark.png"), animations: "allow" });
  const a = await overlay.screenshot({ animations: "allow" });
  await page.waitForTimeout(800);
  const b = await overlay.screenshot({ animations: "allow" });
  const rawA = await sharp(a).ensureAlpha().raw().toBuffer();
  const rawB = await sharp(b).ensureAlpha().raw().toBuffer();
  let pixelsChanged = 0;
  for (let i = 0; i < rawA.length; i += 4) if (Math.abs(rawA[i] - rawB[i]) > 4) pixelsChanged++;
  expect(pixelsChanged).toBeGreaterThan(100);
  for (const colorScheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "no-preference" });
    await expect.poll(() => dots.evaluate((element) => getComputedStyle(element, "::after").animationName)).toContain("dot-wave");
    const color = await overlay.evaluate((element) => getComputedStyle(element).backgroundColor);
    const channels = color.match(/\d+/g)?.map(Number) ?? [];
    expect(channels.length).toBeGreaterThanOrEqual(3);
    const brightness = (channels[0] + channels[1] + channels[2]) / 3;
    if (colorScheme === "dark") expect(brightness).toBeLessThan(80);
    else expect(brightness).toBeGreaterThan(200);
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    expect(await dots.evaluate((element) => getComputedStyle(element, "::after").animationName)).toBe("none");
  }
  release?.();
  await expect(overlay).toHaveCount(0);
});
