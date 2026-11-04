import { expect, test } from '@playwright/test';

const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('可视化调整脸型、发型、体型及表情后，无需选服装即可预览', async ({ page, context, baseURL }) => {
  test.skip(process.env.CHARACTER_AUTH_FIXTURE !== '1', 'Requires isolated character auth fixture');
  await context.addCookies([{ name: 'aigc_session', value: 'character-test-session', url: baseURL! }]);
  const requests: Array<{ prompt?: string }> = [];
  await page.route('**/api/character-preview', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: { image_base64: pixel, mime_type: 'image/png' } } });
  });
  await page.goto('/character-setting');
  const workbench = page.getByRole('region', { name: '角色造型工作台' });
  const nav = workbench.getByRole('navigation', { name: '角色调整' });
  await expect(workbench.getByText('登录后可生成')).toHaveCount(0);

  await nav.getByRole('button', { name: '脸部与发型', exact: true }).click();
  await workbench.getByRole('button', { name: '圆脸', exact: true }).click();
  await expect(workbench.getByRole('button', { name: '圆脸', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await workbench.getByRole('button', { name: '发型', exact: true }).first().click();
  await workbench.getByRole('button', { name: '马尾', exact: true }).click();
  await expect(workbench.getByRole('button', { name: '马尾', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await nav.getByRole('button', { name: '身材与皮肤', exact: true }).click();
  await workbench.getByRole('button', { name: '健壮', exact: true }).click();
  await expect(workbench.getByRole('button', { name: '健壮', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await nav.getByRole('button', { name: '表情与动作', exact: true }).click();
  await workbench.getByRole('button', { name: '预览 愤怒', exact: true }).click();
  await expect(workbench.getByRole('button', { name: '预览 愤怒', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await workbench.getByRole('button', { name: '动作', exact: true }).click();
  await workbench.getByRole('button', { name: '行走', exact: true }).click();
  await expect(workbench.getByRole('button', { name: '行走', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(workbench.getByAltText('角色示例图')).toBeVisible();
  expect(requests).toHaveLength(0);
  await workbench.getByRole('button', { name: '确认生成', exact: true }).click();
  await expect(workbench.getByAltText('AI 生成的角色预览')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].prompt).toContain('脸型：圆脸');
  expect(requests[0].prompt).toContain('发型：马尾');
  expect(requests[0].prompt).toContain('体型：健壮');
  expect(requests[0].prompt).toContain('预览表情：愤怒');
  expect(requests[0].prompt).toContain('动作：行走');
  expect(requests[0].prompt).not.toContain('表情：平静，微笑');
  expect(requests[0].prompt).not.toContain('基础表情：平静');
});

test('撤销套装只恢复套装字段，不覆盖后来修改的角色配置', async ({ page }) => {
  await page.goto('/character-setting');
  const workbench = page.getByRole('region', { name: '角色造型工作台' });
  await workbench.getByRole('button', { name: '经典西装' }).click();
  await workbench.getByRole('navigation', { name: '角色调整' }).getByRole('button', { name: '基础信息' }).click();
  await workbench.getByRole('textbox', { name: '角色姓名' }).fill('测试角色');
  await page.getByRole('button', { name: '撤销替换' }).click();
  await expect(workbench.getByRole('textbox', { name: '角色姓名' })).toHaveValue('测试角色');
  await workbench.getByRole('navigation', { name: '角色调整' }).getByRole('button', { name: '服装与妆饰' }).click();
  await expect(workbench.getByRole('button', { name: '经典西装' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByText('高级设置与提示词预览', { exact: true }).click();
  await expect(page.getByRole('region', { name: '提示词预览' })).toContainText('运动背心');
});
