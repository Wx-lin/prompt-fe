import { expect, test } from "@playwright/test";

test("创建和编辑器在大屏上利用可用宽高", async ({ page }, info) => {
  test.setTimeout(90000);
  test.skip(info.project.name !== "desktop", "This case checks a wide desktop viewport.");
  for (const [viewport, path] of [
    [{ width: 1920, height: 1080 }, "/character-setting?new=1"],
    [{ width: 2147, height: 1400 }, "/character-setting?preset=urban-woman"],
    [{ width: 2560, height: 1440 }, "/character-setting?new=1"],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto(path);
    const workbench = page.getByRole("region", { name: "角色造型工作台" });
    await expect(workbench).toBeVisible();
    await expect.poll(async () => (await workbench.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(viewport.width * 0.9);
    await expect.poll(async () => (await workbench.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(Math.min(950, viewport.height - 240));
    await expect(workbench.getByRole("button", { name: "确认生成" })).toBeInViewport();
    const generateBox = await workbench.getByRole("button", { name: "确认生成" }).boundingBox();
    expect(generateBox!.width).toBeLessThan(500);
    const image = workbench.getByAltText("角色示例图");
    await expect(image).toBeVisible();
    await expect.poll(async () => {
      const [imageBox, stageBox] = await Promise.all([image.boundingBox(), image.locator("..").boundingBox()]);
      return imageBox && stageBox ? Math.max(stageBox.y - imageBox.y, imageBox.y + imageBox.height - stageBox.y - stageBox.height) : Infinity;
    }).toBeLessThanOrEqual(1);
    await workbench.getByRole("button", { name: "半身" }).click();
    await expect(workbench.getByRole("button", { name: "半身" })).toHaveAttribute("aria-pressed", "true");
    expect(await image.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");
    await workbench.getByRole("button", { name: "全身" }).click();
    await expect(workbench.getByRole("button", { name: "全身" })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("角色编辑器在较窄和手机屏幕上无横向溢出", async ({ page }, info) => {
  test.setTimeout(90000);
  test.skip(info.project.name !== "desktop", "Viewport sizes are specified by this test.");
  for (const viewport of [{ width: 1366, height: 768 }, { width: 960, height: 540 }, { width: 850, height: 768 }, { width: 600, height: 844 }, { width: 480, height: 844 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/character-setting?new=1");
    const workbench = page.getByRole("region", { name: "角色造型工作台" });
    await expect(workbench).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const image = workbench.getByAltText("角色示例图");
    await expect(image).toBeVisible();
    await expect.poll(async () => {
      const [imageBox, stageBox] = await Promise.all([image.boundingBox(), image.locator("..").boundingBox()]);
      return imageBox && stageBox ? Math.max(stageBox.y - imageBox.y, imageBox.y + imageBox.height - stageBox.y - stageBox.height) : Infinity;
    }).toBeLessThanOrEqual(1);
    const generate = page.getByRole("button", { name: "确认生成" });
    await generate.scrollIntoViewIfNeeded();
    await expect(generate).toBeInViewport();
  }
});
