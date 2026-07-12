# CLAUDE.md

世界史のテーマ別に重要都市・自然地形をインタラクティブ地図で探索できる学習アプリ「世界史マップ」。Vite + React + TypeScript の静的 SPA。ベースマップは PMTiles（MapLibre）、Cloudflare Workers の静的アセットとして配信する。

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

- `.feature` が一次情報で、人間がレビューする唯一の定常対象。機能の追加・変更は「AI が e2e/GUIDELINE.md に従って .feature を差分更新 → 人間が diff をレビュー → bddgen が語彙を機械検査 → CI」の順で進める
- E2E の境界は 2 基準: ①jsdom で検証できないもの（実 MapLibre 描画・実ビューポートのレイアウト・実リロード）②壊れたら学習体験が成立しないコアフロー（少数を明示）。E2E に置いた振る舞いは component に書かず、同じ機能の分岐・変形を component / unit に置く
- シナリオ文は既存ステップ語彙のみで書く（語彙は `npx bddgen export` で確認）。新しい操作が必要なときだけステップ定義を追加し、その diff は人間が検収する
- 書式・観点導出・検収の観点は e2e/GUIDELINE.md、戦略の根拠は docs/superpowers/specs/2026-07-12-test-strategy-design.md

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
