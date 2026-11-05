import { expect, test, type Page } from "@playwright/test";

const splitterName = "调整聊天面板宽度";
const panelName = "AI 创作对话";
const followupName = "继续提问或描述想法，也可以添加参考图";

async function openChat(page: Page) {
  await page.goto("/zh");
  await page.getByRole("textbox", { name: "描述想生成的画面，或直接聊天", exact: true }).fill("测试创作");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("link", { name: "关闭登录", exact: true }).click();
  const panel = page.getByRole("complementary", { name: panelName, exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

test.beforeEach(async ({ page, baseURL }) => {
  const safeOrigin = new URL(baseURL!).origin;
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== safeOrigin || (request.method() === "POST" && url.pathname.startsWith("/api/prompt-"))) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
});

test("desktop divider tracks the pointer, clamps, releases outside and retains the draft", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop split layout only");
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  const panel = await openChat(page);
  const input = panel.getByRole("textbox", { name: followupName, exact: true });
  await input.fill("拖动后仍然保留的草稿");
  const divider = page.getByRole("separator", { name: splitterName, exact: true });
  await expect(divider).toBeVisible();
  const initial = await divider.boundingBox();
  expect(initial).not.toBeNull();
  const startX = initial!.x + initial!.width / 2;
  const y = Math.min(initial!.y + initial!.height / 2, 450);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  const positions: number[] = [];
  for (const displacement of [45, 90, 135, 180]) {
    await page.mouse.move(startX - displacement, y);
    await expect.poll(async () => (await divider.boundingBox())!.x).toBeLessThan(initial!.x - displacement + 12);
    positions.push((await divider.boundingBox())!.x);
  }
  expect(positions.every((value, index) => index === 0 || value < positions[index - 1])).toBe(true);
  await expect(input).toHaveValue("拖动后仍然保留的草稿");
  await expect(panel).toBeVisible();
  await page.mouse.move(-100, y);
  await page.mouse.up();
  const released = (await divider.boundingBox())!.x;
  await page.mouse.move(800, y);
  await expect.poll(async () => (await divider.boundingBox())!.x).toBeCloseTo(released, 0);
  expect(await page.evaluate(() => getSelection()?.toString() ?? "")).toBe("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await panel.boundingBox())!.width).toBeGreaterThan(250);
  await page.screenshot({ path: info.outputPath("splitter-desktop-dark.png"), animations: "disabled" });
});

test("keyboard resizing and width remain usable in light and dark themes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop split layout only");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await openChat(page);
  const divider = page.getByRole("separator", { name: splitterName, exact: true });
  await expect(divider).toBeVisible();
  await divider.focus();
  const before = (await divider.boundingBox())!.x;
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await divider.boundingBox())!.x).toBeLessThan(before);
  const workspace = page.getByTestId("gallery-workspace");
  const rapidBefore = await workspace.evaluate(element => Number.parseFloat(element.style.getPropertyValue("--chat-width")));
  await divider.evaluate(element => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  });
  await expect.poll(() => workspace.evaluate(element => Number.parseFloat(element.style.getPropertyValue("--chat-width")))).toBeCloseTo(rapidBefore + 48, 1);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => workspace.evaluate(element => Number.parseFloat(element.style.getPropertyValue("--chat-width")))).toBeCloseTo(rapidBefore + 24, 1);
  await expect(divider).toHaveAttribute("aria-orientation", "vertical");
  await expect(divider).toHaveAttribute("aria-valuenow", /^\d+(\.\d+)?$/);
  await page.setViewportSize({ width: 1280, height: 800 });
  await divider.focus();
  await page.keyboard.press("Home");
  const panel = page.getByRole("complementary", { name: panelName, exact: true });
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeLessThan(422);
  expect((await panel.boundingBox())!.width).toBeGreaterThan(417);
  const header = panel.locator("header");
  expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(panel.getByRole("textbox", { name: followupName, exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "发送", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: info.outputPath("splitter-desktop-light.png"), animations: "disabled" });
});

test("narrowest chat keeps English controls inside the pane", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop split layout only");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  await page.getByRole("textbox", { name: "Describe an image or start a conversation", exact: true }).fill("Test creation");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("link", { name: "Close login", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "AI creation conversation", exact: true });
  const divider = page.getByRole("separator", { name: "Resize chat panel", exact: true });
  await expect(divider).toBeVisible();
  await divider.focus();
  await page.keyboard.press("Home");
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeLessThan(422);
  expect((await panel.boundingBox())!.width).toBeGreaterThan(417);
  const header = panel.locator("header");
  expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(panel.getByRole("textbox", { name: "Ask a question, describe an idea, or add a reference image", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobile retains its existing layout without the desktop divider", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile layout only");
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openChat(page);
  await expect(page.getByRole("separator", { name: splitterName, exact: true })).toHaveCount(0);
  await panel.getByRole("textbox", { name: followupName, exact: true }).fill("手机草稿");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(panel.getByRole("textbox", { name: followupName, exact: true })).toHaveValue("手机草稿");
  await page.screenshot({ path: info.outputPath("splitter-mobile.png"), animations: "disabled" });
});
