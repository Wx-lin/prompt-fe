import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";

test.skip(process.env.AIGC_IMAGE_MOCK_E2E !== "1", "Requires isolated loopback auth/gallery fixture and mocked image conversation API");
test.setTimeout(90_000);

const conversationId = "cc111111-1111-4111-8111-111111111111";
const firstId = "aa111111-1111-4111-8111-111111111111";
const secondId = "aa222222-2222-4222-8222-222222222222";
const thirdId = "aa333333-3333-4333-8333-333333333333";
const firstImageId = "bb111111-1111-4111-8111-111111111111";
const secondImageId = "bb222222-2222-4222-8222-222222222222";
const thirdImageId = "bb333333-3333-4333-8333-333333333333";
const date = "2026-11-03T00:00:00Z";
const expires = "2030-01-01T00:00:00Z";
const envelope = (data: unknown) => ({ success: true, data, error: null, request_id: "mock-image-e2e" });

function makeTurn(id: string, imageId: string, message: string, version: number, status: "queued" | "succeeded", parentId: string | null) {
  return {
    id, asset_id: null, input_type: "text", idea_text: message, purpose: null, style: null,
    conversation_id: conversationId, parent_analysis_id: parentId, user_message: message, version,
    generation_mode: "smart", status, phase: status === "queued" ? "queued" : "complete", revision: 0,
    created_at: date, finished_at: status === "succeeded" ? date : null, title: "海边小猫", error_code: null,
    history_retain_until: expires, image_available: false, preview_url: null, thumbnail_url: null, preview_expires_at: null,
    result: null, prompt: null, saved_to_history: status === "succeeded", response_type: status === "succeeded" ? "image" : null,
    assistant_reply: null, prompt_number: null,
    generated_image: status === "succeeded" ? { id: imageId, url: `/mock-image-${version}.webp`, expires_at: expires, width: 1024, height: 1536 } : null,
  };
}

async function login(page: Page, email: string) {
  await page.getByLabel("邮箱地址", { exact: true }).fill(email);
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await page.getByLabel("邮箱验证码", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "验证并登录", exact: true }).click();
}

test.beforeAll(async ({ request, baseURL }) => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  const fixture = process.env.AIGC_PROMPT_FIXTURE_URL ?? "http://127.0.0.1:8038";
  expect(["127.0.0.1", "localhost"]).toContain(new URL(fixture).hostname);
  const health = await request.get(`${fixture}/health`);
  expect(await health.json()).toMatchObject({ isolated_fixture: true, worker_running: true });
});

test("queued image completes, an older result can be edited, and history restores images", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const firstMessage = "画一只在海边散步的小猫";
  const secondMessage = "保留小猫，把天空改成晚霞";
  const thirdMessage = "基于第一张图加一朵小花";
  const sent: Record<string, unknown>[] = [];
  let released = false;
  let turns: ReturnType<typeof makeTurn>[] = [];
  const reply = async (route: Route, data: unknown, status = 200) => route.fulfill({ status, json: envelope(data) });
  await page.route("**/mock-image-*.webp", route => route.fulfill({ path: "public/character-library/drama-07-01-hd.webp", contentType: "image/webp" }));
  await page.route("**/api/prompt-conversations**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/prompt-conversations") {
      sent.push(request.postDataJSON());
      turns = [makeTurn(firstId, firstImageId, firstMessage, 1, "queued", null)];
      return reply(route, turns[0], 202);
    }
    if (request.method() === "POST" && path === `/api/prompt-conversations/${conversationId}/messages`) {
      sent.push(request.postDataJSON());
      const next = sent.length === 2
        ? makeTurn(secondId, secondImageId, secondMessage, 2, "succeeded", firstId)
        : makeTurn(thirdId, thirdImageId, thirdMessage, 3, "succeeded", secondId);
      turns = [...turns, next];
      return reply(route, next, 202);
    }
    if (request.method() === "GET" && path === "/api/prompt-conversations") {
      return reply(route, { items: [{ id: conversationId, title: "海边小猫", status: "succeeded", created_at: date, updated_at: date, latest_analysis_id: turns.at(-1)?.id, version: turns.length }], pagination: { limit: 20, has_more: false, next_cursor: null } });
    }
    if (request.method() === "GET" && path === `/api/prompt-conversations/${conversationId}`) {
      if (released && turns.length === 1) turns = [makeTurn(firstId, firstImageId, firstMessage, 1, "succeeded", null)];
      return reply(route, { id: conversationId, title: "海边小猫", created_at: date, updated_at: date, turns });
    }
    return route.abort("failed");
  });
  await page.goto("/zh");
  await page.getByRole("textbox", { name: "描述想生成的画面，或直接聊天", exact: true }).fill(firstMessage);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await login(page, `sample+image-${info.project.name}-${randomUUID().slice(0, 8)}@example.test`);
  const panel = page.getByRole("complementary", { name: "提示词创作对话", exact: true });
  await expect(panel).toContainText(firstMessage);
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ mode: "smart", message: firstMessage });
  await expect(panel.getByRole("status")).toContainText(/生成|排队/);
  await expect(panel.getByRole("img", { name: "生成的图片", exact: true })).toHaveCount(0);
  await panel.screenshot({ path: info.outputPath("image-queued.png"), animations: "disabled" });
  released = true;
  const images = panel.getByRole("img", { name: "生成的图片", exact: true });
  await expect(images).toHaveCount(1, { timeout: 15_000 });
  await expect(images.first()).toBeVisible();
  await expect(panel.getByRole("link", { name: "下载图片", exact: true })).toHaveAttribute("href", new RegExp(`${conversationId}/images/${firstImageId}/download`));
  await panel.screenshot({ path: info.outputPath("image-result.png"), animations: "disabled" });
  await panel.getByRole("button", { name: "放大图片", exact: true }).first().click();
  const viewer = page.getByRole("dialog", { name: "生成的图片", exact: true });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await panel.getByRole("button", { name: "编辑图片", exact: true }).first().click();
  await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill(secondMessage);
  await panel.getByRole("button", { name: "发送", exact: true }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({ mode: "smart", message: secondMessage, generated_image_id: firstImageId, parent_analysis_id: firstId });
  await expect(images).toHaveCount(2);
  await panel.getByRole("button", { name: "编辑图片", exact: true }).first().click();
  await panel.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图", exact: true }).fill(thirdMessage);
  await panel.getByRole("button", { name: "发送", exact: true }).click();
  await expect.poll(() => sent.length).toBe(3);
  expect(sent[2]).toMatchObject({ mode: "smart", message: thirdMessage, generated_image_id: firstImageId, parent_analysis_id: secondId });
  await expect(images).toHaveCount(3);
  await panel.getByRole("button", { name: "历史", exact: true }).click();
  await panel.getByRole("button", { name: "海边小猫", exact: true }).click();
  await expect(images).toHaveCount(3);
  expect(sent).toHaveLength(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("image-conversation.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
