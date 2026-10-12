import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const avatarCss = readFileSync("src/features/auth/components/user-menu.module.css", "utf8");
const detailCss = readFileSync("src/features/prompt-detail/components/detail-page.module.css", "utf8");

test("avatar and dropdown indicator fit inside the menu button", async ({ page }) => {
  await page.setContent(`<style>*{box-sizing:border-box}${avatarCss}</style>
    <button class="trigger"><img width="34" height="34" alt="avatar"><svg class="chevron" width="16" height="16"></svg></button>`);
  const button = await page.locator("button").boundingBox();
  const image = await page.locator("img").boundingBox();
  const chevron = await page.locator("svg").boundingBox();
  expect(image!.width).toBeCloseTo(34, 1);
  expect(image!.y + image!.height / 2).toBeCloseTo(button!.y + button!.height / 2, 1);
  expect(chevron!.x).toBeGreaterThan(image!.x + image!.width);
  expect(chevron!.x + chevron!.width).toBeLessThanOrEqual(button!.x + button!.width);
});

test("detail stays inside viewport and keeps its width when image dimensions arrive", async ({ page }) => {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}${detailCss}</style>
    <main class="page"><article class="dialog"><section class="artworkPane"></section>
    <section class="details">Prompt details</section></article></main>`);
  const dialog = page.locator(".dialog");
  const initial = await dialog.boundingBox();
  for (const ratio of [0.5, 1, 1.78]) {
    await page.locator(".artworkPane").evaluate((element, value) => {
      (element as HTMLElement).style.setProperty("--art-ratio", String(value));
    }, ratio);
    await expect.poll(async () => (await dialog.boundingBox())!.width).toBe(initial!.width);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});
