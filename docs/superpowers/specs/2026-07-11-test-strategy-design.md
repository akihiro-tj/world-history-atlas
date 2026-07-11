# テスト戦略 設計スペック

世界史マップのテスト戦略。「AI がテストコードを書く」前提で、各テストレイヤの責務を再定義し、E2E を playwright-cli の spec 駆動ワークフロー（plan → generate → heal。Markdown spec + plain Playwright + 自己修復）へ移行する。

- 作成日: 2026-07-11
- ステータス: 設計合意済み（実装計画は別ドキュメント）

## 目的

1. **二重テストの解消** — 同じ振る舞いを結合テストと E2E で重複検証している箇所を排除し、保守コストの二重化・CI 時間の増加・失敗切り分けの困難さを減らす。
2. **E2E 責務の厳密化** — E2E を「jsdom で検証不可能な領域」だけに絞る。テスティングトロフィー型（結合テストに寄せる）を、本アプリ固有の制約で機械的に判定できる原則へ落とす。
3. **AI 前提の spec 駆動の確立** — 人間が査読する仕様（spec）を一次情報とし、テストコードは AI が生成・自己修復する運用を、playwright-cli の spec 駆動ワークフローで構築する。

## 背景（現状）

- 単体・コンポーネントテスト: Vitest + React Testing Library（jsdom）で 19 ファイル。fetch は `vi.mock` によるモジュールモック（MSW は未使用）。
- E2E: playwright-bdd（Gherkin `.feature` = 受け入れ基準の一次情報）で 20 シナリオ / 7 feature。ステップ実装は手書き。
- 突き合わせの結果、E2E の多くが結合テスト（特に `src/app/App.test.tsx`）と重複していることが判明した。`App.test.tsx` は MapView / FeatureMarkers / webgl / fetch をモックし、アプリ骨格の統合を jsdom 上で検証しているため、E2E のエラー処理・URL 反映・パネル開閉・ドロワー等をすでにカバーしている。

## 方針

### テスティングトロフィー（3 層）

| 層 | 実行環境 | 責務 | 地図 |
| --- | --- | --- | --- |
| 単体 | Vitest（純関数） | スキーマ・ロジック・変換の正しさ | — |
| 結合・コンポーネント | Vitest + Testing Library（jsdom） | 画面骨格の統合、コンポーネントのユーザー操作・状態遷移、fetch 境界 | モック |
| E2E | playwright-cli（spec 駆動 / 実ブラウザ） | 実マップ・実レイアウト・実リロードの疎通 | 実物 |

### 2 つの原則

- **二重テスト禁止** — 同じ振る舞いを 2 層で検証しない。下位層で確認できるものは下位層に置く。
- **jsdom 盲点の原則（E2E の境界）** — E2E に残すのは、jsdom が原理的に検証できない領域だけとする。具体的には次のいずれかを要するシナリオ:
  1. 実 MapLibre の描画（マーカー・地形ラベルの表示／非表示・入替）
  2. 実ビューポートのレイアウト（モバイルのボトムシート位置など）
  3. 実ブラウザのリロード往復（localStorage 永続化など）

  MapLibre は jsdom で動作しないため、地図に依存する動線は E2E が唯一の防衛線になる。この原則により E2E に含めるか否かを機械的に判定できる。

## 各層の責務

### 単体（純関数 / Vitest）

対象: `schema` / `result` / `filter` / `urlState` / `colorTheme` / `mapStyle` / `webgl` / `validation` / worker の `range` など。現状維持。最多・最速のレイヤとして、分岐と境界値をここで尽くす。

### 結合・コンポーネント（jsdom + Testing Library）

対象: アプリ骨格の統合（読み込み・エラー分岐・URL 反映・ドロワー開閉・競合応答の処理）、各コンポーネント（Sidebar / DetailPanel / ImportanceFilterControl / ErrorView）のユーザー操作と状態遷移、fetch 境界の Result マッピング。地図はモックする。トロフィーの本体であり、E2E から降りてくる振る舞いの受け皿となる。

**MSW は採用しない。** 本アプリはバックエンドを持たず、静的 JSON（テーマデータ・マニフェスト）を取得するだけである。fetch + parse + Result 変換は `fetch.test.ts` / `manifest.test.ts` が境界で網羅しており、App レベルのテストは読み込み状態やエラー経路のオーケストレーション検証に集中している。ネットワーク層の realism を MSW で足しても、便益はすでに別レイヤで担保済みで、ハンドラ・サーバ設定の追加コストに見合わない。将来、動的な API を導入する場合は再評価する。

### E2E（実ブラウザ / playwright-cli spec 駆動）

「jsdom 盲点の原則」に該当する 8 シナリオのみを対象とする。ブラウザ自動化ツールとして playwright-cli（`@playwright/cli`）を用い、その spec 駆動ワークフロー（plan / generate / heal）でテストを作成・保守する。これは Playwright の Test Agents（planner / generator / healer）と同型のモデルを CLI で実現するもので、追加の MCP サーバを必要とせず、成果物は通常の Playwright テストになる。

- **plan** — 実ブラウザでアプリを探索し、Markdown の spec（`e2e/specs/<feature>.plan.md`）に検証対象シナリオを列挙する
- **generate** — spec を plain Playwright テストへ変換する。`playwright-cli` の各操作が対応する Playwright TypeScript を出力し、セレクタは実行中の実アプリを正とする
- **heal** — `npx playwright test --debug=cli` + `playwright-cli attach` で失敗を診断し、コードを修正、spec と実挙動を再整合する（spec と実挙動の食い違いが意図的か回帰か不明なときは人に確認する）

生成・修復は author 時の操作であり、CI ではコミット済みの plain Playwright テストを通常実行する。LLM は CI のクリティカルパスに入らないため、実行の決定性は保たれる。

## E2E 再仕分け（20 → 8）

### KEEP（E2E に残す 8 シナリオ）

| # | シナリオ | E2E 必須の理由 |
| --- | --- | --- |
| 1 | [smoke] 地図が表示される | MapLibre の起動。jsdom 不可 |
| 2 | テーマ選択でマーカーが表示される（直リンク含む） | 実マップ上のマーカー描画 |
| 3 | テーマ切替で前テーマのマーカーが消える | 実マップのマーカー入替（stale 検出） |
| 4 | マーカー／地形ラベルのクリックで解説パネルが開く | 実マーカーのクリック導線 |
| 5 | 頻出度フィルタで地図のマーカー表示が変わる | フィルタ結果の実マップ反映 |
| 6 | カラーテーマがリロード後も維持される | 実ブラウザのリロード往復 + localStorage |
| 7 | [mobile] ドロワーからテーマを選択してマーカーが表示される | モバイル実レイアウト + 実マップ |
| 8 | [mobile] 解説がボトムシートで表示される | 実ビューポートのレイアウト位置 |

**統合メモ:** 現行シナリオのうち 3 件は KEEP に variant として取り込む。直リンク（選択済み表示）は #2、地形ラベルのクリックは #4、「解説パネルを開いたまま頻出度フィルタを操作できる」回帰は #5 のアサーションに内包する。これにより現行 20 シナリオはすべて KEEP（11 シナリオ → 8 spec）／ DELETE 7 ／ DEMOTE 2 に対応する。

### DELETE（結合／単体で完全カバー済み。7 シナリオ）

削除は「同等以上のカバレッジが下位層に存在する」ことを前提とする。

| 現行 E2E | カバー済みの下位テスト |
| --- | --- |
| サイドバーにテーマが時代順で一覧表示される | `Sidebar.test`（order 順）+ `App.test`（一覧表示） |
| テーマ選択で URL に反映される | `App.test`（URL 反映）+ `urlState.test` |
| 解説パネルを閉じられる | `App.test`（余白クリックで閉じる）+ `DetailPanel.test`（閉じるボタン） |
| フィルタを「すべて」に戻すと全件表示 | `filter.test`（importance 3 = 全件）。KEEP #5 に内包 |
| テーマ一覧の取得失敗でエラー表示 + 再試行ボタン | `App.test`（取得失敗→エラービュー→再試行で回復） |
| 再試行で回復できる | 同上 |
| 存在しないテーマ ID の直リンクは未選択 | `App.test`（不正直リンクは未選択にフォールバックし URL から theme 除去） |

**注記:** 削除対象の E2E が持つ細部のアサーション（例: エラー文言の完全一致 "データの取得に失敗しました"）が下位層に存在しない場合は、削除ではなくその assertion をコンポーネントテストへ移す。カバレッジを落とさないことを削除の条件とする。

### DEMOTE（実マップ不要。新規コンポーネントテストへ移す。2 シナリオ）

現状は純関数テスト（`colorTheme.test`）のみで、DOM への反映は未検証。移行時に小さなコンポーネントテストを新設する。

| 現行 E2E | 追加するコンポーネントテスト |
| --- | --- |
| トグルでダークテーマに切り替わる | トグル操作 → `data-theme`（DOM）反映を検証 |
| OS がダークモードなら初期表示はダーク | matchMedia モック → 初期 `data-theme` を検証 |

## E2E 基盤（playwright-cli spec 駆動の構成）

### ディレクトリと成果物

playwright-cli の spec 駆動テストの規約に従う。

- `e2e/specs/*.plan.md` — 人間が査読する Markdown の振る舞いカタログ（Application Overview + Test Scenarios（Steps / `- expect:` 箇条書き）。旧 `e2e/features/*.feature` を置換）
- 生成された plain Playwright テスト（`e2e/` 配下。1 シナリオ = 1 ファイル。正確な配置は実装計画で確定）
- `e2e/seed.spec.ts` — シナリオ共通の初期状態へ到達する最小テスト（generate / heal のデバッグセッションはここで一時停止する）
- `e2e/fixtures.ts` — base test を拡張した共通 fixture（アプリへのナビゲーション等）と helper（旧ステップ語彙の後継）

### 一貫性ガードレール（Gherkin 廃止の代替）

Gherkin が担っていた「再利用可能なステップ語彙」と「spec とテストの対応」を、次の 3 点で代替する。

1. **安定セレクタ規約** — role / アクセシブルネームと `data-*` 属性（既存の `button[data-marker-kind]`、`aria-current` / `aria-pressed` 等）を優先し、CSS クラスや可変テキストへの依存を避ける。generate / heal が安定した錨を得られる（`playwright-cli` の生成コードも role ベースのロケータを優先する）。
2. **共通 fixture / helper** — アプリ起動（seed 経由のナビゲーション）・テーマ選択・モバイルビューポート設定を関数化する。旧 `e2e/steps/*` のうち E2E に残る操作のロジックをここへ移植する。
3. **生成規約メモ** — generate 時に参照する短いドキュメント。使用すべき helper・セレクタ規約・E2E スコープ（8 シナリオ）を明記し、生成の一貫性と査読容易性を担保する。

### ワークフロー

```
Markdown spec（*.plan.md）を更新
  → 人間がレビュー（受け入れ基準の確定）
  → generate で plain Playwright を生成
  → green を確認してコミット
  → 破綻時は heal で修復（必要なら spec を実挙動に再整合）
```

旧「.feature 更新 → 人間レビュー → ステップ実装」を置換する。仕様の一次情報が `.feature` から `e2e/specs/*.plan.md` に変わる点が本質。

### タグ・プロジェクト対応

- `@smoke` → Playwright の `--grep @smoke`（`e2e:smoke` スクリプトを置換）
- `@mobile` → モバイルデバイスの Playwright プロジェクト
- `@wip` → `--grep-invert @wip` 相当

### 撤去物

- 依存: `playwright-bdd`
- ビルド: `bddgen`（`e2e` / `e2e:smoke` スクリプトの前置きを除去し `playwright test` に一本化）
- ファイル: `e2e/features/*.feature`、`e2e/steps/*`
- ドキュメント: `CLAUDE.md` の E2E 節（Gherkin ステップ語彙）を新ワークフロー・spec 規約に書き換える

### 前提

- ブラウザ自動化は playwright-cli（`@playwright/cli`）を用いる。plan / generate / heal はいずれも `npx playwright test --debug=cli` でアプリを起動し `playwright-cli attach` で実ページを操作するため、生成・修復時はローカルの dev 実行環境（実ブラウザ）が前提となる。
- 追加の MCP サーバは不要。

## 移行順序（カバレッジ欠損を作らない）

並存させながら段階的に移す。旧資産の撤去は最後に行う。

1. playwright-cli spec 駆動の足場（seed / fixtures / 生成規約メモ）を **既存 playwright-bdd と並存**で追加する
2. DEMOTE 2 件のコンポーネントテストを追加する（削除前にカバレッジを先回りで確保）
3. KEEP 8 シナリオの Markdown spec（`*.plan.md`）を作成し、人間がレビューする
4. generate で 8 本を生成し、**全て green** を確認する
5. **その後**に playwright-bdd と旧 `e2e/features` / `e2e/steps`、DELETE 対象を撤去する
6. `CLAUDE.md` と関連ドキュメントを更新する

## 決定サマリ

| 項目 | 決定 |
| --- | --- |
| E2E フレームワーク | playwright-bdd/Gherkin → **playwright-cli の spec 駆動**（plan / generate / heal。Markdown spec + plain Playwright） |
| E2E シナリオ数 | 20 → **8**（KEEP 8 / DELETE 7 / DEMOTE 2） |
| E2E の境界 | **jsdom 盲点の原則**（実マップ・実レイアウト・実リロードのみ） |
| 結合テストのモック方式 | `vi.mock` を継続。**MSW 不採用** |
| 仕様の一次情報 | `.feature` → **`e2e/specs/*.plan.md`** |
| CI の決定性 | 生成テストをコミットして通常実行。LLM は CI 非経路 |

## 非目標（このスペックで扱わないこと）

- 実装そのもの（別途、実装計画ドキュメントで段階を定義する）
- ビジュアルリグレッションテストの導入
- 単体・結合レイヤのフレームワーク変更（Vitest / Testing Library は維持）
- MSW の導入（上記のとおり不採用）

## リスクと緩和

| リスク | 緩和 |
| --- | --- |
| AI 生成テストの品質のばらつき | 生成物は所有する plain Playwright テストで、手編集・レビュー可能。8 シナリオと小規模 |
| AI 生成テストの非決定性 | 生成・修復は author 時のみ。CI はコミット済みテストを実行し LLM を含まない |
| 生成テストのセレクタ・実装のばらつき | 安定セレクタ規約 + 共通 fixture + 生成規約メモで一貫性を担保 |
| 移行中のカバレッジ欠損 | add-before-remove の移行順序。旧資産の撤去は 8 本 green の後 |

## 参考

- playwright-cli（`@playwright/cli`）— plan / generate / heal による spec 駆動テスト
- Playwright Test Agents（同型モデルの背景・公式）: https://playwright.dev/docs/test-agents
- Testing Trophy（フロントエンドのテスト配分の考え方）
