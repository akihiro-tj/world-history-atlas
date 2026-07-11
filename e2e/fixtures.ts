import { expect, type Locator, type Page, test } from '@playwright/test';

export { expect, test };

export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
}

export async function selectTheme(
  page: Page,
  themeName: string,
): Promise<void> {
  const menu = page.getByRole('button', { name: 'テーマ一覧を開く' });
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
  }
  await page
    .locator('nav[aria-label="テーマ一覧"] button', { hasText: themeName })
    .click();
}

export function cityMarker(page: Page, name: string): Locator {
  return page.locator(`button[data-marker-kind="city"][aria-label="${name}"]`);
}

export function terrainLabel(page: Page, name: string): Locator {
  return page.locator(
    `button[data-marker-kind="terrain"][aria-label="${name}"]`,
  );
}

export function detailPanel(page: Page): Locator {
  return page.getByTestId('detail-panel');
}

export function importanceFilter(page: Page, label: string): Locator {
  return page
    .getByRole('group', { name: '頻出度フィルタ' })
    .getByRole('button', { name: label });
}

export function colorThemeToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'カラーテーマを切り替える' });
}
