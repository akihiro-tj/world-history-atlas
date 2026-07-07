# world-history-atlas 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 世界史のテーマごとに重要都市・自然地形をインタラクティブ地図で探索できる学習用 SPA を、空リポジトリから Cloudflare Workers デプロイまで構築する。

**Architecture:** Vite + React + TypeScript の静的 SPA。ベースマップは Natural Earth から nix devShell（tippecanoe/gdal）で生成した PMTiles を静的配信し、テーマデータ（都市・地形・解説の JSON）は zod で検証して起動時に fetch する。ドメイン軸ディレクトリ（app / map / theme / shared）で、ロジックは純粋関数、失敗は Result 値で扱う。

**Tech Stack:** React 19 / TypeScript / Vite / Tailwind CSS 4 / maplibre-gl + pmtiles / zod 4 / Biome / Vitest + React Testing Library / Playwright + playwright-bdd / wrangler (Cloudflare Workers) / nix flake (tippecanoe, gdal)

**Spec:** `docs/superpowers/specs/2026-07-07-world-history-atlas-design.md`

## Global Constraints

- Node は 24 系 LTS 固定: `engines: { "node": ">=24 <25" }`。浮動指定（`lts/*`）にしない
- pnpm を使用し `packageManager` フィールドでバージョン固定。依存は**最新安定版**を導入し lockfile で固定（各タスクで `npm view <pkg> version` により当日の最新安定版を確認して記入する。本計画中の `^X.Y.Z` プレースホルダはその手順で置き換える）
- コミットメッセージは英語・Conventional Commits。コミット末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を付ける
- **`git add` は必ず明示パスで行う。`docs/superpowers/` 配下（スペック・本計画）はユーザー承認まで絶対にコミットしない**
- UI 文言・ドキュメント（README / CLAUDE.md / DESIGN.md）は日本語。アプリの表示名は「世界史マップ」
- コードコメントは Why（業務ルール・ワークアラウンド・非自明な設計判断）と Warning（壊れやすい依存への警告）のみ。動作説明コメント・セクション区切り・自明な JSDoc は書かない
- `public/tiles/basemap.pmtiles` は 25 MiB 未満（Cloudflare Workers 静的アセットの 1 ファイル上限）
- E2E テスト仕様書は英語キーワード + 日本語本文の Gherkin。`「」` 内の引数はカスタムパラメータではなく**正規表現ステップ**で受ける（Cucumber expression の `{string}` は `"…"` 引用にしかマッチしないため）
- 失敗しうる処理（fetch / parse）は例外ではなく `Result<T, E>` を返す。UI 境界で表示に変換する
- 地図マーカーは MapLibre の DOM Marker で描画し `data-testid` を付ける（canvas シンボルにしない）
- **テストの期待値を観測値に合わせて改竄しない**。期待値と実測が食い違ったらタスクをブロックとして報告する
- dev サーバー・tsx・Playwright の実行がサンドボックス起因の EPERM（ポート listen・IPC ソケット）で失敗した場合はサンドボックス外で再試行する（製品バグと誤認しない）
- モデル使い分けの推奨: 計画にコードが完全記載された転記系タスク = haiku、UI・統合タスク = sonnet、Task 22 の最終全体レビュー = 最上位モデル

## ファイル構成マップ

```
world-history-atlas/
├── flake.nix / flake.lock         # Task 2: 開発用 devShell（tippecanoe, gdal, Node 24, pnpm）
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml   # Task 1 / minimumReleaseAge は Task 21
├── vite.config.ts / tsconfig.json / biome.json / index.html  # Task 1
├── wrangler.jsonc                 # Task 19
├── playwright.config.ts           # Task 7
├── .github/workflows/ci.yml       # Task 20
├── .github/workflows/deploy.yml   # Task 21
├── .github/workflows/preview.yml  # Task 21
├── .github/dependabot.yml         # Task 21
├── scripts/
│   ├── build-tiles.sh             # Task 2: NE → ogr2ogr → tippecanoe → PMTiles
│   ├── tile-sources.sha256        # Task 2: ソースデータの checksums
│   ├── check-tiles.sh             # Task 2: 存在 + 25MiB 検証（CI 用）
│   └── validate-data.ts           # Task 4: テーマデータ検証エントリ（fs 読み込みのみ）
├── public/
│   ├── tiles/basemap.pmtiles      # Task 2: 生成物（コミットする）
│   └── data/themes/               # Task 4 でサンプル 1 件、Task 18 で 8〜12 件
├── src/
│   ├── app/                       # main.tsx / App.tsx / 画面骨格・全体状態（Task 1, 10）
│   ├── map/                       # MapView.tsx / mapStyle.ts / mapColors.ts / markers（Task 6, 9, 14）
│   ├── theme/                     # schema.ts / validation.ts / fetch.ts / filter.ts /
│   │                              # urlState.ts / Sidebar.tsx / DetailPanel.tsx 等（Task 3〜5, 9〜13）
│   ├── shared/                    # result.ts（Task 3）
│   ├── index.css                  # Tailwind エントリ + デザイントークン（Task 1, 14）
│   └── test-setup.ts              # Task 1
├── e2e/
│   ├── features/*.feature         # Task 7〜8（受け入れ基準の一次情報）
│   └── steps/                     # Task 7, 9〜16（fixtures + 正規表現ステップ）
├── CLAUDE.md                      # Task 17
├── DESIGN.md                      # Task 14
└── README.md                      # Task 22
```

## タスク一覧（実行順）

| # | タスク | 要ユーザー対話 |
| --- | --- | --- |
| 1 | プロジェクト scaffolding | |
| 2 | nix flake + ベースマップタイル生成 | |
| 3 | Result 型 + テーマ zod スキーマ | |
| 4 | データ検証 + サンプルテーマ | |
| 5 | テーマ fetch | |
| 6 | 地図表示（PMTiles + ライトスタイル） | |
| 7 | E2E 基盤（playwright-bdd + スモーク） | |
| 8 | E2E テスト仕様書（.feature 全量起草） | ✅ .feature レビュー |
| 9 | 画面骨格（ヘッダー・サイドバー・テーマ一覧） | |
| 10 | テーマ選択 → 地図移動 + URL 同期 | |
| 11 | マーカー描画 + importance フィルタ関数 | |
| 12 | 解説パネル | |
| 13 | 頻出度フィルタ UI | |
| 14 | ライト/ダークテーマ切替 + DESIGN.md | |
| 15 | エラー処理と空状態 | |
| 16 | モバイル対応（ドロワー・ボトムシート） | |
| 17 | CLAUDE.md 作成 | |
| 18 | テーマデータ拡充（8〜12 テーマ） | |
| 19 | Cloudflare デプロイ + Range request 実機検証 | ✅ wrangler 認証 |
| 20 | CI ワークフロー | |
| 21 | デプロイ/プレビュー WF + dependabot + minimumReleaseAge | ✅ Secrets 登録 |
| 22 | README + 最終全体レビュー | ✅ デザインレビュー |

---

### Task 1: プロジェクト scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `index.html`, `.gitignore`, `src/app/main.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `src/index.css`, `src/test-setup.ts`

**Interfaces:**
- Produces: `pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm lint` が動く開発基盤。`App` コンポーネント（後続タスクが段階的に置き換える）

- [ ] **Step 1: 環境と最新バージョンの確認**

```bash
node --version   # v24.x であること（>=24 <25）
pnpm --version   # 出力値を packageManager に使う
for p in react react-dom zod maplibre-gl pmtiles typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @types/node @biomejs/biome tsx wrangler; do echo "$p: $(npm view $p version)"; done
```

出力された最新安定版を Step 2 の `^X.Y.Z` に記入する。

- [ ] **Step 2: package.json を作成**

```json
{
  "name": "world-history-atlas",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@<pnpm --version の値>",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "vite",
    "build": "pnpm validate-data && tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write .",
    "validate-data": "tsx scripts/validate-data.ts",
    "tiles:build": "scripts/build-tiles.sh",
    "deploy:cf": "pnpm build && wrangler deploy"
  },
  "dependencies": {
    "maplibre-gl": "^X.Y.Z",
    "pmtiles": "^X.Y.Z",
    "react": "^X.Y.Z",
    "react-dom": "^X.Y.Z",
    "zod": "^X.Y.Z"
  },
  "devDependencies": {
    "@biomejs/biome": "^X.Y.Z",
    "@tailwindcss/vite": "^X.Y.Z",
    "@testing-library/jest-dom": "^X.Y.Z",
    "@testing-library/react": "^X.Y.Z",
    "@testing-library/user-event": "^X.Y.Z",
    "@types/node": "^X.Y.Z",
    "@types/react": "^X.Y.Z",
    "@types/react-dom": "^X.Y.Z",
    "@vitejs/plugin-react": "^X.Y.Z",
    "jsdom": "^X.Y.Z",
    "tailwindcss": "^X.Y.Z",
    "tsx": "^X.Y.Z",
    "typescript": "^X.Y.Z",
    "vite": "^X.Y.Z",
    "vitest": "^X.Y.Z",
    "wrangler": "^X.Y.Z"
  }
}
```

`deploy` という script 名は pnpm 組み込みコマンドに握られてサイレント no-op になるため使わない（`deploy:cf` にしている）。

- [ ] **Step 3: 設定ファイル群を作成**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>世界史マップ</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:

```css
@import "tailwindcss";
```

`src/app/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
```

`src/app/App.tsx`:

```tsx
export function App() {
  return <h1 className="p-4 text-xl font-bold">世界史マップ</h1>;
}
```

`src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

`.gitignore`:

```
node_modules/
dist/
.cache/
.wrangler/
.superpowers/
test-results/
playwright-report/
```

- [ ] **Step 4: Biome を初期化**

```bash
pnpm install
pnpm exec biome init
```

生成された `biome.json` に以下の調整を加える（生成版のスキーマ URL・バージョンは残す）:

```jsonc
// biome.json の該当キーをこの内容に揃える
{
  "formatter": { "indentStyle": "space", "indentWidth": 2 },
  "javascript": { "formatter": { "quoteStyle": "single" } },
  "files": { "includes": ["**", "!public/tiles", "!.features-gen"] }
}
```

除外はフォルダ形式（`/**` なし）で書く。`/**` 付きだと Biome が `useBiomeIgnoreFolder` 警告を出す。

- [ ] **Step 5: 失敗するテストを書く**

`src/app/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('アプリ名を表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '世界史マップ' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: テスト・lint・typecheck・dev サーバーを検証**

```bash
pnpm test        # PASS 1 件
pnpm typecheck   # エラーなし
pnpm lint        # エラーなし（警告が出たら biome format --write . で解消）
pnpm dev         # localhost:5173 で「世界史マップ」が表示されることを確認して停止
```

- [ ] **Step 7: コミット**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig.json biome.json index.html .gitignore src/
git commit -m "chore: scaffold Vite + React + TypeScript + Tailwind project"
```

---

### Task 2: nix flake + ベースマップタイル生成

**Files:**
- Create: `flake.nix`, `scripts/build-tiles.sh`, `scripts/check-tiles.sh`, `scripts/tile-sources.sha256`
- Create（生成物）: `flake.lock`, `public/tiles/basemap.pmtiles`

**Interfaces:**
- Produces: `public/tiles/basemap.pmtiles`（レイヤー名 `land` / `rivers` / `lakes`、z0〜z7）。Task 6 の地図スタイルはこのレイヤー名を `source-layer` として参照する。`scripts/check-tiles.sh`（CI が呼ぶ）

- [ ] **Step 1: flake.nix を作成**

```nix
{
  description = "world-history-atlas tile pipeline";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.tippecanoe pkgs.gdal pkgs.curl pkgs.unzip pkgs.nodejs_24 pkgs.pnpm ];
        };
      });
    };
}
```

- [ ] **Step 2: devShell を検証**

```bash
nix develop -c tippecanoe --version   # tippecanoe vX.Y.Z が表示される
nix develop -c node --version         # v24.x が表示される（devShell が Node 24 を提供）
nix develop -c pnpm install           # Node 24 の実行環境で依存を解決できる
nix develop -c pnpm test && nix develop -c pnpm typecheck && nix develop -c pnpm lint
# ↑ Node 24 上でツールチェーン全体が動くことの統合検証（Task 1 は Node 26 環境で検証されたため、ここがゲート）
nix develop -c ogr2ogr --version      # GDAL X.Y.Z が表示される
```

初回は flake.lock が生成される。`nixos-25.11` が存在しない場合は `nix flake update` 時のエラーメッセージに従い現行安定チャネル名に読み替える。

- [ ] **Step 3: build-tiles.sh を作成**

`scripts/build-tiles.sh`（`chmod +x` する）:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE_DIR=.cache/naturalearth
BUILD_DIR=.cache/build
OUT=public/tiles/basemap.pmtiles
BASE_URL="https://naturalearth.s3.amazonaws.com/10m_physical"
LAYERS=(ne_10m_land ne_10m_rivers_lake_centerlines ne_10m_lakes)
MAX_BYTES=$((25 * 1024 * 1024))

mkdir -p "$CACHE_DIR" "$BUILD_DIR" public/tiles

for layer in "${LAYERS[@]}"; do
  zip="$CACHE_DIR/$layer.zip"
  [ -f "$zip" ] || curl -fL "$BASE_URL/$layer.zip" -o "$zip"
done

if [ ! -s scripts/tile-sources.sha256 ]; then
  echo "ERROR: scripts/tile-sources.sha256 がない。ソースを意図的に更新する場合は .cache/naturalearth/ の zip から再生成してコミットする（README 参照）" >&2
  exit 1
fi
(cd "$CACHE_DIR" && shasum -a 256 -c "$OLDPWD/scripts/tile-sources.sha256")

for layer in "${LAYERS[@]}"; do
  unzip -o "$CACHE_DIR/$layer.zip" -d "$BUILD_DIR/$layer" >/dev/null
  ogr2ogr -f GeoJSONSeq "$BUILD_DIR/$layer.geojsonl" "$BUILD_DIR/$layer/$layer.shp"
done

tippecanoe -o "$OUT" --force -Z0 -z7 -X \
  --coalesce-densest-as-needed \
  -L land:"$BUILD_DIR/ne_10m_land.geojsonl" \
  -L rivers:"$BUILD_DIR/ne_10m_rivers_lake_centerlines.geojsonl" \
  -L lakes:"$BUILD_DIR/ne_10m_lakes.geojsonl"

size=$(wc -c < "$OUT" | tr -d ' ')
if [ "$size" -ge "$MAX_BYTES" ]; then
  echo "ERROR: $OUT is $size bytes (limit: $MAX_BYTES)" >&2
  exit 1
fi
echo "OK: $OUT ($size bytes)"
```

`-X` は全属性を除外する（属性はテーマデータ側が持つためタイルには不要。サイズ削減）。URL が 404 の場合は Natural Earth 公式サイトのダウンロードリンク先（S3 バケット名）を確認して `BASE_URL` を更新し、変更理由をコミットメッセージに書く。

- [ ] **Step 4: checksums を記録**

```bash
nix develop -c scripts/build-tiles.sh   # 初回: ダウンロード後、checksums 未生成の ERROR で停止する
(cd .cache/naturalearth && shasum -a 256 *.zip) > scripts/tile-sources.sha256
nix develop -c scripts/build-tiles.sh   # 2 回目: チェックサム検証込みで成功する
```

Expected: 2 回目の実行で `ne_10m_*.zip: OK` × 3 と `OK: public/tiles/basemap.pmtiles (NNN bytes)` が表示される。サイズが 25 MiB を超えた場合は `-z7` を `-z6` に下げて再生成し、それでも超えるならブロックとして報告する。

- [ ] **Step 5: check-tiles.sh を作成（CI 用）**

`scripts/check-tiles.sh`（`chmod +x` する）:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/tiles/basemap.pmtiles
MAX_BYTES=$((25 * 1024 * 1024))
[ -f "$OUT" ] || { echo "ERROR: $OUT がない。'pnpm tiles:build' で生成してコミットする" >&2; exit 1; }
size=$(wc -c < "$OUT" | tr -d ' ')
[ "$size" -lt "$MAX_BYTES" ] || { echo "ERROR: $OUT is $size bytes (limit: $MAX_BYTES)" >&2; exit 1; }
echo "OK: $OUT ($size bytes)"
```

```bash
scripts/check-tiles.sh   # OK: public/tiles/basemap.pmtiles (NNN bytes)
```

- [ ] **Step 6: コミット**

```bash
git add flake.nix flake.lock scripts/build-tiles.sh scripts/check-tiles.sh scripts/tile-sources.sha256 public/tiles/basemap.pmtiles
git commit -m "feat: add nix-based tile pipeline and generated basemap PMTiles"
```

---

### Task 3: Result 型 + テーマ zod スキーマ

**Files:**
- Create: `src/shared/result.ts`, `src/shared/result.test.ts`, `src/theme/schema.ts`, `src/theme/schema.test.ts`

**Interfaces:**
- Produces:
  - `Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`、`ok(value)`、`err(error)`
  - `themeSchema` / `themeIndexSchema`（zod スキーマ）
  - 型: `Theme`, `ThemeFeature`（`kind: 'city' | 'terrain'` の直和型）, `ThemeIndexEntry`, `TerrainKind`, `Importance`
  - 定数: `TERRAIN_KINDS`, `MAX_DESCRIPTION_LENGTH = 120`

- [ ] **Step 1: Result の失敗するテストを書く**

`src/shared/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result', () => {
  it('ok は成功の値を包む', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('err は失敗の値を包む', () => {
    const result = err('boom');
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm vitest run src/shared/result.test.ts`
Expected: FAIL（`./result` が存在しない）

- [ ] **Step 3: Result を実装**

`src/shared/result.ts`:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

Run: `pnpm vitest run src/shared/result.test.ts`
Expected: PASS 2 件

- [ ] **Step 4: スキーマの失敗するテストを書く**

`src/theme/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { themeIndexSchema, themeSchema } from './schema';

const validCity = {
  id: 'babylon',
  kind: 'city',
  name: 'バビロン',
  coordinates: [44.421, 32.542],
  importance: 1,
  description: 'ハンムラビ王の時代に栄えたメソポタミアの中心都市。新バビロニアの都。',
};

const validTerrain = {
  id: 'euphrates',
  kind: 'terrain',
  terrainKind: 'river',
  name: 'ユーフラテス川',
  coordinates: [43.5, 34.5],
  importance: 1,
  description: 'メソポタミア文明を育んだ大河。肥沃な三日月地帯を形成した。',
};

const validTheme = {
  id: 'ancient-orient',
  title: '古代オリエント',
  era: '前3000年頃〜前330年',
  summary: 'メソポタミアとエジプトに最古の都市文明が生まれた。',
  bounds: [25.0, 22.0, 60.0, 42.0],
  features: [validCity, validTerrain],
};

describe('themeSchema', () => {
  it('正しいテーマを受理する', () => {
    expect(themeSchema.safeParse(validTheme).success).toBe(true);
  });

  it('city に terrainKind があると拒否する', () => {
    const theme = {
      ...validTheme,
      features: [{ ...validCity, terrainKind: 'river' }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('terrain に terrainKind がないと拒否する', () => {
    const { terrainKind: _drop, ...noKind } = validTerrain;
    expect(themeSchema.safeParse({ ...validTheme, features: [noKind] }).success).toBe(false);
  });

  it('経度が範囲外なら拒否する', () => {
    const theme = { ...validTheme, features: [{ ...validCity, coordinates: [181, 0] }] };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('importance が 1..3 以外なら拒否する', () => {
    const theme = { ...validTheme, features: [{ ...validCity, importance: 4 }] };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('description が 120 文字を超えると拒否する', () => {
    const theme = {
      ...validTheme,
      features: [{ ...validCity, description: 'あ'.repeat(121) }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('west >= east の bounds を拒否する', () => {
    expect(themeSchema.safeParse({ ...validTheme, bounds: [60, 22, 25, 42] }).success).toBe(false);
  });

  it('テーマ内のフィーチャー id 重複を拒否する', () => {
    const theme = { ...validTheme, features: [validCity, { ...validTerrain, id: 'babylon' }] };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });
});

describe('themeIndexSchema', () => {
  it('正しい一覧を受理する', () => {
    const index = [{ id: 'ancient-orient', title: '古代オリエント', era: '前3000年頃〜前330年', order: 1 }];
    expect(themeIndexSchema.safeParse(index).success).toBe(true);
  });

  it('order が整数でなければ拒否する', () => {
    const index = [{ id: 'a', title: 'A', era: 'era', order: 1.5 }];
    expect(themeIndexSchema.safeParse(index).success).toBe(false);
  });
});
```

- [ ] **Step 5: テストが失敗することを確認**

Run: `pnpm vitest run src/theme/schema.test.ts`
Expected: FAIL（`./schema` が存在しない）

- [ ] **Step 6: スキーマを実装**

`src/theme/schema.ts`:

```ts
import { z } from 'zod';

export const MAX_DESCRIPTION_LENGTH = 120;

export const TERRAIN_KINDS = ['river', 'mountain', 'sea', 'strait', 'lake', 'desert', 'region'] as const;

const idSchema = z.string().regex(/^[a-z0-9-]+$/);

const coordinatesSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const importanceSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const featureBase = {
  id: idSchema,
  name: z.string().min(1),
  coordinates: coordinatesSchema,
  importance: importanceSchema,
  description: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
};

const cityFeatureSchema = z.strictObject({ kind: z.literal('city'), ...featureBase });

const terrainFeatureSchema = z.strictObject({
  kind: z.literal('terrain'),
  terrainKind: z.enum(TERRAIN_KINDS),
  ...featureBase,
});

const themeFeatureSchema = z.discriminatedUnion('kind', [cityFeatureSchema, terrainFeatureSchema]);

const boundsSchema = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .refine(([west, south, east, north]) => west < east && south < north, {
    message: 'bounds は [west, south, east, north] で west < east かつ south < north',
  });

export const themeSchema = z
  .strictObject({
    id: idSchema,
    title: z.string().min(1),
    era: z.string().min(1),
    summary: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
    bounds: boundsSchema,
    features: z.array(themeFeatureSchema).min(1),
  })
  .refine((theme) => new Set(theme.features.map((f) => f.id)).size === theme.features.length, {
    message: 'フィーチャー id が重複している',
  });

export const themeIndexSchema = z.array(
  z.strictObject({
    id: idSchema,
    title: z.string().min(1),
    era: z.string().min(1),
    order: z.number().int(),
  }),
);

export type Theme = z.infer<typeof themeSchema>;
export type ThemeFeature = z.infer<typeof themeFeatureSchema>;
export type ThemeIndexEntry = z.infer<typeof themeIndexSchema>[number];
export type TerrainKind = (typeof TERRAIN_KINDS)[number];
export type Importance = z.infer<typeof importanceSchema>;
```

`z.strictObject` を使い、未知キー（`city` への `terrainKind` 混入など）を拒否する。

- [ ] **Step 7: テスト・lint を検証しコミット**

```bash
pnpm vitest run src/theme/schema.test.ts src/shared/result.test.ts   # 全 PASS
pnpm lint && pnpm typecheck
git add src/shared/ src/theme/
git commit -m "feat: add Result type and theme zod schema"
```

---

### Task 4: データ検証 + サンプルテーマ

**Files:**
- Create: `src/theme/validation.ts`, `src/theme/validation.test.ts`, `scripts/validate-data.ts`
- Create: `public/data/themes/index.json`, `public/data/themes/ancient-orient.json`, `public/data/themes/ancient-greece.json`

**Interfaces:**
- Consumes: `themeSchema` / `themeIndexSchema` / 型（Task 3）
- Produces:
  - `validateThemeData(index: ThemeIndexEntry[], themes: Theme[]): ValidationIssue[]`（純粋関数）
  - `ValidationIssue = { level: 'error' | 'warning'; message: string }`
  - `pnpm validate-data`（エラーで exit 1、警告のみなら exit 0）
  - サンプルテーマ 2 件（E2E がテーマ切替を検証するために 2 件必要）

- [ ] **Step 1: 検証ロジックの失敗するテストを書く**

`src/theme/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Theme, ThemeIndexEntry } from './schema';
import { validateThemeData } from './validation';

function makeTheme(overrides: Partial<Theme>): Theme {
  return {
    id: 'theme-a',
    title: 'テーマA',
    era: '前100年〜後100年',
    summary: '概要。',
    bounds: [0, 0, 50, 50],
    features: [
      {
        id: 'city-a',
        kind: 'city',
        name: '都市A',
        coordinates: [10, 10],
        importance: 1,
        description: '解説。',
      },
    ],
    ...overrides,
  };
}

function makeIndex(...ids: string[]): ThemeIndexEntry[] {
  return ids.map((id, i) => ({ id, title: id, era: 'era', order: i + 1 }));
}

describe('validateThemeData', () => {
  it('整合したデータなら issue なし', () => {
    expect(validateThemeData(makeIndex('theme-a'), [makeTheme({})])).toEqual([]);
  });

  it('index にあるのにテーマファイルがなければ error', () => {
    const issues = validateThemeData(makeIndex('theme-a', 'theme-b'), [makeTheme({})]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('theme-b') }));
  });

  it('テーマファイルが index に載っていなければ error', () => {
    const issues = validateThemeData(makeIndex(), [makeTheme({})]);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('theme-a'))).toBe(true);
  });

  it('テーマ id が重複していれば error', () => {
    const issues = validateThemeData(makeIndex('theme-a'), [makeTheme({}), makeTheme({})]);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('theme-a'))).toBe(true);
  });

  it('同名フィーチャーの座標が 0.1 度以上ズレていれば error', () => {
    const themeA = makeTheme({});
    const themeB = makeTheme({
      id: 'theme-b',
      features: [{ id: 'city-a2', kind: 'city', name: '都市A', coordinates: [10.2, 10], importance: 1, description: '解説。' }],
    });
    const issues = validateThemeData(makeIndex('theme-a', 'theme-b'), [themeA, themeB]);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('都市A'))).toBe(true);
  });

  it('同名フィーチャーの座標が 0.1 度未満のズレなら issue なし', () => {
    const themeA = makeTheme({});
    const themeB = makeTheme({
      id: 'theme-b',
      features: [{ id: 'city-a2', kind: 'city', name: '都市A', coordinates: [10.05, 10.05], importance: 1, description: '解説。' }],
    });
    expect(validateThemeData(makeIndex('theme-a', 'theme-b'), [themeA, themeB])).toEqual([]);
  });

  it('bounds 外のフィーチャーは warning', () => {
    const theme = makeTheme({
      features: [{ id: 'city-a', kind: 'city', name: '都市A', coordinates: [60, 10], importance: 1, description: '解説。' }],
    });
    const issues = validateThemeData(makeIndex('theme-a'), [theme]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning', message: expect.stringContaining('city-a') }));
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm vitest run src/theme/validation.test.ts`
Expected: FAIL（`./validation` が存在しない）

- [ ] **Step 3: 検証ロジックを実装**

`src/theme/validation.ts`:

```ts
import type { Theme, ThemeIndexEntry } from './schema';

export type ValidationIssue = { level: 'error' | 'warning'; message: string };

const COORDINATE_MISMATCH_THRESHOLD = 0.1;

export function validateThemeData(index: ThemeIndexEntry[], themes: Theme[]): ValidationIssue[] {
  return [
    ...checkIndexThemeConsistency(index, themes),
    ...checkThemeIdUniqueness(themes),
    ...checkSameNameCoordinates(themes),
    ...checkFeaturesWithinBounds(themes),
  ];
}

function checkIndexThemeConsistency(index: ThemeIndexEntry[], themes: Theme[]): ValidationIssue[] {
  const indexIds = new Set(index.map((entry) => entry.id));
  const themeIds = new Set(themes.map((theme) => theme.id));
  const issues: ValidationIssue[] = [];
  for (const id of indexIds) {
    if (!themeIds.has(id)) {
      issues.push({ level: 'error', message: `index.json の「${id}」に対応するテーマファイルがない` });
    }
  }
  for (const id of themeIds) {
    if (!indexIds.has(id)) {
      issues.push({ level: 'error', message: `テーマ「${id}」が index.json に載っていない` });
    }
  }
  return issues;
}

function checkThemeIdUniqueness(themes: Theme[]): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const theme of themes) {
    if (seen.has(theme.id)) {
      issues.push({ level: 'error', message: `テーマ id「${theme.id}」が重複している` });
    }
    seen.add(theme.id);
  }
  return issues;
}

function checkSameNameCoordinates(themes: Theme[]): ValidationIssue[] {
  const byName = new Map<string, { themeId: string; coordinates: readonly [number, number] }[]>();
  for (const theme of themes) {
    for (const feature of theme.features) {
      const entries = byName.get(feature.name) ?? [];
      entries.push({ themeId: theme.id, coordinates: feature.coordinates });
      byName.set(feature.name, entries);
    }
  }
  const issues: ValidationIssue[] = [];
  for (const [name, entries] of byName) {
    const [first, ...rest] = entries;
    if (!first) continue;
    for (const entry of rest) {
      const lonGap = Math.abs(first.coordinates[0] - entry.coordinates[0]);
      const latGap = Math.abs(first.coordinates[1] - entry.coordinates[1]);
      if (lonGap >= COORDINATE_MISMATCH_THRESHOLD || latGap >= COORDINATE_MISMATCH_THRESHOLD) {
        issues.push({
          level: 'error',
          message: `「${name}」の座標がテーマ間で食い違っている（${first.themeId} と ${entry.themeId}）`,
        });
      }
    }
  }
  return issues;
}

function checkFeaturesWithinBounds(themes: Theme[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const theme of themes) {
    const [west, south, east, north] = theme.bounds;
    for (const feature of theme.features) {
      const [lon, lat] = feature.coordinates;
      if (lon < west || lon > east || lat < south || lat > north) {
        issues.push({
          level: 'warning',
          message: `テーマ「${theme.id}」のフィーチャー「${feature.id}」が bounds の外にある`,
        });
      }
    }
  }
  return issues;
}
```

Run: `pnpm vitest run src/theme/validation.test.ts`
Expected: PASS 7 件

- [ ] **Step 4: サンプルテーマデータを作成**

`public/data/themes/index.json`:

```json
[
  { "id": "ancient-orient", "title": "古代オリエント", "era": "前3000年頃〜前330年", "order": 1 },
  { "id": "ancient-greece", "title": "古代ギリシア", "era": "前800年頃〜前338年", "order": 2 }
]
```

`public/data/themes/ancient-orient.json`:

```json
{
  "id": "ancient-orient",
  "title": "古代オリエント",
  "era": "前3000年頃〜前330年",
  "summary": "メソポタミアとエジプトに最古の都市文明が生まれ、統一帝国が興亡した。",
  "bounds": [25.0, 22.0, 60.0, 42.0],
  "features": [
    { "id": "babylon", "kind": "city", "name": "バビロン", "coordinates": [44.421, 32.542], "importance": 1, "description": "ハンムラビ王の時代に栄えたメソポタミアの中心都市。新バビロニアの都となった。" },
    { "id": "ur", "kind": "city", "name": "ウル", "coordinates": [46.103, 30.961], "importance": 2, "description": "シュメール人の都市国家。ジッグラトの遺構が残る。" },
    { "id": "uruk", "kind": "city", "name": "ウルク", "coordinates": [45.636, 31.322], "importance": 3, "description": "シュメール最古級の都市国家。ギルガメシュ伝説の舞台とされる。" },
    { "id": "nineveh", "kind": "city", "name": "ニネヴェ", "coordinates": [43.153, 36.360], "importance": 2, "description": "アッシリア帝国後期の都。アッシュルバニパル王の図書館が置かれた。" },
    { "id": "memphis", "kind": "city", "name": "メンフィス", "coordinates": [31.251, 29.844], "importance": 1, "description": "古王国時代のエジプトの都。ナイル川下流域に位置する。" },
    { "id": "thebes-egypt", "kind": "city", "name": "テーベ", "coordinates": [32.639, 25.720], "importance": 1, "description": "中王国・新王国時代のエジプトの都。カルナック神殿が造営された。" },
    { "id": "euphrates", "kind": "terrain", "terrainKind": "river", "name": "ユーフラテス川", "coordinates": [42.8, 33.6], "importance": 1, "description": "メソポタミア文明を育んだ大河。ティグリス川とともに肥沃な三日月地帯を形成した。" },
    { "id": "tigris", "kind": "terrain", "terrainKind": "river", "name": "ティグリス川", "coordinates": [43.9, 34.2], "importance": 1, "description": "メソポタミア東部を流れる大河。流域にアッシリアの中心都市が栄えた。" },
    { "id": "nile", "kind": "terrain", "terrainKind": "river", "name": "ナイル川", "coordinates": [31.7, 26.5], "importance": 1, "description": "エジプト文明を育んだ大河。定期的な氾濫が肥沃な耕地をもたらした。" }
  ]
}
```

`public/data/themes/ancient-greece.json`:

```json
{
  "id": "ancient-greece",
  "title": "古代ギリシア",
  "era": "前800年頃〜前338年",
  "summary": "エーゲ海周辺に多数のポリスが成立し、独自の文化が栄えた。",
  "bounds": [19.0, 34.5, 28.5, 41.5],
  "features": [
    { "id": "athens", "kind": "city", "name": "アテネ", "coordinates": [23.727, 37.984], "importance": 1, "description": "ポリスの代表格。民主政が発達し、パルテノン神殿が建てられた。" },
    { "id": "sparta", "kind": "city", "name": "スパルタ", "coordinates": [22.430, 37.075], "importance": 1, "description": "軍国主義的な体制をとったポリス。ペロポネソス戦争でアテネと争った。" },
    { "id": "delphi", "kind": "city", "name": "デルフォイ", "coordinates": [22.501, 38.482], "importance": 2, "description": "アポロン神殿の神託で知られる聖地。" },
    { "id": "olympia", "kind": "city", "name": "オリンピア", "coordinates": [21.630, 37.638], "importance": 2, "description": "4年ごとの祭典競技（古代オリンピック）が開かれた聖地。" },
    { "id": "aegean-sea", "kind": "terrain", "terrainKind": "sea", "name": "エーゲ海", "coordinates": [25.3, 38.5], "importance": 1, "description": "ギリシア本土と小アジアに挟まれた海。ポリスの交易と植民活動の舞台となった。" },
    { "id": "peloponnesus", "kind": "terrain", "terrainKind": "region", "name": "ペロポネソス半島", "coordinates": [22.3, 37.5], "importance": 2, "description": "ギリシア南部の半島。スパルタなどの有力ポリスが位置した。" }
  ]
}
```

座標・記述は実装時に事実確認すること（座標は遺跡・現代都市の実座標、解説は教科書レベルの事実）。誤りを見つけたらデータを直す（テストや検証を緩めない）。

- [ ] **Step 5: validate-data スクリプトを作成**

`scripts/validate-data.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { themeIndexSchema, themeSchema } from '../src/theme/schema';
import type { Theme } from '../src/theme/schema';
import { validateThemeData, type ValidationIssue } from '../src/theme/validation';

const DATA_DIR = path.join(import.meta.dirname, '../public/data/themes');

async function main(): Promise<void> {
  const issues: ValidationIssue[] = [];

  const indexRaw = JSON.parse(await readFile(path.join(DATA_DIR, 'index.json'), 'utf8'));
  const indexParsed = themeIndexSchema.safeParse(indexRaw);
  if (!indexParsed.success) {
    fail([{ level: 'error', message: `index.json: ${indexParsed.error.message}` }]);
    return;
  }

  const themes: Theme[] = [];
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json') && f !== 'index.json');
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
    const parsed = themeSchema.safeParse(raw);
    if (parsed.success) {
      themes.push(parsed.data);
      if (`${parsed.data.id}.json` !== file) {
        issues.push({ level: 'error', message: `${file}: ファイル名とテーマ id「${parsed.data.id}」が一致しない` });
      }
    } else {
      issues.push({ level: 'error', message: `${file}: ${parsed.error.message}` });
    }
  }

  issues.push(...validateThemeData(indexParsed.data, themes));
  fail(issues);
}

function fail(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    console.log(`[${issue.level}] ${issue.message}`);
  }
  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  if (errorCount > 0) {
    console.error(`NG: ${errorCount} 件のエラー`);
    process.exitCode = 1;
  } else {
    console.log(`OK: テーマデータの検証を通過（警告 ${issues.length} 件）`);
  }
}

await main();
```

- [ ] **Step 6: 検証を実行しコミット**

```bash
pnpm validate-data   # OK: テーマデータの検証を通過（警告 0 件）
pnpm test && pnpm lint && pnpm typecheck
git add src/theme/validation.ts src/theme/validation.test.ts scripts/validate-data.ts public/data/themes/
git commit -m "feat: add theme data validation and sample themes"
```

---

### Task 5: テーマ fetch

**Files:**
- Create: `src/theme/fetch.ts`, `src/theme/fetch.test.ts`

**Interfaces:**
- Consumes: `Result` / `ok` / `err`（Task 3）、`themeSchema` / `themeIndexSchema`（Task 3）
- Produces:
  - `ThemeDataError = { type: 'network' } | { type: 'invalid-data'; detail: string }`
  - `fetchThemeIndex(fetchFn?: typeof fetch): Promise<Result<ThemeIndexEntry[], ThemeDataError>>`
  - `fetchTheme(id: string, fetchFn?: typeof fetch): Promise<Result<Theme, ThemeDataError>>`
  - データ URL 規約: `/data/themes/index.json`, `/data/themes/<id>.json`

- [ ] **Step 1: 失敗するテストを書く**

`src/theme/fetch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fetchTheme, fetchThemeIndex } from './fetch';

const validIndex = [{ id: 'ancient-orient', title: '古代オリエント', era: '前3000年頃〜前330年', order: 1 }];

function jsonResponse(body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status: 200 });
}

describe('fetchThemeIndex', () => {
  it('正しい JSON なら ok で返す', async () => {
    const result = await fetchThemeIndex(jsonResponse(validIndex));
    expect(result).toEqual({ ok: true, value: validIndex });
  });

  it('HTTP エラーなら network エラー', async () => {
    const notFound: typeof fetch = async () => new Response('not found', { status: 404 });
    const result = await fetchThemeIndex(notFound);
    expect(result).toEqual({ ok: false, error: { type: 'network' } });
  });

  it('fetch が例外を投げたら network エラー', async () => {
    const broken: typeof fetch = async () => {
      throw new TypeError('failed to fetch');
    };
    const result = await fetchThemeIndex(broken);
    expect(result).toEqual({ ok: false, error: { type: 'network' } });
  });

  it('スキーマ違反なら invalid-data エラー', async () => {
    const result = await fetchThemeIndex(jsonResponse([{ id: 'x' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('invalid-data');
  });

  it('JSON でないレスポンスなら invalid-data エラー', async () => {
    const html: typeof fetch = async () => new Response('<html></html>', { status: 200 });
    const result = await fetchThemeIndex(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('invalid-data');
  });
});

describe('fetchTheme', () => {
  it('テーマ id から URL を組み立てる', async () => {
    let requestedUrl = '';
    const spy: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response('{}', { status: 404 });
    };
    await fetchTheme('ancient-orient', spy);
    expect(requestedUrl).toBe('/data/themes/ancient-orient.json');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm vitest run src/theme/fetch.test.ts`
Expected: FAIL（`./fetch` が存在しない）

- [ ] **Step 3: fetch を実装**

`src/theme/fetch.ts`:

```ts
import type { ZodType } from 'zod';
import { err, ok, type Result } from '../shared/result';
import { themeIndexSchema, themeSchema, type Theme, type ThemeIndexEntry } from './schema';

export type ThemeDataError = { type: 'network' } | { type: 'invalid-data'; detail: string };

export function fetchThemeIndex(fetchFn: typeof fetch = fetch): Promise<Result<ThemeIndexEntry[], ThemeDataError>> {
  return fetchJson('/data/themes/index.json', themeIndexSchema, fetchFn);
}

export function fetchTheme(id: string, fetchFn: typeof fetch = fetch): Promise<Result<Theme, ThemeDataError>> {
  return fetchJson(`/data/themes/${id}.json`, themeSchema, fetchFn);
}

async function fetchJson<T>(url: string, schema: ZodType<T>, fetchFn: typeof fetch): Promise<Result<T, ThemeDataError>> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch {
    return err({ type: 'network' });
  }
  if (!response.ok) {
    return err({ type: 'network' });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return err({ type: 'invalid-data', detail: 'JSON として解釈できない' });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return err({ type: 'invalid-data', detail: parsed.error.message });
  }
  return ok(parsed.data);
}
```

- [ ] **Step 4: テストを検証しコミット**

```bash
pnpm vitest run src/theme/fetch.test.ts   # PASS 6 件
pnpm lint && pnpm typecheck
git add src/theme/fetch.ts src/theme/fetch.test.ts
git commit -m "feat: add theme data fetching with Result-based error handling"
```

---

### Task 6: 地図表示（PMTiles + ライトスタイル）

**Files:**
- Create: `src/map/mapColors.ts`, `src/map/mapStyle.ts`, `src/map/mapStyle.test.ts`, `src/map/MapView.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `public/tiles/basemap.pmtiles`（Task 2。source-layer: `land` / `rivers` / `lakes`）
- Produces:
  - `ColorTheme = 'light' | 'dark'`、`MAP_COLORS: Record<ColorTheme, MapColors>`（`src/map/mapColors.ts`）
  - `buildMapStyle(colorTheme: ColorTheme, origin: string): StyleSpecification`
  - `MapView` コンポーネント（props: `{ colorTheme: ColorTheme; onMapReady?: (map: maplibregl.Map) => void }`、`data-testid="map-view"`）
  - ズーム定数 `MIN_ZOOM = 1` / `MAX_ZOOM = 8`

- [ ] **Step 1: 地図色トークンを定義**

`src/map/mapColors.ts`（値は承認済みモックアップの配色。DESIGN.md への成文化は Task 14）:

```ts
export type ColorTheme = 'light' | 'dark';

export type MapColors = {
  sea: string;
  land: string;
  landOutline: string;
  river: string;
  lake: string;
};

export const MAP_COLORS: Record<ColorTheme, MapColors> = {
  light: {
    sea: '#cfe0ec',
    land: '#faf7ef',
    landOutline: '#9fb8c9',
    river: '#7fa8c9',
    lake: '#cfe0ec',
  },
  dark: {
    sea: '#1b222b',
    land: '#2e3844',
    landOutline: '#46586a',
    river: '#4a6a85',
    lake: '#1b222b',
  },
};
```

- [ ] **Step 2: スタイル生成の失敗するテストを書く**

`src/map/mapStyle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMapStyle } from './mapStyle';

describe('buildMapStyle', () => {
  const style = buildMapStyle('light', 'http://localhost:5173');

  it('PMTiles ソースを絶対 URL で参照する', () => {
    const source = style.sources.basemap;
    expect(source).toMatchObject({
      type: 'vector',
      url: 'pmtiles://http://localhost:5173/tiles/basemap.pmtiles',
    });
  });

  it('background / land / rivers / lakes のレイヤーを持つ', () => {
    expect(style.layers.map((layer) => layer.id)).toEqual(['background', 'land', 'land-outline', 'rivers', 'lakes']);
  });

  it('source-layer 名がタイルのレイヤー名と一致する', () => {
    const sourceLayers = style.layers.flatMap((layer) => ('source-layer' in layer ? [layer['source-layer']] : []));
    expect(sourceLayers).toEqual(['land', 'land', 'rivers', 'lakes']);
  });

  it('ライトとダークで配色が異なる', () => {
    const dark = buildMapStyle('dark', 'http://localhost:5173');
    expect(dark.layers[0]).not.toEqual(style.layers[0]);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `pnpm vitest run src/map/mapStyle.test.ts`
Expected: FAIL（`./mapStyle` が存在しない）

- [ ] **Step 4: スタイル生成を実装**

`src/map/mapStyle.ts`:

```ts
import type { StyleSpecification } from 'maplibre-gl';
import { MAP_COLORS, type ColorTheme } from './mapColors';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function buildMapStyle(colorTheme: ColorTheme, origin: string): StyleSpecification {
  const colors = MAP_COLORS[colorTheme];
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'vector',
        url: `pmtiles://${origin}/tiles/basemap.pmtiles`,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': colors.sea } },
      { id: 'land', type: 'fill', source: 'basemap', 'source-layer': 'land', paint: { 'fill-color': colors.land } },
      {
        id: 'land-outline',
        type: 'line',
        source: 'basemap',
        'source-layer': 'land',
        paint: { 'line-color': colors.landOutline, 'line-width': 0.6 },
      },
      {
        id: 'rivers',
        type: 'line',
        source: 'basemap',
        'source-layer': 'rivers',
        paint: { 'line-color': colors.river, 'line-width': 1 },
      },
      { id: 'lakes', type: 'fill', source: 'basemap', 'source-layer': 'lakes', paint: { 'fill-color': colors.lake } },
    ],
  };
}
```

Run: `pnpm vitest run src/map/mapStyle.test.ts`
Expected: PASS 4 件

- [ ] **Step 5: MapView コンポーネントを実装**

`src/map/MapView.tsx`（jsdom でテストできないため単体テストなし。E2E が検証する）:

```tsx
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useRef } from 'react';
import type { ColorTheme } from './mapColors';
import { buildMapStyle, MAX_ZOOM, MIN_ZOOM } from './mapStyle';

let isProtocolRegistered = false;

function ensurePmtilesProtocol(): void {
  if (isProtocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  isProtocolRegistered = true;
}

type MapViewProps = {
  colorTheme: ColorTheme;
  onMapReady?: (map: maplibregl.Map) => void;
};

export function MapView({ colorTheme, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const colorThemeRef = useRef(colorTheme);
  colorThemeRef.current = colorTheme;
  const appliedColorThemeRef = useRef(colorTheme);

  useEffect(() => {
    if (!containerRef.current) return;
    ensurePmtilesProtocol();
    appliedColorThemeRef.current = colorThemeRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(colorThemeRef.current, window.location.origin),
      center: [20, 25],
      zoom: MIN_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    onMapReadyRef.current?.(map);
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || appliedColorThemeRef.current === colorTheme) return;
    appliedColorThemeRef.current = colorTheme;
    mapRef.current.setStyle(buildMapStyle(colorTheme, window.location.origin));
  }, [colorTheme]);

  return <div ref={containerRef} className="h-full w-full" data-testid="map-view" />;
}
```

`src/app/App.tsx` を全画面地図に置き換える:

```tsx
import { MapView } from '../map/MapView';

export function App() {
  return (
    <div className="h-dvh w-dvw">
      <h1 className="sr-only">世界史マップ</h1>
      <MapView colorTheme="light" />
    </div>
  );
}
```

`App.test.tsx` は heading が sr-only になっても通る（`getByRole('heading')` は hidden 要素も返すが、`sr-only` は visibility を消さない）。ただし jsdom で MapView がクラッシュしないよう、`App.test.tsx` に maplibre のモックを追加する:

```tsx
// App.test.tsx の先頭に追加
import { vi } from 'vitest';

vi.mock('../map/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));
```

- [ ] **Step 6: 実ブラウザで確認**

```bash
pnpm test && pnpm lint && pnpm typecheck
pnpm dev   # サンドボックス起因の EPERM が出たらサンドボックス外で再実行
```

playwright-cli で `http://localhost:5173` を開き、スクリーンショットを撮って以下を目視確認する:
- 海（淡青）と陸（アイボリー）が描画されている
- ズームイン（z7 付近）で河川・湖が見える
- コンソールにタイル取得エラーが出ていない

- [ ] **Step 7: コミット**

```bash
git add src/map/ src/app/App.tsx src/app/App.test.tsx package.json pnpm-lock.yaml
git commit -m "feat: render PMTiles basemap with MapLibre"
```

---

### Task 7: E2E 基盤（playwright-bdd + スモーク）

**Files:**
- Create: `playwright.config.ts`, `e2e/features/app-boot.feature`, `e2e/steps/fixtures.ts`, `e2e/steps/app.steps.ts`
- Modify: `package.json`（scripts と devDependencies）, `.gitignore`

**Interfaces:**
- Consumes: `data-testid="map-view"`（Task 6）
- Produces:
  - `pnpm e2e`（`@wip` 以外の全シナリオ）/ `pnpm e2e:smoke`（`@smoke` のみ）
  - ステップ定義の書き方の規範（正規表現ステップ + createBdd）。後続タスクはこの形式に従う
  - Playwright プロジェクト: `desktop`（`@mobile` を除外）と `mobile`（全件）

- [ ] **Step 1: 依存を追加**

```bash
npm view @playwright/test version && npm view playwright-bdd version
pnpm add -D @playwright/test@^X.Y.Z playwright-bdd@^X.Y.Z
pnpm exec playwright install chromium
```

- [ ] **Step 2: playwright.config.ts を作成**

```ts
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: 'e2e/steps/**/*.ts',
});

export default defineConfig({
  testDir,
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

`package.json` の scripts に追加:

```json
{
  "e2e": "bddgen --tags \"not @wip\" && playwright test",
  "e2e:smoke": "bddgen --tags \"@smoke and not @wip\" && playwright test"
}
```

`.gitignore` に追記:

```
.features-gen/
```

- [ ] **Step 3: スモーク feature を書く**

`e2e/features/app-boot.feature`:

```gherkin
@smoke
Feature: アプリの起動

  Scenario: 地図が表示される
    Given アプリを開いている
    Then 地図が表示されている
```

- [ ] **Step 4: fixtures とステップを実装**

`e2e/steps/fixtures.ts`（後続タスクでヘルパーを足していく土台）:

```ts
import { createBdd } from 'playwright-bdd';

export const { Given, When, Then } = createBdd();
```

`e2e/steps/app.steps.ts`:

```ts
import { expect } from '@playwright/test';
import { Given, Then } from './fixtures';

Given('アプリを開いている', async ({ page }) => {
  await page.goto('/');
});

Then('地図が表示されている', async ({ page }) => {
  await expect(page.getByTestId('map-view')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
```

`「…」` 内の引数を受けるステップは、後続タスクで必ず正規表現で定義する（例: `` Given(/^テーマ「(.+)」を選択している$/, …) ``）。Cucumber expression の `{string}` は `"…"` 引用にしかマッチしないため使わない。

- [ ] **Step 5: E2E を実行**

```bash
pnpm e2e
```

Expected: desktop プロジェクトで 1 PASS（mobile プロジェクトは `@mobile` タグ付きシナリオのみ実行するため、この時点では 0 件）。サンドボックス起因の失敗（ポート listen 等）はサンドボックス外で再実行する。

- [ ] **Step 6: コミット**

```bash
git add playwright.config.ts e2e/ package.json pnpm-lock.yaml .gitignore
git commit -m "feat: add playwright-bdd E2E infrastructure with smoke test"
```

---

### Task 8: E2E テスト仕様書（.feature 全量起草）【要ユーザー対話: .feature レビュー】

**Files:**
- Create: `e2e/features/theme-selection.feature`, `e2e/features/feature-detail.feature`, `e2e/features/importance-filter.feature`, `e2e/features/color-theme.feature`, `e2e/features/error-handling.feature`, `e2e/features/mobile.feature`

**Interfaces:**
- Consumes: サンプルテーマデータ（Task 4。シナリオ中の固有名詞はこのデータに実在するものを使う）
- Produces: MVP 全機能の受け入れ基準（`@wip` タグ付き）。Task 9〜16 は各自の機能の `@wip` を外し、シナリオを green にする責務を負う

- [ ] **Step 1: .feature を起草する**

全ファイル共通: Feature 直下に `@wip` を付ける（実装済みになったタスクが外す）。以下の内容で作成する。

`e2e/features/theme-selection.feature`:

```gherkin
@wip
Feature: テーマ選択

  Background:
    Given アプリを開いている

  Scenario: サイドバーにテーマが時代順で一覧表示される
    Then サイドバーにテーマ「古代オリエント」が表示されている
    And サイドバーにテーマ「古代ギリシア」が表示されている

  Scenario: テーマを選択するとマーカーが表示される
    When テーマ「古代オリエント」を選択する
    Then 都市マーカー「バビロン」が表示されている
    And 地形ラベル「ユーフラテス川」が表示されている

  Scenario: テーマを選択すると URL に反映される
    When テーマ「古代オリエント」を選択する
    Then URL のクエリが「theme=ancient-orient」を含んでいる

  Scenario: テーマ直リンクを開くと選択済みの状態になる
    Given クエリ「?theme=ancient-greece」でアプリを開いている
    Then 都市マーカー「アテネ」が表示されている

  Scenario: テーマを切り替えると前のテーマのマーカーが消える
    When テーマ「古代オリエント」を選択する
    And テーマ「古代ギリシア」を選択する
    Then 都市マーカー「アテネ」が表示されている
    And 都市マーカー「バビロン」が表示されていない
```

`e2e/features/feature-detail.feature`:

```gherkin
@wip
Feature: フィーチャーの解説表示

  Background:
    Given アプリを開いている
    And テーマ「古代オリエント」を選択している

  Scenario: 都市マーカーをクリックすると解説パネルが表示される
    When 都市マーカー「バビロン」をクリックする
    Then 解説パネルに「バビロン」と表示されている
    And 解説パネルに「メソポタミア」を含む解説文が表示されている
    And 解説パネルに頻出度「★1」が表示されている

  Scenario: 地形ラベルをクリックしても解説パネルが表示される
    When 地形ラベル「ユーフラテス川」をクリックする
    Then 解説パネルに「ユーフラテス川」と表示されている

  Scenario: 解説パネルを閉じられる
    Given 都市マーカー「バビロン」をクリックする
    When 解説パネルの閉じるボタンをクリックする
    Then 解説パネルが表示されていない
```

`e2e/features/importance-filter.feature`:

```gherkin
@wip
Feature: 頻出度フィルタ

  Background:
    Given アプリを開いている
    And テーマ「古代オリエント」を選択している

  Scenario Outline: フィルタで対象の頻出度だけが表示される
    When 頻出度フィルタを「<フィルタ>」に切り替える
    Then 都市マーカー「<表示される>」が表示されている
    And 都市マーカー「<表示されない>」が表示されていない

    Examples:
      | フィルタ | 表示される | 表示されない |
      | ★1のみ   | バビロン   | ウル         |
      | ★1〜2    | ウル       | ウルク       |

  Scenario: フィルタを「すべて」に戻すと全フィーチャーが表示される
    Given 頻出度フィルタを「★1のみ」に切り替える
    When 頻出度フィルタを「すべて」に切り替える
    Then 都市マーカー「ウルク」が表示されている
```

`e2e/features/color-theme.feature`:

```gherkin
@wip
Feature: カラーテーマ切替

  Scenario: トグルでダークテーマに切り替わる
    Given アプリを開いている
    When カラーテーマトグルをクリックする
    Then ダークテーマが適用されている

  Scenario: 選択したカラーテーマはリロード後も維持される
    Given アプリを開いている
    And カラーテーマトグルをクリックする
    When ページをリロードする
    Then ダークテーマが適用されている

  Scenario: OS がダークモードなら初期表示はダークになる
    Given OS のカラースキームがダークである
    And アプリを開いている
    Then ダークテーマが適用されている
```

`e2e/features/error-handling.feature`:

```gherkin
@wip
Feature: エラー処理

  Scenario: テーマ一覧の取得に失敗するとエラー表示と再試行ボタンが出る
    Given テーマデータの取得が失敗する状態である
    And アプリを開いている
    Then エラーメッセージ「データの取得に失敗しました」が表示されている
    And 再試行ボタンが表示されている

  Scenario: 再試行で回復できる
    Given テーマデータの取得が失敗する状態である
    And アプリを開いている
    When データ取得を正常に戻す
    And 再試行ボタンをクリックする
    Then サイドバーにテーマ「古代オリエント」が表示されている

  Scenario: 存在しないテーマ ID の直リンクはテーマ未選択になる
    Given クエリ「?theme=no-such-theme」でアプリを開いている
    Then テーマ選択を促すメッセージが表示されている
```

`e2e/features/mobile.feature`:

```gherkin
@wip @mobile
Feature: モバイル表示

  Scenario: ドロワーからテーマを選択できる
    Given アプリを開いている
    When メニューボタンでドロワーを開く
    And テーマ「古代オリエント」を選択する
    Then 都市マーカー「バビロン」が表示されている

  Scenario: 解説はボトムシートで表示される
    Given アプリを開いている
    And テーマ「古代オリエント」を選択している
    When 都市マーカー「バビロン」をクリックする
    Then 解説パネルが画面の下半分に表示されている
```

- [ ] **Step 2: bddgen が通ることを確認**

```bash
pnpm e2e:smoke   # @wip は除外されるので PASS のまま
```

- [ ] **Step 3: 【要ユーザー対話】.feature をユーザーにレビューしてもらう**

全 .feature ファイルをユーザーに提示し、受け入れ基準としてレビューを受ける。フィードバックがあれば .feature を修正して再提示する。**承認されるまで次のタスクへ進まない**（.feature が Task 9〜16 の受け入れ基準になるため）。

- [ ] **Step 4: コミット**

```bash
git add e2e/features/
git commit -m "test: draft E2E acceptance scenarios for all MVP features"
```

---

### Task 9: 画面骨格（ヘッダー・サイドバー・テーマ一覧）

**Files:**
- Create: `src/theme/Sidebar.tsx`, `src/theme/Sidebar.test.tsx`
- Modify: `src/app/App.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `fetchThemeIndex`（Task 5）、`ThemeIndexEntry`（Task 3）
- Produces:
  - `Sidebar`（props: `{ entries: readonly ThemeIndexEntry[]; selectedThemeId: string | undefined; onSelectTheme: (id: string) => void }`、`nav[aria-label="テーマ一覧"]`）
  - App の直和型状態 `ThemeIndexState`（`loading` | `loaded` | `error`）
  - `data-testid="empty-state"`（テーマ未選択メッセージ）

- [ ] **Step 1: Sidebar の失敗するテストを書く**

`src/theme/Sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const entries = [
  { id: 'ancient-greece', title: '古代ギリシア', era: '前800年頃〜前338年', order: 2 },
  { id: 'ancient-orient', title: '古代オリエント', era: '前3000年頃〜前330年', order: 1 },
];

describe('Sidebar', () => {
  it('テーマを order 順に表示する', () => {
    render(<Sidebar entries={entries} selectedThemeId={undefined} onSelectTheme={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('古代オリエント');
    expect(buttons[1]).toHaveTextContent('古代ギリシア');
  });

  it('クリックで onSelectTheme が呼ばれる', async () => {
    const onSelectTheme = vi.fn();
    render(<Sidebar entries={entries} selectedThemeId={undefined} onSelectTheme={onSelectTheme} />);
    await userEvent.click(screen.getByRole('button', { name: /古代オリエント/ }));
    expect(onSelectTheme).toHaveBeenCalledWith('ancient-orient');
  });

  it('選択中のテーマに aria-current が付く', () => {
    render(<Sidebar entries={entries} selectedThemeId="ancient-orient" onSelectTheme={() => {}} />);
    expect(screen.getByRole('button', { name: /古代オリエント/ })).toHaveAttribute('aria-current', 'true');
  });
});
```

Run: `pnpm vitest run src/theme/Sidebar.test.tsx`
Expected: FAIL（`./Sidebar` が存在しない）

- [ ] **Step 2: Sidebar を実装**

`src/theme/Sidebar.tsx`:

```tsx
import type { ThemeIndexEntry } from './schema';

type SidebarProps = {
  entries: readonly ThemeIndexEntry[];
  selectedThemeId: string | undefined;
  onSelectTheme: (id: string) => void;
};

export function Sidebar({ entries, selectedThemeId, onSelectTheme }: SidebarProps) {
  const sortedEntries = [...entries].sort((a, b) => a.order - b.order);
  return (
    <nav aria-label="テーマ一覧">
      <ul>
        {sortedEntries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelectTheme(entry.id)}
              aria-current={entry.id === selectedThemeId ? 'true' : undefined}
              className="block w-full px-4 py-3 text-left hover:bg-slate-100 aria-[current=true]:bg-sky-100"
            >
              <span className="block font-medium">{entry.title}</span>
              <span className="block text-xs text-slate-500">{entry.era}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Run: `pnpm vitest run src/theme/Sidebar.test.tsx`
Expected: PASS 3 件

- [ ] **Step 3: App に骨格を組み込む**

`src/app/App.tsx` を置き換える:

```tsx
import { useEffect, useState } from 'react';
import { MapView } from '../map/MapView';
import { fetchThemeIndex } from '../theme/fetch';
import type { ThemeIndexEntry } from '../theme/schema';
import { Sidebar } from '../theme/Sidebar';

type ThemeIndexState =
  | { status: 'loading' }
  | { status: 'loaded'; entries: ThemeIndexEntry[] }
  | { status: 'error' };

export function App() {
  const [indexState, setIndexState] = useState<ThemeIndexState>({ status: 'loading' });
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isCancelled = false;
    void fetchThemeIndex().then((result) => {
      if (isCancelled) return;
      setIndexState(result.ok ? { status: 'loaded', entries: result.value } : { status: 'error' });
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center border-b border-slate-200 px-4 py-2">
        <h1 className="text-lg font-bold">世界史マップ</h1>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 md:block">
          {indexState.status === 'loaded' && (
            <Sidebar entries={indexState.entries} selectedThemeId={selectedThemeId} onSelectTheme={setSelectedThemeId} />
          )}
          {indexState.status === 'error' && <p className="p-4 text-sm">データの取得に失敗しました</p>}
        </aside>
        <main className="relative min-w-0 flex-1">
          <MapView colorTheme="light" />
          {selectedThemeId === undefined && (
            <p
              data-testid="empty-state"
              className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/90 px-4 py-2 text-sm shadow"
            >
              テーマを選んで地図を探索しましょう
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
```

`src/app/App.test.tsx` を更新（MapView モックは維持し、fetch もモックする）:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../map/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

vi.mock('../theme/fetch', () => ({
  fetchThemeIndex: async () => ({
    ok: true,
    value: [{ id: 'ancient-orient', title: '古代オリエント', era: '前3000年頃〜前330年', order: 1 }],
  }),
}));

describe('App', () => {
  it('テーマ一覧を表示する', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /古代オリエント/ })).toBeInTheDocument();
  });

  it('テーマ未選択なら空状態メッセージを表示する', async () => {
    render(<App />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck
pnpm dev   # 目視: ヘッダー + サイドバーにテーマ 2 件 + 地図 + 空状態メッセージ
git add src/theme/Sidebar.tsx src/theme/Sidebar.test.tsx src/app/
git commit -m "feat: add app shell with theme sidebar"
```

---

### Task 10: テーマ選択 → 地図移動 + URL 同期

**Files:**
- Create: `src/theme/urlState.ts`, `src/theme/urlState.test.ts`, `e2e/steps/theme.steps.ts`
- Modify: `src/app/App.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `fetchTheme`（Task 5）、`Theme`（Task 3）、`MapView` の `onMapReady`（Task 6）
- Produces:
  - `parseThemeIdFromSearch(search: string): string | undefined` / `buildSearchWithTheme(search: string, themeId: string | undefined): string`
  - App の直和型状態 `ThemeSelection`（`none` | `loading` | `loaded` | `error`）。Task 11〜13 はこの `loaded.theme.features` を消費する
  - E2E ステップ: テーマ選択・サイドバー表示・クエリ付き起動・URL 検証（feature はまだ `@wip` のまま。green 化は Task 11）

- [ ] **Step 1: urlState の失敗するテストを書く**

`src/theme/urlState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSearchWithTheme, parseThemeIdFromSearch } from './urlState';

describe('parseThemeIdFromSearch', () => {
  it('theme パラメータを取り出す', () => {
    expect(parseThemeIdFromSearch('?theme=ancient-orient')).toBe('ancient-orient');
  });

  it('パラメータがなければ undefined', () => {
    expect(parseThemeIdFromSearch('')).toBeUndefined();
    expect(parseThemeIdFromSearch('?other=1')).toBeUndefined();
  });

  it('空値は undefined', () => {
    expect(parseThemeIdFromSearch('?theme=')).toBeUndefined();
  });
});

describe('buildSearchWithTheme', () => {
  it('theme パラメータを設定する', () => {
    expect(buildSearchWithTheme('', 'ancient-orient')).toBe('?theme=ancient-orient');
  });

  it('既存パラメータを保持する', () => {
    expect(buildSearchWithTheme('?other=1', 'ancient-orient')).toBe('?other=1&theme=ancient-orient');
  });

  it('undefined なら theme を除去する', () => {
    expect(buildSearchWithTheme('?theme=ancient-orient', undefined)).toBe('');
  });
});
```

Run: `pnpm vitest run src/theme/urlState.test.ts`
Expected: FAIL

- [ ] **Step 2: urlState を実装**

`src/theme/urlState.ts`:

```ts
export function parseThemeIdFromSearch(search: string): string | undefined {
  const value = new URLSearchParams(search).get('theme');
  return value === null || value === '' ? undefined : value;
}

export function buildSearchWithTheme(search: string, themeId: string | undefined): string {
  const params = new URLSearchParams(search);
  if (themeId === undefined) {
    params.delete('theme');
  } else {
    params.set('theme', themeId);
  }
  const queryString = params.toString();
  return queryString === '' ? '' : `?${queryString}`;
}
```

Run: `pnpm vitest run src/theme/urlState.test.ts`
Expected: PASS 6 件

- [ ] **Step 3: App にテーマ選択を実装**

`src/app/App.tsx` に以下を組み込む（Task 9 の骨格を保ちつつ差分適用）:

```tsx
import type maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useState } from 'react';
import { MapView } from '../map/MapView';
import { fetchTheme, fetchThemeIndex } from '../theme/fetch';
import type { Theme, ThemeIndexEntry } from '../theme/schema';
import { Sidebar } from '../theme/Sidebar';
import { buildSearchWithTheme, parseThemeIdFromSearch } from '../theme/urlState';

type ThemeIndexState =
  | { status: 'loading' }
  | { status: 'loaded'; entries: ThemeIndexEntry[] }
  | { status: 'error' };

type ThemeSelection =
  | { status: 'none' }
  | { status: 'loading'; themeId: string }
  | { status: 'loaded'; theme: Theme }
  | { status: 'error'; themeId: string };

function syncThemeToUrl(themeId: string | undefined): void {
  const search = buildSearchWithTheme(window.location.search, themeId);
  window.history.replaceState(null, '', `${window.location.pathname}${search}`);
}

export function App() {
  const [indexState, setIndexState] = useState<ThemeIndexState>({ status: 'loading' });
  const [selection, setSelection] = useState<ThemeSelection>({ status: 'none' });
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  const selectTheme = useCallback((themeId: string, options?: { fallbackToNoneOnError: boolean }) => {
    setSelection({ status: 'loading', themeId });
    syncThemeToUrl(themeId);
    void fetchTheme(themeId).then((result) => {
      setSelection((current) => {
        if (current.status !== 'loading' || current.themeId !== themeId) return current;
        if (result.ok) return { status: 'loaded', theme: result.value };
        if (options?.fallbackToNoneOnError) {
          syncThemeToUrl(undefined);
          return { status: 'none' };
        }
        return { status: 'error', themeId };
      });
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;
    void fetchThemeIndex().then((result) => {
      if (isCancelled) return;
      setIndexState(result.ok ? { status: 'loaded', entries: result.value } : { status: 'error' });
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const initialThemeId = parseThemeIdFromSearch(window.location.search);
    if (initialThemeId !== undefined) {
      selectTheme(initialThemeId, { fallbackToNoneOnError: true });
    }
  }, [selectTheme]);

  useEffect(() => {
    if (map && selection.status === 'loaded') {
      map.fitBounds(selection.theme.bounds, { padding: 40, duration: 800 });
    }
  }, [map, selection]);

  const selectedThemeId =
    selection.status === 'loaded' ? selection.theme.id : selection.status === 'none' ? undefined : selection.themeId;

  return (
    /* Task 9 の JSX を維持しつつ変更:
       - <Sidebar onSelectTheme={(id) => selectTheme(id)} selectedThemeId={selectedThemeId} />
       - <MapView colorTheme="light" onMapReady={setMap} />
       - 空状態の条件を selection.status === 'none' に変更
       - selection.status === 'error' のとき地図上に
         <p data-testid="theme-error" className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/90 px-4 py-2 text-sm shadow">
           テーマの読み込みに失敗しました
         </p>（Task 15 で再試行付きに置き換える） */
  );
}
```

- [ ] **Step 4: App のテストを追加**

`src/app/App.test.tsx` に追加（fetch モックに `fetchTheme` を足す）:

```tsx
vi.mock('../theme/fetch', () => ({
  fetchThemeIndex: async () => ({
    ok: true,
    value: [{ id: 'ancient-orient', title: '古代オリエント', era: '前3000年頃〜前330年', order: 1 }],
  }),
  fetchTheme: async (id: string) =>
    id === 'ancient-orient'
      ? {
          ok: true,
          value: {
            id: 'ancient-orient',
            title: '古代オリエント',
            era: '前3000年頃〜前330年',
            summary: '概要。',
            bounds: [25, 22, 60, 42],
            features: [
              { id: 'babylon', kind: 'city', name: 'バビロン', coordinates: [44.421, 32.542], importance: 1, description: '解説。' },
            ],
          },
        }
      : { ok: false, error: { type: 'network' } },
}));

it('テーマを選択すると URL に反映され空状態が消える', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: /古代オリエント/ }));
  expect(window.location.search).toBe('?theme=ancient-orient');
  expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
});
```

テスト間で URL が汚染されないよう `afterEach(() => window.history.replaceState(null, '', '/'))` を追加する。

- [ ] **Step 5: E2E ステップを追加（feature は `@wip` のまま）**

`e2e/steps/theme.steps.ts`:

```ts
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
  await page.locator('nav[aria-label="テーマ一覧"] button', { hasText: themeName }).click();
}

Given(/^クエリ「(.+)」でアプリを開いている$/, async ({ page }, query: string) => {
  await page.goto(`/${query}`);
});

When(/^テーマ「(.+)」を選択する$/, async ({ page }, themeName: string) => {
  await selectTheme(page, themeName);
});

Given(/^テーマ「(.+)」を選択している$/, async ({ page }, themeName: string) => {
  await selectTheme(page, themeName);
});

Then(/^サイドバーにテーマ「(.+)」が表示されている$/, async ({ page }, themeName: string) => {
  await expect(page.locator('nav[aria-label="テーマ一覧"] button', { hasText: themeName })).toBeVisible();
});

Then(/^URL のクエリが「(.+)」を含んでいる$/, async ({ page }, fragment: string) => {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(escaped));
});
```

- [ ] **Step 6: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e:smoke
pnpm dev   # 目視: テーマ選択で地図がその地域へアニメーション移動し、URL が変わる
git add src/theme/urlState.ts src/theme/urlState.test.ts src/app/ e2e/steps/theme.steps.ts
git commit -m "feat: add theme selection with camera fit and URL sync"
```

---

### Task 11: マーカー描画 + importance フィルタ関数

**Files:**
- Create: `src/theme/filter.ts`, `src/theme/filter.test.ts`, `src/map/FeatureMarkers.tsx`, `e2e/steps/marker.steps.ts`
- Modify: `src/app/App.tsx`, `src/index.css`, `e2e/features/theme-selection.feature`（`@wip` を外す）

**Interfaces:**
- Consumes: `ThemeSelection`（Task 10）、`ThemeFeature`（Task 3）、map インスタンス（Task 10 の `map` state）
- Produces:
  - `ImportanceFilter = 1 | 2 | 3`（表示する最大 importance）、`filterFeaturesByImportance(features, maxImportance): ThemeFeature[]`
  - `FeatureMarkers`（props: `{ map: maplibregl.Map | null; features: readonly ThemeFeature[]; selectedFeatureId: string | undefined; onSelectFeature: (id: string) => void }`）
  - マーカー DOM 規約: `button[data-marker-kind="city"|"terrain"][aria-label=<名前>]`（E2E・Task 12 が依存）
  - App の `selectedFeatureId` state（Task 12 が解説パネルに使う）

- [ ] **Step 1: フィルタ関数の失敗するテストを書く**

`src/theme/filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeFeature } from './schema';
import { filterFeaturesByImportance } from './filter';

function city(id: string, importance: 1 | 2 | 3): ThemeFeature {
  return { id, kind: 'city', name: id, coordinates: [0, 0], importance, description: '解説。' };
}

describe('filterFeaturesByImportance', () => {
  const features = [city('a', 1), city('b', 2), city('c', 3)];

  it('1 なら importance 1 のみ', () => {
    expect(filterFeaturesByImportance(features, 1).map((f) => f.id)).toEqual(['a']);
  });

  it('2 なら importance 1〜2', () => {
    expect(filterFeaturesByImportance(features, 2).map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('3 なら全件', () => {
    expect(filterFeaturesByImportance(features, 3)).toHaveLength(3);
  });
});
```

Run: `pnpm vitest run src/theme/filter.test.ts` → FAIL を確認

- [ ] **Step 2: フィルタ関数を実装**

`src/theme/filter.ts`:

```ts
import type { Importance, ThemeFeature } from './schema';

export type ImportanceFilter = Importance;

export function filterFeaturesByImportance(
  features: readonly ThemeFeature[],
  maxImportance: ImportanceFilter,
): ThemeFeature[] {
  return features.filter((feature) => feature.importance <= maxImportance);
}
```

Run: `pnpm vitest run src/theme/filter.test.ts` → PASS 3 件

- [ ] **Step 3: マーカー用 CSS トークンとクラスを追加**

`src/index.css` に追記（ダーク値の上書きは Task 14）:

```css
:root {
  --color-marker-city: #d64545;
  --color-marker-halo: #ffffff;
  --color-marker-label: #1f2430;
  --color-marker-terrain: #4878a8;
}

.marker-city {
  position: relative;
  padding-left: 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-marker-label);
  text-shadow: 0 0 3px var(--color-marker-halo);
  cursor: pointer;
}

.marker-city::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: var(--color-marker-city);
  border: 2px solid var(--color-marker-halo);
}

.marker-terrain {
  font-size: 12px;
  font-style: italic;
  color: var(--color-marker-terrain);
  text-shadow: 0 0 3px var(--color-marker-halo);
  cursor: pointer;
}

button[data-marker-selected='true'] {
  outline: 2px solid var(--color-marker-city);
  outline-offset: 2px;
  border-radius: 2px;
}
```

- [ ] **Step 4: FeatureMarkers を実装**

`src/map/FeatureMarkers.tsx`（MapLibre 依存のため単体テストなし。E2E が検証する）:

```tsx
import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import type { ThemeFeature } from '../theme/schema';

type FeatureMarkersProps = {
  map: maplibregl.Map | null;
  features: readonly ThemeFeature[];
  selectedFeatureId: string | undefined;
  onSelectFeature: (id: string) => void;
};

export function FeatureMarkers({ map, features, selectedFeatureId, onSelectFeature }: FeatureMarkersProps) {
  useEffect(() => {
    if (!map) return;
    const markers = features.map((feature) =>
      new maplibregl.Marker({
        element: buildMarkerElement(feature, feature.id === selectedFeatureId, onSelectFeature),
        anchor: feature.kind === 'city' ? 'left' : 'center',
      })
        .setLngLat(feature.coordinates)
        .addTo(map),
    );
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [map, features, selectedFeatureId, onSelectFeature]);

  return null;
}

function buildMarkerElement(
  feature: ThemeFeature,
  isSelected: boolean,
  onSelect: (id: string) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = feature.name;
  button.setAttribute('aria-label', feature.name);
  button.dataset.testid = `marker-${feature.id}`;
  button.dataset.markerKind = feature.kind;
  if (isSelected) button.dataset.markerSelected = 'true';
  button.className = feature.kind === 'city' ? 'marker-city' : 'marker-terrain';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(feature.id);
  });
  return button;
}
```

- [ ] **Step 5: App に組み込む**

`src/app/App.tsx` に追加:

```tsx
import { FeatureMarkers } from '../map/FeatureMarkers';
import { filterFeaturesByImportance, type ImportanceFilter } from '../theme/filter';

// state に追加
const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>(3);
const [selectedFeatureId, setSelectedFeatureId] = useState<string | undefined>(undefined);

// テーマ切替時に選択フィーチャーをリセット: selectTheme 冒頭に
setSelectedFeatureId(undefined);

const visibleFeatures =
  selection.status === 'loaded' ? filterFeaturesByImportance(selection.theme.features, importanceFilter) : [];

// JSX の <MapView …/> の直後に
<FeatureMarkers
  map={map}
  features={visibleFeatures}
  selectedFeatureId={selectedFeatureId}
  onSelectFeature={setSelectedFeatureId}
/>
```

- [ ] **Step 6: E2E ステップを追加し theme-selection を green にする**

`e2e/steps/marker.steps.ts`:

```ts
import { expect, type Page } from '@playwright/test';
import { Then } from './fixtures';

export function cityMarker(page: Page, name: string) {
  return page.locator(`button[data-marker-kind="city"][aria-label="${name}"]`);
}

export function terrainLabel(page: Page, name: string) {
  return page.locator(`button[data-marker-kind="terrain"][aria-label="${name}"]`);
}

Then(/^都市マーカー「(.+)」が表示されている$/, async ({ page }, name: string) => {
  await expect(cityMarker(page, name)).toBeVisible();
});

Then(/^都市マーカー「(.+)」が表示されていない$/, async ({ page }, name: string) => {
  await expect(cityMarker(page, name)).toHaveCount(0);
});

Then(/^地形ラベル「(.+)」が表示されている$/, async ({ page }, name: string) => {
  await expect(terrainLabel(page, name)).toBeVisible();
});
```

`e2e/features/theme-selection.feature` の `@wip` を削除する。

- [ ] **Step 7: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck
pnpm e2e   # theme-selection.feature 全 5 シナリオ + スモークが PASS
pnpm dev   # 実ブラウザ目視: マーカーの見た目・ラベルの重なり具合を確認
git add src/theme/filter.ts src/theme/filter.test.ts src/map/FeatureMarkers.tsx src/app/App.tsx src/index.css e2e/steps/marker.steps.ts e2e/features/theme-selection.feature
git commit -m "feat: render city and terrain markers with importance filtering"
```

---

### Task 12: 解説パネル

**Files:**
- Create: `src/theme/labels.ts`, `src/theme/DetailPanel.tsx`, `src/theme/DetailPanel.test.tsx`, `e2e/steps/detail.steps.ts`
- Modify: `src/app/App.tsx`, `e2e/features/feature-detail.feature`（`@wip` を外す）

**Interfaces:**
- Consumes: `ThemeFeature` / `TerrainKind`（Task 3）、`selectedFeatureId`（Task 11）、マーカー DOM 規約（Task 11）
- Produces:
  - `TERRAIN_KIND_LABELS: Record<TerrainKind, string>`（`src/theme/labels.ts`）
  - `DetailPanel`（props: `{ feature: ThemeFeature; onClose: () => void }`、`data-testid="detail-panel"`、閉じるボタン `aria-label="閉じる"`）
  - デスクトップは右パネル・モバイルは下部シートを同一コンポーネントのレスポンシブクラスで実現（Task 16 が位置をアサートする）

- [ ] **Step 1: 失敗するテストを書く**

`src/theme/DetailPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeFeature } from './schema';
import { DetailPanel } from './DetailPanel';

const city: ThemeFeature = {
  id: 'babylon',
  kind: 'city',
  name: 'バビロン',
  coordinates: [44.421, 32.542],
  importance: 1,
  description: 'ハンムラビ王の時代に栄えたメソポタミアの中心都市。',
};

const terrain: ThemeFeature = {
  id: 'euphrates',
  kind: 'terrain',
  terrainKind: 'river',
  name: 'ユーフラテス川',
  coordinates: [43.5, 34.5],
  importance: 1,
  description: 'メソポタミア文明を育んだ大河。',
};

describe('DetailPanel', () => {
  it('都市の名前・種別・頻出度・解説を表示する', () => {
    render(<DetailPanel feature={city} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'バビロン' })).toBeInTheDocument();
    expect(screen.getByText('都市')).toBeInTheDocument();
    expect(screen.getByText('★1')).toBeInTheDocument();
    expect(screen.getByText(/ハンムラビ王/)).toBeInTheDocument();
  });

  it('地形は terrainKind のラベルを表示する', () => {
    render(<DetailPanel feature={terrain} onClose={() => {}} />);
    expect(screen.getByText('河川')).toBeInTheDocument();
  });

  it('閉じるボタンで onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    render(<DetailPanel feature={city} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run src/theme/DetailPanel.test.tsx` → FAIL を確認

- [ ] **Step 2: labels と DetailPanel を実装**

`src/theme/labels.ts`:

```ts
import type { TerrainKind, ThemeFeature } from './schema';

export const TERRAIN_KIND_LABELS: Record<TerrainKind, string> = {
  river: '河川',
  mountain: '山脈',
  sea: '海',
  strait: '海峡',
  lake: '湖',
  desert: '砂漠',
  region: '地域',
};

export function featureKindLabel(feature: ThemeFeature): string {
  return feature.kind === 'city' ? '都市' : TERRAIN_KIND_LABELS[feature.terrainKind];
}
```

`src/theme/DetailPanel.tsx`:

```tsx
import type { ThemeFeature } from './schema';
import { featureKindLabel } from './labels';

type DetailPanelProps = {
  feature: ThemeFeature;
  onClose: () => void;
};

export function DetailPanel({ feature, onClose }: DetailPanelProps) {
  return (
    <section
      data-testid="detail-panel"
      aria-label={feature.name}
      className="absolute z-10 bg-white shadow-lg max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-xl max-md:p-4 md:top-0 md:right-0 md:h-full md:w-80 md:overflow-y-auto md:p-6"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold">{feature.name}</h2>
        <button type="button" aria-label="閉じる" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
          ✕
        </button>
      </div>
      <p className="mt-1 flex gap-2 text-sm text-slate-500">
        <span>{featureKindLabel(feature)}</span>
        <span>{`★${feature.importance}`}</span>
      </p>
      <p className="mt-3 leading-relaxed">{feature.description}</p>
    </section>
  );
}
```

Run: `pnpm vitest run src/theme/DetailPanel.test.tsx` → PASS 3 件

- [ ] **Step 3: App に組み込む**

`src/app/App.tsx` の `<main>` 内に追加:

```tsx
import { DetailPanel } from '../theme/DetailPanel';

const selectedFeature = visibleFeatures.find((feature) => feature.id === selectedFeatureId);

// パネル外（地図の余白）クリックで閉じる。マーカーのクリックは
// buildMarkerElement 内の stopPropagation により map まで届かない
useEffect(() => {
  if (!map) return;
  const closePanel = () => setSelectedFeatureId(undefined);
  map.on('click', closePanel);
  return () => {
    map.off('click', closePanel);
  };
}, [map]);

// JSX（FeatureMarkers の後）
{selectedFeature && <DetailPanel feature={selectedFeature} onClose={() => setSelectedFeatureId(undefined)} />}
```

フィルタで選択中フィーチャーが非表示になった場合、`visibleFeatures.find` が外れてパネルも自動で閉じる。

- [ ] **Step 4: E2E ステップを追加し feature-detail を green にする**

`e2e/steps/detail.steps.ts`:

```ts
import { expect } from '@playwright/test';
import { Then, When } from './fixtures';
import { cityMarker, terrainLabel } from './marker.steps';

When(/^都市マーカー「(.+)」をクリックする$/, async ({ page }, name: string) => {
  await cityMarker(page, name).click();
});

When(/^地形ラベル「(.+)」をクリックする$/, async ({ page }, name: string) => {
  await terrainLabel(page, name).click();
});

Then(/^解説パネルに「(.+)」と表示されている$/, async ({ page }, text: string) => {
  await expect(page.getByTestId('detail-panel')).toContainText(text);
});

Then(/^解説パネルに「(.+)」を含む解説文が表示されている$/, async ({ page }, text: string) => {
  await expect(page.getByTestId('detail-panel')).toContainText(text);
});

Then(/^解説パネルに頻出度「(.+)」が表示されている$/, async ({ page }, stars: string) => {
  await expect(page.getByTestId('detail-panel')).toContainText(stars);
});

When('解説パネルの閉じるボタンをクリックする', async ({ page }) => {
  await page.getByTestId('detail-panel').getByRole('button', { name: '閉じる' }).click();
});

Then('解説パネルが表示されていない', async ({ page }) => {
  await expect(page.getByTestId('detail-panel')).toHaveCount(0);
});
```

Gherkin のステップ照合はキーワード（Given/When/Then）に依存しないため、`Given 都市マーカー「バビロン」をクリックする` も上の When 定義にマッチする。

`e2e/features/feature-detail.feature` の `@wip` を削除する。

- [ ] **Step 5: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
pnpm dev   # 実ブラウザ目視: マーカークリック → パネル表示、✕ で閉じる
git add src/theme/labels.ts src/theme/DetailPanel.tsx src/theme/DetailPanel.test.tsx src/app/App.tsx e2e/steps/detail.steps.ts e2e/features/feature-detail.feature
git commit -m "feat: add feature detail panel"
```

---

### Task 13: 頻出度フィルタ UI

**Files:**
- Create: `src/theme/ImportanceFilterControl.tsx`, `src/theme/ImportanceFilterControl.test.tsx`, `e2e/steps/filter.steps.ts`
- Modify: `src/app/App.tsx`, `e2e/features/importance-filter.feature`（`@wip` を外す）

**Interfaces:**
- Consumes: `ImportanceFilter`（Task 11）、App の `importanceFilter` state（Task 11）
- Produces: `ImportanceFilterControl`（props: `{ value: ImportanceFilter; onChange: (value: ImportanceFilter) => void }`。ボタンラベル: `★1のみ` / `★1〜2` / `すべて`）

- [ ] **Step 1: 失敗するテストを書く**

`src/theme/ImportanceFilterControl.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportanceFilterControl } from './ImportanceFilterControl';

describe('ImportanceFilterControl', () => {
  it('3 段階の選択肢を表示する', () => {
    render(<ImportanceFilterControl value={3} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '★1のみ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '★1〜2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'すべて' })).toBeInTheDocument();
  });

  it('選択中の値に aria-pressed が付く', () => {
    render(<ImportanceFilterControl value={1} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '★1のみ' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('クリックで onChange が呼ばれる', async () => {
    const onChange = vi.fn();
    render(<ImportanceFilterControl value={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '★1〜2' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
```

Run: `pnpm vitest run src/theme/ImportanceFilterControl.test.tsx` → FAIL を確認

- [ ] **Step 2: 実装**

`src/theme/ImportanceFilterControl.tsx`:

```tsx
import type { ImportanceFilter } from './filter';

const OPTIONS: { value: ImportanceFilter; label: string }[] = [
  { value: 1, label: '★1のみ' },
  { value: 2, label: '★1〜2' },
  { value: 3, label: 'すべて' },
];

type ImportanceFilterControlProps = {
  value: ImportanceFilter;
  onChange: (value: ImportanceFilter) => void;
};

export function ImportanceFilterControl({ value, onChange }: ImportanceFilterControlProps) {
  return (
    <div role="group" aria-label="頻出度フィルタ" className="flex overflow-hidden rounded-lg bg-white shadow">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="px-3 py-1.5 text-sm aria-pressed:bg-sky-600 aria-pressed:text-white"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

Run: `pnpm vitest run src/theme/ImportanceFilterControl.test.tsx` → PASS 3 件

- [ ] **Step 3: App の地図左上に配置**

`src/app/App.tsx` の `<main>` 内（テーマ選択中のみ表示）。右側・下部の解説パネルと競合しないよう左上に置く:

```tsx
import { ImportanceFilterControl } from '../theme/ImportanceFilterControl';

{selection.status === 'loaded' && (
  <div className="absolute top-4 left-4 z-10">
    <ImportanceFilterControl value={importanceFilter} onChange={setImportanceFilter} />
  </div>
)}
```

- [ ] **Step 4: E2E ステップを追加し importance-filter を green にする**

`e2e/steps/filter.steps.ts`:

```ts
import { When } from './fixtures';

When(/^頻出度フィルタを「(.+)」に切り替える$/, async ({ page }, label: string) => {
  await page.getByRole('group', { name: '頻出度フィルタ' }).getByRole('button', { name: label }).click();
});
```

`e2e/features/importance-filter.feature` の `@wip` を削除する。

- [ ] **Step 5: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
git add src/theme/ImportanceFilterControl.tsx src/theme/ImportanceFilterControl.test.tsx src/app/App.tsx e2e/steps/filter.steps.ts e2e/features/importance-filter.feature
git commit -m "feat: add importance filter control"
```

---

### Task 14: ライト/ダークテーマ切替 + DESIGN.md

**Files:**
- Create: `src/app/colorTheme.ts`, `src/app/colorTheme.test.ts`, `e2e/steps/color-theme.steps.ts`, `DESIGN.md`
- Modify: `src/app/App.tsx`, `src/index.css`, `e2e/features/color-theme.feature`（`@wip` を外す）

**Interfaces:**
- Consumes: `ColorTheme` / `MAP_COLORS`（Task 6）、`MapView` の `colorTheme` prop（Task 6）
- Produces:
  - `resolveInitialColorTheme(storedValue: string | null, prefersDark: boolean): ColorTheme` / `toggleColorTheme(theme: ColorTheme): ColorTheme`
  - DOM 規約: `<html data-color-theme="light"|"dark">`（CSS 変数の切替と E2E アサーションが依存）
  - localStorage キー: `color-theme`
  - ヘッダーのトグルボタン `aria-label="カラーテーマを切り替える"`

- [ ] **Step 1: 失敗するテストを書く**

`src/app/colorTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveInitialColorTheme, toggleColorTheme } from './colorTheme';

describe('resolveInitialColorTheme', () => {
  it('保存値があればそれを使う', () => {
    expect(resolveInitialColorTheme('dark', false)).toBe('dark');
    expect(resolveInitialColorTheme('light', true)).toBe('light');
  });

  it('保存値がなければ OS 設定に従う', () => {
    expect(resolveInitialColorTheme(null, true)).toBe('dark');
    expect(resolveInitialColorTheme(null, false)).toBe('light');
  });

  it('不正な保存値は OS 設定にフォールバックする', () => {
    expect(resolveInitialColorTheme('blue', true)).toBe('dark');
  });
});

describe('toggleColorTheme', () => {
  it('light と dark を反転する', () => {
    expect(toggleColorTheme('light')).toBe('dark');
    expect(toggleColorTheme('dark')).toBe('light');
  });
});
```

Run: `pnpm vitest run src/app/colorTheme.test.ts` → FAIL を確認

- [ ] **Step 2: 実装**

`src/app/colorTheme.ts`:

```ts
import type { ColorTheme } from '../map/mapColors';

export const COLOR_THEME_STORAGE_KEY = 'color-theme';

export function resolveInitialColorTheme(storedValue: string | null, prefersDark: boolean): ColorTheme {
  if (storedValue === 'light' || storedValue === 'dark') return storedValue;
  return prefersDark ? 'dark' : 'light';
}

export function toggleColorTheme(theme: ColorTheme): ColorTheme {
  return theme === 'light' ? 'dark' : 'light';
}
```

jsdom には `window.matchMedia` がないため、`src/test-setup.ts` にスタブを追加する（既存の App テストが壊れないようにする）:

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}));
```

`src/app/App.tsx` に組み込む:

```tsx
import { COLOR_THEME_STORAGE_KEY, resolveInitialColorTheme, toggleColorTheme } from './colorTheme';

const [colorTheme, setColorTheme] = useState<ColorTheme>(() =>
  resolveInitialColorTheme(
    window.localStorage.getItem(COLOR_THEME_STORAGE_KEY),
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  ),
);

useEffect(() => {
  document.documentElement.dataset.colorTheme = colorTheme;
}, [colorTheme]);

const handleToggleColorTheme = () => {
  const next = toggleColorTheme(colorTheme);
  window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, next);
  setColorTheme(next);
};

// header 内にトグルを追加
<button
  type="button"
  aria-label="カラーテーマを切り替える"
  onClick={handleToggleColorTheme}
  className="ml-auto rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
>
  {colorTheme === 'light' ? '🌙' : '☀️'}
</button>

// MapView に渡す
<MapView colorTheme={colorTheme} onMapReady={setMap} />
```

- [ ] **Step 3: CSS のダーク対応**

`src/index.css` に追記:

```css
@custom-variant dark (&:where([data-color-theme='dark'], [data-color-theme='dark'] *));

[data-color-theme='dark'] {
  --color-marker-city: #ffb454;
  --color-marker-halo: #1b222b;
  --color-marker-label: #f0e6d2;
  --color-marker-terrain: #7fa3c4;
}
```

既存コンポーネントの主要要素に `dark:` バリアントを追加する（クラス文字列の変更のみ）:

- App のルート div: `bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100` を追加
- header / aside の `border-slate-200` の後ろに `dark:border-slate-700` を追加
- 空状態・エラーの `bg-white/90` の後ろに `dark:bg-slate-800/90` を追加
- Sidebar のボタン: `hover:bg-slate-100 aria-[current=true]:bg-sky-100` → `hover:bg-slate-100 dark:hover:bg-slate-800 aria-[current=true]:bg-sky-100 dark:aria-[current=true]:bg-sky-900` に変更、`text-slate-500` → `text-slate-500 dark:text-slate-400`
- DetailPanel の `bg-white` → `bg-white dark:bg-slate-800`、`hover:bg-slate-100` → `hover:bg-slate-100 dark:hover:bg-slate-700`、`text-slate-500` → `text-slate-500 dark:text-slate-400`
- ImportanceFilterControl の `bg-white` → `bg-white dark:bg-slate-800`

- [ ] **Step 4: E2E ステップを追加し color-theme を green にする**

`e2e/steps/color-theme.steps.ts`:

```ts
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures';

When('カラーテーマトグルをクリックする', async ({ page }) => {
  await page.getByRole('button', { name: 'カラーテーマを切り替える' }).click();
});

When('ページをリロードする', async ({ page }) => {
  await page.reload();
});

Given('OS のカラースキームがダークである', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
});

Then('ダークテーマが適用されている', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'dark');
});
```

「カラーテーマトグルをクリックする」は Given としても使われる（キーワード非依存で照合される）。`e2e/features/color-theme.feature` の `@wip` を削除する。

- [ ] **Step 5: DESIGN.md を作成**

```markdown
# DESIGN.md — 世界史マップ デザインガイド

## カラーテーマ

ライト（参考書クリーン）とダーク（ダーク・フォーカス）の 2 テーマ。`<html data-color-theme>` で切り替える。
初期値は OS 設定（prefers-color-scheme）、ユーザー操作で localStorage(`color-theme`) に保存。

### 地図の配色（src/map/mapColors.ts が実装の一次情報）

| トークン | ライト | ダーク | 用途 |
| --- | --- | --- | --- |
| sea | #cfe0ec | #1b222b | 海（背景） |
| land | #faf7ef | #2e3844 | 陸地 |
| landOutline | #9fb8c9 | #46586a | 海岸線 |
| river | #7fa8c9 | #4a6a85 | 河川 |
| lake | #cfe0ec | #1b222b | 湖 |

### マーカーの配色（src/index.css の CSS 変数が実装の一次情報）

| トークン | ライト | ダーク | 用途 |
| --- | --- | --- | --- |
| --color-marker-city | #d64545 | #ffb454 | 都市マーカーの点 |
| --color-marker-halo | #ffffff | #1b222b | マーカー縁取り・テキストの発光 |
| --color-marker-label | #1f2430 | #f0e6d2 | 都市ラベル文字 |
| --color-marker-terrain | #4878a8 | #7fa3c4 | 地形ラベル文字（斜体） |

### UI の配色

Tailwind の slate / sky パレットを使う。ライトは白背景 + slate-900 文字、ダークは slate-900 背景 + slate-100 文字。
アクセント（選択状態）は sky-100（ライト）/ sky-900（ダーク）。

## タイポグラフィ

- UI・ラベルともシステムフォント（Tailwind デフォルトの font-sans）
- 地図ラベル: 都市 = 12px 太字、地形 = 12px 斜体
- 見出し: ヘッダー 18px 太字、パネル見出し 18px 太字

## Do / Don't

- Do: 地図上の情報は「今選んでいるテーマのもの」だけを表示する（常設表示を増やさない）
- Do: 色の意味を統一する（赤/琥珀 = 都市、青系 = 水・地形ラベル）
- Don't: ベースマップに現代の国境・都市・道路を描かない
- Don't: マーカー色を importance で変えない（重要度はフィルタと★表示で伝える）
- Don't: 地図の配色トークンを UI に流用しない（境界は mapColors.ts と CSS 変数）
```

- [ ] **Step 6: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
pnpm dev   # 実ブラウザ目視: トグルで地図・UI 両方の配色が切り替わる
git add src/app/ src/index.css e2e/steps/color-theme.steps.ts e2e/features/color-theme.feature DESIGN.md
git commit -m "feat: add light/dark color theme with persisted toggle"
```

---

### Task 15: エラー処理と空状態

**Files:**
- Create: `src/shared/ErrorView.tsx`, `src/shared/ErrorView.test.tsx`, `src/shared/webgl.ts`, `e2e/steps/error.steps.ts`
- Modify: `src/app/App.tsx`, `src/app/App.test.tsx`, `e2e/features/error-handling.feature`（`@wip` を外す）

**Interfaces:**
- Consumes: `ThemeIndexState` / `ThemeSelection`（Task 9, 10）
- Produces:
  - `ErrorView`（props: `{ message: string; onRetry: () => void }`、`role="alert"`、再試行ボタン `name="再試行"`）
  - `isWebgl2Supported(): boolean`

- [ ] **Step 1: ErrorView の失敗するテストを書く**

`src/shared/ErrorView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorView } from './ErrorView';

describe('ErrorView', () => {
  it('メッセージと再試行ボタンを表示する', () => {
    render(<ErrorView message="データの取得に失敗しました" onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('データの取得に失敗しました');
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });

  it('再試行ボタンで onRetry が呼ばれる', async () => {
    const onRetry = vi.fn();
    render(<ErrorView message="失敗" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run src/shared/ErrorView.test.tsx` → FAIL を確認

- [ ] **Step 2: ErrorView と WebGL 判定を実装**

`src/shared/ErrorView.tsx`:

```tsx
type ErrorViewProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded bg-white/90 p-4 shadow dark:bg-slate-800/90">
      <p className="text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-sky-600 px-4 py-1.5 text-sm text-white hover:bg-sky-700"
      >
        再試行
      </button>
    </div>
  );
}
```

`src/shared/webgl.ts`:

```ts
export function isWebgl2Supported(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: App に組み込む**

`src/app/App.tsx` の変更:

```tsx
import { ErrorView } from '../shared/ErrorView';
import { isWebgl2Supported } from '../shared/webgl';

// index の取得を再試行できるよう useCallback に抽出し、初回 useEffect から呼ぶ
const loadThemeIndex = useCallback(() => {
  setIndexState({ status: 'loading' });
  void fetchThemeIndex().then((result) => {
    setIndexState(result.ok ? { status: 'loaded', entries: result.value } : { status: 'error' });
  });
}, []);

useEffect(() => {
  loadThemeIndex();
}, [loadThemeIndex]);

const [isWebglAvailable] = useState(() => isWebgl2Supported());

// aside 内のエラー表示を置き換え
{indexState.status === 'error' && (
  <div className="p-4">
    <ErrorView message="データの取得に失敗しました" onRetry={loadThemeIndex} />
  </div>
)}

// テーマ読み込みエラー（Task 10 の暫定表示）を置き換え
{selection.status === 'error' && (
  <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2">
    <ErrorView message="テーマの読み込みに失敗しました" onRetry={() => selectTheme(selection.themeId)} />
  </div>
)}

// main 内: WebGL 非対応なら地図の代わりに案内
{isWebglAvailable ? (
  <MapView colorTheme={colorTheme} onMapReady={setMap} />
) : (
  <p className="flex h-full items-center justify-center p-8 text-center text-sm">
    お使いのブラウザは WebGL2 に対応していないため、地図を表示できません。最新のブラウザでお試しください。
  </p>
)}
```

`src/app/App.test.tsx` に追加（fetch モックを `vi.mocked` で差し替えられるよう `vi.mock` のファクトリを `vi.fn()` ベースに変更する）:

```tsx
it('テーマ一覧の取得失敗でエラービューが出て、再試行で回復する', async () => {
  vi.mocked(fetchThemeIndex).mockResolvedValueOnce({ ok: false, error: { type: 'network' } });
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('データの取得に失敗しました');
  await userEvent.click(screen.getByRole('button', { name: '再試行' }));
  expect(await screen.findByRole('button', { name: /古代オリエント/ })).toBeInTheDocument();
});
```

- [ ] **Step 4: E2E ステップを追加し error-handling を green にする**

`e2e/steps/error.steps.ts`:

```ts
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures';

Given('テーマデータの取得が失敗する状態である', async ({ page }) => {
  await page.route('**/data/themes/**', (route) => route.abort());
});

When('データ取得を正常に戻す', async ({ page }) => {
  await page.unroute('**/data/themes/**');
});

When('再試行ボタンをクリックする', async ({ page }) => {
  await page.getByRole('button', { name: '再試行' }).click();
});

Then(/^エラーメッセージ「(.+)」が表示されている$/, async ({ page }, message: string) => {
  await expect(page.getByRole('alert')).toContainText(message);
});

Then('再試行ボタンが表示されている', async ({ page }) => {
  await expect(page.getByRole('button', { name: '再試行' })).toBeVisible();
});

Then('テーマ選択を促すメッセージが表示されている', async ({ page }) => {
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
```

`e2e/features/error-handling.feature` の `@wip` を削除する。

- [ ] **Step 5: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
git add src/shared/ src/app/ e2e/steps/error.steps.ts e2e/features/error-handling.feature
git commit -m "feat: add error views, retry, and WebGL fallback"
```

---

### Task 16: モバイル対応（ドロワー・ボトムシート）

**Files:**
- Create: `e2e/steps/mobile.steps.ts`
- Modify: `src/app/App.tsx`, `src/app/App.test.tsx`, `e2e/features/mobile.feature`（`@wip` を外す。`@mobile` は残す）

**Interfaces:**
- Consumes: サイドバー（Task 9）、DetailPanel のレスポンシブクラス（Task 12）
- Produces: メニューボタン `aria-label="テーマ一覧を開く"`（モバイルのみ表示。Task 10 の `openSidebarIfNeeded` ヘルパーがこれを参照している）

- [ ] **Step 1: ドロワーを実装**

`src/app/App.tsx` の変更:

```tsx
const [isDrawerOpen, setIsDrawerOpen] = useState(false);

// header 左端に追加（md 以上では隠す）
<button
  type="button"
  aria-label="テーマ一覧を開く"
  aria-expanded={isDrawerOpen}
  onClick={() => setIsDrawerOpen(true)}
  className="mr-2 rounded p-2 hover:bg-slate-100 md:hidden dark:hover:bg-slate-700"
>
  ☰
</button>

// aside を書き換え: hidden md:block をやめてドロワー化
<aside
  className={`w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:transition-transform dark:border-slate-700 dark:bg-slate-900 ${
    isDrawerOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
  }`}
>
  …（中身は既存のまま）
</aside>

// aside の直前にバックドロップ（モバイルでドロワー表示中のみ）
{isDrawerOpen && (
  <button
    type="button"
    aria-label="テーマ一覧を閉じる"
    onClick={() => setIsDrawerOpen(false)}
    className="fixed inset-0 z-20 bg-black/40 md:hidden"
  />
)}

// テーマ選択でドロワーを閉じる: Sidebar の onSelectTheme を
onSelectTheme={(id) => {
  setIsDrawerOpen(false);
  selectTheme(id);
}}
```

- [ ] **Step 2: RTL テストを追加**

`src/app/App.test.tsx` に追加:

```tsx
it('メニューボタンでドロワーの開閉状態が切り替わる', async () => {
  render(<App />);
  const menuButton = await screen.findByRole('button', { name: 'テーマ一覧を開く' });
  expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(menuButton);
  expect(menuButton).toHaveAttribute('aria-expanded', 'true');
});
```

- [ ] **Step 3: E2E ステップを追加し mobile を green にする**

`e2e/steps/mobile.steps.ts`:

```ts
import { expect } from '@playwright/test';
import { Then, When } from './fixtures';

When('メニューボタンでドロワーを開く', async ({ page }) => {
  await page.getByRole('button', { name: 'テーマ一覧を開く' }).click();
});

Then('解説パネルが画面の下半分に表示されている', async ({ page }) => {
  const panel = page.getByTestId('detail-panel');
  await expect(panel).toBeVisible();
  const viewportSize = page.viewportSize();
  const box = await panel.boundingBox();
  if (!viewportSize || !box) throw new Error('パネルの位置を取得できない');
  expect(box.y).toBeGreaterThan(viewportSize.height / 2);
});
```

`e2e/features/mobile.feature` の `@wip` を削除する（`@mobile` は残す）。

- [ ] **Step 4: 検証してコミット**

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e   # mobile プロジェクトの 2 シナリオも PASS
pnpm dev   # 実ブラウザ目視: ウィンドウを狭めてドロワーとボトムシートを確認
git add src/app/ e2e/steps/mobile.steps.ts e2e/features/mobile.feature
git commit -m "feat: add mobile drawer and bottom-sheet layout"
```

---

### Task 17: CLAUDE.md 作成

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Produces: 以降のセッション（特に Task 18 のデータ作成）が従う品質基準・スタイルガイド

- [ ] **Step 1: CLAUDE.md を作成**

```markdown
# CLAUDE.md

世界史のテーマ別に重要都市・自然地形をインタラクティブ地図で探索できる学習アプリ「世界史マップ」。
Vite + React + TypeScript の静的 SPA。ベースマップは PMTiles（MapLibre）、Cloudflare Workers の静的アセットとして配信する。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー |
| `pnpm test` / `pnpm vitest run <path>` | 単体・コンポーネントテスト |
| `pnpm e2e` / `pnpm e2e:smoke` | E2E（Gherkin + playwright-bdd。smoke は @smoke のみ） |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | tsc / Biome check / Biome format |
| `pnpm validate-data` | テーマデータの検証 |
| `pnpm tiles:build` | ベースマップ PMTiles の再生成（`nix develop -c pnpm tiles:build`） |
| `pnpm build` | validate-data + typecheck + vite build |
| `pnpm deploy:cf` | ビルドして Cloudflare Workers にデプロイ |

## アーキテクチャ

- ドメイン軸ディレクトリ: `src/app/`（骨格・全体状態）/ `src/map/`（MapLibre 描画）/ `src/theme/`（テーマのスキーマ・ロジック・UI）/ `src/shared/`（Result 等、最小限）
- zod スキーマ（`src/theme/schema.ts`）が型の一次情報。fetch 時に parse し「検証済み」を型で表す
- 失敗は例外ではなく `Result<T, E>`（`src/shared/result.ts`）で返し、UI 境界で表示に変換する
- 相関する状態は直和型で表す（`ThemeSelection` 等）。ロジックは純粋関数としてコンポーネントの外に置く
- 地図マーカーは DOM 要素（`button[data-marker-kind]`）。canvas シンボルにしない（E2E とアクセシビリティのため）
- MapLibre は jsdom で動かない。地図の動線は E2E が一次防衛線。UI 操作系の変更は実ブラウザでも確認する

## デザイン

- UI・地図の配色やタイポグラフィは DESIGN.md に従う
- 地図の色は `src/map/mapColors.ts`、マーカーの色は `src/index.css` の CSS 変数、UI の色は Tailwind クラス。この境界を崩さない

## E2E テスト仕様書（e2e/features/）

- `.feature` が受け入れ基準の一次情報。機能の追加・変更は「.feature 更新 → 人間レビュー → ステップ実装」の順で進める
- 記法: 英語キーワード（Feature / Scenario / Given / When / Then）+ 日本語本文
- 未実装の機能の Feature には `@wip`、モバイル専用は `@mobile`、スモークは `@smoke` タグ
- `「」` 内の引数を取るステップは正規表現で定義する（`{string}` は使わない）
- ステップの言い回し（表記ゆれ禁止。既存ステップを再利用する）:
  - 起動: `アプリを開いている` / `クエリ「?…」でアプリを開いている`
  - テーマ: `テーマ「◯◯」を選択する`（Given 形は `選択している`）
  - マーカー: `都市マーカー「◯◯」` / `地形ラベル「◯◯」` + `が表示されている` / `が表示されていない` / `をクリックする`
  - パネル: `解説パネルに「◯◯」と表示されている` / `解説パネルが表示されていない`
  - アサーションは「〜されている」（状態）、操作は「〜する」（動作）で統一する

## データ作成（public/data/themes/）

- **正確性 > 網羅性。不確かな情報は載せない**。誤った位置・解説は学習教材として本末転倒
- 解説は日本語・常体・1〜2文（120 文字以内）で自作する。教科書レベルの周知の客観的事実のみを書き、書籍・ウェブサイトからの転載はしない
- 座標は遺跡・現代都市の実座標を信頼できる情報源（学術資料・地図サービス）と突き合わせて確認する。都市は遺跡または後継都市の座標、地形ラベルは名称を置くのに自然な代表点
- `importance`: 1 = 最頻出（教科書太字・地図問題頻出）/ 2 = 主要 / 3 = 発展。1 テーマあたり 10〜25 フィーチャーに抑える
- 同一都市が複数テーマに登場する場合はテーマごとに記述する（解説はテーマ文脈で書き分ける）。座標は 0.1 度以内で一致させる（validate-data が検査する）
- データ編集のたびに `pnpm validate-data` を実行する
- データレビューは事実確認（座標・解説・時代区分）を主軸とする

## 規約

- UI 文言・ドキュメントは日本語、コミットメッセージは英語（Conventional Commits）
- コメントは Why / Warning のみ。動作説明・自明な JSDoc は書かない
- `deploy` という npm script 名は使わない（pnpm 組み込みに握られる）
```

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with data creation and testing guidelines"
```

---

### Task 18: テーマデータ拡充（8〜12 テーマ）

**Files:**
- Modify: `public/data/themes/index.json`, `public/data/themes/ancient-orient.json`（拡充）, `public/data/themes/ancient-greece.json`（拡充）
- Create: `public/data/themes/roman-empire.json`, `ancient-india.json`, `chinese-dynasties.json`, `islamic-world.json`, `medieval-europe.json`, `mongol-empire.json`, `age-of-discovery.json`, `early-modern-europe.json`

**Interfaces:**
- Consumes: CLAUDE.md のデータ作成指針（Task 17）、`pnpm validate-data`（Task 4）
- Produces: MVP の全テーマデータ（計 10 テーマ、各 10〜25 フィーチャー）

- [ ] **Step 1: テーマの確定リスト**

| order | id | title | era | bounds の目安 [w,s,e,n] |
| --- | --- | --- | --- | --- |
| 1 | ancient-orient | 古代オリエント | 前3000年頃〜前330年 | [25, 22, 60, 42] |
| 2 | ancient-greece | 古代ギリシア | 前800年頃〜前338年 | [19, 34.5, 28.5, 41.5] |
| 3 | roman-empire | ローマ帝国 | 前27年〜後476年 | [-10, 24, 45, 55] |
| 4 | ancient-india | 古代インド | 前2600年頃〜後550年 | [60, 5, 95, 37] |
| 5 | chinese-dynasties | 中国王朝（秦漢〜隋唐） | 前221年〜後907年 | [95, 18, 125, 45] |
| 6 | islamic-world | イスラーム世界の成立と拡大 | 610年〜1258年 | [-12, 10, 65, 45] |
| 7 | medieval-europe | 中世ヨーロッパ | 476年〜1453年 | [-12, 35, 32, 60] |
| 8 | mongol-empire | モンゴル帝国と東西交流 | 1206年〜1368年 | [20, 20, 130, 58] |
| 9 | age-of-discovery | 大航海時代 | 1415年〜1600年頃 | [-100, -40, 145, 55] |
| 10 | early-modern-europe | 近世ヨーロッパ | 1517年〜1789年 | [-12, 35, 35, 62] |

- [ ] **Step 2: テーマごとにデータを作成する（1 テーマ = 1 サイクル）**

各テーマについて以下を繰り返す:

1. CLAUDE.md のデータ作成指針に従い、そのテーマで「地図問題として問われやすい」都市・地形を 10〜25 件選定して JSON を書く（入試頻出の地名を優先。確信が持てない地名は入れない）
2. `index.json` にエントリを追加する
3. `pnpm validate-data` で検証する（bounds 警告が出たら bounds か座標を修正）
4. 座標の妥当性を確認する: 各都市の座標が正しい位置を指すか、開発サーバーの地図表示で目視確認する
5. テーマ単位でコミットする: `git add public/data/themes/ && git commit -m "feat: add <id> theme data"`

- [ ] **Step 3: 事実確認レビュー**

全テーマ作成後、レビュアー（実装とは別のエージェント）に以下の観点でレビューさせる:

> public/data/themes/ の全テーマデータをレビューせよ。**レビューの主軸は事実確認**とする: (1) 各都市の座標が実際の遺跡・都市の位置と一致するか、(2) 解説文の内容（人名・王朝名・年代・出来事）が教科書レベルの定説と一致するか、(3) era・テーマ配属が適切か、(4) importance の妥当性（明らかな過大・過小）。疑わしい項目は根拠とともに列挙せよ。

指摘があれば修正して `pnpm validate-data` を再実行し、同じレビュアーに再確認させる。

- [ ] **Step 4: E2E への影響を確認してコミット**

```bash
pnpm e2e   # 既存シナリオがデータ拡充後も PASS することを確認
git add public/data/themes/
git commit -m "fix: correct theme data based on fact-check review"   # 修正があった場合
```

---

### Task 19: R2 + 単一 Worker デプロイ（PMTiles を Range 対応で配信）【要ユーザー対話: wrangler 認証・R2 バケット】

実機検証で Cloudflare Workers 静的アセットが Range request を honor せず（200 で全ファイル返却）PMTiles が動作しないことが判明したため、Protomaps 公式推奨の R2 配信に切り替える。単一 Worker が静的アセット（アプリ）と R2（PMTiles・テーマ JSON）を配信する。

**Files:**
- Create: `wrangler.jsonc`、`src/worker/index.ts`（Worker スクリプト）、`scripts/asset-manifest.ts`（ハッシュ計算 + マニフェスト生成）、`scripts/deploy-r2.ts`（R2 アップロード）、`public/asset-manifest.json`（dev 用・ローカルパス）、`src/data/manifest.ts`（マニフェスト fetch + 型）
- Modify: `src/theme/fetch.ts`（URL をマニフェストから受け取る）、`src/map/mapStyle.ts`（pmtiles URL をマニフェストから受け取る）、`src/app/App.tsx`（起動時にマニフェスト fetch）、`package.json`（deploy:cf を R2 アップロード込みに）

**Interfaces:**
- `AssetManifest = { basemap: string; themeIndex: string; themes: Record<string, string> }`
- Produces: 本番 URL（`https://world-history-atlas.<account>.workers.dev`）。PMTiles への Range request が 206 で返る

**設計方針:**
- 原本 `public/tiles/basemap.pmtiles` と `public/data/themes/*.json` はハッシュなしで repo に残す（dev / E2E はこれを直接使う）
- `public/asset-manifest.json`（dev 用）はローカルパスを指す: `{ "basemap": "/tiles/basemap.pmtiles", "themeIndex": "/data/themes/index.json", "themes": { "<id>": "/data/themes/<id>.json", ... } }`
- デプロイ時: 各ファイルの content hash（sha256 先頭 16 桁等）を計算し `basemap-<hash>.pmtiles` / `<id>-<hash>.json` として R2 にアップロード、`/r2/<hashed>` を指す本番マニフェストを `dist/asset-manifest.json` に生成
- Worker: `/r2/*` の GET は R2 から Range 対応で取得し `Cache-Control: public, max-age=31536000, immutable` で返す。それ以外は静的アセット binding へ委譲
- アプリは起動時に `/asset-manifest.json` を fetch し、以降 pmtiles・テーマ JSON のアクセスにマニフェストの URL を使う。dev ではローカルパスなので R2 なしで動く（E2E の `**/data/themes/**` route も従来どおり効く）

- [ ] **Step 1: R2 バケット作成【要ユーザー対話】**

`wrangler r2 bucket create world-history-atlas-tiles`（ユーザーの Cloudflare アカウントに作成）。認証は `wrangler login` または `CLOUDFLARE_API_TOKEN`（R2 書き込み権限込み）。

- [ ] **Step 2: Worker スクリプト・wrangler.jsonc・マニフェスト・スクリプト群を実装**

`wrangler.jsonc`（`main` + `assets` binding + `r2_buckets` binding、`compatibility_date` は実装日）。`src/worker/index.ts` は `/r2/<key>` を R2 の `env.BUCKET.get(key, { range })` で Range 対応配信、それ以外を `env.ASSETS.fetch()` へ委譲。マニフェスト生成・R2 アップロードスクリプト。アプリ統合（マニフェスト fetch → fetch/mapStyle への URL 注入）。dev / E2E（`pnpm test` `pnpm e2e`）が green のままであることを確認。

- [ ] **Step 3: デプロイと 206 実機検証**

`pnpm deploy:cf`（ビルド → R2 アップロード → Worker デプロイ）。検証:

```bash
URL="https://world-history-atlas.<account>.workers.dev/r2/basemap-<hash>.pmtiles"
curl -sI -H "Range: bytes=0-16383" "$URL"    # HTTP/2 206 と content-range を確認
```

playwright-cli で本番 URL を開き、ベースマップ（陸地・海岸線・河川）が描画されること、テーマ選択 → マーカー → 解説パネルの動線、SPA 深いパス（`/?theme=ancient-orient`）を確認。206 が返らない/描画されない場合はブロック報告。

- [ ] **Step 4: コミット**（`wrangler.jsonc` / worker / scripts / アプリ変更を明示パスで）

---

### Task 20: CI ワークフロー

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm lint` / `typecheck` / `validate-data` / `test` / `build` / `e2e` / `e2e:smoke`（Task 1, 7）、`scripts/check-tiles.sh`（Task 2）
- Produces: PR と main への push で走る CI

- [ ] **Step 1: GitHub リポジトリを確認する**

`git remote -v` でリモートを確認する。未設定ならユーザーに確認のうえ `gh repo create akihiro-tj/world-history-atlas --private --source=. --push` で作成する（公開設定はユーザーに確認）。

- [ ] **Step 2: ci.yml を作成**

`actions/checkout` / `pnpm/action-setup` / `actions/setup-node` の最新メジャーを `gh api repos/{owner}/{repo}/releases/latest` 等で確認して使う（以下は執筆時点の目安）。

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm validate-data
      - run: scripts/check-tiles.sh
      - run: pnpm test
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - name: E2E (smoke on PR)
        if: github.event_name == 'pull_request'
        run: pnpm e2e:smoke
      - name: E2E (full on main)
        if: github.event_name == 'push'
        run: pnpm e2e
```

- [ ] **Step 3: push して CI が green になることを確認**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint, test, data validation, and E2E workflow"
git push -u origin main
gh run watch   # 完了まで確認。失敗したらログを読んで修正（成功と報告しない）
```

---

### Task 21: デプロイ/プレビュー WF + dependabot + minimumReleaseAge【要ユーザー対話: Secrets 登録】

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/preview.yml`, `.github/dependabot.yml`, `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: `wrangler.jsonc`（Task 19）、GitHub Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
- Produces: main push での自動デプロイ、PR ごとのプレビュー URL コメント

- [ ] **Step 1: 【要ユーザー対話】GitHub Secrets を登録してもらう**

ユーザーに以下を依頼する（API トークンは Workers 編集権限で発行）:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

**登録完了の連絡があるまで Step 4 の push はしない**（ワークフローが失敗するため）。

- [ ] **Step 2: deploy.yml と preview.yml を作成**

`.github/workflows/deploy.yml`（wrangler-action は `packageManager` から pnpm を検出するため、pnpm セットアップと install を必ず入れる）:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

`.github/workflows/preview.yml`:

```yaml
name: Preview

on:
  pull_request:

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - id: upload
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: versions upload
      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          message: |
            🔍 プレビュー環境: ${{ steps.upload.outputs.deployment-url }}
```

`versions upload` の出力 URL が `deployment-url` で取れない場合は wrangler-action の README で outputs 名を確認して合わせる。

- [ ] **Step 3: dependabot と minimumReleaseAge を設定**

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

`pnpm-workspace.yaml`（単一パッケージだが pnpm の設定置き場として作る。単位は分 = 7 日）:

```yaml
packages:
  - '.'

minimumReleaseAge: 10080
```

`pnpm install` を実行して lockfile に影響がないことを確認する。

- [ ] **Step 4: PR で動作確認してマージ**

```bash
git switch -c ci/deploy-preview
git add .github/ pnpm-workspace.yaml
git commit -m "ci: add deploy and preview workflows with dependabot"
git push -u origin ci/deploy-preview
gh pr create --title "ci: add deploy and preview workflows" --body "$(cat <<'EOF'
## 概要

main への push で Cloudflare Workers に自動デプロイし、PR ごとにプレビュー URL をコメントするワークフローを追加します。あわせて dependabot（npm / github-actions、週次）と pnpm の minimumReleaseAge（7 日）を設定します。

## 確認方法

この PR 自身に Preview ワークフローがプレビュー URL をコメントすることを確認してください。

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh run watch   # CI + Preview が green、PR にプレビュー URL コメントが付く
```

プレビュー URL を実際に開いて動作確認し、マージする。マージ後の main push で Deploy ワークフローが走り、本番が更新されることを `gh run watch` で確認する。

---

### Task 22: README + 最終全体レビュー【要ユーザー対話: デザインレビュー】

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: これまでの全成果物

- [ ] **Step 1: README.md を作成**

```markdown
# world-history-atlas

世界史のテーマごとに重要な都市・自然地形をインタラクティブな地図で探索できる学習アプリ「世界史マップ」。

<本番 URL>

## 開発

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

| コマンド | 内容 |
| --- | --- |
| \`pnpm dev\` | 開発サーバー |
| \`pnpm test\` | 単体・コンポーネントテスト |
| \`pnpm e2e\` | E2E テスト（Playwright + playwright-bdd） |
| \`pnpm validate-data\` | テーマデータの検証 |
| \`pnpm build\` | データ検証 + 型チェック + ビルド |
| \`pnpm deploy:cf\` | ビルドして Cloudflare Workers にデプロイ |

## データの追加

\`public/data/themes/\` にテーマ JSON を追加し、\`index.json\` にエントリを足して
\`pnpm validate-data\` で検証する。スキーマは \`src/theme/schema.ts\`。
作成基準は CLAUDE.md の「データ作成」を参照。

## ベースマップの再生成

Natural Earth からタイルを再生成する場合（要 [nix](https://nixos.org/)）:

\`\`\`bash
nix develop -c pnpm tiles:build
\`\`\`

生成物 \`public/tiles/basemap.pmtiles\`（25 MiB 未満）はリポジトリにコミットする。
ダウンロード元を意図的に更新する場合は、取得済み zip から \`scripts/tile-sources.sha256\` を
再生成してコミットする（\`(cd .cache/naturalearth && shasum -a 256 *.zip) > scripts/tile-sources.sha256\`）。

## デプロイ

Cloudflare Workers にアセットのみの Worker としてデプロイする。設定は \`wrangler.jsonc\`。
main への push で CI が自動デプロイし、PR にはプレビュー URL がコメントされる
（GitHub Secrets: \`CLOUDFLARE_API_TOKEN\`, \`CLOUDFLARE_ACCOUNT_ID\`）。

## テスト仕様書

E2E の受け入れシナリオは \`e2e/features/*.feature\`（Gherkin: 英語キーワード + 日本語本文）が一次情報。
機能の追加・変更は .feature の更新とレビューから始める。
\`\`\`
```

`<本番 URL>` は Task 19 の実際の URL に置き換える。

- [ ] **Step 2: 最終全体レビュー（最上位モデルのレビュアーで実施）**

レビュアーへの指示:

> リポジトリ全体（スペック `docs/superpowers/specs/2026-07-07-world-history-atlas-design.md` と全実装・全テスト・CI 設定・データ）をレビューせよ。観点: (1) スペックとの乖離、(2) 実ブラウザでしか出ない UI バグの兆候（passive イベント、pointer capture、canvas 上のヒットテスト等）、(3) データの事実誤認、(4) セキュリティ・依存関係、(5) 計画自体の誤りに起因する欠陥も plan-mandated として報告せよ。

- [ ] **Step 3: 実ブラウザ最終確認（playwright-cli）**

本番 URL に対して:
- デスクトップとモバイルの両ビューポートで主要動線（テーマ選択 → マーカー → 解説 → フィルタ → テーマ切替）
- ライト/ダーク切替と localStorage 永続化
- ホイールズーム・ドラッグパン・ピンチズーム（タッチエミュレーション）が地図にだけ効き、ページズームを併発しないこと
- 直リンク（`/?theme=chinese-dynasties`）とリロード

- [ ] **Step 4: 【要ユーザー対話】デザインレビュー**

本番 URL をユーザーに提示し、デザイン（配色・レイアウト・マーカーの見やすさ・モバイル挙動）の確認を受ける。フィードバックは DESIGN.md の Do/Don't と突き合わせて反映する。

- [ ] **Step 5: 仕上げのコミット**

```bash
git add README.md
git commit -m "docs: add README"
git push
```

レビューで見つかった修正はそれぞれ Conventional Commits で個別にコミットする。

---

## 実行時の運用メモ

- Minor な指摘・残課題は `docs/superpowers/progress.md` に台帳として蓄積し、Task 22 の最終レビューでトリアージする
- レビュアーには毎回「計画由来の欠陥も plan-mandated として報告せよ」を含める
- 修正後の再レビューは同じレビュアーに SendMessage で依頼する（コンテキスト再構築を避ける）
- 各タスクの検証コマンド（test / lint / typecheck / e2e）が失敗したまま「完了」と報告しない





