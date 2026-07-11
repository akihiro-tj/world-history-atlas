// spec: e2e/specs/mobile.plan.md
import {
  cityMarker,
  detailPanel,
  expect,
  selectTheme,
  test,
} from '../fixtures';

test('解説がボトムシートで表示される', { tag: '@mobile' }, async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await cityMarker(page, 'バビロン').click();
  const panel = detailPanel(page);
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize();
  const box = await panel.boundingBox();
  if (!viewport || !box) throw new Error('パネルの位置を取得できない');
  expect(box.y).toBeGreaterThan(viewport.height / 2);
});
