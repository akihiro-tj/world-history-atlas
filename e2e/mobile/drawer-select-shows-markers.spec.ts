// spec: e2e/specs/mobile.plan.md
import { cityMarker, expect, selectTheme, test } from '../fixtures';

test('ドロワーからテーマを選択してマーカーが表示される', {
  tag: '@mobile',
}, async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await expect(cityMarker(page, 'バビロン')).toBeVisible();
});
