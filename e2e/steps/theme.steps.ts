import { expect, type Page } from '@playwright/test';
import { Given, Then, When } from './fixtures';

async function openSidebarIfNeeded(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'テーマ一覧を開く' });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
}

async function selectTheme(page: Page, themeName: string): Promise<void> {
  await openSidebarIfNeeded(page);
  await page
    .locator('nav[aria-label="テーマ一覧"] button', { hasText: themeName })
    .click();
}

Given(
  /^クエリ「(.+)」でアプリを開いている$/,
  async ({ page }, query: string) => {
    await page.goto(`/${query}`);
  },
);

When(/^テーマ「(.+)」を選択する$/, async ({ page }, themeName: string) => {
  await selectTheme(page, themeName);
});

Given(/^テーマ「(.+)」を選択している$/, async ({ page }, themeName: string) => {
  await selectTheme(page, themeName);
});

Then(
  /^サイドバーにテーマ「(.+)」が表示されている$/,
  async ({ page }, themeName: string) => {
    await expect(
      page.locator('nav[aria-label="テーマ一覧"] button', {
        hasText: themeName,
      }),
    ).toBeVisible();
  },
);

Then(
  /^URL のクエリが「(.+)」を含んでいる$/,
  async ({ page }, fragment: string) => {
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(page).toHaveURL(new RegExp(escaped));
  },
);
