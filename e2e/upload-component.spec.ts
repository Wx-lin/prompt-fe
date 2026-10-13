import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Real Next page and BFF; opt-in localhost fixture replaces the backend only.
test.skip(process.env.UPLOAD_FIXTURE !== '1', 'Requires the isolated localhost API fixture');
// Start the localhost fixture: python3 e2e/helpers/upload-fixture.py;
// run Next with API_BASE_URL=http://127.0.0.1:8017, then UPLOAD_FIXTURE=1 npm run test:e2e -- upload-component.spec.ts.
const image = readFileSync('public/demo/portrait.jpg');

test('click, drop, paste, retry, remove and submit uploaded IDs', async ({ page, context }, testInfo) => {
  await context.addCookies([{ name: 'aigc_session', value: 'local-fixture-only', url: 'http://127.0.0.1:3000' }]);
  await page.goto('/publish');
  await page.waitForLoadState('networkidle');
  const zone = page.getByTestId('image-dropzone');
  const uploadedIds: string[] = [];
  page.on('response', async response => {
    if (response.url().endsWith('/api/submissions/upload') && response.ok()) uploadedIds.push((await response.json()).id);
  });
  const chooser = page.waitForEvent('filechooser');
  await zone.click();
  await (await chooser).setFiles({ name: 'click.png', mimeType: 'image/jpeg', buffer: image });
  await expect(page.getByAltText('作品预览 1')).toBeVisible();
  await page.getByLabel('作品标题', { exact: true }).fill('本地上传组件验收');
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(1);
  for (const kind of ['drop', 'paste']) {
    await zone.evaluate((element, data) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))], `${data.kind}.png`, { type: 'image/jpeg' }));
      element.dispatchEvent(data.kind === 'drop' ? new DragEvent('drop', { bubbles: true, dataTransfer: transfer }) : new ClipboardEvent('paste', { bubbles: true, clipboardData: transfer }));
    }, { kind, base64: image.toString('base64') });
  }
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(3);
  await page.getByLabel('作品图片', { exact: true }).setInputFiles({ name: 'fail.png', mimeType: 'image/jpeg', buffer: image });
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '提交审核' })).toBeDisabled();
  await page.route('**/api/submissions/upload', route => route.fulfill({ json: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', image_url: 'https://example.test/retry.png' } }));
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(4);
  await page.getByRole('button', { name: '移除 fail.png', exact: true }).click();
  await expect(page.getByText('上传成功', { exact: true })).toHaveCount(3);
  await page.getByLabel('提示词', { exact: true }).fill('A local fixture portrait');
  await page.getByRole('combobox', { name: '作品分类' }).click();
  await page.getByRole('option', { name: '人像' }).click();
  await page.getByRole('combobox', { name: '模型版本' }).click();
  await page.getByRole('option', { name: 'Midjourney V6.1' }).click();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    await zone.hover();
    await expect.poll(() => zone.evaluate(element => {
      const styles = getComputedStyle(element);
      const probe = document.createElement('span');
      probe.style.backgroundColor = styles.getPropertyValue('--color-hover');
      document.body.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return styles.backgroundColor === expected;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/upload-${testInfo.project.name}-${theme}.png`, fullPage: true });
  }
  const submission = page.waitForRequest(request => request.url().endsWith('/api/submissions') && request.method() === 'POST');
  await page.getByRole('button', { name: '提交审核' }).click();
  const payload = (await submission).postDataJSON();
  expect(payload.upload_ids).toHaveLength(3);
  expect(new Set(payload.upload_ids).size).toBe(3);
  expect(payload.upload_ids[0]).toBe(uploadedIds[0]);
  expect(payload.upload_ids).not.toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await expect(page).toHaveURL(/my-works\?submitted=1/);
});
