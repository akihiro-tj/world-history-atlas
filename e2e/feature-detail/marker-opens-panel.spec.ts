// spec: e2e/specs/feature-detail.plan.md
import {
  cityMarker,
  detailPanel,
  expect,
  selectTheme,
  test,
} from '../fixtures';

test('都市マーカーのクリックで解説パネルが開く', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await cityMarker(page, 'バビロン').click();
  await expect(detailPanel(page)).toContainText('バビロン');
  await expect(detailPanel(page)).toContainText('メソポタミア');
  await expect(detailPanel(page)).toContainText('★1');
});
