import { expect, test } from "@playwright/test";

test("手机可发现所有模板，并在配置与预览之间返回", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "This flow verifies the mobile layout.");
  await page.goto("/character-setting");

  const templatesLink = page.getByRole("link", { name: "提示词与模板" });
  await expect(templatesLink).toBeInViewport();
  await templatesLink.click();
  const templates = page.getByRole("navigation", { name: "选择模板" });
  for (const name of ["基础角色设定板", "三视图设定板", "表情设定板", "服装设定板", "短剧剧照", "连续分镜剧照"]) {
    await expect(templates.getByRole("button", { name, exact: true })).toBeInViewport();
  }

  await page.getByRole("link", { name: "查看预览" }).click();
  const preview = page.getByLabel("提示词内容", { exact: true });
  await expect(preview).toBeInViewport();
  expect(await preview.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  await expect(page.getByRole("button", { name: "复制提示词", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "复制当前内容", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回配置" }).click();
  await expect(page.getByRole("heading", { name: "角色配置" })).toBeInViewport();
});
