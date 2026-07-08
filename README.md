# world-history-atlas

世界史のテーマ（単元）ごとに、重要な都市と自然地形をインタラクティブな地図で探索できる学習用 Web アプリ「世界史マップ」。

https://world-history-atlas.akihiro-tj.workers.dev

## 開発

```bash
pnpm install
pnpm dev
```

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー |
| `pnpm test` | 単体・コンポーネントテスト（Vitest） |
| `pnpm e2e` / `pnpm e2e:smoke` | E2E テスト（Playwright + playwright-bdd。smoke は `@smoke` のみ） |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | tsc（アプリ + Worker）/ Biome check / Biome format |
| `pnpm validate-data` | テーマデータの検証 |
| `pnpm tiles:build` | ベースマップ PMTiles の再生成（`nix develop -c pnpm tiles:build`） |
| `pnpm build` | データ検証 + 型チェック + ビルド |
| `pnpm deploy:cf` | ビルド → R2 アップロード → Cloudflare Workers デプロイ |

## データの追加

`public/data/themes/` にテーマ JSON を追加し、`index.json` にエントリを足して
`pnpm validate-data` で検証する。スキーマは `src/theme/schema.ts`。
作成基準（正確性 > 網羅性、座標・解説の確認方法、importance 基準）は CLAUDE.md の
「データ作成」を参照。

## ベースマップの再生成

Natural Earth からタイルを再生成する場合（要 [nix](https://nixos.org/)）:

```bash
nix develop -c pnpm tiles:build
```

生成物 `public/tiles/basemap.pmtiles`（25 MiB 未満）はリポジトリにコミットする。
ダウンロード元を意図的に更新する場合は、取得済み zip から `scripts/tile-sources.sha256` を
再生成してコミットする。

## アーキテクチャ

- アプリ本体（HTML / JS / CSS）は Cloudflare Workers の静的アセットとして配信する
- **ベースマップ（PMTiles）とテーマ JSON は R2 バケットに置き、単一 Worker（`src/worker/`）が
  R2 バインディング経由で HTTP Range 対応で配信する**。Cloudflare Workers の静的アセットは
  Range request を返さず PMTiles が動作しないため、R2 配信としている
- `public/` の原本はハッシュなし。デプロイ時に content hash を付けて R2 へアップロードし、
  `asset-manifest.json`（論理名 → ハッシュ付き URL）でアプリが解決する。R2 由来のアセットは
  `immutable` で長期キャッシュ、マニフェストは `no-cache`
- 開発時はマニフェストがローカルパスを指すため R2 なしで動作する（Vite プラグインが配信）

## デプロイ

main への push で CI が `pnpm deploy:cf` を実行し、R2 へアセットをアップロードして
Cloudflare Workers にデプロイする。PR には `wrangler versions upload` で発行した
プレビュー URL がコメントされる。

必要な GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`（Workers Scripts と R2 Storage の Edit 権限）
- `CLOUDFLARE_ACCOUNT_ID`

R2 バケット `world-history-atlas-tiles` を事前に作成しておく
（`wrangler r2 bucket create world-history-atlas-tiles`）。

## テスト仕様書

E2E の受け入れシナリオは `e2e/features/*.feature`（Gherkin: 英語キーワード + 日本語本文）が
一次情報。機能の追加・変更は `.feature` の更新とレビューから始める。
