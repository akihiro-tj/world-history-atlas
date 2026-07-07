import { expect } from '@playwright/test';
import { Then, When } from './fixtures';

When('メニューボタンでドロワーを開く', async ({ page }) => {
  await page.getByRole('button', { name: 'テーマ一覧を開く' }).click();
});

Then('解説パネルが画面の下半分に表示されている', async ({ page }) => {
  const panel = page.getByTestId('detail-panel');
  await expect(panel).toBeVisible();
  const viewportSize = page.viewportSize();
  const box = await panel.boundingBox();
  if (!viewportSize || !box) throw new Error('パネルの位置を取得できない');
  expect(box.y).toBeGreaterThan(viewportSize.height / 2);
});
