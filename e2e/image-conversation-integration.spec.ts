import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";

test.skip(process.env.AIGC_IMAGE_INTEGRATION !== "1", "Requires dedicated loopback image fixture and isolated Next server");
test.setTimeout(120_000);
const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:8039";

async function control(request: APIRequestContext, email: string, path: string, mode = "success") {
  const response = await request.post(`${fixture}/__fixture/${path}`, { data: { email, mode } });
  expect(response.ok()).toBe(true);
}
async function metrics(request: APIRequestContext, email: string) {
  const response = await request.get(`${fixture}/__fixture/metrics`, { params: { email } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ calls: number; image_calls: number; statuses: string[]; job_count: number; conversation_calls: { mode: string; has_image: boolean }[]; image_prompts: string[] }>;
}
async function login(page: Page, email: string) {
  await page.getByLabel("邮箱地址", { exact: true }).fill(email);
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await page.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "验证并登录", exact: true }).click();
}

async function animatedPixelCount(first: Buffer, second: Buffer): Promise<number> {
  const left = await sharp(first).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(second).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(left.info).toEqual(right.info);
  let changed = 0;
  for (let index = 0; index < left.data.length; index += 4) {
    if (Math.abs(left.data[index] - right.data[index]) + Math.abs(left.data[index + 1] - right.data[index + 1]) + Math.abs(left.data[index + 2] - right.data[index + 2]) > 12) changed += 1;
  }
  return changed;
}

test.beforeAll(async ({ request, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(fixture).hostname);
  expect(await (await request.get(`${fixture}/health`)).json()).toMatchObject({ isolated_fixture: true, worker_running: true });
});

test("real conversation API persists generated images, follows earlier reference, and restores history", async ({ page, request }, info) => {
  const email = `sample+image-${info.project.name}-${randomUUID().slice(0, 8)}@example.test`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Rewrite only synthetic signed media hosts. Conversation/auth calls are never intercepted.
  await page.route("https://image-fixture.invalid/**", async route => {
    const source = new URL(route.request().url());
    const response = await request.get(`${fixture}${source.pathname}${source.search}`);
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": "*" } });
  });
  try {
    await control(request, email, "next-vision", "hold_image");
    await page.goto("/zh");
    await expect(page.getByRole("combobox", { name: "创作模式" })).toHaveCount(0);
    await expect(page.getByText("继续上次创作")).toHaveCount(0);
    await page.getByRole("textbox", { name: "描述想生成的画面，或直接聊天", exact: true }).fill("画一只在海边散步的小猫");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    const pendingCreate = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/prompt-conversations");
    await login(page, email);
    const created = await pendingCreate;
    expect(created.status()).toBe(202);
    expect(created.request().postDataJSON()).toMatchObject({ mode: "smart" });
    const initial = (await created.json()).data as { conversation_id: string };
    const panel = page.getByRole("complementary", { name: "提示词创作对话", exact: true });
    const progress = panel.getByRole("progressbar", { name: "预计生成进度" });
    await expect(progress).toBeVisible({ timeout: 25_000 });
    await expect(panel.getByRole("status")).toContainText("正在生成图片");
    await expect(progress).toHaveText(/^\d+%$/);
    const stage = progress.locator("..");
    const dots = stage.locator('[aria-hidden="true"]');
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      await expect.poll(() => dots.evaluate(element => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
      await dots.evaluate(element => { element.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 0; }); });
      const firstFrame = await stage.screenshot({ mask: [progress], animations: "allow" });
      await dots.evaluate(element => { element.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = 1000; }); });
      const secondFrame = await stage.screenshot({ mask: [progress], animations: "allow" });
      expect(await animatedPixelCount(firstFrame, secondFrame)).toBeGreaterThan(100);
    }
    await expect(page.getByRole("combobox", { name: "创作模式" })).toHaveCount(0);
    await expect(page.getByText("继续上次创作")).toHaveCount(0);
    await expect.poll(async () => (await metrics(request, email)).calls).toBe(2);
    await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
    await panel.screenshot({ path: info.outputPath("image-loading-light.png"), animations: "disabled" });
    await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    await panel.screenshot({ path: info.outputPath("image-loading-dark.png"), animations: "disabled" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(panel.getByRole("progressbar", { name: "预计生成进度" })).toBeVisible();
    await expect.poll(() => dots.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await control(request, email, "release");
    const images = panel.getByRole("img", { name: "生成的图片", exact: true });
    await expect(images).toHaveCount(1, { timeout: 25_000 });
    await expect(images.first()).toBeVisible();
    const firstDetailResponse = await page.request.get(`/api/prompt-conversations/${initial.conversation_id}`);
    expect(firstDetailResponse.status()).toBe(200);
    const firstDetail = (await firstDetailResponse.json()).data;
    const firstImageId = firstDetail.turns[0].generated_image.id as string;
    expect(firstDetail.turns[0]).toMatchObject({ status: "succeeded", response_type: "image" });
    await panel.screenshot({ path: info.outputPath("image-real-result.png"), animations: "disabled" });
    await panel.getByRole("button", { name: "编辑图片", exact: true }).first().click();
    await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill("把天空改成晚霞");
    const next = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/prompt-conversations/${initial.conversation_id}/messages`);
    await panel.getByRole("button", { name: "发送", exact: true }).click();
    const nextResponse = await next;
    expect(nextResponse.status()).toBe(202);
    expect(nextResponse.request().postDataJSON()).toMatchObject({ mode: "smart", generated_image_id: firstImageId });
    await expect(images).toHaveCount(2, { timeout: 25_000 });
    const secondDetail = (await (await page.request.get(`/api/prompt-conversations/${initial.conversation_id}`)).json()).data;
    const secondTurnId = secondDetail.turns[1].id as string;
    await panel.getByRole("button", { name: "编辑图片", exact: true }).first().click();
    await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill("从第一张图增加一朵小花");
    const olderEdit = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/prompt-conversations/${initial.conversation_id}/messages`);
    await panel.getByRole("button", { name: "发送", exact: true }).click();
    const olderResponse = await olderEdit;
    expect(olderResponse.status()).toBe(202);
    expect(olderResponse.request().postDataJSON()).toMatchObject({ mode: "smart", generated_image_id: firstImageId, parent_analysis_id: secondTurnId });
    await expect(images).toHaveCount(3, { timeout: 25_000 });
    const actual = await metrics(request, email);
    expect(actual.calls).toBe(6);
    expect(actual.image_calls).toBe(4);
    expect(actual.statuses).toEqual(["succeeded", "succeeded", "succeeded"]);
    const download = await page.request.get(`/api/prompt-conversations/${initial.conversation_id}/images/${firstImageId}/download`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("image/");
    await control(request, email, "next-vision", "reply");
    await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill("你好");
    await panel.getByRole("button", { name: "发送", exact: true }).click();
    await expect(panel.getByText("你好！可以随便聊聊，也可以一起讨论创作。")).toBeVisible({ timeout: 25_000 });
    expect((await metrics(request, email)).conversation_calls.at(-1)).toEqual({ mode: "smart", has_image: false });
    await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill("这张图是什么");
    await panel.getByRole("button", { name: "发送", exact: true }).click();
    await expect(panel.getByText("这是一张粉色的图片。")).toBeVisible({ timeout: 25_000 });
    expect((await metrics(request, email)).conversation_calls.slice(-2)).toEqual([
      { mode: "smart", has_image: false },
      { mode: "auto", has_image: true },
    ]);
    await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill("画一辆蓝色火车");
    await panel.getByRole("button", { name: "发送", exact: true }).click();
    await expect(images).toHaveCount(4, { timeout: 25_000 });
    const newImagePrompt = (await metrics(request, email)).image_prompts.at(-1)!;
    expect(newImagePrompt).toContain("蓝色火车");
    expect(newImagePrompt).not.toContain("小猫");
    expect(newImagePrompt).not.toContain("晚霞");
    await panel.getByRole("button", { name: "历史", exact: true }).click();
    await panel.getByRole("button", { name: "画一只在海边散步的小猫", exact: true }).click();
    await expect(images).toHaveCount(4);
    await page.screenshot({ path: info.outputPath("image-real-history.png"), fullPage: true, animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await control(request, email, "release"); }
});

test("smart input can answer casual conversation without generating an image", async ({ page, request }, info) => {
  const email = `sample+chat-${info.project.name}-${randomUUID().slice(0, 8)}@example.test`;
  await control(request, email, "next-vision", "reply");
  await page.goto("/zh");
  await page.getByRole("textbox", { name: "描述想生成的画面，或直接聊天", exact: true }).fill("你好，今天心情很好");
  const pendingCreate = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/prompt-conversations");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await login(page, email);
  const created = await pendingCreate;
  expect(created.request().postDataJSON()).toMatchObject({ mode: "smart" });
  const panel = page.getByRole("complementary", { name: "提示词创作对话", exact: true });
  await expect(panel.getByText("你好！可以随便聊聊，也可以一起讨论创作。")).toBeVisible({ timeout: 25_000 });
  expect((await metrics(request, email)).calls).toBe(1);
  await expect(panel.getByRole("img", { name: "生成的图片" })).toHaveCount(0);
  await expect(panel.getByRole("progressbar")).toHaveCount(0);
});
