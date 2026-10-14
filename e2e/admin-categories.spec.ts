import { test, expect } from "@playwright/test";

// Use tests.category_e2e_app (isolated PostgreSQL schema) at localhost:8000,
// admin Vite at localhost:5176, and explicitly set AIGC_ADMIN_E2E_URL.
const adminUrl = process.env.AIGC_ADMIN_E2E_URL;
test("admin reads historical keys and selects zero-stock categories for edit and review", async ({page}, info) => {
  test.skip(!adminUrl, "Explicit disposable admin fixture required");
  const target = new URL(adminUrl!);
  expect(["127.0.0.1", "localhost"]).toContain(target.hostname);
  await page.addInitScript(() => sessionStorage.setItem("admin_key", "test-admin"));
  await page.goto(`${adminUrl}/prompts`);
  await expect(page.getByRole("heading", {name:"内容管理"})).toBeVisible();
  const filter = page.getByRole("combobox", {name:"分类筛选"});
  await expect(filter.locator("option")).toHaveCount(13);
  const row = page.getByRole("row").filter({hasText:`未迁移旧分类 ${info.project.name}`});
  await expect(row).toBeVisible();
  await row.getByRole("button", {name:"编辑", exact:true}).click();
  const modal = page.locator(".modal");
  const picker = modal.getByRole("combobox", {name:"分类", exact:true});
  await expect(picker).toHaveValue("workflow");
  await expect(picker.locator('option[value="workflow"]')).toBeDisabled();
  await expect(picker.locator('option[value="product"]')).toBeEnabled();
  await picker.selectOption("product");
  await expect(picker).toHaveValue("product");
  await modal.getByRole("button", {name:"✕"}).click();
  await filter.selectOption("product");
  await expect(page.getByText("暂无内容", {exact:true})).toBeVisible();
  await page.goto(`${adminUrl}/crawl-drafts`);
  const draft = page.getByRole("row").filter({hasText:`未迁移旧草稿 ${info.project.name}`});
  await expect(draft).toBeVisible();
  await draft.getByRole("button", {name:"查看/审核"}).click();
  await expect(page.locator(".modal").getByRole("combobox", {name:"分类", exact:true})).toHaveValue("image_edit");
  await expect(page.locator(".modal").getByRole("combobox", {name:"分类", exact:true}).locator('option[value="branding"]')).toBeEnabled();
  await page.goto(`${adminUrl}/submissions`);
  const submission = page.getByRole("article").filter({hasText:`待审核投稿 ${info.project.name}`});
  await expect(submission).toBeVisible();
  await submission.getByRole("combobox", {name:"分类", exact:true}).selectOption("branding");
  const approval = page.waitForResponse(response => response.url().includes("/approve") && response.request().method()==="POST");
  await submission.getByRole("button", {name:"通过并发布"}).click();
  const response = await approval;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({category:"branding"});
  await expect(page.getByRole("status").filter({hasText:"审核通过"})).toBeVisible();
});
