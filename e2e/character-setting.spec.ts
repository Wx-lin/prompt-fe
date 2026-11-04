import { expect, test } from "@playwright/test";

test.use({ actionTimeout: 5000 });

test("搜索选项能定位配置，清除搜索后保留已展开的分组", async ({ page }) => {
  await page.goto("/character-setting");
  await page.getByRole("region", { name: "角色设置" }).getByText("脸部五官", { exact: true }).click();
  const search = page.getByRole("textbox", { name: "搜索配置项" });
  await search.fill("短发");
  await expect(page.getByRole("region", { name: "角色设置" }).locator("summary").getByText("发型", { exact: true })).toBeVisible();
  await expect(page.getByText("头发长度", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(page.getByRole("combobox", { name: "脸型", exact: true })).toBeVisible();
});

test("搜索与自定义不会误改配置，多选的无与其他选项互斥", async ({ page }) => {
  await page.goto("/character-setting");
  const occupation = page.getByRole("combobox", { name: "职业／身份", exact: true });
  const preview = page.getByLabel("提示词内容", { exact: true });
  await occupation.click();
  await occupation.pressSequentially("摄影");
  await expect(page.getByRole("option", { name: "摄影师", exact: true })).toBeVisible();
  await occupation.press("Enter");
  await expect(occupation).toHaveValue("摄影师");
  await expect(preview).toContainText("职业／身份：摄影师");
  await occupation.fill("不完整搜索");
  const heading = await page.locator("h2").filter({ hasText: "角色配置" }).boundingBox();
  expect(heading).not.toBeNull();
  await page.mouse.click(heading!.x + 5, heading!.y + 5);
  await expect(occupation).toHaveValue("摄影师");
  await occupation.click();
  await occupation.pressSequentially("星际地图绘制师");
  await occupation.press("Tab");
  await expect(occupation).toHaveValue("星际地图绘制师");
  await expect(preview).toContainText("职业／身份：星际地图绘制师");

  await page.getByRole("region", { name: "角色设置" }).getByText("脸部五官", { exact: true }).click();
  const marks = page.getByRole("region", { name: "角色设置" }).locator("details").filter({ hasText: "特色标记" });
  await marks.getByRole("button", { name: "无", exact: true }).click();
  await expect(marks.getByRole("button", { name: "眼角痣", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(preview).not.toContainText("眼角痣，无");
  const description = page.getByLabel("补充描述", { exact: true });
  await expect(description).toHaveValue("");
  await description.pressSequentially("戴眼镜");
  await expect(preview).toContainText("补充描述：戴眼镜");
});

test("有默认值的配置下拉可浏览全部选项并选择", async ({ page }) => {
  await page.goto("/character-setting");
  const gender = page.getByRole("combobox", { name: "性别", exact: true });
  await expect(gender).toHaveValue("女性");
  await page.getByRole("button", { name: "展开性别选项" }).click();
  await expect(page.getByRole("option", { name: "女性", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "男性", exact: true }).click();
  await expect(gender).toHaveValue("男性");
  await expect(page.getByLabel("提示词内容", { exact: true })).toContainText("性别：男性");
  const occupation = page.getByRole("combobox", { name: "职业／身份", exact: true });
  await occupation.fill("摄影");
  await expect(page.getByRole("option", { name: "摄影师", exact: true })).toBeVisible();
  await occupation.press("Escape");
  await expect(occupation).toHaveValue("演员");
  await expect(page.getByLabel("提示词内容", { exact: true })).toContainText("职业／身份：演员");
});

test("新访客能直接看到角色配置默认值，重置及撤销保留用户输入", async ({ page }) => {
  await page.goto("/character-setting");
  const occupation = page.getByRole("combobox", { name: /^职业／身份/ });
  const initialOccupation = await occupation.inputValue();
  expect(initialOccupation.trim()).not.toBe("");
  await page.getByRole("region", { name: "角色设置" }).getByText("脸部五官", { exact: true }).click();
  const face = page.getByRole("combobox", { name: /^脸型/ });
  expect((await face.inputValue()).trim()).not.toBe("");
  await page.getByRole("region", { name: "角色设置" }).locator("summary").getByText("发型", { exact: true }).click();
  const hairColor = page.getByRole("combobox", { name: /^发色/ });
  expect((await hairColor.inputValue()).trim()).not.toBe("");
  await page.getByRole("region", { name: "角色设置" }).getByText("身材体态", { exact: true }).click();
  expect((await page.getByRole("combobox", { name: /^体型/ }).inputValue()).trim()).not.toBe("");
  await page.getByRole("region", { name: "角色设置" }).getByText("服装造型", { exact: true }).click();
  expect((await page.getByRole("combobox", { name: /^上身/ }).inputValue()).trim()).not.toBe("");
  await page.getByText("镜头摄影", { exact: true }).click();
  expect((await page.getByRole("combobox", { name: /^焦段/ }).inputValue()).trim()).not.toBe("");
  await occupation.fill("");
  await occupation.press("Enter");
  await page.getByLabel("角色姓名", { exact: true }).fill("用户自己的角色");
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(occupation).toHaveValue(initialOccupation);
  await page.locator("summary").filter({ hasText: "预设管理" }).click();
  await page.getByRole("button", { name: "撤销替换", exact: true }).click();
  await expect(occupation).toHaveValue("");
  await expect(page.getByLabel("角色姓名", { exact: true })).toHaveValue("用户自己的角色");
});

test("浏览器后退和前进后恢复本标签页草稿", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "角色设定", exact: true }).click();
  const name = page.getByLabel("角色姓名", { exact: true });
  await name.fill("回退后保留的角色");
  await expect(page.getByLabel("提示词内容", { exact: true })).toContainText("回退后保留的角色");
  await page.goBack();
  await expect(page.getByRole("link", { name: "角色设定", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("角色姓名", { exact: true })).toHaveValue("回退后保留的角色");
});

test("角色配置可预览、切换模板，并完成预设与文件往返", async ({ page }, info) => {
  await page.goto("/character-setting");
  await expect(page.getByRole("heading", { name: "角色设定", exact: true })).toBeVisible();

  const name = page.getByLabel("角色姓名", { exact: true });
  const preview = page.getByLabel("提示词内容", { exact: true });
  await name.fill("测试角色青禾");
  await expect(preview).toContainText("测试角色青禾");
  await page.getByRole("button", { name: "三视图设定板", exact: true }).click();
  await expect(name).toHaveValue("测试角色青禾");
  await expect(preview).toContainText("三视图");
  await expect(preview).toContainText("测试角色青禾");

  await page.locator("summary").filter({ hasText: "预设管理" }).click();
  await page.getByLabel("预设名称", { exact: true }).fill("自动化角色");
  await page.getByRole("button", { name: "保存预设", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("本机");
  await name.fill("临时修改");
  await page.getByRole("button", { name: "应用预设", exact: true }).click();
  await expect(name).toHaveValue("测试角色青禾");
  await expect(preview).toContainText("测试角色青禾");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("character-setup.json");
  const downloadedFile = await download.path();
  expect(downloadedFile).toBeTruthy();
  await name.fill("导入前的角色");
  await page.locator('input[type="file"]').setInputFiles(downloadedFile!);
  await expect(name).toHaveValue("测试角色青禾");
  await expect(preview).toContainText("测试角色青禾");
  await expect(page.getByRole("button", { name: "三视图设定板", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(name).not.toHaveValue("测试角色青禾");
  await page.getByRole("button", { name: "撤销替换", exact: true }).click();
  await expect(name).toHaveValue("测试角色青禾");

  if (info.project.name === "mobile") {
    const quickPreview = page.getByRole("link", { name: "查看预览", exact: true });
    await expect(quickPreview).toBeVisible();
    await expect(page.getByRole("button", { name: "复制当前内容", exact: true })).toBeVisible();
    const before = await quickPreview.boundingBox();
    await page.evaluate(() => window.scrollTo(0, Math.max(0, document.body.scrollHeight / 3)));
    const after = await quickPreview.boundingBox();
    expect(before).not.toBeNull(); expect(after).not.toBeNull();
    expect(Math.abs(before!.y - after!.y)).toBeLessThan(3);
    await quickPreview.click();
    await expect(preview).toBeInViewport();
  }
  await page.screenshot({ path: info.outputPath("character-setting.png"), fullPage: true });
});
