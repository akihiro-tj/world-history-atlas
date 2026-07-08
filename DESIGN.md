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
