// spec: e2e/specs/feature-detail.plan.md
import {
  detailPanel,
  expect,
  selectTheme,
  terrainLabel,
  test,
} from '../fixtures';

test('地形ラベルのクリックで解説パネルが開く', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await terrainLabel(page, 'ユーフラテス川').click();
  await expect(detailPanel(page)).toContainText('ユーフラテス川');
});
