import { expect, test, type Locator, type Page } from "@playwright/test";

const dismissalKey = "aigc:feature:image-to-prompt:v1:dismissed";
const launchDate = new Date("2026-10-23T04:00:00Z");
const requests = new WeakMap<Page, string[]>();

const copy = {
  zh: { entry: "图片转提示词", title: "图片，也能变成提示词", close: "关闭新功能提示", upload: "上传图片", tool: "反推提示词" },
  en: { entry: "Image to prompt", title: "Images can become prompts, too", close: "Dismiss new feature announcement", upload: "Upload image", tool: "Image to prompt" },
} as const;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(launchDate);
  requests.set(page, []);
  // A presentation test must never upload an image or create a paid analysis.
  await page.route(/\/api\/prompt-(assets|analyses)(?:\/|\?|$)/, async route => {
    if (route.request().method() === "POST") {
      requests.get(page)!.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 503, json: { error: "Blocked by entry presentation test" } });
      return;
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  expect(requests.get(page), "opening an entry or announcement must not start a model request").toEqual([]);
});

async function announcement(page: Page, locale: "zh" | "en") {
  const entry = page.getByRole("button", { name: copy[locale].entry, exact: true });
  await expect(entry).toBeVisible();
  const popup = page.locator("[data-feature-announcement]");
  await expect(popup.getByRole("heading", { name: copy[locale].title, exact: true })).toBeVisible();
  return { entry, popup };
}

async function expectFitsViewport(page: Page, element: Locator) {
  const bounds = await element.boundingBox();
  expect(bounds).not.toBeNull();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const locale of ["zh", "en"] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`${locale} ${theme}: launch entry and anchored announcement fit responsive widths`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(locale === "zh" ? "/" : "/en");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const { entry, popup } = await announcement(page, locale);
      const widths = test.info().project.name === "mobile" ? [320, 390, 681, 768, 900] : [901, 1024, 1536];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 960 });
        await expectFitsViewport(page, entry);
        await expectFitsViewport(page, popup);
        const layout = await entry.evaluate(button => {
          const text = Array.from(button.querySelectorAll("span")).find(span => /图片转提示词|Image to prompt/.test(span.textContent ?? ""));
          const rect = button.getBoundingClientRect();
          const header = button.closest("header")!;
          const brand = header.querySelector("a")!.getBoundingClientRect();
          const theme = header.querySelector('[role="combobox"]')!.getBoundingClientRect();
          const popup = document.querySelector("[data-feature-announcement]")!.getBoundingClientRect();
          const coveredControls = Array.from(header.querySelectorAll("a, button, input")).filter(control => {
            if (control === button || control.getAttribute("aria-hidden") === "true") return false;
            const controlStyle = getComputedStyle(control);
            if (controlStyle.visibility === "hidden" || controlStyle.opacity === "0") return false;
            const bounds = control.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0 && bounds.left < popup.right
              && bounds.right > popup.left && bounds.top < popup.bottom && bounds.bottom > popup.top;
          }).map(control => control.getAttribute("aria-label") ?? control.textContent);
          return {
            coveredControls,
            brandRight: brand.right, themeLeft: theme.left,
            height: rect.height,
            background: getComputedStyle(button).backgroundColor,
            labelWidth: text?.scrollWidth ?? 0,
            labelBox: text?.getBoundingClientRect().width ?? 0,
          };
        });
        expect(layout.coveredControls, `${width}px announcement does not cover header controls`).toEqual([]);
        expect(layout.brandRight, `${width}px brand does not collide with theme control`).toBeLessThanOrEqual(layout.themeLeft);
        expect(layout.height, `${width}px accessible tap height`).toBeGreaterThanOrEqual(44);
        expect(layout.background, `${width}px restrained text entry`).toBe("rgba(0, 0, 0, 0)");
        expect(layout.labelWidth, `${width}px full entry label`).toBeGreaterThan(0);
        expect(layout.labelWidth, `${width}px no clipped entry label`).toBeLessThanOrEqual(Math.ceil(layout.labelBox));
        await expect(entry.getByText("NEW", { exact: true })).toBeVisible();
        await expect(entry.locator("svg")).toBeVisible();
        await expect(entry.locator("svg.lucide-scan-line")).toHaveCount(0);
        const arrow = popup.locator("[data-feature-arrow]");
        await expect(arrow).toBeVisible();
        const entryBounds = (await entry.boundingBox())!;
        const arrowBounds = (await arrow.boundingBox())!;
        expect(arrowBounds.x + arrowBounds.width / 2, `${width}px arrow belongs to entry`).toBeGreaterThanOrEqual(entryBounds.x);
        expect(arrowBounds.x + arrowBounds.width / 2, `${width}px arrow belongs to entry`).toBeLessThanOrEqual(entryBounds.x + entryBounds.width);
      }
      await page.setViewportSize({ width: test.info().project.name === "mobile" ? 390 : 1536, height: 960 });
      await page.screenshot({ path: test.info().outputPath(`feature-launch-${locale}-${theme}.png`), animations: "disabled" });
    });
  }
}

test("dismissal persists after reload and client route changes without hiding the entry", async ({ page }) => {
  await page.goto("/");
  const { entry, popup } = await announcement(page, "zh");
  await popup.getByRole("button", { name: copy.zh.close, exact: true }).click();
  await expect(popup).toBeHidden();
  await expect(entry).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), dismissalKey)).toBe("1");
  await page.reload();
  await expect(page.getByRole("button", { name: copy.zh.entry, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: copy.zh.title, exact: true })).toBeHidden();
  await page.getByRole("link", { name: "切换语言，中英文", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.getByRole("button", { name: copy.en.entry, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: copy.en.title, exact: true })).toBeHidden();
});

test("announcement CTA opens the existing uploader and records the announcement as seen", async ({ page }) => {
  await page.goto("/");
  const { popup } = await announcement(page, "zh");
  await popup.getByRole("button", { name: copy.zh.upload, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: copy.zh.tool, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "选择图片", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "开始反推", exact: true })).toBeDisabled();
  await expect(popup).toBeHidden();
  expect(await page.evaluate(key => localStorage.getItem(key), dismissalKey)).toBe("1");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: copy.zh.title, exact: true })).toBeHidden();
});

test("search to entry to close preserves search text, focus restoration, and keyboard search", async ({ page }) => {
  await page.goto("/");
  const { entry } = await announcement(page, "zh");
  const input = page.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("猫咪");
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
  await entry.click();
  const dialog = page.getByRole("dialog", { name: copy.zh.tool, exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeHidden();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("猫咪");
  await expect(page.getByRole("heading", { name: "最近搜索" })).toBeVisible();
});

test("the launch announcement does not capture focus or block gallery navigation", async ({ page }) => {
  await page.goto("/");
  await announcement(page, "zh");
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(page.locator('[role="dialog"][aria-modal="true"]:visible')).toHaveCount(0);
  const firstPrompt = test.info().project.name === "mobile"
    ? page.locator('[data-layout="mobile"] a[href*="00000000-0000-4000-8000-000000000001"]').first()
    : page.getByTestId("prompt-view-link").first();
  await firstPrompt.click();
  await expect(page).toHaveURL(/\/prompt\//);
  await expect(page.getByRole("heading", { name: "春日樱花少女，电影感人像", exact: true })).toBeVisible();
});

test("after the launch window the feature remains usable without an evergreen NEW badge", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-07T00:00:00+08:00"));
  await page.goto("/");
  const entry = page.getByRole("button", { name: copy.zh.entry, exact: true });
  await expect(entry).toBeVisible();
  await expect(entry.getByText("NEW", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: copy.zh.title, exact: true })).toBeHidden();
  await entry.click();
  await expect(page.getByRole("dialog", { name: copy.zh.tool, exact: true })).toBeVisible();
});
