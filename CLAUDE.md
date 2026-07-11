# CLAUDE.md

世界史のテーマ別に重要都市・自然地形をインタラクティブ地図で探索できる学習アプリ「世界史マップ」。Vite + React + TypeScript の静的 SPA。ベースマップは PMTiles（MapLibre）、Cloudflare Workers の静的アセットとして配信する。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー |
| `pnpm test` / `pnpm vitest run <path>` | 単体・コンポーネントテスト |
| `pnpm e2e` / `pnpm e2e:smoke` | E2E（playwright-cli spec 駆動 / plain Playwright。smoke は @smoke のみ） |
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

## E2E テスト仕様書（e2e/specs/）

- E2E は playwright-cli の spec 駆動（plan / generate / heal）。`e2e/specs/*.plan.md` が受け入れ基準の一次情報。機能の追加・変更は「spec 更新 → 人間レビュー → generate → green 確認 → heal」の順で進める
- E2E に含めるのは jsdom で検証不可能なものだけ（実 MapLibre 描画・実ビューポートのレイアウト・実リロード）。それ以外は結合テスト（Vitest + Testing Library）に置く。同じ振る舞いを 2 層で検証しない
- テストは 1 シナリオ 1 ファイル（`e2e/<group>/<name>.spec.ts`）。先頭に `// spec: e2e/specs/<name>.plan.md`。locator は `e2e/fixtures.ts` のヘルパーに寄せ、role / アクセシブルネーム / `data-*` を優先する
- モバイルは `{ tag: '@mobile' }`（mobile プロジェクト）、スモークは `{ tag: '@smoke' }`、未実装は `test.fixme(...)`

## データ作成（public/data/themes/）

- **正確性 > 網羅性。不確かな情報は載せない**。誤った位置・解説は学習教材として本末転倒
- 解説は日本語・常体・1〜2文（120 文字以内）で自作する。教科書レベルの周知の客観的事実のみを書き、書籍・ウェブサイトからの転載はしない
- 座標は遺跡・現代都市の実座標を信頼できる情報源（学術資料・地図サービス）と突き合わせて確認する。都市は遺跡または後継都市の座標、地形ラベルは名称を置くのに自然な代表点
- スキーマ（`src/theme/schema.ts`）:
  - テーマ: `id`（kebab-case）/ `title` / `era` / `summary`（120 文字以内）/ `bounds`（[west, south, east, north]）/ `features`（フィーチャー配列）
  - フィーチャー: `id`（kebab-case）/ `kind`（"city" or "terrain"）/ `name` / `coordinates`（[lon, lat]）/ `importance`（1/2/3）/ `description`（120 文字以内） / `terrainKind`（terrain のみ）
- `importance`: 1 = 最頻出（教科書太字・地図問題頻出）/ 2 = 主要 / 3 = 発展。1 テーマあたり 10〜25 フィーチャーに抑える
- 同一都市が複数テーマに登場する場合はテーマごとに記述する（解説はテーマ文脈で書き分ける）。座標は 0.1 度以内で一致させる（validate-data が検査する）
- データ編集のたびに `pnpm validate-data` を実行する
- データレビューは事実確認（座標・解説・時代区分）を主軸とする

## 規約

- **main への直接コミット・push は禁止**。変更は必ずブランチを切って PR を作成し、CI（lint / typecheck / test / E2E）が green かつレビューを経てからマージする。main はブランチ保護で直接 push を禁止している
- UI 文言・ドキュメントは日本語、コミットメッセージは英語（Conventional Commits）
- コメントは Why / Warning のみ。動作説明・自明な JSDoc は書かない。コメントは英語で書く（UI 文言・ドキュメントは日本語だが、コード内コメントは英語）
- `deploy` という npm script 名は使わない（pnpm 組み込みに握られる）
