import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures';

Given('テーマデータの取得が失敗する状態である', async ({ page }) => {
  await page.route('**/data/themes/**', (route) => route.abort());
});

When('データ取得を正常に戻す', async ({ page }) => {
  await expect(page.getByRole('button', { name: '再試行' })).toBeVisible();
  await page.unroute('**/data/themes/**');
});

When('再試行ボタンをクリックする', async ({ page }) => {
  await page.getByRole('button', { name: '再試行' }).click();
});

Then(
  /^エラーメッセージ「(.+)」が表示されている$/,
  async ({ page }, message: string) => {
    await expect(page.getByRole('alert')).toContainText(message);
  },
);

Then('再試行ボタンが表示されている', async ({ page }) => {
  await expect(page.getByRole('button', { name: '再試行' })).toBeVisible();
});

Then('テーマ選択を促すメッセージが表示されている', async ({ page }) => {
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
