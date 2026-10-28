import { createHash, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

test.skip(process.env.AIGC_PROMPT_INTEGRATION !== "1", "Requires the loopback PostgreSQL/Redis conversation fixture");
test.setTimeout(90_000);
const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:8036";
const image = "e2e/fixtures/submission.png";
const homeInput = "说说你的想法，帮你写成提示词";
const followupInput = "继续提问或描述想法，也可以添加参考图";
const panelLabel = "提示词创作对话";
const emailForTest = () => `sample+inline-${test.info().project.name}-${randomUUID().slice(0, 8)}@example.test`;
type Metrics = { calls: number; job_count: number; image_calls: number; statuses: string[]; context_prompt_hashes: string[]; conversation_count: number };

async function metrics(request: APIRequestContext, email: string): Promise<Metrics> {
  const response = await request.get(`${fixture}/__fixture/metrics`, { params: { email } });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function configure(request: APIRequestContext, email: string, mode: "hold" | "failure") {
  expect((await request.post(`${fixture}/__fixture/next-vision`, { data: { email, mode } })).ok()).toBe(true);
}
async function release(request: APIRequestContext, email: string) {
  expect((await request.post(`${fixture}/__fixture/release`, { data: { email } })).ok()).toBe(true);
}
async function login(page: Page, email: string) {
  await expect(page.getByLabel("邮箱地址", { exact: true })).toBeVisible();
  await page.getByLabel("邮箱地址", { exact: true }).fill(email);
  const sent = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/send-code");
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  expect((await sent).status()).toBe(204);
  await page.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  const verified = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/verify-code");
  await page.getByRole("button", { name: "验证并登录", exact: true }).click();
  expect((await verified).status()).toBe(204);
}
function version(panel: Locator, number: number) {
  return panel.getByRole("button", { name: new RegExp(`^版本 ${number} ·`) }).locator("..");
}
async function newText(page: Page, email: string, text: string) {
  await page.goto("/zh");
  await page.getByRole("textbox", { name: homeInput, exact: true }).fill(text);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  const created = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/prompt-conversations");
  await login(page, email);
  const response = await created;
  expect(response.status()).toBe(202);
  const body = await response.json();
  return { panel: page.getByRole("complementary", { name: panelLabel, exact: true }), conversationId: body.data.conversation_id as string };
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "用户菜单", exact: true }).click();
  const left = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/logout");
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  expect((await left).ok()).toBe(true);
  await expect(page.getByRole("link", { name: "登录", exact: true })).toBeVisible();
}

test.beforeAll(async ({ request, baseURL }) => {
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(baseURL!).hostname);
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(fixture).hostname);
  const health = await request.get(`${fixture}/health`);
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ isolated_fixture: true, worker_running: true });
});

test("the home layout keeps the full brand label and search with gallery filters", async ({ page }, info) => {
  await page.goto("/zh");
  const brand = page.getByRole("link", { name: "提示词创作", exact: true }).locator("span");
  expect(await brand.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const search = page.getByRole("textbox", { name: "搜索关键词", exact: true });
  await expect(search).toBeVisible();
  expect(await search.evaluate(element => Boolean(element.closest("[data-gallery-toolbar]")))).toBe(true);
  expect(await search.evaluate(element => Boolean(element.closest("[data-site-topbar]")))).toBe(false);
  const columns = await page.locator('[data-layout]:visible').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(info.project.name === "mobile" ? 2 : 5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("inline-home.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: info.outputPath("inline-home-dark.png"), fullPage: true });
});

test("text conversations survive collapse and search, refine the saved version, and restore private history", async ({ page, request }, info) => {
  if (info.project.name === "desktop") await page.setViewportSize({ width: 1280, height: 720 });
  const email = emailForTest();
  const idea = "雨夜送花的小猫，做一张手机壁纸";
  await configure(request, email, "hold");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const { panel } = await newText(page, email, idea);
    await expect(panel).toBeVisible();
    if (info.project.name === "desktop") {
      await page.evaluate(() => window.scrollTo(0, 0));
      const sendBounds = await panel.getByRole("button", { name: "发送", exact: true }).boundingBox();
      expect(sendBounds!.y + sendBounds!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    }
    const brand = page.getByRole("link", { name: "提示词创作", exact: true }).locator("span");
    expect(await brand.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const columns = await page.locator('[data-layout]:visible').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(info.project.name === "mobile" ? 2 : 3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(panel).toContainText(idea);
    await expect.poll(async () => (await metrics(request, email)).calls).toBe(1);
    await expect(panel.getByRole("status")).toContainText("正在回复…");
    await panel.getByRole("button", { name: "收起", exact: true }).click();
    await expect(panel).toBeHidden();
    const search = page.getByRole("textbox", { name: "搜索关键词", exact: true });
    await search.fill("粉色");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=/);
    await page.getByRole("button", { name: "继续上次创作", exact: true }).click();
    await expect(panel).toBeVisible();
    expect((await metrics(request, email)).job_count).toBe(1);
    await release(request, email);
    const first = version(panel, 1);
    await expect(first).toContainText(`根据想法创作：${idea}`, { timeout: 20_000 });
    await first.getByRole("tab", { name: "English", exact: true }).click();
    await expect(first).toContainText("English prompt for:");
    await first.getByRole("tab", { name: "中文", exact: true }).click();
    await first.getByRole("button", { name: "编辑", exact: true }).click();
    const edited = `用户保留的主体与光线 ${randomUUID().slice(0, 8)}。`;
    await first.getByRole("textbox", { name: "编辑中文提示词", exact: true }).fill(edited);
    const saved = page.waitForResponse(response => response.request().method() === "PATCH" && /\/api\/prompt-analyses\/[^/]+$/.test(new URL(response.url()).pathname));
    await first.getByRole("button", { name: "保存修改", exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(first).toContainText(edited);
    expect((await metrics(request, email)).calls).toBe(1);
    await panel.getByRole("textbox", { name: followupInput, exact: true }).fill("保留主体，背景改成奶油白");
    await panel.getByRole("button", { name: "发送", exact: true }).click();
    const second = version(panel, 2);
    await expect(second).toContainText(edited, { timeout: 20_000 });
    await expect(second).toContainText("本轮调整：保留主体，背景改成奶油白");
    const measured = await metrics(request, email);
    expect(measured.calls).toBe(2);
    expect(measured.job_count).toBe(2);
    expect(measured.conversation_count).toBe(1);
    expect(measured.context_prompt_hashes).toEqual([createHash("sha256").update(edited).digest("hex")]);
    await panel.getByRole("button", { name: "历史", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "历史创作", exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "文字想法创作", exact: true }).click();
    await expect(version(panel, 2)).toContainText(edited);
    expect((await metrics(request, email)).calls).toBe(2);
    expect(new URL(page.url()).searchParams.get("q")).toBe("粉色");
    await page.screenshot({ path: info.outputPath("inline-text-result.png"), fullPage: true });
    await panel.screenshot({ path: info.outputPath("inline-text-panel.png") });
    expect(errors).toEqual([]);
  } finally { await release(request, email); }
});

test("local images and gallery references stay local until explicit send and share the conversation UI", async ({ page, request }, info) => {
  const email = emailForTest();
  await page.goto("/zh");
  await page.getByLabel("选择创作参考图片", { exact: true }).setInputFiles(image);
  await expect(page.getByRole("img", { name: "参考图片", exact: true })).toBeVisible();
  expect((await metrics(request, email)).calls).toBe(0);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  const created = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/prompt-conversations");
  await login(page, email);
  expect((await created).status()).toBe(202);
  const panel = page.getByRole("complementary", { name: panelLabel, exact: true });
  await expect(version(panel, 1)).toContainText("根据参考图片和想法创作", { timeout: 20_000 });
  await expect.poll(async () => (await metrics(request, email)).image_calls).toBe(1);
  await expect.poll(() => panel.getByRole("img", { name: "参考图片", exact: true }).evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await panel.getByRole("button", { name: "新建", exact: true }).click();
  const reference = page.getByRole("button", { name: /用《粉色产品摄影参考图 1》的图片创作提示词/ }).filter({ visible: true });
  await reference.click();
  expect((await metrics(request, email)).calls).toBe(1);
  const imported = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/prompt-assets/from-prompt");
  await panel.getByRole("button", { name: "发送", exact: true }).click();
  expect((await imported).status()).toBe(201);
  await expect(version(panel, 1)).toContainText("根据参考图片和想法创作", { timeout: 20_000 });
  expect((await metrics(request, email)).image_calls).toBe(2);
  expect((await metrics(request, email)).conversation_count).toBe(2);
  await page.screenshot({ path: info.outputPath("inline-image-result.png"), fullPage: true });
});

test("switching accounts clears drafts, references and history without resending previous private content", async ({ page, request }, info) => {
  const author = emailForTest();
  const other = emailForTest();
  const secret = `仅账户A可见的想法-${randomUUID().slice(0, 8)}`;
  const { panel, conversationId } = await newText(page, author, secret);
  await expect(version(panel, 1)).toContainText(secret, { timeout: 20_000 });
  await panel.getByRole("textbox", { name: followupInput, exact: true }).fill("账户A尚未发送的草稿");
  await panel.getByLabel("选择创作参考图片", { exact: true }).setInputFiles(image);
  await logout(page);
  await expect(page.getByRole("textbox", { name: homeInput, exact: true })).toHaveValue("");
  await expect(page.getByRole("img", { name: "参考图片", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "历史", exact: true }).click();
  await login(page, other);
  await expect(panel.getByText("还没有创作记录", { exact: true })).toBeVisible();
  await expect(panel).not.toContainText(secret);
  expect((await metrics(request, other)).calls).toBe(0);
  expect((await metrics(request, other)).job_count).toBe(0);
  expect((await page.request.get(`/api/prompt-conversations/${conversationId}`)).status()).toBe(404);
  expect((await metrics(request, author)).calls).toBe(1);
  await page.screenshot({ path: info.outputPath("inline-account-b-empty.png"), fullPage: true });
});
