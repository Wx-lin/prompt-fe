import { expect, test } from '@playwright/test';
// python3 e2e/helpers/recommendations-fixture.py; Next API_BASE_URL=http://127.0.0.1:8018 AIGC_DEMO_MODE=false.
test.skip(process.env.RECOMMENDATIONS_FIXTURE !== '1', 'Requires isolated localhost similar-prompts API fixture');
const id = (number: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(number).padStart(12, '0')}`;

test('direct detail uses valid real recommendations and navigates their IDs', async ({ page }, info) => {
  await page.goto(`/prompt/${id(1)}`);
  await expect(page.getByRole('heading', { name: '真实推荐作品 1', exact: true })).toBeVisible();
  const section = page.getByRole('heading', { name: '猜你喜欢', exact: true }).locator('..');
  await expect(section.locator('a')).toHaveCount(3);
  await expect(section.getByRole('link', { name: '真实推荐作品 1' })).toHaveCount(0);
  for (const number of [2, 3, 4]) await expect(section.getByRole('link', { name: `真实推荐作品 ${number}` })).toHaveAttribute('href', `/prompt/${id(number)}`);
  await expect(section.getByText('坏数据')).toHaveCount(0);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/recommendations-direct-${info.project.name}.png` });
  await section.getByRole('link', { name: '真实推荐作品 2' }).click();
  await expect(page).toHaveURL(`/prompt/${id(2)}`);
  await expect(page.getByRole('heading', { name: '真实推荐作品 2', exact: true })).toBeVisible();
});

test('gallery intercepted detail modal gets similar API recommendations', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: '查看提示词：真实推荐作品 1' }).first().click();
  await expect(page).toHaveURL(`/prompt/${id(1)}`);
  await expect(page.getByRole('navigation', { name: '提示词分类' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '猜你喜欢', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '真实推荐作品 3' })).toHaveAttribute('href', `/prompt/${id(3)}`);
  await page.screenshot({ path: `/tmp/recommendations-modal-${info.project.name}.png` });
});

for (const number of [5, 6]) test(`empty or failed similar API hides recommendations (${number})`, async ({ page }) => {
  await page.goto(`/prompt/${id(number)}`);
  await expect(page.getByRole('heading', { name: `真实推荐作品 ${number}`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '猜你喜欢', exact: true })).toHaveCount(0);
  await expect(page.getByText('春日樱花少女，电影感人像')).toHaveCount(0);
});
