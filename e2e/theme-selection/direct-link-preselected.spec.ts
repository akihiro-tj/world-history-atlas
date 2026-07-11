// spec: e2e/specs/theme-selection.plan.md
import { cityMarker, expect, test } from '../fixtures';

test('テーマ直リンクで選択済みになる', async ({ page }) => {
  await page.goto('/?theme=ancient-greece');
  await expect(cityMarker(page, 'アテネ')).toBeVisible();
});
