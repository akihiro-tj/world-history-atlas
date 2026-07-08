import { expect } from '@playwright/test';
import { Then, When } from './fixtures';
import { cityMarker, terrainLabel } from './marker.steps';

When(/^都市マーカー「(.+)」をクリックする$/, async ({ page }, name: string) => {
  await cityMarker(page, name).click();
});

When(/^地形ラベル「(.+)」をクリックする$/, async ({ page }, name: string) => {
  await terrainLabel(page, name).click();
});

Then(
  /^解説パネルに「(.+)」と表示されている$/,
  async ({ page }, text: string) => {
    await expect(page.getByTestId('detail-panel')).toContainText(text);
  },
);

Then(
  /^解説パネルに「(.+)」を含む解説文が表示されている$/,
  async ({ page }, text: string) => {
    await expect(page.getByTestId('detail-panel')).toContainText(text);
  },
);

Then(
  /^解説パネルに頻出度「(.+)」が表示されている$/,
  async ({ page }, stars: string) => {
    await expect(page.getByTestId('detail-panel')).toContainText(stars);
  },
);

When('解説パネルの閉じるボタンをクリックする', async ({ page }) => {
  await page
    .getByTestId('detail-panel')
    .getByRole('button', { name: '閉じる' })
    .click();
});

Then('解説パネルが表示されていない', async ({ page }) => {
  await expect(page.getByTestId('detail-panel')).toHaveCount(0);
});
