# E2E 生成規約

- 対象は「jsdom 盲点の原則」に該当する 8 シナリオのみ（実マップ・実レイアウト・実リロード）。それ以外は結合テストに置く。
- locator は `e2e/fixtures.ts` のヘルパーを必ず使う（`cityMarker` / `terrainLabel` / `detailPanel` / `importanceFilter` / `colorThemeToggle` / `selectTheme`）。
- 生の CSS クラス・可変テキストへ依存しない。role / アクセシブルネーム / `data-*` を優先する。
- 1 シナリオ = 1 ファイル。ファイル先頭に `// spec: e2e/specs/<name>.plan.md` を記す。
- モバイル用は `{ tag: '@mobile' }`、スモークは `{ tag: '@smoke' }`。WIP は `test.fixme(...)`。
