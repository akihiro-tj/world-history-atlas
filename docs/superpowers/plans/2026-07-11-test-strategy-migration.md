# テスト戦略移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E2E を playwright-bdd/Gherkin から playwright-cli の spec 駆動（plain Playwright）へ移行し、20 シナリオを jsdom 盲点の 8 本に絞る。

**Architecture:** 3 層トロフィー（単体 / 結合・コンポーネント / E2E）。地図に依存しない振る舞いは結合テスト（jsdom）に置き、E2E は実マップ・実レイアウト・実リロードのみ。E2E テストは playwright-cli の plan/generate/heal で作成し、成果物は commit 済みの plain Playwright として CI で実行する。

**Tech Stack:** Vitest / React Testing Library（jsdom）、Playwright（`@playwright/test`）、playwright-cli（`@playwright/cli`）。

## Global Constraints

- Node `>=24 <25`、パッケージマネージャ `pnpm@11.4.0`。
- **main への直接コミット・push 禁止。** 本作業はブランチ `docs/test-strategy`（または派生ブランチ）で行い、CI green かつレビュー後に PR マージ。
- UI 文言・ドキュメントは日本語。コミットメッセージは英語 Conventional Commits。コード内コメントは Why / Warning のみ英語。
- **二重テスト禁止**: 同じ振る舞いを 2 層で検証しない。
- **E2E の境界 = jsdom 盲点の原則**: 実 MapLibre 描画・実ビューポートのレイアウト・実ブラウザのリロードのいずれかを要するシナリオだけ E2E に残す。
- 仕様の一次情報は `e2e/specs/*.plan.md`。
- MSW は導入しない。Vitest / React Testing Library は維持。
- 地図の色は `src/map/mapColors.ts`、マーカーの色は `src/index.css`、UI の色は Tailwind クラス。この境界を崩さない。
- WIP シナリオは `@wip` タグではなく Playwright ネイティブの `test.fixme(...)` で表す。

---

## File Structure

**新規作成:**
- `e2e/fixtures.ts` — 共通の locator / helper（旧 `e2e/steps/*` の後継）。1 責任: E2E から使う要素アクセスと共通操作。
- `e2e/seed.spec.ts` — plan/generate/heal のデバッグセッションが一時停止する最小テスト。
- `e2e/specs/*.plan.md` — 人間が査読する Markdown 振る舞いカタログ（6 ファイル）。
- `e2e/specs/CONVENTIONS.md` — generate 時に参照する生成規約メモ。
- `e2e/<group>/<scenario>.spec.ts` — 生成された plain Playwright テスト（10 ファイル）。

**変更:**
- `src/app/App.test.tsx` — DEMOTE 2 件（カラーテーマ）のコンポーネントテストを追加。
- `playwright.config.ts` — playwright-bdd の `defineBddConfig` を廃し、`testDir: 'e2e'` に。
- `package.json` — `e2e` / `e2e:smoke` スクリプトから `bddgen` を除去。`playwright-bdd` を devDependencies から削除。
- `CLAUDE.md` — E2E 節（Gherkin ステップ語彙）を新ワークフロー・spec 規約へ書き換え。
- `docs/superpowers/specs/2026-07-11-test-strategy-design.md` — ステータスを実装反映済みに更新。

**削除:**
- `e2e/steps/**`（`playwright-bdd` に依存するため）。
- `e2e/features/**`（spec 作成の参照に使い、最後に削除）。

## E2E 生成レシピ（playwright-cli。Task 4–6 で共通利用）

各 E2E テストは以下の手順で生成・検証する（詳細な driving は各シナリオの目標コードに従う）。

1. デバッグ起動: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/seed.spec.ts --debug=cli`（バックグラウンド）。出力の `tw-XXXX` セッション名を得る。
2. `playwright-cli attach tw-XXXX` → `playwright-cli resume`（seed が走りアプリに到達）。
3. spec の Steps を `playwright-cli`（`snapshot` / `click` / `fill` 等）で 1 つずつ再現。各操作が出力する Playwright TS を収集する。`- expect:` ごとに明示アサーションを足す。
4. 収集したコードを目標パスの `*.spec.ts` に書き、`import { ... } from '../fixtures'` を使う（locator は fixtures のヘルパーに寄せる）。
5. 単体実行して green を確認: `PLAYWRIGHT_HTML_OPEN=never npx playwright test <file>`。失敗すれば heal（`--debug=cli` + attach で診断・修正）。
6. CLI セッションとバックグラウンドテストを停止してから次へ。

> セレクタはすべて `e2e/fixtures.ts` のヘルパー経由にする。実 DOM がヘルパーの想定と異なる場合のみヘルパー側を調整する。

---

### Task 1: DEMOTE のコンポーネントテスト（カラーテーマ）

E2E を削除する前に、カラーテーマの DOM 反映を結合テストで先に担保する（backfill）。`src/app/App.tsx` はトグルで `document.documentElement.dataset.colorTheme` を切り替え、初期値を `resolveInitialColorTheme(localStorage, matchMedia('(prefers-color-scheme: dark)').matches)` で決める。

**Files:**
- Modify/Test: `src/app/App.test.tsx`（末尾に `describe('カラーテーマ')` を追加）

**Interfaces:**
- Consumes: 既存の `App.test.tsx` のモック群（MapView / FeatureMarkers / webgl / manifest / fetch）と `test-setup.ts` のグローバルスタブ（`matchMedia` は既定 `matches: false`、`localStorage` はメモリ実装）。
- Produces: なし（テスト追加のみ）。

- [ ] **Step 1: テストを追加する**

`src/app/App.test.tsx` の最後（最終行の閉じ括弧の後）に以下を追加:

```tsx
describe('カラーテーマ', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('トグルで data-color-theme が dark になる', async () => {
    render(<App />);
    await userEvent.click(
      screen.getByRole('button', { name: 'カラーテーマを切り替える' }),
    );
    expect(document.documentElement).toHaveAttribute(
      'data-color-theme',
      'dark',
    );
  });

  it('OS がダークなら初期表示が dark になる', async () => {
    const restoreMatchMedia = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    try {
      render(<App />);
      await screen.findByRole('button', { name: /古代オリエント/ });
      expect(document.documentElement).toHaveAttribute(
        'data-color-theme',
        'dark',
      );
    } finally {
      vi.stubGlobal('matchMedia', restoreMatchMedia);
    }
  });
});
```

- [ ] **Step 2: テストを実行して green を確認する**

Run: `pnpm vitest run src/app/App.test.tsx`
Expected: PASS（既存挙動のカバレッジ backfill。新規 2 件を含め全て green）

- [ ] **Step 3: コミット**

```bash
git add src/app/App.test.tsx
git commit -m "test(app): cover color theme DOM application at component level"
```

---

### Task 2: playwright-cli 基盤の導入と playwright.config 切替

E2E の足場（fixtures / seed / 生成規約）を作り、playwright-bdd を撤去して Playwright を素の構成へ切り替える。`e2e/steps/*` は `playwright-bdd` に依存するため本タスクで削除し、そのロジックは `e2e/fixtures.ts` へ移植する。`e2e/features/*` は spec 作成の参照として残す（Task 7 で削除）。

**Files:**
- Create: `e2e/fixtures.ts`, `e2e/seed.spec.ts`, `e2e/specs/CONVENTIONS.md`
- Modify: `playwright.config.ts`, `package.json`
- Delete: `e2e/steps/**`

**Interfaces:**
- Produces（後続タスクが利用）:
  - `test`, `expect` — `@playwright/test` の再エクスポート。
  - `openApp(page: Page, path?: string): Promise<void>` — 既定 `'/'` へ遷移。
  - `selectTheme(page: Page, themeName: string): Promise<void>` — 必要ならドロワーを開いてテーマを選択。
  - `cityMarker(page: Page, name: string): Locator` / `terrainLabel(page: Page, name: string): Locator`
  - `detailPanel(page: Page): Locator` / `importanceFilter(page: Page, label: string): Locator` / `colorThemeToggle(page: Page): Locator`

- [ ] **Step 1: fixtures を作成する**

Create `e2e/fixtures.ts`:

```ts
import { type Locator, type Page, test, expect } from '@playwright/test';

export { test, expect };

export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
}

export async function selectTheme(page: Page, themeName: string): Promise<void> {
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
```

- [ ] **Step 2: seed を作成する**

Create `e2e/seed.spec.ts`:

```ts
import { openApp, test } from './fixtures';

test('seed', async ({ page }) => {
  await openApp(page);
});
```

- [ ] **Step 3: 生成規約メモを作成する**

Create `e2e/specs/CONVENTIONS.md`:

```markdown
# E2E 生成規約

- 対象は「jsdom 盲点の原則」に該当する 8 シナリオのみ（実マップ・実レイアウト・実リロード）。それ以外は結合テストに置く。
- locator は `e2e/fixtures.ts` のヘルパーを必ず使う（`cityMarker` / `terrainLabel` / `detailPanel` / `importanceFilter` / `colorThemeToggle` / `selectTheme`）。
- 生の CSS クラス・可変テキストへ依存しない。role / アクセシブルネーム / `data-*` を優先する。
- 1 シナリオ = 1 ファイル。ファイル先頭に `// spec: e2e/specs/<name>.plan.md` を記す。
- モバイル用は `{ tag: '@mobile' }`、スモークは `{ tag: '@smoke' }`。WIP は `test.fixme(...)`。
```

- [ ] **Step 4: playwright.config を素の構成へ切り替える**

Replace `playwright.config.ts` の全内容:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 5: package.json スクリプトを更新し playwright-bdd を削除する**

`package.json` の `scripts` を変更:

```json
    "e2e": "playwright test",
    "e2e:smoke": "playwright test --grep @smoke",
```

続けて依存を削除し steps を撤去:

```bash
pnpm remove playwright-bdd
git rm -r e2e/steps
```

- [ ] **Step 6: typecheck / lint / seed 実行で green を確認する**

Run:
```bash
pnpm typecheck
pnpm lint
PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/seed.spec.ts
```
Expected: typecheck・lint ともにエラーなし。seed テストが desktop プロジェクトで PASS。

- [ ] **Step 7: コミット**

```bash
git add e2e/fixtures.ts e2e/seed.spec.ts e2e/specs/CONVENTIONS.md playwright.config.ts package.json pnpm-lock.yaml
git commit -m "test(e2e): scaffold playwright-cli spec-driven foundation and drop playwright-bdd"
```

---

### Task 3: E2E 仕様（*.plan.md）を作成する

KEEP 8 シナリオを playwright-cli の plan 形式で `e2e/specs/` に書き起こす。内容は現行 `e2e/features/*.feature` を参照して転記する（この後 Task 7 で features を削除する）。これは人間が査読する一次情報になる。

**Files:**
- Create: `e2e/specs/app-boot.plan.md`, `e2e/specs/theme-selection.plan.md`, `e2e/specs/feature-detail.plan.md`, `e2e/specs/importance-filter.plan.md`, `e2e/specs/color-theme.plan.md`, `e2e/specs/mobile.plan.md`

- [ ] **Step 1: app-boot / theme-selection の spec を作成する**

Create `e2e/specs/app-boot.plan.md`:

```markdown
# アプリ起動 Test Plan

## Application Overview

アプリを開くと実 MapLibre 地図が描画される。地図は jsdom で動かないため E2E スモークで守る。

## Test Scenarios

### 1. 起動

**Seed:** `e2e/seed.spec.ts`

#### 1.1. map-renders `@smoke`

**File:** `e2e/app-boot/map-renders.spec.ts`

**Steps:**
  1. `/` を開く
    - expect: `map-view`（testid）が表示される
    - expect: `.maplibregl-canvas` が表示される
```

Create `e2e/specs/theme-selection.plan.md`:

```markdown
# テーマ選択 Test Plan

## Application Overview

テーマを選ぶと実マップ上に都市マーカー・地形ラベルが描画される。直リンクで開くと選択済みになり、テーマを切り替えると前テーマのマーカーは消える。

## Test Scenarios

### 1. テーマ選択

**Seed:** `e2e/seed.spec.ts`

#### 1.1. select-shows-markers

**File:** `e2e/theme-selection/select-shows-markers.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択する
    - expect: 都市マーカー「バビロン」が表示される
    - expect: 地形ラベル「ユーフラテス川」が表示される

#### 1.2. direct-link-preselected

**File:** `e2e/theme-selection/direct-link-preselected.spec.ts`

**Steps:**
  1. `/?theme=ancient-greece` を開く
    - expect: 都市マーカー「アテネ」が表示される

#### 1.3. switch-clears-previous

**File:** `e2e/theme-selection/switch-clears-previous.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」→「古代ギリシア」の順に選択する
    - expect: 都市マーカー「アテネ」が表示される
    - expect: 都市マーカー「バビロン」が表示されない
```

- [ ] **Step 2: feature-detail / importance-filter / color-theme の spec を作成する**

Create `e2e/specs/feature-detail.plan.md`:

```markdown
# 解説パネル Test Plan

## Application Overview

実マップ上のマーカー／地形ラベルをクリックすると解説パネルが開き、名称・解説文・頻出度が表示される。

## Test Scenarios

### 1. 解説表示

**Seed:** `e2e/seed.spec.ts`

#### 1.1. marker-opens-panel

**File:** `e2e/feature-detail/marker-opens-panel.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択し、都市マーカー「バビロン」をクリックする
    - expect: 解説パネルに「バビロン」が表示される
    - expect: 解説パネルに「メソポタミア」が表示される
    - expect: 解説パネルに「★1」が表示される

#### 1.2. terrain-opens-panel

**File:** `e2e/feature-detail/terrain-opens-panel.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択し、地形ラベル「ユーフラテス川」をクリックする
    - expect: 解説パネルに「ユーフラテス川」が表示される
```

Create `e2e/specs/importance-filter.plan.md`:

```markdown
# 頻出度フィルタ Test Plan

## Application Overview

頻出度フィルタの切替が実マップのマーカー表示に反映される。解説パネルを開いたままでもフィルタを操作できる。

## Test Scenarios

### 1. フィルタ

**Seed:** `e2e/seed.spec.ts`

#### 1.1. filter-changes-markers

**File:** `e2e/importance-filter/filter-changes-markers.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択する
  2. 頻出度フィルタを「★1のみ」に切り替える
    - expect: 都市マーカー「バビロン」が表示される
    - expect: 都市マーカー「ウル」が表示されない
  3. 頻出度フィルタを「すべて」に切り替える
    - expect: 都市マーカー「ウルク」が表示される
  4. 都市マーカー「バビロン」をクリックし、頻出度フィルタを「★1のみ」に切り替える
    - expect: 解説パネルに「バビロン」が表示される
    - expect: 都市マーカー「ウル」が表示されない
```

Create `e2e/specs/color-theme.plan.md`:

```markdown
# カラーテーマ Test Plan

## Application Overview

カラーテーマの選択はブラウザのリロードをまたいで維持される（localStorage 永続化の実往復）。

## Test Scenarios

### 1. 永続化

**Seed:** `e2e/seed.spec.ts`

#### 1.1. persists-across-reload

**File:** `e2e/color-theme/persists-across-reload.spec.ts`

**Steps:**
  1. `/` を開き、カラーテーマトグルをクリックする
    - expect: `html` の `data-color-theme` が `dark`
  2. ページをリロードする
    - expect: `html` の `data-color-theme` が `dark`
```

- [ ] **Step 3: mobile の spec を作成する**

Create `e2e/specs/mobile.plan.md`:

```markdown
# モバイル表示 Test Plan

## Application Overview

モバイル実ビューポートで、ドロワーからのテーマ選択と、解説のボトムシート表示（画面下半分）を守る。

## Test Scenarios

### 1. モバイル `@mobile`

**Seed:** `e2e/seed.spec.ts`

#### 1.1. drawer-select-shows-markers

**File:** `e2e/mobile/drawer-select-shows-markers.spec.ts`

**Steps:**
  1. `/` を開き、ドロワーからテーマ「古代オリエント」を選択する
    - expect: 都市マーカー「バビロン」が表示される

#### 1.2. detail-bottom-sheet

**File:** `e2e/mobile/detail-bottom-sheet.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択し、都市マーカー「バビロン」をクリックする
    - expect: 解説パネルが表示される
    - expect: 解説パネルの上端 y が画面高さの半分より下にある
```

- [ ] **Step 4: 人間レビュー（ワークフロー上の査読ゲート）**

spec 6 ファイルを読み返し、シナリオが KEEP 8（+ variant）と一致し、jsdom 盲点の原則に反する項目がないことを確認する。

- [ ] **Step 5: コミット**

```bash
git add e2e/specs
git commit -m "docs(e2e): author spec-driven test plans for the 8 kept scenarios"
```

---

### Task 4: E2E 生成 — 起動スモーク + テーマ選択

「E2E 生成レシピ」に従い、`app-boot` と `theme-selection` の 4 テストを生成し green 化する。

**Files:**
- Create: `e2e/app-boot/map-renders.spec.ts`, `e2e/theme-selection/select-shows-markers.spec.ts`, `e2e/theme-selection/direct-link-preselected.spec.ts`, `e2e/theme-selection/switch-clears-previous.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `openApp`, `selectTheme`, `cityMarker`, `terrainLabel`（`e2e/fixtures.ts`）。

- [ ] **Step 1: レシピで 4 テストを生成し、目標コードに合わせる**

`e2e/app-boot/map-renders.spec.ts`:

```ts
// spec: e2e/specs/app-boot.plan.md
import { expect, test } from '../fixtures';

test('地図が表示される', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
```

`e2e/theme-selection/select-shows-markers.spec.ts`:

```ts
// spec: e2e/specs/theme-selection.plan.md
import { cityMarker, expect, selectTheme, terrainLabel, test } from '../fixtures';

test('テーマ選択でマーカーが表示される', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await expect(cityMarker(page, 'バビロン')).toBeVisible();
  await expect(terrainLabel(page, 'ユーフラテス川')).toBeVisible();
});
```

`e2e/theme-selection/direct-link-preselected.spec.ts`:

```ts
// spec: e2e/specs/theme-selection.plan.md
import { cityMarker, expect, test } from '../fixtures';

test('テーマ直リンクで選択済みになる', async ({ page }) => {
  await page.goto('/?theme=ancient-greece');
  await expect(cityMarker(page, 'アテネ')).toBeVisible();
});
```

`e2e/theme-selection/switch-clears-previous.spec.ts`:

```ts
// spec: e2e/specs/theme-selection.plan.md
import { cityMarker, expect, selectTheme, test } from '../fixtures';

test('テーマ切替で前テーマのマーカーが消える', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await selectTheme(page, '古代ギリシア');
  await expect(cityMarker(page, 'アテネ')).toBeVisible();
  await expect(cityMarker(page, 'バビロン')).toHaveCount(0);
});
```

- [ ] **Step 2: 実行して green を確認する**

Run: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/app-boot e2e/theme-selection`
Expected: 4 テストが desktop プロジェクトで PASS。失敗はレシピ 5（heal）で修正。

- [ ] **Step 3: コミット**

```bash
git add e2e/app-boot e2e/theme-selection
git commit -m "test(e2e): add boot smoke and theme selection scenarios"
```

---

### Task 5: E2E 生成 — 解説パネル + 頻出度フィルタ + カラーテーマ

**Files:**
- Create: `e2e/feature-detail/marker-opens-panel.spec.ts`, `e2e/feature-detail/terrain-opens-panel.spec.ts`, `e2e/importance-filter/filter-changes-markers.spec.ts`, `e2e/color-theme/persists-across-reload.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `selectTheme`, `cityMarker`, `terrainLabel`, `detailPanel`, `importanceFilter`, `colorThemeToggle`（`e2e/fixtures.ts`）。

- [ ] **Step 1: レシピで 4 テストを生成し、目標コードに合わせる**

`e2e/feature-detail/marker-opens-panel.spec.ts`:

```ts
// spec: e2e/specs/feature-detail.plan.md
import { cityMarker, detailPanel, expect, selectTheme, test } from '../fixtures';

test('都市マーカーのクリックで解説パネルが開く', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await cityMarker(page, 'バビロン').click();
  await expect(detailPanel(page)).toContainText('バビロン');
  await expect(detailPanel(page)).toContainText('メソポタミア');
  await expect(detailPanel(page)).toContainText('★1');
});
```

`e2e/feature-detail/terrain-opens-panel.spec.ts`:

```ts
// spec: e2e/specs/feature-detail.plan.md
import { detailPanel, expect, selectTheme, terrainLabel, test } from '../fixtures';

test('地形ラベルのクリックで解説パネルが開く', async ({ page }) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await terrainLabel(page, 'ユーフラテス川').click();
  await expect(detailPanel(page)).toContainText('ユーフラテス川');
});
```

`e2e/importance-filter/filter-changes-markers.spec.ts`:

```ts
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
```

`e2e/color-theme/persists-across-reload.spec.ts`:

```ts
// spec: e2e/specs/color-theme.plan.md
import { colorThemeToggle, expect, test } from '../fixtures';

test('カラーテーマがリロード後も維持される', async ({ page }) => {
  await page.goto('/');
  await colorThemeToggle(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'dark');
});
```

- [ ] **Step 2: 実行して green を確認する**

Run: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/feature-detail e2e/importance-filter e2e/color-theme`
Expected: 4 テストが PASS。失敗はレシピ 5（heal）で修正。

- [ ] **Step 3: コミット**

```bash
git add e2e/feature-detail e2e/importance-filter e2e/color-theme
git commit -m "test(e2e): add detail panel, importance filter, and color theme scenarios"
```

---

### Task 6: E2E 生成 — モバイル

**Files:**
- Create: `e2e/mobile/drawer-select-shows-markers.spec.ts`, `e2e/mobile/detail-bottom-sheet.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `selectTheme`, `cityMarker`, `detailPanel`（`e2e/fixtures.ts`）。

- [ ] **Step 1: レシピで 2 テストを生成し、目標コードに合わせる**

`e2e/mobile/drawer-select-shows-markers.spec.ts`:

```ts
// spec: e2e/specs/mobile.plan.md
import { cityMarker, expect, selectTheme, test } from '../fixtures';

test('ドロワーからテーマを選択してマーカーが表示される', { tag: '@mobile' }, async ({
  page,
}) => {
  await page.goto('/');
  await selectTheme(page, '古代オリエント');
  await expect(cityMarker(page, 'バビロン')).toBeVisible();
});
```

`e2e/mobile/detail-bottom-sheet.spec.ts`:

```ts
// spec: e2e/specs/mobile.plan.md
import { cityMarker, detailPanel, expect, selectTheme, test } from '../fixtures';

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
```

- [ ] **Step 2: 実行して green を確認する**

Run: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/mobile --project=mobile`
Expected: 2 テストが mobile プロジェクトで PASS。

- [ ] **Step 3: コミット**

```bash
git add e2e/mobile
git commit -m "test(e2e): add mobile drawer and bottom sheet scenarios"
```

---

### Task 7: 旧資産の撤去とドキュメント更新

全 E2E が green になった後、旧 Gherkin 資産を撤去し、ドキュメントを新運用へ更新する。

**Files:**
- Delete: `e2e/features/**`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-07-11-test-strategy-design.md`

- [ ] **Step 1: 旧 features を削除する**

```bash
git rm -r e2e/features
```

- [ ] **Step 2: CLAUDE.md の E2E 節を書き換える**

`CLAUDE.md` の「## E2E テスト仕様書（e2e/features/）」節全体を、以下に置換する:

```markdown
## E2E テスト仕様書（e2e/specs/）

- E2E は playwright-cli の spec 駆動（plan / generate / heal）。`e2e/specs/*.plan.md` が受け入れ基準の一次情報。機能の追加・変更は「spec 更新 → 人間レビュー → generate → green 確認 → heal」の順で進める
- E2E に含めるのは jsdom で検証不可能なものだけ（実 MapLibre 描画・実ビューポートのレイアウト・実リロード）。それ以外は結合テスト（Vitest + Testing Library）に置く。同じ振る舞いを 2 層で検証しない
- テストは 1 シナリオ 1 ファイル（`e2e/<group>/<name>.spec.ts`）。先頭に `// spec: e2e/specs/<name>.plan.md`。locator は `e2e/fixtures.ts` のヘルパーに寄せ、role / アクセシブルネーム / `data-*` を優先する
- モバイルは `{ tag: '@mobile' }`（mobile プロジェクト）、スモークは `{ tag: '@smoke' }`、未実装は `test.fixme(...)`
```

- [ ] **Step 3: 設計スペックのステータスを更新する**

`docs/superpowers/specs/2026-07-11-test-strategy-design.md` の `- ステータス:` 行を次に変更:

```markdown
- ステータス: 実装反映済み（実装計画: docs/superpowers/plans/2026-07-11-test-strategy-migration.md）
```

- [ ] **Step 4: 全体検証**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm e2e
```
Expected: すべて green。`pnpm test`（Vitest）は DEMOTE 2 件を含み PASS。`pnpm e2e`（Playwright）は 11 テスト（desktop: KEEP 8 + seed 1、mobile: 2）が PASS。

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-07-11-test-strategy-design.md
git commit -m "docs: switch E2E docs to playwright-cli spec-driven workflow"
```

- [ ] **Step 6: PR 作成（push は承認後）**

作業ブランチを push し、CI（lint / typecheck / test / E2E）green を確認のうえ PR を作成する。**push・PR は不可逆な公開操作のため、ユーザー承認を得てから実施する。**

---

## Self-Review

**1. Spec coverage（設計スペックの各要求 → タスク対応）:**
- 3 層トロフィー / 二重テスト禁止 → Task 1（demote）+ Task 7 の CLAUDE.md 反映
- E2E 20→8（KEEP/DELETE/DEMOTE） → Task 1（DEMOTE 2）、Task 3–6（KEEP 8）、Task 2 + 7（DELETE = 旧資産撤去でカバレッジは下位層へ）
- playwright-bdd → playwright-cli 移行 → Task 2（基盤・config・依存）、Task 4–6（生成）
- 仕様一次情報 `e2e/specs/*.plan.md` → Task 3
- MSW 不採用 → 変更なし（計画に MSW 導入タスクを含めない）で担保
- 安全な移行順序（add-before-remove） → Task 1（先に demote）→ Task 2–6（新 E2E 追加）→ Task 7（旧撤去）。ブランチ未マージのため中間でカバレッジ欠損は main に到達しない
- タグ対応（@smoke/@mobile/@wip） → Task 2（config projects）+ Task 4/6（tag）+ Task 7（@wip は test.fixme）

**2. Placeholder scan:** 各 code step は実コードを含む。E2E テストは locator ヘルパーで確定した具体コード。生成手順はレシピに集約（「Similar to Task N」は不使用）。

**3. Type consistency:** `e2e/fixtures.ts` が Produces する `openApp` / `selectTheme` / `cityMarker` / `terrainLabel` / `detailPanel` / `importanceFilter` / `colorThemeToggle` を、Task 4–6 の各テストが同名で import している。`data-color-theme`（html 属性）・`data-marker-kind`（マーカー）・`detail-panel`（testid）・アクセシブルネームは既存実装から転記。

**リスク注記:** Task 4–6 の各アサーション文言（「メソポタミア」「★1」やテーマ ID `ancient-greece`、マーカー名 バビロン/ウル/ウルク/アテネ）は現行 `e2e/features/*` が実データに対して検証していた値をそのまま踏襲している。generate 時に実アプリが正となるため、乖離があれば heal（レシピ 5）で spec とテストを実挙動に整合させる。
