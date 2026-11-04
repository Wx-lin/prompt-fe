import { expect, test } from "@playwright/test";

test("角色草稿在浏览器后退和前进后恢复", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "角色设定" }).click();
  await page.getByLabel("角色姓名").fill("浏览器回退测试角色");
  await expect(page.getByLabel("提示词内容")).toContainText("浏览器回退测试角色");
  await page.goBack();
  await page.goForward();
  await expect(page.getByLabel("角色姓名")).toHaveValue("浏览器回退测试角色");
  await expect(page.getByLabel("提示词内容")).toContainText("浏览器回退测试角色");
});
