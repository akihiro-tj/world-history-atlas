// spec: e2e/specs/color-theme.plan.md
import { colorThemeToggle, expect, test } from '../fixtures';

test('カラーテーマがリロード後も維持される', async ({ page }) => {
  await page.goto('/');
  await colorThemeToggle(page).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-theme',
    'dark',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-theme',
    'dark',
  );
});
