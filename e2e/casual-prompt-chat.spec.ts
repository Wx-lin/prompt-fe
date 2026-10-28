import { createHash, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

test.skip(process.env.AIGC_PROMPT_INTEGRATION !== "1", "Requires isolated real SQL/Redis conversation fixture");
test.setTimeout(120_000);
const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:8038";
const inputName = "继续提问或描述想法，也可以添加参考图";

async function login(page: Page, email: string) {
  await page.getByLabel("邮箱地址", { exact: true }).fill(email);
  const sent = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/send-code");
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  expect((await sent).status()).toBe(204);
  await page.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  const verified = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/verify-code");
  await page.getByRole("button", { name: "验证并登录", exact: true }).click();
  expect((await verified).status()).toBe(204);
}

async function configure(request: APIRequestContext, email: string, reply?: string) {
  const response = await request.post(`${fixture}/__fixture/next-vision`, {
    data: { email, mode: reply === undefined ? "success" : "reply", ...(reply ? { reply } : {}) },
  });
  expect(response.ok()).toBe(true);
}

async function metrics(request: APIRequestContext, email: string) {
  const response = await request.get(`${fixture}/__fixture/metrics`, { params: { email } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ calls: number; send_modes: string[]; context_prompt_hashes: (string | null)[] }>;
}

async function send(panel: Locator, text: string) {
  await panel.getByRole("textbox", { name: inputName, exact: true }).fill(text);
  await panel.getByRole("button", { name: "发送", exact: true }).click();
}

function version(panel: Locator, number: number) {
  return panel.getByRole("button", { name: new RegExp(`^版本 ${number} ·`) }).locator("..");
}

test.beforeAll(async ({ request, baseURL }) => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  expect(["127.0.0.1", "localhost"]).toContain(new URL(fixture).hostname);
  const response = await request.get(`${fixture}/health`);
  expect(await response.json()).toMatchObject({ isolated_fixture: true, worker_running: true });
});

test("casual replies and prompt versions share private history without losing edits", async ({ page, request }, info) => {
  const email = `sample+casual-${info.project.name}-${randomUUID().slice(0, 8)}@example.test`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/zh");
  const firstReply = "你好！今天想聊些什么？我们也可以一起讨论创作。";
  await configure(request, email, firstReply);
  await page.getByRole("textbox", { name: "说说你的想法，帮你写成提示词", exact: true }).fill("你好");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  expect((await metrics(request, email)).calls).toBe(0);
  const created = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/prompt-conversations");
  await login(page, email);
  const response = await created;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).not.toHaveProperty("mode", "generate");
  const panel = page.getByRole("complementary", { name: "提示词创作对话", exact: true });
  await expect(panel.getByText(firstReply, { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^版本 \d/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "换一种风格", exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("casual-only-light.png"), fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: info.outputPath("casual-only-dark.png"), fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const secondReply = "可以聊温暖的城市生活，也可以聊雨夜的电影氛围。";
  await configure(request, email, secondReply);
  await send(panel, "推荐两个画面方向");
  await expect(panel.getByText(secondReply, { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^版本 \d/ })).toHaveCount(0);

  await configure(request, email);
  await send(panel, "就第二种，帮我写一张雨夜小猫壁纸的提示词");
  const first = version(panel, 1);
  await expect(first.getByRole("button", { name: "复制中文", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^版本 3 ·/ })).toHaveCount(0);
  await first.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = first.getByRole("textbox", { name: "编辑中文提示词", exact: true });
  const edited = (await editor.inputValue()) + " 保留人工添加的白色花束。";
  await editor.fill(edited);
  const saved = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname.startsWith("/api/prompt-analyses/"));
  await first.getByRole("button", { name: "保存修改", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(first.getByText(edited, { exact: true })).toBeVisible();

  const explanation = "浅景深会突出小猫，如果想保留街景细节，可以改成中等景深。";
  await configure(request, email, explanation);
  await send(panel, "浅景深是什么意思？");
  await expect(panel.getByText(explanation, { exact: true })).toBeVisible();
  await expect(first.getByText(edited, { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^版本 \d/ })).toHaveCount(1);

  await configure(request, email);
  await send(panel, "那就改成中等景深，保留白色花束");
  await expect(version(panel, 2).getByRole("button", { name: "复制中文", exact: true })).toBeVisible();
  const result = await metrics(request, email);
  expect(result.calls).toBe(5);
  expect(result.send_modes).toEqual(["auto", "auto", "auto", "auto", "auto"]);
  expect(result.context_prompt_hashes.at(-1)).toBe(createHash("sha256").update(edited).digest("hex"));

  await page.reload();
  await page.getByRole("button", { name: "历史", exact: true }).click();
  await panel.getByRole("button", { name: "普通对话", exact: true }).click();
  await expect(panel.getByText(firstReply, { exact: true })).toBeVisible();
  await expect(panel.getByText(explanation, { exact: true })).toBeVisible();
  await expect(version(panel, 2).getByRole("button", { name: "复制中文", exact: true })).toBeVisible();
  expect((await metrics(request, email)).calls).toBe(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("casual-chat-light.png"), fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: info.outputPath("casual-chat-dark.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
