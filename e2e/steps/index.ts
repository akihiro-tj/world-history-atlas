import { expect, type Page } from '@playwright/test';
import { createRegistry } from '../../tests/spec-runner/registry';

type Ctx = { page: Page };

function cityMarker(page: Page, name: string) {
  return page.locator(`button[data-marker-kind="city"][aria-label="${name}"]`);
}

function terrainLabel(page: Page, name: string) {
  return page.locator(
    `button[data-marker-kind="terrain"][aria-label="${name}"]`,
  );
}

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

export const registry = createRegistry<Ctx>();

registry.phrase(/^アプリを開いている$/, async ({ page }) => {
  await page.goto('/');
});

registry.phrase(
  /^クエリ「(.+)」でアプリを開いている$/,
  async ({ page }, query) => {
    await page.goto(`/${query}`);
  },
);

registry.phrase(/^地図が表示されている$/, async ({ page }) => {
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});

registry.phrase(
  /^テーマ「(.+)」を選択(?:する|している)$/,
  async ({ page }, themeName) => {
    await selectTheme(page, themeName);
  },
);

registry.phrase(
  /^サイドバーにテーマ「(.+)」が表示されている$/,
  async ({ page }, themeName) => {
    await expect(
      page.locator('nav[aria-label="テーマ一覧"] button', {
        hasText: themeName,
      }),
    ).toBeVisible();
  },
);

registry.phrase(
  /^都市マーカー「(.+)」が表示されている$/,
  async ({ page }, name) => {
    await expect(cityMarker(page, name)).toBeVisible();
  },
);

registry.phrase(
  /^都市マーカー「(.+)」が表示されていない$/,
  async ({ page }, name) => {
    await expect(cityMarker(page, name)).toHaveCount(0);
  },
);

registry.phrase(
  /^都市マーカー「(.+)」を(?:クリックする|選択している)$/,
  async ({ page }, name) => {
    await cityMarker(page, name).click();
  },
);

registry.phrase(
  /^地形ラベル「(.+)」が表示されている$/,
  async ({ page }, name) => {
    await expect(terrainLabel(page, name)).toBeVisible();
  },
);

registry.phrase(
  /^地形ラベル「(.+)」をクリックする$/,
  async ({ page }, name) => {
    await terrainLabel(page, name).click();
  },
);

registry.phrase(
  /^解説パネルに「(.+)」と表示されている$/,
  async ({ page }, text) => {
    await expect(page.getByTestId('detail-panel')).toContainText(text);
  },
);

registry.phrase(
  /^解説パネルに「(.+)」を含む解説文が表示されている$/,
  async ({ page }, text) => {
    await expect(page.getByTestId('detail-panel')).toContainText(text);
  },
);

registry.phrase(
  /^解説パネルに頻出度「(.+)」が表示されている$/,
  async ({ page }, stars) => {
    await expect(page.getByTestId('detail-panel')).toContainText(stars);
  },
);

registry.phrase(/^解説パネルが表示されていない$/, async ({ page }) => {
  await expect(page.getByTestId('detail-panel')).toHaveCount(0);
});

registry.phrase(
  /^解説パネルが画面の下半分に表示されている$/,
  async ({ page }) => {
    const panel = page.getByTestId('detail-panel');
    await expect(panel).toBeVisible();
    const viewportSize = page.viewportSize();
    const box = await panel.boundingBox();
    if (!viewportSize || !box) throw new Error('パネルの位置を取得できない');
    expect(box.y).toBeGreaterThan(viewportSize.height / 2);
  },
);

registry.phrase(
  /^頻出度フィルタを「(.+)」に切り替える$/,
  async ({ page }, label) => {
    await page
      .getByRole('group', { name: '頻出度フィルタ' })
      .getByRole('button', { name: label })
      .click();
  },
);

registry.phrase(/^メニューボタンでドロワーを開く$/, async ({ page }) => {
  await page.getByRole('button', { name: 'テーマ一覧を開く' }).click();
});

registry.phrase(/^カラーテーマトグルをクリックする$/, async ({ page }) => {
  await page.getByRole('button', { name: 'カラーテーマを切り替える' }).click();
});

registry.phrase(/^ページをリロードする$/, async ({ page }) => {
  await page.reload();
});

registry.phrase(/^ダークテーマが適用されている$/, async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute(
    'data-color-theme',
    'dark',
  );
});
