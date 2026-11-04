import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.skip(process.env.AIGC_THINKING_INTEGRATION !== "1", "Requires a dedicated loopback fixture");
test.setTimeout(120_000);
const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:18148";

async function control(request: APIRequestContext, email: string, path: string, mode = "success") {
  expect((await request.post(`${fixture}/__fixture/${path}`, { data: { email, mode } })).ok()).toBe(true);
}

async function login(page: Page, email: string) {
  await page.getByLabel("邮箱地址", { exact: true }).fill(email);
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await page.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "验证并登录", exact: true }).click();
}

test("queued and thinking states are compact, and image generation retains its own indicator", async ({ page, request, baseURL }, info) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(fixture).hostname);
  expect(await (await request.get(`${fixture}/health`)).json()).toMatchObject({ isolated_fixture: true, worker_running: true });
  const email = `sample+thinking-${info.project.name}-${randomUUID().slice(0, 8)}@example.test`;
  let forceQueued = true;
  await page.route("https://image-fixture.invalid/**", async route => {
    const source = new URL(route.request().url());
    const response = await request.get(`${fixture}${source.pathname}${source.search}`);
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": "*" } });
  });
  await page.route("**/api/prompt-conversations/**", async route => {
    if (!forceQueued || route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    if (Array.isArray(body.data?.turns)) {
      body.data.turns = body.data.turns.map((turn: Record<string, unknown>) => ({ ...turn, status: "queued", phase: "queued", generation_mode: null }));
    }
    return route.fulfill({ response, json: body });
  });
  try {
    await control(request, email, "next-vision", "hold");
    await page.goto("/zh");
    await page.getByRole("textbox", { name: "描述想生成的画面，或直接聊天", exact: true }).fill("画一张夜晚的海边");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await login(page, email);
    const panel = page.getByRole("complementary", { name: "提示词创作对话", exact: true });
    const status = panel.getByRole("status");
    await expect(status).toContainText("排队中", { timeout: 20_000 });
    await expect(panel.locator('[class*="skeleton"]')).toHaveCount(0);
    forceQueued = false;
    await expect(status).toContainText("正在思考中", { timeout: 20_000 });
    await expect(panel.getByText("处理中…")).toHaveCount(0);
    await expect(panel.locator('[class*="skeleton"]')).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      await expect(status).toBeVisible();
      await panel.screenshot({ path: info.outputPath(`thinking-${theme}.png`), animations: "disabled" });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await status.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await control(request, email, "next-vision", "hold_image");
    await control(request, email, "release");
    await expect(panel.getByRole("progressbar", { name: "预计生成进度" })).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByRole("status")).toContainText("正在生成图片");
    await control(request, email, "release");
    await expect(panel.getByRole("img", { name: "生成的图片", exact: true })).toHaveCount(1, { timeout: 20_000 });
  } finally {
    await control(request, email, "release");
  }
});
