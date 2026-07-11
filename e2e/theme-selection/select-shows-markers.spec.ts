// spec: e2e/specs/theme-selection.plan.md
import {
  cityMarker,
  expect,
  selectTheme,
  terrainLabel,
  test,
} from '../fixtures';

test('テーマ選択でマーカーが表示される', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await expect(cityMarker(page, 'バビロン')).toBeVisible();
  await expect(terrainLabel(page, 'ユーフラテス川')).toBeVisible();
});
