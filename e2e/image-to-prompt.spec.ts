import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

test.skip(process.env.AIGC_PROMPT_INTEGRATION !== "1", "Requires the isolated PostgreSQL/Redis prompt-analysis fixture");
test.setTimeout(60_000);

const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:8026";
const image = "e2e/fixtures/submission.png";
const chinese = "一块粉色抽象方块，干净背景，柔和光线，简洁构图。";
const english = "A pink abstract square on a clean background, soft light, minimal composition.";

test.beforeAll(async ({ request, baseURL }) => {
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(baseURL!).hostname);
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(fixture).hostname);
  const health = await request.get(`${fixture}/health`);
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ isolated_fixture: true, worker_running: true });
});

test.beforeEach(async ({ page }) => {
  // Next's development-only issue badge covers the mobile footer. Keep product
  // controls and runtime errors intact while excluding that development chrome.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { pointer-events: none !important; }";
      document.head.appendChild(style);
    });
  });
});

function emailForTest() {
  return `sample+${test.info().project.name}-${randomUUID().slice(0, 8)}@example.test`;
}

async function metrics(request: APIRequestContext, email: string) {
  const response = await request.get(`${fixture}/__fixture/metrics`, { params: { email } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ calls: number; job_count: number; statuses: string[]; deleted_count: number }>;
}

async function configureVision(request: APIRequestContext, email: string, mode: "hold" | "failure") {
  const response = await request.post(`${fixture}/__fixture/next-vision`, { data: { email, mode } });
  expect(response.ok()).toBe(true);
}

async function openTool(page: Page) {
  await page.getByRole("button", { name: "图片转提示词", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName("反推提示词");
  return dialog;
}

async function selectImage(page: Page, dialog: Locator) {
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "选择图片", exact: true }).click();
  await (await chooser).setFiles(image);
  await expect(dialog.getByRole("button", { name: "更换图片", exact: true })).toBeVisible();
}

async function login(page: Page, email: string, toolTitle: "反推提示词" | "历史记录" = "反推提示词") {
  await expect(page.getByLabel("邮箱地址", { exact: true })).toBeVisible();
  await page.getByLabel("邮箱地址", { exact: true }).fill(email);
  const sent = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/send-code");
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  expect((await sent).status()).toBe(204);
  await page.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  const verified = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/verify-code");
  await page.getByRole("button", { name: "验证并登录", exact: true }).click();
  expect((await verified).status()).toBe(204);
  await expect(page.getByRole("dialog", { name: toolTitle, exact: true })).toBeVisible();
}

async function savePrompt(page: Page, prompt: Locator, value: string) {
  const saved = page.waitForResponse((response) =>
    /\/api\/prompt-analyses\/[^/]+$/.test(new URL(response.url()).pathname)
    && response.request().method() === "PATCH" && response.ok(),
  );
  await prompt.fill(value);
  await saved;
  await expect(page.getByText("已保存到历史", { exact: true })).toBeVisible();
}

async function prepare(page: Page, email: string) {
  await page.goto("/zh");
  const dialog = await openTool(page);
  await page.screenshot({ path: test.info().outputPath("image-to-prompt-upload.png"), fullPage: true });
  await selectImage(page, dialog);
  await page.screenshot({ path: test.info().outputPath("image-to-prompt-selected.png"), fullPage: true });
  await dialog.getByRole("button", { name: "开始反推", exact: true }).click();
  const created = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/prompt-analyses" && response.request().method() === "POST",
  ).catch(() => null);
  await login(page, email);
  expect((await created)?.ok()).toBe(true);
  await expect(dialog.getByRole("button", { name: "更换图片", exact: true })).toBeVisible();
  return dialog;
}

async function selectLanguage(page: Page, dialog: Locator, name: "中文" | "English") {
  await dialog.getByRole("combobox", { name: "输出语言", exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function fitsViewport(page: Page, dialog: Locator) {
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("selected image survives email login; one analysis supplies both languages, edits, copy, and private history", async ({ page, context, request }, info) => {
  const email = emailForTest();
  let runtimeErrors: string[] = [];
  let missingMessages: string[] = [];
  page.on("pageerror", (error) => { runtimeErrors = [...runtimeErrors, error.message]; });
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("MISSING_MESSAGE")) {
      missingMessages = [...new Set([...missingMessages, message.text().split("\n", 1)[0]])];
    }
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.emulateMedia({ colorScheme: "dark" });
  const dialog = await prepare(page, email);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const prompt = dialog.getByRole("textbox", { name: "完整提示词", exact: true });
  await expect(prompt).toHaveValue(chinese, { timeout: 20_000 });
  await expect.poll(async () => (await metrics(request, email)).calls).toBe(1);
  expect((await metrics(request, email)).job_count).toBe(1);

  await selectLanguage(page, dialog, "English");
  await expect(prompt).toHaveValue(english);
  await dialog.getByRole("tab", { name: "画面拆解", exact: true }).click();
  await expect(dialog.getByText("A pink abstract square", { exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "完整提示词", exact: true }).click();
  await selectLanguage(page, dialog, "中文");
  const edited = `${chinese} 增加淡粉色渐变。`;
  const saved = page.waitForResponse((response) =>
    /\/api\/prompt-analyses\/[^/]+$/.test(new URL(response.url()).pathname)
    && response.request().method() === "PATCH" && response.ok(),
  );
  await prompt.fill(edited);
  await saved;
  await dialog.getByRole("button", { name: "复制提示词", exact: true }).click();
  await expect(dialog.getByText("已复制提示词", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(edited);
  await fitsViewport(page, dialog);
  await page.screenshot({ path: info.outputPath("image-to-prompt-dark.png"), fullPage: true });
  await dialog.screenshot({ path: info.outputPath("image-to-prompt-dark-dialog.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await fitsViewport(page, dialog);
  await page.screenshot({ path: info.outputPath("image-to-prompt-light.png"), fullPage: true });
  await dialog.screenshot({ path: info.outputPath("image-to-prompt-light-dialog.png") });

  await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
  await dialog.getByRole("button", { name: /^打开记录 / }).first().click();
  await expect(prompt).toHaveValue(edited);
  await expect.poll(() => dialog.getByRole("img", { name: "参考图片", exact: true })
    .evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect((await metrics(request, email)).calls).toBe(1);
  await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
  const deleted = page.waitForResponse((response) => response.request().method() === "DELETE"
    && /\/api\/prompt-analyses\/[^/]+$/.test(new URL(response.url()).pathname) && response.status() === 204);
  await dialog.getByRole("button", { name: /^删除记录 / }).first().click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await deleted;
  await expect(dialog.getByRole("button", { name: /^打开记录 / })).toHaveCount(0);
  expect((await metrics(request, email)).deleted_count).toBe(1);
  expect(runtimeErrors).toEqual([]);
  expect(missingMessages).toEqual([]);
});

test("invalid files never upload or dispatch a model request", async ({ page, request }) => {
  await page.goto("/zh");
  const dialog = await openTool(page);
  let uploadCount = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/prompt-assets" && request.method() === "POST") uploadCount += 1;
  });
  await dialog.getByLabel("选择参考图片", { exact: true }).setInputFiles({
    name: "not-an-image.txt", mimeType: "text/plain", buffer: Buffer.from("This is not an image."),
  });
  await expect(dialog.getByRole("alert")).toContainText(/JPEG|PNG|WebP/);
  await expect(dialog.getByRole("button", { name: "开始反推", exact: true })).toBeDisabled();
  expect(uploadCount).toBe(0);
  expect((await request.get(`${fixture}/health`)).ok()).toBe(true);
});

test("closing and reopening a running analysis preserves the job without another dispatch", async ({ page, request }) => {
  const email = emailForTest();
  await configureVision(request, email, "hold");
  try {
    const dialog = await prepare(page, email);
    await expect.poll(async () => (await metrics(request, email)).calls).toBe(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await openTool(page);
    await expect.poll(async () => (await metrics(request, email)).statuses).toEqual(["running"]);
    expect((await metrics(request, email)).job_count).toBe(1);
    expect((await metrics(request, email)).calls).toBe(1);
    expect((await request.post(`${fixture}/__fixture/release`, { data: { email } })).ok()).toBe(true);
    await expect(dialog.getByRole("textbox", { name: "完整提示词", exact: true })).toHaveValue(chinese, { timeout: 20_000 });
    expect((await metrics(request, email)).calls).toBe(1);
  } finally {
    // A failed UI assertion must not leave the single worker blocked for later tests.
    await request.post(`${fixture}/__fixture/release`, { data: { email } });
  }
});

test("provider failure remains visible and retry creates exactly one new analysis", async ({ page, request }) => {
  const email = emailForTest();
  await configureVision(request, email, "failure");
  const dialog = await prepare(page, email);
  await expect(dialog.getByRole("heading", { name: "解析失败", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(dialog).not.toContainText(/fixture-secret|api_key|traceback/i);
  await expect.poll(async () => (await metrics(request, email)).statuses).toEqual(["failed"]);
  await dialog.getByRole("button", { name: "重新反推", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "完整提示词", exact: true })).toHaveValue(chinese, { timeout: 20_000 });
  expect((await metrics(request, email)).calls).toBe(2);
  expect((await metrics(request, email)).job_count).toBe(2);
});

test("switching accounts through the UI clears the previous account's prompt, preview, and history", async ({ page, request }, info) => {
  const author = emailForTest();
  const other = emailForTest();
  const dialog = await prepare(page, author);
  const prompt = dialog.getByRole("textbox", { name: "完整提示词", exact: true });
  await expect(prompt).toHaveValue(chinese, { timeout: 20_000 });
  const privateText = `${chinese} 仅属于账户 A 的私有修改 ${randomUUID().slice(0, 8)}。`;
  await savePrompt(page, prompt, privateText);
  await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^打开记录 / })).toHaveCount(1);
  const thumbnail = dialog.getByRole("button", { name: /^打开记录 / }).locator("img");
  await expect.poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const privateThumbnail = await thumbnail.getAttribute("src");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "用户菜单", exact: true }).click();
  const loggedOut = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/logout");
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  expect((await loggedOut).ok()).toBe(true);
  await expect(page.getByRole("link", { name: "登录", exact: true })).toBeVisible();
  // Keep the same mounted launcher: visiting /login could unmount its state and
  // conceal a missing identity reset. History opens the existing inline login.
  await openTool(page);
  await expect(prompt).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: "参考图片", exact: true })).toHaveCount(0);
  await expect(dialog).not.toContainText(privateText);
  await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
  await login(page, other, "历史记录");
  await expect(dialog.getByRole("heading", { name: "还没有反推记录", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();

  await openTool(page);
  await expect(prompt).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: "参考图片", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "更换图片", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "开始反推", exact: true })).toBeDisabled();
  await expect(dialog).not.toContainText(privateText);
  await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "还没有反推记录", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^打开记录 / })).toHaveCount(0);
  expect(await dialog.locator("img").evaluateAll((images, source) => images.some((image) => image.getAttribute("src") === source), privateThumbnail)).toBe(false);
  expect((await metrics(request, other)).job_count).toBe(0);
  expect((await metrics(request, other)).calls).toBe(0);
  expect((await metrics(request, author)).calls).toBe(1);
  await page.screenshot({ path: info.outputPath("account-b-empty-private-history.png"), fullPage: true });
});

for (const action of ["replace", "rerun", "record"] as const) {
  test(`unsaved draft requires confirmation before ${action}; returning preserves it and continuing switches`, async ({ page, request }, info) => {
    const email = emailForTest();
    const dialog = await prepare(page, email);
    const prompt = dialog.getByRole("textbox", { name: "完整提示词", exact: true });
    await expect(prompt).toHaveValue(chinese, { timeout: 20_000 });
    const firstSaved = `${chinese} 第一条记录的已保存内容。`;
    if (action === "record") {
      await savePrompt(page, prompt, firstSaved);
      await dialog.getByRole("button", { name: "重新反推", exact: true }).click();
      await expect.poll(async () => (await metrics(request, email)).calls).toBe(2);
      await expect(prompt).toHaveValue(chinese, { timeout: 20_000 });
      await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
      await expect(dialog.getByRole("button", { name: /^打开记录 / })).toHaveCount(2);
      await dialog.getByRole("button", { name: /^打开记录 / }).first().click();
      await expect(prompt).toHaveValue(chinese);
    }
    await page.route("**/api/prompt-analyses/*", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
        success: false, data: null, error: { code: "SERVICE_UNAVAILABLE", message: "Fixture save unavailable" }, request_id: "fixture-save-failure",
      }) });
    });
    const priorImage = await dialog.getByRole("img", { name: "参考图片", exact: true }).getAttribute("src");
    const callsBefore = (await metrics(request, email)).calls;
    const draft = `${chinese} 尚未保存的 ${action} 草稿。`;
    await prompt.fill(draft);

    async function attemptSwitch() {
      if (action === "replace") {
        await dialog.getByLabel("选择参考图片", { exact: true }).setInputFiles(image);
      } else if (action === "rerun") {
        await dialog.getByRole("button", { name: "重新反推", exact: true }).click();
      } else {
        await dialog.getByRole("button", { name: "历史记录", exact: true }).click();
        await dialog.getByRole("button", { name: /^打开记录 / }).nth(1).click();
      }
      return page.getByRole("alertdialog", { name: "还有未保存的修改", exact: true });
    }

    const confirmation = await attemptSwitch();
    await expect(confirmation).toBeVisible();
    expect((await metrics(request, email)).calls).toBe(callsBefore);
    await page.screenshot({ path: info.outputPath(`${action}-unsaved-confirmation.png`), fullPage: true });
    await confirmation.getByRole("button", { name: "返回编辑", exact: true }).click();
    await expect(confirmation).toBeHidden();
    if (action === "record") await dialog.getByRole("button", { name: "返回反推", exact: true }).click();
    await expect(prompt).toHaveValue(draft);
    await expect(dialog.getByRole("img", { name: "参考图片", exact: true })).toHaveAttribute("src", priorImage!);
    expect((await metrics(request, email)).calls).toBe(callsBefore);

    await attemptSwitch();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "继续切换", exact: true }).click();
    await expect(confirmation).toBeHidden();
    if (action === "replace") {
      await expect(prompt).toHaveCount(0);
      await expect(dialog.getByRole("img", { name: "参考图片", exact: true })).not.toHaveAttribute("src", priorImage!);
      await expect(dialog.getByRole("button", { name: "开始反推", exact: true })).toBeEnabled();
    } else {
      await expect(prompt).toHaveValue(action === "record" ? firstSaved : chinese, { timeout: 20_000 });
    }
    expect((await metrics(request, email)).calls).toBe(callsBefore + (action === "rerun" ? 1 : 0));
  });
}
