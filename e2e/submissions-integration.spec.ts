import { expect, test } from "@playwright/test";

test.skip(!process.env.AIGC_SUBMISSION_INTEGRATION, "Requires isolated submission fixture API");
const backend = "http://127.0.0.1:8100";

test("upload, submit, admin approve, and public detail share one real database", async ({ page, context, request }) => {
  await context.addCookies([{ name: "aigc_session", value: "test-session", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const title = `浏览器投稿-${test.info().project.name}-${Date.now()}`;
  await page.goto("/publish");
  await expect(page.getByRole("heading", { name: "发布作品", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/submission.png");
  await expect(page.getByRole("img", { name: "作品预览 1" })).toBeVisible();
  await page.getByLabel("作品标题").fill(title);
  await page.getByLabel("提示词", { exact: true }).fill("a pink abstract square");
  await page.getByRole("combobox", { name: "作品分类", exact: true }).click();
  await page.getByRole("option", { name: "人像写真", exact: true }).click();
  await page.getByRole("combobox", { name: "模型版本", exact: true }).click();
  await page.getByRole("option", { name: "Midjourney V6", exact: true }).click();
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page).toHaveURL(/\/my-works\?submitted=1/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const work = page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(work).toContainText("待审核");
  const listed = await request.get(`${backend}/api/submissions`, { headers: { Authorization: "Bearer test-session" } });
  const item = (await listed.json()).items.find((item: {title: string}) => item.title === title);
  expect((await request.get(`${backend}/api/prompts/${item.id}`)).status()).toBe(404);
  const original = item.image_urls[0].split("?")[0];
  expect((await request.get(original)).status()).toBe(404);
  const approved = await request.post(`${backend}/api/admin/submissions/${item.id}/approve`, { headers: { "X-Admin-Key": "test-admin" } });
  expect(approved.status()).toBe(200);
  expect((await request.get(original)).status()).toBe(200);
  await page.reload();
  await expect(work).toContainText("已公开");
  await page.goto(`/prompt/${item.id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Midjourney V6", { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: `/tmp/submission-public-${test.info().project.name}.png` });
});

test("admin review page approves and rejects submissions with reasons", async ({ page, request }) => {
  const title = `后台审核-${test.info().project.name}-${Date.now()}`;
  const upload = await request.post(`${backend}/api/submissions/upload`, {
    headers: { Authorization: "Bearer test-session" }, multipart: {file: {name:"work.png",mimeType:"image/png",buffer: await (await import("node:fs/promises")).readFile("e2e/fixtures/submission.png")}}
  });
  expect(upload.status()).toBe(201);
  const response = await request.post(`${backend}/api/submissions`, { headers: {Authorization:"Bearer test-session"}, data: {title,prompt_text:"a cat",description:"",category:"portrait",models:["Midjourney V6"],upload_ids:[(await upload.json()).id]} });
  expect(response.status()).toBe(201);
  const id = (await response.json()).id;
  await page.addInitScript(() => sessionStorage.setItem("admin_key", "test-admin"));
  await page.goto("http://127.0.0.1:5176/submissions");
  const card = page.getByRole("article", { name: title });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "拒绝投稿" })).toBeDisabled();
  await card.getByRole("button", { name: "通过并发布" }).click();
  await expect(page.getByText("审核通过，作品已发布。", {exact:true})).toBeVisible();
  await page.getByRole("combobox", { name: "审核状态" }).selectOption("approved");
  await expect(card).toBeVisible();
  expect((await request.get(`${backend}/api/prompts/${id}`)).status()).toBe(200);
  const secondUpload=await request.post(`${backend}/api/submissions/upload`, {headers:{Authorization:"Bearer test-session"},multipart:{file:{name:"work.png",mimeType:"image/png",buffer:await (await import("node:fs/promises")).readFile("e2e/fixtures/submission.png")}}});
  const second=await request.post(`${backend}/api/submissions`,{headers:{Authorization:"Bearer test-session"},data:{title:title+"拒绝",prompt_text:"a cat",description:"",category:"portrait",models:["Midjourney V7"],upload_ids:[(await secondUpload.json()).id]}});
  const rejectedId=(await second.json()).id;
  await page.getByRole("combobox",{name:"审核状态"}).selectOption("pending");
  const rejectCard=page.getByRole("article",{name:title+"拒绝"});
  await rejectCard.getByRole("textbox",{name:"拒绝原因"}).fill("请补充生成参数");
  await rejectCard.getByRole("button",{name:"拒绝投稿"}).click();
  await expect(page.getByText("已拒绝投稿并保存原因。", {exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"审核状态"}).selectOption("rejected");
  await expect(rejectCard).toContainText("请补充生成参数");
  expect((await request.get(`${backend}/api/prompts/${rejectedId}`)).status()).toBe(404);
  await page.screenshot({path:`/tmp/submission-admin-${test.info().project.name}.png`});
});
