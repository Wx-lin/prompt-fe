import { expect, test, type Page } from '@playwright/test';

// python3 e2e/helpers/upload-fixture.py; run Next with API_BASE_URL=http://127.0.0.1:8017.
test.skip(process.env.UPLOAD_FIXTURE !== '1', 'Requires isolated localhost signed-in API fixture');

async function menusStayOnscreen(page: Page) {
  await expect.poll(() => page.getByRole('menu').evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1'))).toBe(true);
  const menus = page.getByRole('menu');
  for (const menu of await menus.all()) {
    if (!(await menu.isVisible())) continue;
    const bounds = await menu.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}

test('account appearance and language menus retain state and fit viewport', async ({ page, context }, info) => {
  await context.addCookies([{ name: 'aigc_session', value: 'local-fixture-only', url: 'http://127.0.0.1:3000' }]);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/publish?source=menu-check');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '用户菜单' }).click();
  await expect(page.getByRole('menuitem', { name: /我的收藏/ })).toBeVisible();
  await expect.poll(() => page.getByRole('menuitem', { name: /我的收藏/ }).locator('svg').evaluate(element => getComputedStyle(element).fill)).not.toBe('none');
  await menusStayOnscreen(page);
  await page.getByRole('menuitem', { name: /主题|外观/ }).click();
  await menusStayOnscreen(page);
  await page.getByRole('menuitemradio', { name: /暗黑模式/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '用户菜单' }).click();
  await menusStayOnscreen(page);
  await page.screenshot({ path: `/tmp/account-${info.project.name}-dark.png` });
  await page.getByRole('menuitem', { name: /主题|外观/ }).click();
  await expect(page.getByRole('menuitemradio', { name: /跟随系统/ })).toBeVisible();
  await menusStayOnscreen(page);
  await page.screenshot({ path: `/tmp/account-${info.project.name}-appearance-dark.png` });
  await page.getByRole('menuitemradio', { name: /跟随系统/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '用户菜单' }).click();
  await page.getByRole('menuitem', { name: /语言/ }).click();
  await menusStayOnscreen(page);
  await page.screenshot({ path: `/tmp/account-${info.project.name}-language-light.png` });
  if (info.project.name === 'mobile') {
    await page.getByRole('menuitem', { name: '返回' }).click();
    await expect(page.getByRole('menuitem', { name: /我的收藏/ })).toBeVisible();
    await page.getByRole('menuitem', { name: /语言/ }).click();
    await expect(page.getByRole('menuitemradio', { name: /简体中文/ })).toBeFocused();
    await page.setViewportSize({ width: 820, height: 844 });
    await expect(page.getByRole('menuitem', { name: /我的收藏/ })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('menuitem', { name: /语言/ }).click();
  }
  await page.getByRole('menuitemradio', { name: /English/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/publish\?source=menu-check/);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
});
