// spec: e2e/specs/theme-selection.plan.md
import { cityMarker, expect, selectTheme, test } from '../fixtures';

test('テーマ切替で前テーマのマーカーが消える', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await selectTheme(page, '古代ギリシア');
  await expect(cityMarker(page, 'アテネ')).toBeVisible();
  await expect(cityMarker(page, 'バビロン')).toHaveCount(0);
});
