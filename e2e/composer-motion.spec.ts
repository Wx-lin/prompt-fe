import { expect, test } from "@playwright/test";

type Sample = { width: number; opacity: number };
declare global { interface Window { galleryMotionSamples: Sample[] } }

for (const reduce of [false, true]) test(`inline gallery motion is ${reduce ? "disabled for reduced motion" : "restrained and reversible"}`, async ({ page }, info) => {
  const sends: string[] = [];
  await page.route(/\/api\/prompt-(assets|analyses|conversations)(?:\/|\?|$)/, async route => {
    if (route.request().method() === "POST") {
      sends.push(new URL(route.request().url()).pathname);
      await route.abort();
    } else await route.continue();
  });
  await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
  if (info.project.name === "desktop") await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/zh");
  const gallery = page.getByTestId("gallery-pane");
  const initial = (await gallery.boundingBox())!.width;
  await page.evaluate(() => {
    window.galleryMotionSamples = [];
    const main = document.querySelector("main[data-chat-open]")!;
    const observer = new MutationObserver(() => {
      if (main.getAttribute("data-chat-open") !== "true") return;
      observer.disconnect();
      const sample = () => {
        const gallery = document.querySelector('[data-testid="gallery-pane"]')!;
        const pane = document.querySelector('[data-testid="creation-chat-pane"]')!;
        window.galleryMotionSamples.push({ width: gallery.getBoundingClientRect().width, opacity: Number(getComputedStyle(pane).opacity) });
        if (window.galleryMotionSamples.length < 22) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    observer.observe(main, { attributes: true, attributeFilter: ["data-chat-open"] });
  });
  const reference = page.getByRole("button", { name: /图片创作提示词/ }).filter({ visible: true }).first();
  await reference.click();
  const panel = page.getByRole("complementary", { name: "提示词创作对话", exact: true });
  await expect(panel).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.galleryMotionSamples.length)).toBe(22);
  const samples = await page.evaluate(() => window.galleryMotionSamples);
  const pane = page.getByTestId("creation-chat-pane");
  if (reduce) {
    expect(await pane.evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.00001);
    expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  } else {
    expect(samples.some(sample => sample.opacity > 0 && sample.opacity < 1)).toBe(true);
    if (info.project.name === "desktop") {
      const end = (await gallery.boundingBox())!.width;
      expect(samples.some(sample => sample.width > end + 2 && sample.width < initial - 2)).toBe(true);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  if (info.project.name === "desktop") {
    const bounds = await panel.getByRole("button", { name: "发送", exact: true }).boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.getByRole("button", { name: "收起", exact: true }).click();
  await expect(pane).toHaveAttribute("inert");
  await expect.poll(async () => (await pane.boundingBox())!.height).toBe(0);
  await expect.poll(async () => Math.round((await gallery.boundingBox())!.width)).toBe(Math.round(initial));
  await expect(page.getByRole("textbox", { name: "说说你的想法，帮你写成提示词", exact: true })).toBeVisible();
  await reference.dispatchEvent("click");
  await panel.getByRole("button", { name: "收起", exact: true }).dispatchEvent("click");
  await expect(pane).toHaveAttribute("inert");
  await expect.poll(async () => (await pane.boundingBox())!.height).toBe(0);
  if (info.project.name === "mobile") for (const height of [420, 500]) {
    await page.setViewportSize({ width: 390, height });
    await reference.dispatchEvent("click");
    await expect(pane).toHaveCSS("opacity", "1");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => {
      const bounds = await panel.getByRole("button", { name: "发送", exact: true }).boundingBox();
      return bounds!.y + bounds!.height;
    }).toBeLessThanOrEqual(height);
    await panel.getByRole("button", { name: "收起", exact: true }).dispatchEvent("click");
    await expect.poll(async () => (await pane.boundingBox())!.height).toBe(0);
  }
  expect(sends).toEqual([]);
});

test("the composer grows within bounds, clears cleanly and exposes the correct keyboard guidance", async ({ page }, info) => {
  const sends: string[] = [];
  await page.route(/\/api\/prompt-(assets|analyses|conversations)(?:\/|\?|$)/, async route => {
    if (route.request().method() === "POST") { sends.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  await page.goto("/zh");
  const input = page.getByRole("textbox", { name: "说说你的想法，帮你写成提示词", exact: true });
  await expect(input).toHaveCSS("resize", "none");
  await expect(page.getByText("支持粘贴", { exact: true })).toHaveCount(0);
  const initial = (await input.boundingBox())!.height;
  await input.fill("第一行");
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("第一行\n");
  await input.fill(Array.from({ length: 35 }, (_, index) => `第${index + 1}行想法`).join("\n"));
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(initial);
  await expect.poll(async () => (await input.boundingBox())!.height).toBeLessThanOrEqual(208);
  await expect(input).toHaveCSS("overflow-y", "auto");
  const hint = page.getByText(info.project.name === "mobile" ? "回车换行，点按钮发送" : "Enter 发送 · Shift+Enter 换行", { exact: true });
  await expect(hint).toBeVisible();
  await expect(hint).toHaveCSS("opacity", "1");
  await input.fill("");
  await expect.poll(async () => (await input.boundingBox())!.height).toBe(initial);
  await expect(input).toHaveCSS("overflow-y", "hidden");
  await expect(page.getByRole("button", { name: "发送", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(sends).toEqual([]);
});
