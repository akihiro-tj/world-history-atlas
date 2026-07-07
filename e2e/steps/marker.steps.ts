import { expect, type Page } from '@playwright/test';
import { Then } from './fixtures';

export function cityMarker(page: Page, name: string) {
  return page.locator(`button[data-marker-kind="city"][aria-label="${name}"]`);
}

export function terrainLabel(page: Page, name: string) {
  return page.locator(
    `button[data-marker-kind="terrain"][aria-label="${name}"]`,
  );
}

Then(
  /^都市マーカー「(.+)」が表示されている$/,
  async ({ page }, name: string) => {
    await expect(cityMarker(page, name)).toBeVisible();
  },
);

Then(
  /^都市マーカー「(.+)」が表示されていない$/,
  async ({ page }, name: string) => {
    await expect(cityMarker(page, name)).toHaveCount(0);
  },
);

Then(/^地形ラベル「(.+)」が表示されている$/, async ({ page }, name: string) => {
  await expect(terrainLabel(page, name)).toBeVisible();
});
