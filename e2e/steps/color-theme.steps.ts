import { expect } from '@playwright/test';
import { Then, When } from './fixtures';

When('カラーテーマトグルをクリックする', async ({ page }) => {
  await page.getByRole('button', { name: 'カラーテーマを切り替える' }).click();
});

When('ページをリロードする', async ({ page }) => {
  await page.reload();
});

Then('ダークテーマが適用されている', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-theme',
    'dark',
  );
});
