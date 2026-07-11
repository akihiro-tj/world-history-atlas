// spec: e2e/specs/app-boot.plan.md
import { expect, test } from '../fixtures';

test('地図が表示される', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
