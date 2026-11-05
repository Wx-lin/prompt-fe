import { expect, test } from "@playwright/test";

test("访客输入角色描述，移动悬浮条，登录提示和刷新后草稿保留", async ({ page }, info) => {
  let paidRequests = 0;
  await page.route("**/api/character-interpret", async (route) => { paidRequests += 1; await route.abort(); });
  await page.route("**/api/character-preview", async (route) => { paidRequests += 1; await route.abort(); });
  await page.goto("/character-setting?new=1");

  const input = page.getByRole("textbox", { name: "描述角色，AI 快速创建" });
  const send = page.getByRole("button", { name: "生成角色", exact: true });
  const move = page.getByRole("button", { name: "移动输入框，可使用方向键" });
  const bar = move.locator("..");
  await expect(input).toBeVisible();
  await expect(send).toBeDisabled();
  await input.fill("25岁中国女生，黑色长发\n穿灰色T恤和牛仔裤");
  await expect(send).toBeEnabled();
  const before = await bar.boundingBox();
  expect(before).not.toBeNull();
  await move.focus();
  await move.press("ArrowRight");
  const after = await bar.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x - before!.x).toBeCloseTo(10, 0);
  await expect(bar).toBeInViewport();
  await page.screenshot({ path: info.outputPath("character-ai-composer.png") });
  const unobstructed = await input.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return target === node || node.contains(target);
  });
  expect(unobstructed, "输入框的可见区域不应被固定底栏遮挡").toBe(true);

  await send.click();
  await expect(page.getByRole("dialog")).toContainText("登录后生成角色预览");
  expect(paidRequests).toBe(0);
  await page.getByRole("button", { name: "稍后再说" }).click();
  await page.reload();
  await expect(input).toHaveValue("25岁中国女生，黑色长发\n穿灰色T恤和牛仔裤");
  expect(paidRequests).toBe(0);
});

test("悬浮条可在角色预览内拖动", async ({ page }, info) => {
  await page.goto("/character-setting?new=1");
  await expect(page.getByRole("heading", { name: "创建角色", exact: true })).toBeVisible();
  const handle = page.getByRole("button", { name: "移动输入框，可使用方向键" });
  const bar = handle.locator("..");
  await handle.scrollIntoViewIfNeeded();
  const point = await handle.boundingBox();
  const before = await bar.boundingBox();
  expect(point).not.toBeNull();
  expect(before).not.toBeNull();
  const x = point!.x + point!.width / 2;
  const y = point!.y + point!.height / 2;
  if (info.project.name === "mobile") {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 35, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 35, { steps: 5 });
    await page.mouse.up();
  }
  await expect.poll(async () => (await bar.boundingBox())!.y).toBeLessThan(before!.y - 20);
});
