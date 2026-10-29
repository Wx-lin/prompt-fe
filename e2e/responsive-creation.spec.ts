import { expect, test } from "@playwright/test";

const homeInput = "说说你的想法，帮你写成提示词";
const followupInput = "继续提问或描述想法，也可以添加参考图";

for (const width of [390, 900, 901, 1024, 1190, 1279, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`creation panel fits ${width}px ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.route(/\/api\/prompt-(assets|analyses|conversations)(?:\/|\?|$)/, route =>
        route.request().method() === "POST" ? route.abort() : route.continue());
      await page.goto("/");
      const gallery = page.getByTestId("gallery-pane");
      const reference = page.getByRole("button", { name: /图片创作提示词/ }).filter({ visible: true }).first();
      await expect(reference).toBeVisible();
      await reference.dispatchEvent("click");
      const pane = page.getByTestId("creation-chat-pane");
      const panel = page.getByRole("complementary", { name: "提示词创作对话" });
      await expect(panel).toBeVisible();
      await expect(pane).toHaveCSS("opacity", "1");
      const paneBox = (await pane.boundingBox())!;
      const galleryBox = (await gallery.boundingBox())!;
      if (width > 900) {
        expect(paneBox.x).toBeGreaterThanOrEqual(galleryBox.x + galleryBox.width - 1);
        expect(paneBox.width).toBeGreaterThanOrEqual(379);
        expect(Math.abs(paneBox.y - galleryBox.y)).toBeLessThan(2);
        const grid = gallery.locator('[data-layout]:visible').first();
        const columns = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        expect(columns).toBe(width <= 1200 ? 2 : 3);
      } else {
        expect(paneBox.y + paneBox.height).toBeLessThanOrEqual(galleryBox.y + 1);
      }
      const input = panel.getByRole("textbox", { name: followupInput, exact: true });
      await input.fill("创作建议".repeat(100));
      await expect(panel.getByRole("button", { name: "发送", exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "上传图片", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await pane.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await panel.getByRole("button", { name: "收起", exact: true }).click();
      await expect(pane).toHaveAttribute("inert");
      await expect(page.getByRole("textbox", { name: homeInput, exact: true })).toBeVisible();
    });
  }
}

test("resizing around the split boundary preserves the draft and keeps controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 1201, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const reference = page.getByRole("button", { name: /图片创作提示词/ }).filter({ visible: true }).first();
  await reference.dispatchEvent("click");
  const pane = page.getByTestId("creation-chat-pane");
  const gallery = page.getByTestId("gallery-pane");
  const panel = page.getByRole("complementary", { name: "提示词创作对话" });
  const input = panel.getByRole("textbox", { name: followupInput, exact: true });
  await input.fill("调整窗口后保留的草稿");
  for (const { width, height } of [{ width: 901, height: 600 }, { width: 901, height: 400 }, { width: 900, height: 600 }, { width: 901, height: 600 }, { width: 1201, height: 600 }]) {
    await page.setViewportSize({ width, height });
    await expect(input).toHaveValue("调整窗口后保留的草稿");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const a = (await pane.boundingBox())!;
    const b = (await gallery.boundingBox())!;
    if (width > 900) {
      expect(a.x).toBeGreaterThanOrEqual(b.x + b.width - 1);
      const button = (await panel.getByRole("button", { name: "发送", exact: true }).boundingBox())!;
      expect(button.y + button.height).toBeLessThanOrEqual(height + 1);
      const grid = gallery.locator('[data-layout]:visible').first();
      expect(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(width <= 1200 ? 2 : 3);
    } else expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1);
  }
});

test("split panel stays usable after scrolling with normal motion", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const reference = page.getByRole("button", { name: /图片创作提示词/ }).filter({ visible: true }).first();
  await page.evaluate(() => window.scrollTo(0, 350));
  await reference.dispatchEvent("click");
  const panel = page.getByRole("complementary", { name: "提示词创作对话" });
  const pane = page.getByTestId("creation-chat-pane");
  const gallery = page.getByTestId("gallery-pane");
  await expect(panel).toBeVisible();
  await expect(pane).toHaveCSS("opacity", "1");
  await expect.poll(async () => Math.round((await pane.boundingBox())!.width)).toBeGreaterThanOrEqual(379);
  const paneBox = (await pane.boundingBox())!;
  const galleryBox = (await gallery.boundingBox())!;
  expect(paneBox.x).toBeGreaterThanOrEqual(galleryBox.x + galleryBox.width - 1);
  const sendBox = (await panel.getByRole("button", { name: "发送", exact: true }).boundingBox())!;
  expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(601);
  await panel.getByRole("button", { name: "收起", exact: true }).click();
  await expect(pane).toHaveAttribute("inert");
  await expect.poll(async () => (await pane.boundingBox())!.height).toBe(0);
});

test("long drafts with a reference image fit a short window and stay scrollable after resize", async ({ page }) => {
  await page.setViewportSize({ width: 901, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /图片创作提示词/ }).filter({ visible: true }).first().dispatchEvent("click");
  const panel = page.getByRole("complementary", { name: "提示词创作对话" });
  const input = panel.getByRole("textbox", { name: followupInput, exact: true });
  const draft = "雨夜的猫和花店的画面十分温暖\n".repeat(20);
  await input.fill(draft);
  await page.setViewportSize({ width: 901, height: 400 });
  await expect(input).toHaveValue(draft);
  await expect.poll(() => input.evaluate(el => getComputedStyle(el).overflowY)).toBe("auto");
  expect(await input.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const pane = (await page.getByTestId("creation-chat-pane").boundingBox())!;
  for (const name of ["上传图片", "发送"]) {
    const button = panel.getByRole("button", { name, exact: true });
    const bounds = (await button.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(pane.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(Math.min(pane.y + pane.height, 400));
  }
  const search = (await page.getByRole("textbox", { name: "搜索关键词" }).boundingBox())!;
  const sort = (await page.getByRole("combobox", { name: "排序方式" }).boundingBox())!;
  const model = (await page.getByRole("combobox", { name: "模型", exact: true }).boundingBox())!;
  expect(search.x + search.width).toBeLessThanOrEqual(sort.x);
  expect(sort.x + sort.width).toBeLessThanOrEqual(model.x);
});

for (const width of [320, 390]) test(`long draft with reference remains usable on ${width}px short screen`, async ({ page }) => {
  await page.setViewportSize({ width, height: 400 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const home = page.getByRole("textbox", { name: homeInput, exact: true });
  await home.fill("测试");
  await expect(page.getByRole("button", { name: "发送", exact: true })).toBeEnabled();
  await home.clear();
  await page.getByRole("button", { name: /图片创作提示词/ }).filter({ visible: true }).first().dispatchEvent("click");
  const panel = page.getByRole("complementary", { name: "提示词创作对话" });
  const input = panel.getByRole("textbox", { name: followupInput, exact: true });
  await input.fill("雨夜猫咪\n".repeat(50));
  await expect.poll(() => input.evaluate(el => getComputedStyle(el).overflowY)).toBe("auto");
  const pane = (await page.getByTestId("creation-chat-pane").boundingBox())!;
  for (const name of ["上传图片", "发送"]) {
    const bounds = (await panel.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(pane.y + pane.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
