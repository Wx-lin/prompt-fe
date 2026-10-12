import { expect, test } from "@playwright/test";

test("gallery filters expose distinct accessible names", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "排序方式", exact: true })).toHaveText("最新");
  await expect(page.getByRole("combobox", { name: "模型", exact: true })).toHaveText("全部模型");
});

test("filter menus open below their triggers and remain inside the viewport", async ({ page }) => {
  await page.goto("/");

  for (const currentValue of ["最新", "全部模型"]) {
    const trigger = page.getByRole("combobox").filter({ hasText: currentValue });
    await trigger.click();
    const popup = page.getByRole("listbox");
    await expect(popup).toBeVisible();
    const triggerBounds = await trigger.boundingBox();
    const popupBounds = await popup.boundingBox();
    expect(triggerBounds).not.toBeNull();
    expect(popupBounds).not.toBeNull();
    expect(popupBounds!.y).toBeGreaterThanOrEqual(triggerBounds!.y + triggerBounds!.height);
    expect(popupBounds!.x).toBeGreaterThanOrEqual(0);
    expect(popupBounds!.x + popupBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test("selecting and resetting filters retains the other query parameters", async ({ page }) => {
  await page.goto("/?category=portrait");
  const sort = page.getByRole("combobox").filter({ hasText: "最新" });
  await sort.click();
  await page.getByRole("option", { name: "最受欢迎", exact: true }).click();
  await expect(page).toHaveURL(/sort=popular/);

  const model = page.getByRole("combobox").filter({ hasText: "全部模型" });
  await model.click();
  await page.getByRole("option", { name: "Stable Diffusion", exact: true }).click();
  await expect(page).toHaveURL(/models=Stable\+Diffusion/);
  await expect(model).not.toBeVisible();
  const selectedModel = page.getByRole("combobox").filter({ hasText: "Stable Diffusion" });
  await expect(selectedModel).toBeVisible();
  await selectedModel.click();
  await expect(page.getByRole("option", { name: "Stable Diffusion", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("option", { name: "全部模型", exact: true }).click();
  await expect(page.getByRole("combobox").filter({ hasText: "全部模型" })).toBeVisible();

  const query = new URL(page.url()).searchParams;
  expect(query.get("category")).toBe("portrait");
  expect(query.get("sort")).toBe("popular");
  expect(query.has("models")).toBe(false);
});

test("keyboard selection and outside dismissal use the library interactions", async ({ page }) => {
  await page.goto("/");
  const sort = page.getByRole("combobox").filter({ hasText: "最新" });
  await sort.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/sort=popular/);
  await expect(page.getByRole("listbox")).toBeHidden();
  const model = page.getByRole("combobox").filter({ hasText: "全部模型" });
  await model.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.locator("body").click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(model).toBeFocused();
});
