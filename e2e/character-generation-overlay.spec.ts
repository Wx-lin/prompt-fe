import { expect, test } from "@playwright/test";

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("生成中遮罩完整覆盖全身和半身预览", async ({ page, context, baseURL }) => {
  test.skip(process.env.CHARACTER_AUTH_FIXTURE !== "1", "Requires isolated character auth fixture");
  await context.addCookies([{ name: "aigc_session", value: "character-test-session", url: baseURL! }]);
  let release: (() => void) | undefined;
  await page.route("**/api/character-preview", async (route) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: { data: { image_base64: pixel, mime_type: "image/png" } } });
  });
  await page.goto("/character-setting?preset=urban-woman");
  const workbench = page.getByRole("region", { name: "角色造型工作台" });
  await expect(workbench.getByText("登录后可生成")).toHaveCount(0);

  for (const view of ["全身", "半身"]) {
    await workbench.getByRole("button", { name: view }).click();
    await workbench.getByRole("button", { name: "确认生成" }).click();
    const overlay = workbench.getByRole("status").filter({ hasText: "正在生成角色" });
    await expect(overlay).toBeVisible();
    const preview = overlay.locator("..");
    await preview.scrollIntoViewIfNeeded();
    const [previewBox, overlayBox] = await Promise.all([preview.boundingBox(), overlay.boundingBox()]);
    expect(previewBox).not.toBeNull();
    expect(overlayBox).not.toBeNull();
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(overlayBox![key]).toBeCloseTo(previewBox![key], 0);
    }
    expect(await overlay.evaluate((element) => getComputedStyle(element).backgroundColor)).toMatch(/^rgb\(/);
    const covered = await overlay.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return [[rect.left + 24, rect.top + 24], [rect.right - 45, rect.top + 28], [rect.left + 10, rect.bottom - 10]]
        .every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
    });
    expect(covered).toBe(true);
    expect(await workbench.getByRole("button", { name: "生成中，请稍候…" }).isDisabled()).toBe(true);
    release?.();
    await expect(overlay).toHaveCount(0);
  }
});
