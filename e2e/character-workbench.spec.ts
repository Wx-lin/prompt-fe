import { expect, test } from "@playwright/test";

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

// Authenticated tests require the isolated local fixture described in
// e2e/helpers/character-auth-fixture.py. Image generation is intercepted below.
test("选择完整套装后确认生成，配置变更时保留并标记旧预览", async ({ page, context, baseURL }) => {
  test.skip(process.env.CHARACTER_AUTH_FIXTURE !== "1", "Requires isolated character auth fixture");
  await context.addCookies([{ name: "aigc_session", value: "character-test-session", url: baseURL! }]);
  const requests: Array<{ prompt?: string; aspect_ratio?: string }> = [];
  await page.route("**/api/character-preview", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: { image_base64: pixel, mime_type: "image/png" } } });
  });
  await page.goto("/character-setting");
  const workbench = page.getByRole("region", { name: "角色造型工作台" });
  await expect(workbench.getByText("登录后可生成")).toHaveCount(0);
  const stage = workbench.getByAltText("角色示例图");
  await expect(stage).toBeVisible();
  await workbench.getByRole("button", { name: "经典西装" }).click();
  await expect(workbench.getByRole("button", { name: "经典西装" })).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toBeVisible();
  await workbench.getByRole("button", { name: "确认生成" }).click();
  await expect(workbench.getByAltText("AI 生成的角色预览")).toBeVisible();
  expect(requests[0]).toMatchObject({ aspect_ratio: "3:4" });
  expect(requests[0].prompt).toContain("黑色西装外套");
  await workbench.getByRole("button", { name: "温柔休闲" }).click();
  await expect(workbench.getByText("配置已更改，当前展示上次生成结果")).toBeVisible();
});

test("未登录时生成要求登录且不会发起生图请求", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/character-preview", async (route) => { calls++; await route.abort(); });
  await page.goto("/character-setting");
  const workbench = page.getByRole("region", { name: "角色造型工作台" });
  await expect(workbench.getByText("登录后可生成")).toBeVisible();
  await workbench.getByRole("button", { name: "确认生成" }).click();
  await expect(page.getByRole("dialog", { name: "登录后生成角色预览" })).toBeVisible();
  expect(calls).toBe(0);
});

test("服装风格和 AI 造型描述可切换", async ({ page }) => {
  await page.goto("/character-setting");
  const workbench = page.getByRole("region", { name: "角色造型工作台" });
  await workbench.getByRole("button", { name: "古风" }).click();
  await workbench.getByRole("button", { name: "粉色汉服" }).click();
  await expect(workbench.getByRole("button", { name: "粉色汉服" })).toHaveAttribute("aria-pressed", "true");
  await workbench.getByRole("tab", { name: "AI 生成" }).click();
  await workbench.getByLabel("补充描述").fill("搭配银色耳饰");
  await expect(workbench.getByText("将描述和所选服装一起用于生成。参考图上传暂未开放。")).toBeVisible();
});
