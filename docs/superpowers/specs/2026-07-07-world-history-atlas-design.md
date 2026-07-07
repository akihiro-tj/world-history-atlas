# world-history-atlas 設計スペック

世界史のテーマ（単元）ごとに、重要な都市と自然地形をインタラクティブな地図で探索できる学習用 Web アプリケーション。

- 作成日: 2026-07-07
- ステータス: 承認済み設計（実装計画は別ドキュメント）

## 目的と対象ユーザー

- **目的**: 世界史の地図知識（都市の位置・自然地形）を、テーマ別のインタラクティブ地図で視覚的に学べるようにする。
- **対象ユーザー**: 大学受験レベルの世界史学習者。掲載する地名の選定は「入試の地図問題で問われやすいか」を基準にする。
- **成功基準**: テーマを選ぶと重要地名が過不足なく地図上に現れ、タップ／クリックで正確な解説が読めること。正確性 > 網羅性。

## MVP スコープ

### 含む

- テーマ別地図の探索（8〜12 テーマ。例: 古代オリエント、古代ギリシア、ローマ帝国、イスラーム世界、中国王朝、大航海時代など主要単元をカバー。テーマの確定リストは実装計画で定める）
- 1 テーマあたりのフィーチャー数は 10〜25 件を目安とする（正確性を担保できる規模に抑える）
- 地図要素: 都市マーカー + 自然地形ラベル（河川・山脈・海・海峡・湖・砂漠・地域名）
- 頻出度（importance）によるフィルタ
- ライト／ダークのカラーテーマ切替
- レスポンシブ対応（デスクトップ / モバイル）
- E2E テスト（Gherkin テスト仕様書ベース。英語キーワード + 日本語本文）、PR プレビュー環境、dependabot + minimumReleaseAge

### 含まない（フォローアップ）

- 一問一答クイズモード（探索用データを流用して追加できる設計を保つ）
- ルート線（交易路・遠征路など LineString 表現）
- 領域ポリゴン（国家・帝国の版図。歴史的国境は作成・検証コストが最も高いため見送り）
- SEO 設定（meta / OGP / sitemap）

## 全体アーキテクチャ

### 技術スタック

- Vite + React + TypeScript + Tailwind CSS の静的 SPA
- 地図描画: `maplibre-gl` + `pmtiles`（PMTiles プロトコルアダプタ）
- スキーマ検証: zod（スキーマを型の一次情報とする）
- テスト: Vitest / React Testing Library / Playwright + playwright-bdd
- Lint・Format: Biome
- 配信: Cloudflare Workers（アプリは静的アセット、PMTiles・テーマ JSON は R2 バインディング経由。設定は `wrangler.jsonc` でリポジトリ内管理）

### 技術方針

- Node は現時点の LTS（Node 24 系）を `engines` で固定する。浮動指定（`lts/*` など）にしない
- パッケージマネージャは pnpm。`packageManager` フィールドでバージョン固定
- 依存パッケージは最新安定版を採用し lockfile で固定する
- 開発ツールチェーンは nix flake（`flake.nix` + `flake.lock`）の devShell で管理する。devShell はタイル生成ツール（tippecanoe / gdal）に加えて Node 24 系と pnpm を提供し、ローカル開発は devShell 経由を標準とする（`nix develop` 内で `pnpm dev` 等を実行）。CI は `actions/setup-node`（Node 24）を使い、nix を持ち込まない

### リポジトリ構成

```
world-history-atlas/
├── flake.nix / flake.lock    # 開発用 devShell（tippecanoe, gdal, Node 24, pnpm）
├── wrangler.jsonc            # Cloudflare Workers 設定
├── scripts/
│   ├── build-tiles.sh        # ベースマップ PMTiles の生成（nix devShell 内で実行）
│   └── validate-data.ts      # テーマデータの検証（CI・ビルド前に実行）
├── public/
│   ├── tiles/basemap.pmtiles # 生成物だがコミットする
│   └── data/themes/          # テーマデータ（index.json + テーマごとの JSON）
├── src/                      # ドメイン軸でディレクトリを構成する
│   ├── app/                  # エントリ・画面骨格・全体状態
│   ├── map/                  # 地図表示（MapLibre ラッパー、スタイル、レイヤー、マーカー）
│   ├── theme/                # テーマ（zod スキーマ、純粋関数、一覧 UI、解説パネル、fetch）
│   └── shared/               # 真に横断的なもののみ（最小限に保つ）
├── e2e/
│   ├── features/             # Gherkin テスト仕様書（受け入れ基準の一次情報）
│   └── steps/                # ステップ定義（薄く保つ）
└── docs/superpowers/specs/   # 設計スペック（本書）
```

- 各ドメインディレクトリ内で「型 + 純粋関数（functional core）」と「コンポーネント（imperative shell）」を同居させる。ビジネスロジックはコンポーネントの外の純粋関数に置く
- 失敗しうる処理（fetch・parse など）は例外ではなく Result 値で返し、UI 境界で表示に変換する

### データ配信方式

- アプリ本体（HTML / JS / CSS）は Cloudflare Workers の静的アセットとして配信する（Vite が content hash でフィンガープリントし immutable キャッシュ）
- **ベースマップ（PMTiles）とテーマデータ（JSON）は R2 バケットに置き、単一 Worker が R2 バインディング経由で配信する**。R2 は HTTP Range request（206 Partial Content）をネイティブ対応するため、PMTiles プロトコルが必要とする部分取得が成立する（Cloudflare Workers 静的アセットは Range を honor せず 200 で全ファイルを返すため PMTiles では使えないことを実機検証で確認済み。Protomaps 公式も R2 配信を推奨）
- **content hash によるキャッシュバスティング**: `public/tiles/basemap.pmtiles` と `public/data/themes/*.json` はハッシュなしの原本として repo に置く（dev / E2E はこれを直接使う）。デプロイ時に各ファイルの content hash を計算し、`basemap-<hash>.pmtiles` / `<id>-<hash>.json` として R2 にアップロードする。R2 由来のレスポンスは `Cache-Control: public, max-age=31536000, immutable` で配信する
- アプリは起動時に `asset-manifest.json`（論理名 → ハッシュ付きキーの対応表。静的アセットとして短期キャッシュで配信）を fetch し、PMTiles とテーマ JSON のハッシュ付き URL を解決する。dev ではマニフェストがローカルのハッシュなしパスを指すため R2 なしで動作する

### アーキテクチャ（単一 Worker）

- `wrangler.jsonc` に Worker スクリプト（`main`）、静的アセットの binding、R2 バケットの binding を設定する
- Worker は R2 配信パス（`/r2/*` 等）への GET を R2 から取得して Range 対応 + immutable キャッシュで返し、それ以外のリクエストは静的アセット binding へ委譲する
- デプロイは「Vite ビルド → ハッシュ計算 → R2 へアップロード → マニフェスト生成 → Worker デプロイ」を 1 コマンドで行う。設定はすべて `wrangler.jsonc` とスクリプトでリポジトリ内管理する
- R2 バケットの作成と、CI の `CLOUDFLARE_API_TOKEN` への R2 書き込み権限付与が必要（手動作業）
- `basemap.pmtiles` は Cloudflare Workers 静的アセットの 1 ファイル 25 MiB 上限の影響を受けない（R2 に置くため）が、生成物のサイズは CI で検証する

## データモデル

### テーマデータ

`public/data/themes/` に配置し、zod スキーマ（`src/theme/schema.ts`）を型の一次情報とする。fetch 時に parse し、「検証済み」であることを型で表す。

```jsonc
// public/data/themes/index.json — テーマ一覧
[
  { "id": "ancient-orient", "title": "古代オリエント", "era": "前3000年頃〜前330年", "order": 1 }
]

// public/data/themes/ancient-orient.json — テーマ本体
{
  "id": "ancient-orient",
  "title": "古代オリエント",
  "era": "前3000年頃〜前330年",
  "summary": "テーマの概要（1〜2文）",
  "bounds": [25.0, 22.0, 60.0, 42.0],   // [west, south, east, north] 初期カメラ
  "features": [
    {
      "id": "babylon",
      "kind": "city",
      "name": "バビロン",
      "coordinates": [44.421, 32.536],   // [lon, lat]
      "importance": 1,
      "description": "ハンムラビ王の時代に栄えたメソポタミアの中心都市。新バビロニアの都。"
    },
    {
      "id": "euphrates",
      "kind": "terrain",
      "terrainKind": "river",
      "name": "ユーフラテス川",
      "coordinates": [43.5, 34.5],       // ラベルアンカー点
      "importance": 1,
      "description": "メソポタミア文明を育んだ大河。ティグリス川とともに肥沃な三日月地帯を形成した。"
    }
  ]
}
```

- **フィーチャーは `kind` による直和型**: `city`（都市）と `terrain`（自然地形）。`terrain` のみ `terrainKind` を持つ: `river` | `mountain` | `sea` | `strait` | `lake` | `desert` | `region`
- **`importance`（頻出度）**: 1 = 最頻出（教科書太字・地図問題頻出）/ 2 = 標準 / 3 = 発展。UI では★表示とフィルタに使う
- **地形はアンカー点 + ラベルで表現**する。形状そのもの（河川の線・湖の面）はベースマップのレイヤーが担う
- **同一都市が複数テーマに登場する場合はテーマごとに記述**する（解説はテーマ文脈に依存するため、共通マスタは作らない）

### 検証（scripts/validate-data.ts）

CI とビルド前に実行し、以下を検証する:

- zod スキーマ準拠
- id の一意性（テーマ内のフィーチャー id、テーマ間のテーマ id）
- 座標範囲（経度 -180〜180、緯度 -90〜90）
- フィーチャーが `bounds` に収まること（警告）
- 同名フィーチャーの座標整合（複数テーマに登場する同名フィーチャーの座標が 0.1 度以上ズレていたらエラー。コピペミス防止）
- `description` の長さ上限（120 文字。1〜2文の目安）
- `index.json` とテーマファイルの整合（両方向の過不足）

### データ作成指針

詳細は CLAUDE.md に記載する（実装タスクに含める）。要点:

- **正確性 > 網羅性。不確かな情報は載せない**（誤った位置・解説は学習教材として本末転倒）
- 解説は日本語・常体・1〜2文で自作する。教科書レベルの周知の客観的事実に基づき、書籍やウェブサイトからの転載はしない
- 座標は遺跡・現代都市の実座標を信頼できる情報源と突き合わせて確認する
- データレビューは事実確認（座標・解説・時代区分）を主軸とする

## ベースマップのタイルパイプライン

### 生成フロー（scripts/build-tiles.sh、nix devShell 内で実行）

1. Natural Earth 10m データをダウンロード（URL 固定 + sha256 検証、`.cache/` に保存）
   - `ne_10m_land`（陸地）/ `ne_10m_rivers_lake_centerlines`（河川）/ `ne_10m_lakes`（湖）
2. ogr2ogr（gdal）で GeoJSONSeq に変換し、不要な属性を削ぎ落とす
3. tippecanoe でレイヤー（land / rivers / lakes）を束ね、z0〜z7 の `basemap.pmtiles` を生成
4. 生成物が 25 MiB 未満であることを検証し `public/tiles/basemap.pmtiles` に配置

### 方針

- **収録は陸地・河川・湖のみ**。海は背景色で表現する。現代の国境・都市・道路は歴史学習のノイズになるため収録しない。山脈・砂漠などの面データも収録せず、テーマデータのラベル点で表現する
- **z8 以上は MapLibre の overzoom で表示**する。Natural Earth 10m は 1:1,000 万縮尺で都市レベルの拡大には耐えないため、アプリ側で maxZoom を制限する
- **再現性**: flake.nix + flake.lock でツールのバージョンを固定し、ソースデータは URL + sha256 で固定する。生成コマンドは `nix develop -c pnpm tiles:build` の一発で完結し、手順を README に記載する
- **生成物はコミットし、CI は検証のみ**（存在 + サイズ上限チェック）。CI に nix / tippecanoe を持ち込まない

## UI / UX

### レイアウト（サイドバー型）

- デスクトップ: 左 = テーマ一覧サイドバー、中央 = 地図、右 = 解説パネル（フィーチャー選択時にスライドイン）
- モバイル: サイドバーはハンバーガードロワー、解説はボトムシートに変形する

### カラーテーマ

- ライト =「参考書クリーン」: アイボリーの陸地・淡い青の海・赤マーカー。判読性を最優先
- ダーク =「ダーク・フォーカス」: 暗色の地図・琥珀色マーカー。マーカーへの視線誘導を強く
- 初期値は `prefers-color-scheme` に従い、ヘッダーのトグルで手動切替（localStorage に保存）
- 地図スタイル（MapLibre style JSON）もテーマと連動して切り替える
- UI の色はデザイントークンとして DESIGN.md に定義する（両テーマの色定義・Do/Don't を含む）

### 挙動

- **テーマ選択**: サイドバーに `order` 順で列挙。選択でテーマの `bounds` へ `fitBounds` アニメーションし、フィーチャーを描画する
- **URL 反映**: 選択中テーマを `?theme=<id>` に反映し、リロード・共有に耐える。存在しない id は未選択状態にフォールバックする
- **頻出度フィルタ**: 地図左上のコントロールで「★1 のみ / ★1-2 / すべて」の3段階。既定はすべて表示（右側・下部の解説パネルと配置が競合しないよう左上に置く）
- **マーカー**: 都市・地形ラベルは MapLibre の Marker（DOM 要素）として描画し、`data-testid` を付与する。canvas 内シンボルにしない理由: E2E でのクリック・アサーションの安定と、ホバー・フォーカス等のアクセシビリティ対応（MVP 規模の点数では性能問題なし）。都市 = 丸マーカー + 名前、地形 = 斜体ラベル（`terrainKind` ごとに配色を変える）
- **解説パネル**: フィーチャー名・種別・頻出度★・解説文を表示。パネル外クリックか ✕ で閉じる。選択中マーカーは強調表示する
- **ズーム制御**: minZoom = z1、maxZoom = z8（ベースマップの解像度が破綻しない範囲に制限）
- **初期表示（テーマ未選択）**: 世界全体を表示し、テーマ選択を促す空状態を表示する

## エラー処理

失敗は Result 値として扱い、UI 境界で表示に変換する。

- **テーマデータの fetch / parse 失敗**: エラービュー + 再試行ボタン。テーマ単位で全か無か（部分的成功はさせない）
- **タイル読み込み失敗**: 地図領域にエラー表示（テーマデータとは独立に検知）
- **WebGL 非対応**: 起動時に検出し、対応ブラウザの案内を表示
- **不正な URL パラメータ**: テーマ未選択の初期状態へフォールバック

## テスト戦略

| 層 | 対象 | ツール |
| --- | --- | --- |
| 単体 | ドメイン純粋関数（フィルタ、カメラ計算、URL 解釈など） | Vitest |
| コンポーネント | 地図以外の UI（サイドバー、解説パネル、フィルタ） | React Testing Library + jsdom |
| E2E | 地図を含む主要動線すべて | Gherkin（英語キーワード + 日本語本文）+ playwright-bdd + Playwright |
| データ | テーマ JSON のスキーマ・整合性 | validate-data.ts |

### E2E テスト仕様書（Gherkin + playwright-bdd）

- テスト仕様書は `e2e/features/*.feature` に **英語キーワード + 日本語本文** の Gherkin で書く（キーワードは Feature / Scenario / Given / When / Then、タイトル・ステップ本文は日本語）。ラテン文字のキーワードと日本語本文の文字種の違いで、構造と内容が視覚的に区別できる。**`.feature` が受け入れ基準の一次情報**であり、本スペックには受け入れシナリオの詳細を書かない

```gherkin
Feature: テーマ別地図の探索

  Scenario: 都市マーカーをクリックすると解説が表示される
    Given テーマ「古代オリエント」を選択している
    When 都市マーカー「バビロン」をクリックする
    Then 解説パネルに「バビロン」の解説が表示される
```
- playwright-bdd の `bddgen` が `.feature` から Playwright テストを生成する。仕様に書かれたステップに実装がなければ生成が失敗するため、仕様とテストコードの乖離（抜け漏れ）が機械的に防がれる
- **運用**: 機能追加・変更時は「`.feature` の作成・更新 → 人間レビュー → ステップ実装」の順に進める。`.feature` レビューが人間の主要な品質ゲート
- **日本語ステップの言い回しはスタイルガイドで統一**する（CLAUDE.md に記載。表記ゆれによるステップ定義の乱立を防ぐ）
- ステップ定義は薄く保ち、ロジックは fixtures / ヘルパーに寄せる
- バリエーション（頻出度フィルタの段階など）はシナリオアウトライン（Examples 表）でデータ駆動にする
- **タグ運用**: `@smoke` を PR CI で、全シナリオを main で実行する
- **対象ブラウザ**: Chromium（デスクトップビューポート + モバイルエミュレーションの 2 プロジェクト構成）。他ブラウザは MVP 外
- MapLibre は jsdom で動作しないため、地図動線は E2E が一次防衛線。UI 操作系の実装タスクには実ブラウザでの動作確認を含める

## CI / CD・リポジトリ運用

### GitHub Actions

- **CI（PR・main）**: pnpm install → Biome lint → typecheck → validate-data → 単体・コンポーネントテスト → ビルド → E2E（PR は `@smoke`、main は全件）→ タイル検証（存在 + 25 MiB 未満）
- **デプロイ（main push）**: `cloudflare/wrangler-action` で Workers へ。deploy ジョブにも pnpm / Node のセットアップと `pnpm install` を明示的に入れる（wrangler-action は `packageManager` フィールドから pnpm を検出するため、依存が未インストールだと失敗する）
- **プレビュー環境（PR 作成・更新時）**: `wrangler versions upload` でプレビュー URL を発行し、PR にコメントで投稿する

### 運用

- npm scripts: デプロイは `deploy:cf`（`deploy` という名前は pnpm 組み込みコマンドに握られるため使わない）。タイル生成は `tiles:build`
- GitHub Secrets: `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`（登録は手動作業）
- dependabot: npm と github-actions を週次で監視。pnpm の `minimumReleaseAge` を 7 日相当に設定し、公開直後のパッケージを取り込まない
- ドキュメントはすべて日本語: README(開発手順・タイル再生成手順) / CLAUDE.md（コマンド・アーキテクチャ・データ作成指針・Gherkin スタイルガイド）/ DESIGN.md（デザイントークン・Do/Don't）。コミットメッセージは英語（Conventional Commits）

## フォローアップ（MVP 外・優先度順未定）

1. 一問一答クイズモード: テーマデータ（位置 + 解説）を出題に流用する
2. ルート線: 交易路・遠征路を LineString で表現（スキーマに `kind: "route"` を追加する拡張を想定）
3. 領域ポリゴン: 国家・帝国の版図（歴史的国境の作成・検証コストが高いため、方針検討から）
4. SEO 設定: meta / OGP / sitemap
