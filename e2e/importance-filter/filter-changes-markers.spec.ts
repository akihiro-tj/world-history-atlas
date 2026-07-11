// spec: e2e/specs/importance-filter.plan.md
import {
  cityMarker,
  detailPanel,
  expect,
  importanceFilter,
  selectTheme,
  test,
} from '../fixtures';

test('頻出度フィルタで地図のマーカー表示が変わる', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');

  await importanceFilter(page, '★1のみ').click();
  await expect(cityMarker(page, 'バビロン')).toBeVisible();
  await expect(cityMarker(page, 'ウル')).toHaveCount(0);

  await importanceFilter(page, 'すべて').click();
  await expect(cityMarker(page, 'ウルク')).toBeVisible();

  // Regression: 解説パネルを開いたままでもフィルタを操作できる
  await cityMarker(page, 'バビロン').click();
  await expect(detailPanel(page)).toContainText('バビロン');
  await importanceFilter(page, '★1のみ').click();
  await expect(detailPanel(page)).toContainText('バビロン');
  await expect(cityMarker(page, 'ウル')).toHaveCount(0);
});
