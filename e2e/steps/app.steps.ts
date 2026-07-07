import { expect } from '@playwright/test';
import { Given, Then } from './fixtures';

Given('アプリを開いている', async ({ page }) => {
  await page.goto('/');
});

Then('地図が表示されている', async ({ page }) => {
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
