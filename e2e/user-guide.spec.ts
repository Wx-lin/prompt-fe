import { expect, test } from "@playwright/test";

test("homepage guide entry opens a guide with working chapter links", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("link", { name: "使用手册" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { name: "平台使用手册", level: 1 })).toBeVisible();

  const chapters = page.getByRole("navigation", { name: "手册目录" }).getByRole("link");
  expect(await chapters.count()).toBeGreaterThan(0);
  for (const chapter of await chapters.all()) {
    const href = await chapter.getAttribute("href");
    expect(href).toMatch(/^#.+/);
    const title = (await chapter.textContent())!.trim();
    const heading = page.getByRole("heading", { name: title, level: 2 });
    await expect(heading).toHaveAttribute("id", href!.slice(1));
  }
  await chapters.first().click();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe(await chapters.first().getAttribute("href"));
});
