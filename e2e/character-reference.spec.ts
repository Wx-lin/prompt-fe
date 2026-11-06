import { expect, test } from '@playwright/test';

const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('官方角色连续调整时使用当前预览图和本次修改', async ({ page, context, baseURL }) => {
  test.skip(process.env.CHARACTER_AUTH_FIXTURE !== '1', 'Requires isolated character auth fixture');
  await context.addCookies([{ name: 'aigc_session', value: 'character-test-session', url: baseURL! }]);
  const requests: Array<{ prompt: string; reference_image_base64?: string }> = [];
  await page.route('**/api/character-preview', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: { image_base64: pixel, mime_type: 'image/png' } } });
  });
  await page.goto('/character-setting?preset=urban-woman');
  const workbench = page.getByRole('region', { name: '角色造型工作台' });
  await expect(workbench.getByText('登录后可生成')).toHaveCount(0);
  await workbench.getByRole('button', { name: '发型', exact: true }).first().click();
  await workbench.getByRole('button', { name: '马尾', exact: true }).click();
  await workbench.getByRole('button', { name: '确认生成' }).click();
  await expect(workbench.getByAltText('AI 生成的角色预览')).toBeVisible();
  expect(requests[0].reference_image_base64?.length).toBeGreaterThan(100);
  expect(requests[0].prompt).toContain('马尾');
  await workbench.getByRole('button', { name: '发色', exact: true }).click();
  await workbench.getByRole('button', { name: '金色', exact: true }).click();
  await workbench.getByRole('button', { name: '确认生成' }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].reference_image_base64).toBe(pixel);
  expect(requests[1].prompt).toContain('金色');
  expect(requests[1].prompt).not.toContain('马尾');
});
