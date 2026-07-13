# テスト戦略実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計スペック（docs/superpowers/specs/2026-07-13-test-strategy-design.md）を実装する。テスト仕様を「実行可能な観点表」（`specs/<機能>.md`）に一本化し、軸マトリクス表と単発表をランナーが直接実行、`check-specs` が枠の網羅を CI で検査する。

**Architecture:** `tests/spec-runner/`（表パース + 軸辞書の解決 + フレーズディスパッチ、純ロジック）を共有し、Playwright 側 `e2e/catalog.spec.ts` が e2e 行を、Vitest 側 `tests/component.spec.ts` が c 行を実行する。フレーズ実装は `e2e/steps/`（Playwright）と `tests/component-steps/`（Testing Library + モック）。playwright-bdd / bddgen / Gherkin は撤去し、外部依存は素の Playwright / Vitest のみ。

**Tech Stack:** Playwright / Vitest + React Testing Library（jsdom）/ tsx。

## Global Constraints

- ブランチ `test/spec-driven-testing`。**実行開始・コミット・push・PR 操作はユーザーの指示後**（計画作成時点では凍結中）
- コミットは英語 Conventional Commits。ドキュメントは日本語。コード内コメントは Why / Warning のみ英語
- 二重テスト禁止。層の境界は技術基準のみ
- すべての表は状態（Given）→ 操作（When）→ 期待（Then）で読む。未定義フレーズはランナーがテスト収集・実行時にエラーにする
- 表形式は 2 つ: 軸マトリクス表（`## A × B`、列 `# | 状態（A） | 操作（B） | 期待 | 層 | 備考`、セルは軸の値）と単発表（`# | 観点 | 状態 | 操作 | 期待 | 層 | 備考`）
- 軸列見出しは全角括弧 `状態（<軸名>）` / `操作（<軸名>）`。層の値: `e2e` / `e2e(smoke)` / `e2e(mobile)` / `c` / `unit` / `直接` / `=N` / `対象外`。セル内の複数フレーズは `<br>` 区切り
- サンドボックス内では dev サーバ（localhost）不可。`pnpm e2e` はコントローラがサンドボックス無効で実行。タスク内の検証は typecheck / lint / vitest / `pnpm exec playwright test --list` / `pnpm check-specs` まで
- c 行はモックのフィクスチャ（古代オリエント: バビロン★1・ウル★2・ユーフラテス川★1、壊れたテーマ）を、e2e 行は実データ（古代ギリシア等を含む）を参照する

## File Structure

- Create: `tests/spec-runner/{parse.ts,registry.ts,load.ts,parse.test.ts}`、`specs/GUIDELINE.md`、`specs/<機能>.md` × 7、`e2e/catalog.spec.ts`、`e2e/steps/index.ts`、`tests/component-steps/*`、`tests/component.spec.ts`、`scripts/check-specs.ts`
- Modify: `playwright.config.ts`、`vite.config.ts`、`package.json`、`.github/workflows/ci.yml`、`biome.json`、`.gitignore`、`src/app/App.test.tsx`、`src/theme/DetailPanel.test.tsx`、`CLAUDE.md`、`README.md`
- Delete: `e2e/features/**`、旧 `e2e/steps/*.steps.ts` と `e2e/steps/fixtures.ts`、devDependency `playwright-bdd`

---

### Task 1: spec-runner（表パース + 軸辞書の解決 + ディスパッチ）

**Files:**
- Create: `tests/spec-runner/parse.ts`, `tests/spec-runner/registry.ts`, `tests/spec-runner/load.ts`, `tests/spec-runner/parse.test.ts`
- Modify: `vite.config.ts`（unit include に `tests/spec-runner/**/*.test.ts` を追加）

**Interfaces（Produces）:**

```ts
export type AxisValue = { value: string; phrases: string[] };
export type SpecRow = {
  id: string;
  label: string;                     // 観点 セル（単発表）。マトリクスは ""
  axisValues: Map<string, string>;   // 軸名 → 値（マトリクス表のみ）
  states: string[];                  // 状態 フレーズ（単発表）
  operations: string[];              // 操作 フレーズ（単発表）
  expects: string[];
  layer: string;
  note: string;
  precondition: string[];            // 備考の「前置き:」
};
export type SpecTable = {
  heading: string;
  mode: 'matrix' | 'step';
  axisColumns: { name: string; header: string }[];  // マトリクス: 軸名と列見出し（列順）
  premise: string[];
  rows: SpecRow[];
};
export type SpecFeature = {
  name: string;
  file: string;
  axes: Map<string, AxisValue[]>;
  tables: SpecTable[];
};
export function parseSpec(markdown: string, file: string): SpecFeature;
export function rowPhrases(feature: SpecFeature, table: SpecTable, row: SpecRow): string[];
export function rowLabel(table: SpecTable, row: SpecRow): string;
```

- [ ] **Step 1: 失敗するテストを書く（`tests/spec-runner/parse.test.ts`）**

```ts
import { describe, expect, it } from 'vitest';
import { parseSpec, rowLabel, rowPhrases } from './parse';

const sample = `# サンプル

## 軸
| 軸 | 値 | フレーズ |
| --- | --- | --- |
| 選択中のフィーチャー | なし | |
| 選択中のフィーチャー | ★2都市 | 都市マーカー「ウル」を選択している |
| フィルタ | ★1のみ | 頻出度フィルタを「★1のみ」に切り替える |

## 選択中のフィーチャー × フィルタ
前提: アプリを開いている

| # | 状態（選択中のフィーチャー） | 操作（フィルタ） | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | なし | ★1のみ | 都市マーカー「バビロン」が表示されている | e2e | |
| 7 | ★2都市 | ★1のみ | 解説パネルが表示されていない | c | 前置き: 頻出度フィルタを「すべて」に切り替える |

## 手順テスト
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 切替 | テーマ「A」を選択している | テーマ「B」を選択する | 都市マーカー「アテネ」が表示されている | e2e | |
`;

const feature = parseSpec(sample, 'sample.md');

describe('parseSpec', () => {
  it('軸表を辞書として読む', () => {
    expect(feature.axes.get('選択中のフィーチャー')).toEqual([
      { value: 'なし', phrases: [] },
      { value: '★2都市', phrases: ['都市マーカー「ウル」を選択している'] },
    ]);
  });

  it('状態（軸）・操作（軸）列を持つ表を matrix と判定する', () => {
    const table = feature.tables[0];
    expect(table.mode).toBe('matrix');
    expect(table.axisColumns).toEqual([
      { name: '選択中のフィーチャー', header: '状態（選択中のフィーチャー）' },
      { name: 'フィルタ', header: '操作（フィルタ）' },
    ]);
    expect(table.premise).toEqual(['アプリを開いている']);
  });

  it('matrix 行の軸値・期待・前置きを読む', () => {
    const row = feature.tables[0].rows[1];
    expect(row.axisValues.get('選択中のフィーチャー')).toBe('★2都市');
    expect(row.axisValues.get('フィルタ')).toBe('★1のみ');
    expect(row.expects).toEqual(['解説パネルが表示されていない']);
    expect(row.precondition).toEqual(['頻出度フィルタを「すべて」に切り替える']);
    expect(row.note).toBe('');
  });

  it('状態・操作列を持つ表を step と判定する', () => {
    const table = feature.tables[1];
    expect(table.mode).toBe('step');
    expect(table.rows[0].label).toBe('切替');
    expect(table.rows[0].states).toEqual(['テーマ「A」を選択している']);
    expect(table.rows[0].operations).toEqual(['テーマ「B」を選択する']);
  });

  it('matrix 行を 前提 → 前置き → 状態軸 → 操作軸 → 期待 に解決する', () => {
    const table = feature.tables[0];
    expect(rowPhrases(feature, table, table.rows[1])).toEqual([
      'アプリを開いている',
      '頻出度フィルタを「すべて」に切り替える',
      '都市マーカー「ウル」を選択している',
      '頻出度フィルタを「★1のみ」に切り替える',
      '解説パネルが表示されていない',
    ]);
  });

  it('step 行を 前提 → 状態 → 操作 → 期待 に解決する', () => {
    const table = feature.tables[1];
    expect(rowPhrases(feature, table, table.rows[0])).toEqual([
      'テーマ「A」を選択している',
      'テーマ「B」を選択する',
      '都市マーカー「アテネ」が表示されている',
    ]);
  });

  it('rowLabel は matrix では軸値の連結、step では観点', () => {
    expect(rowLabel(feature.tables[0], feature.tables[0].rows[1])).toBe('★2都市 × ★1のみ');
    expect(rowLabel(feature.tables[1], feature.tables[1].rows[0])).toBe('切替');
  });
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `pnpm vitest run tests/spec-runner`（include 追加後）。Expected: FAIL

- [ ] **Step 3: 実装する**

```ts
// tests/spec-runner/parse.ts
export type AxisValue = { value: string; phrases: string[] };
export type SpecRow = {
  id: string;
  label: string;
  axisValues: Map<string, string>;
  states: string[];
  operations: string[];
  expects: string[];
  layer: string;
  note: string;
  precondition: string[];
};
export type SpecTable = {
  heading: string;
  mode: 'matrix' | 'step';
  axisColumns: { name: string; header: string }[];
  premise: string[];
  rows: SpecRow[];
};
export type SpecFeature = {
  name: string;
  file: string;
  axes: Map<string, AxisValue[]>;
  tables: SpecTable[];
};

// Warning: full-width parens（）— must match the header convention in specs
const AXIS_HEADER = /^(?:状態|操作)（(.+)）$/;

function splitCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function splitPhrases(cell: string): string[] {
  return cell
    .split('<br>')
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

type RawTable = { heading: string; premise: string[]; header: string[]; rows: string[][] };

function collectRawTables(markdown: string): { name: string; raws: RawTable[] } {
  const lines = markdown.split('\n');
  const raws: RawTable[] = [];
  let name = '';
  let heading = '';
  let premise: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h1 = lines[i].match(/^#\s+(.+)$/);
    if (h1) {
      name = h1[1].trim();
      continue;
    }
    const h2 = lines[i].match(/^#{2,}\s+(.+)$/);
    if (h2) {
      heading = h2[1].trim();
      premise = [];
      continue;
    }
    const premiseMatch = lines[i].match(/^前提:\s*(.+)$/);
    if (premiseMatch) {
      premise = splitPhrases(premiseMatch[1]);
      continue;
    }
    if (/^\|/.test(lines[i]) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      const header = splitCells(lines[i]);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j])) {
        rows.push(splitCells(lines[j]));
        j++;
      }
      raws.push({ heading, premise, header, rows });
      i = j - 1;
    }
  }
  return { name, raws };
}

export function parseSpec(markdown: string, file: string): SpecFeature {
  const { name, raws } = collectRawTables(markdown);

  const axes = new Map<string, AxisValue[]>();
  for (const raw of raws.filter((raw) => raw.heading === '軸')) {
    const axisIdx = raw.header.indexOf('軸');
    const valueIdx = raw.header.indexOf('値');
    const phraseIdx = raw.header.indexOf('フレーズ');
    for (const row of raw.rows) {
      const axis = row[axisIdx];
      if (!axes.has(axis)) axes.set(axis, []);
      axes.get(axis)?.push({
        value: row[valueIdx],
        phrases: phraseIdx >= 0 ? splitPhrases(row[phraseIdx] ?? '') : [],
      });
    }
  }

  const tables: SpecTable[] = [];
  for (const raw of raws) {
    if (raw.heading === '軸') continue;
    const col = (header: string) => raw.header.indexOf(header);
    if (col('期待') < 0 || col('層') < 0) continue;

    const axisColumns: { name: string; header: string }[] = [];
    for (const header of raw.header) {
      const matched = header.match(AXIS_HEADER);
      if (matched && axes.has(matched[1])) {
        axisColumns.push({ name: matched[1], header });
      }
    }
    const mode: 'matrix' | 'step' = axisColumns.length > 0 ? 'matrix' : 'step';

    const rows: SpecRow[] = raw.rows.map((cells) => {
      const rawNote = cells[col('備考')] ?? '';
      const preMatch = rawNote.match(/^前置き:\s*(.+)$/);
      return {
        id: cells[col('#')] ?? '',
        label: col('観点') >= 0 ? (cells[col('観点')] ?? '') : '',
        axisValues: new Map(
          axisColumns.map(({ name, header }) => [name, cells[col(header)] ?? '']),
        ),
        states: col('状態') >= 0 ? splitPhrases(cells[col('状態')] ?? '') : [],
        operations: col('操作') >= 0 ? splitPhrases(cells[col('操作')] ?? '') : [],
        expects: splitPhrases(cells[col('期待')] ?? ''),
        layer: cells[col('層')] ?? '',
        note: preMatch ? '' : rawNote,
        precondition: preMatch ? splitPhrases(preMatch[1]) : [],
      };
    });

    tables.push({ heading: raw.heading, mode, axisColumns, premise: raw.premise, rows });
  }

  return { name: name || file, file, axes, tables };
}

export function rowPhrases(feature: SpecFeature, table: SpecTable, row: SpecRow): string[] {
  const phrases = [...table.premise, ...row.precondition];
  if (table.mode === 'matrix') {
    for (const { name } of table.axisColumns) {
      const value = row.axisValues.get(name) ?? '';
      const entry = feature.axes.get(name)?.find((v) => v.value === value);
      phrases.push(...(entry?.phrases ?? []));
    }
  } else {
    phrases.push(...row.states, ...row.operations);
  }
  phrases.push(...row.expects);
  return phrases;
}

export function rowLabel(table: SpecTable, row: SpecRow): string {
  if (table.mode === 'matrix') {
    return table.axisColumns.map(({ name }) => row.axisValues.get(name) ?? '').join(' × ');
  }
  return row.label;
}
```

`registry.ts` と `load.ts`:

```ts
// tests/spec-runner/registry.ts
export type PhraseHandler<Ctx> = (ctx: Ctx, ...args: string[]) => Promise<void> | void;

export function createRegistry<Ctx>() {
  const entries: { pattern: RegExp; handler: PhraseHandler<Ctx> }[] = [];
  return {
    phrase(pattern: RegExp, handler: PhraseHandler<Ctx>) {
      entries.push({ pattern, handler });
    },
    async run(ctx: Ctx, text: string) {
      for (const entry of entries) {
        const matched = text.match(entry.pattern);
        if (matched) {
          await entry.handler(ctx, ...matched.slice(1));
          return;
        }
      }
      throw new Error(`未定義のフレーズ: ${text}`);
    },
  };
}
```

```ts
// tests/spec-runner/load.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type SpecFeature, parseSpec } from './parse';

export function loadSpecs(dir = 'specs'): SpecFeature[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'GUIDELINE.md')
    .sort()
    .map((file) => parseSpec(readFileSync(join(dir, file), 'utf8'), file));
}
```

`vite.config.ts` の test.include に `'tests/spec-runner/**/*.test.ts'` を追加（projects 化は Task 5）。

- [ ] **Step 4: green を確認してコミット**

Run: `pnpm vitest run tests/spec-runner && pnpm typecheck && pnpm lint`

```bash
git add tests/spec-runner vite.config.ts
git commit -m "test: add spec-runner for executable perspective tables"
```

---

### Task 2: specs/GUIDELINE.md

**Files:**
- Create: `specs/GUIDELINE.md`

- [ ] **Step 1: 作成する**

```markdown
# テスト仕様書（実行可能な観点表）作成ガイドライン

AI が `specs/<機能>.md` を作成・更新するときの手順と規約。観点表が唯一の一次情報であり、そのまま実行される。戦略の根拠は docs/superpowers/specs/2026-07-13-test-strategy-design.md。

## 読み方の統一

すべての表は 状態（Given）→ 操作（When）→ 期待（Then）を左から右に読む。列の役割を見出しに持たせる。

## 観点の導出手順

1. 対象機能の状態の軸（状態変数とその値域）を洗い出す
2. 6 カテゴリを順に当てて観点を出す: ①状態の単体（loading / error / empty / success）②状態の組み合わせ（変更した状態 × 既存の状態）③派生状態の追従 ④境界値 ⑤エラー経路と回復 ⑥永続化・リロード
3. 相互作用する軸ペアは軸マトリクス表（`## A × B`）で直積を全行展開する。相互作用しない軸ペアは本文に「相互作用なし」と宣言する（宣言もレビュー対象）
4. 各行を層へ振り分ける（技術基準のみ）
   - e2e: 実 MapLibre の描画・実ビューポートのレイアウト・実リロードを要する
   - c: 結合でしか確認できない（画面の状態遷移・モジュール連携。地図はモック）
   - unit / 直接: 純ロジック・振る舞いでない検査（既存テストへのポインタ）
   - e2e に置いた振る舞いは c に書かない。分岐・変形は下位層に置く
5. 実行行（e2e / c）は既存フレーズのみで書く。語彙は `e2e/steps/`・`tests/component-steps/` の定義（未定義フレーズはテスト収集時にエラーになる）

## 表の書き分け

- **軸マトリクス表** — 見出し `## A × B`、列 `# | 状態（A） | 操作（B） | 期待 | 層 | 備考`。状態・操作の列には軸の値だけを書く。使う軸は「軸」表で値 → フレーズを宣言する（辞書）。MECE を値の列の縦走査で確認でき、直積網羅を機械検査できる。軸列見出しは全角括弧 `状態（<軸名>）`
- **単発表** — 見出し任意、列 `# | 観点 | 状態 | 操作 | 期待 | 層 | 備考`。状態・操作にフレーズを直接書く。多軸の相互作用を単発表で書く場合は観点を `A × B` の組ラベルにする（直積を機械検査）。単軸の 2〜3 値の列挙は観点欄に並べて目視確認する

## 表の書式

- 「軸」表: `軸 | 値 | フレーズ`（辞書が不要な軸は `軸 | 値` の 2 列でよい）
- 状態・操作は空欄可。期待はフレーズ（`<br>` 区切り）で実行行は必須
- 層: `e2e` / `e2e(smoke)` / `e2e(mobile)` / `c` / `unit` / `直接` / `=N`（同じ表の N 行と同値。理由を備考に）/ `対象外`（理由を備考に）
- 備考: 同値・対象外の理由、unit・直接のテストファイルパス、`前置き: フレーズ`（その行だけの追加準備）
- 表の直前の `前提: フレーズ<br>フレーズ` はその表の全実行行の先頭で実行される
- 実行順: 前提 → 前置き → 状態 → 操作 → 期待
- c 行はモックのフィクスチャ、e2e 行は実データを参照する

## フレーズの規約

- 状態は「〜している / 〜である」、操作は「〜する」、期待は「〜されている / 〜されていない」
- `「」` 内を引数に取るフレーズは正規表現で定義する
- 表記ゆれ禁止。既存フレーズを再利用し、同義の新しい言い回しを作らない
- ロケータ・クエリは role / アクセシブルネーム / `data-*` を優先。component 実装は `find*` / `waitFor` で待つ

## フレーズ実装を増やすとき

- 新しい UI 操作・検証が必要な場合のみ追加する（E2E: `e2e/steps/`、component: `tests/component-steps/`）
- 追加・変更の diff は人間が検収する。見る点は 3 つ: 文と実装の意味の一致 / 対象を正しく指しているか / 否定形・待機の実装
- 同じ文は層をまたいで同じ意味に保つ（実装は層ごとに別でよい）

## レビューの分担

- 毎回: `specs/<機能>.md` の diff（軸・枠・状態・操作・期待・層・同値と対象外の判断）
- 語彙の増減時のみ: フレーズ実装の diff（上記 3 点）
- ランナー・unit・直接テストのコードは定常の精読対象にしない

## 機械検査

- ランナー: 未定義フレーズをエラーにする
- `pnpm check-specs`: 直積網羅（軸マトリクスは値の列、単発表は観点の組ラベル）/ 実行行の期待必須 / `=N` の解決 / unit・直接のパス実在 / 層の記法・マトリクスのセル値の整合
```

- [ ] **Step 2: コミット**

```bash
git add specs/GUIDELINE.md
git commit -m "docs(specs): add guideline for executable perspective tables"
```

---

### Task 3: specs/<機能>.md（7 機能の観点表）

**Files:**
- Create: `specs/{app-boot,theme-selection,feature-detail,importance-filter,color-theme,error-handling,mobile}.md`

- [ ] **Step 1: 各ファイルを以下の内容で作成する**

`specs/app-boot.md`:

```markdown
# アプリの起動

## 起動
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | WebGL2 対応 | アプリを開いている | | 地図が表示されている | e2e(smoke) | |
| 2 | WebGL2 非対応 | WebGL2 に対応していない環境である<br>アプリを開いている | | 地図の代わりに非対応の案内が表示されている | c | |
| 3 | 起動中の表示 | | | 読み込み中の一時表示 | 対象外 | 遷移状態。成功・失敗の行で通過確認される |
| 4 | WebGL 判定ロジック | | | コンテキスト取得の分岐 | unit | src/shared/webgl.test.ts |
```

`specs/theme-selection.md`:

```markdown
# テーマ選択

## 基本動作
前提: アプリを開いている

| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 未選択の初期表示 | | | テーマ選択を促すメッセージが表示されている | c | |
| 2 | サイドバーから選択 | | テーマ「古代オリエント」を選択する | 都市マーカー「バビロン」が表示されている<br>地形ラベル「ユーフラテス川」が表示されている | e2e | |
| 3 | 選択の URL 反映 | | テーマ「古代オリエント」を選択する | URL のクエリが「theme=ancient-orient」を含んでいる<br>テーマ選択を促すメッセージが表示されていない | c | |
| 4 | テーマの切替 | テーマ「古代オリエント」を選択している | テーマ「古代ギリシア」を選択する | 都市マーカー「アテネ」が表示されている<br>都市マーカー「バビロン」が表示されていない | e2e | |
| 5 | 切替で解説が閉じる | テーマ「古代オリエント」を選択している<br>都市マーカー「バビロン」を選択している | テーマ「壊れたテーマ」を選択する | 解説パネルが表示されていない | c | |
| 6 | 一覧の表示順 | | | サイドバーのテーマが「古代オリエント,壊れたテーマ」の順に並んでいる | c | |

## 直リンク
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 正常な直リンク | クエリ「?theme=ancient-greece」でアプリを開いている | | 都市マーカー「アテネ」が表示されている | e2e | |
| 2 | 不正な直リンク | クエリ「?theme=no-such-theme」でアプリを開いている | | テーマ選択を促すメッセージが表示されている<br>URL から theme パラメータが除去されている | c | |

## 直接テスト・unit
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 読み込み完了の範囲移動 | | | fitBounds が呼ばれる | 直接 | src/app/App.test.tsx |
| 2 | 競合する応答 | | | 古いマニフェスト応答が新しい応答を上書きしない | 直接 | src/app/App.test.tsx |
| 3 | URL クエリの解析・生成 | | | theme の取り出し・設定・除去 | unit | src/theme/urlState.test.ts |
| 4 | 一覧の並びロジック | | | order 順に表示する | unit | src/theme/Sidebar.test.tsx |
```

`specs/feature-detail.md`:

```markdown
# フィーチャーの解説表示

## 開く
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 都市 | | 都市マーカー「バビロン」をクリックする | 解説パネルに「バビロン」と表示されている<br>解説パネルに「メソポタミア」を含む解説文が表示されている<br>解説パネルに頻出度「★1」が表示されている | e2e | |
| 2 | 地形 | | 地形ラベル「ユーフラテス川」をクリックする | 解説パネルに「ユーフラテス川」と表示されている | e2e | |

## 閉じる
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している<br>都市マーカー「バビロン」を選択している

| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 閉じるボタン | | 解説パネルの閉じるボタンをクリックする | 解説パネルが表示されていない | c | |
| 2 | 地図の余白 | | 地図の余白をクリックする | 解説パネルが表示されていない | c | |
| 3 | ドロワーを開く | | メニューボタンでドロワーを開く | 解説パネルが表示されていない | c | |

## 直接テスト
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | パネルの表示内容 | | | 種別ラベル・terrainKind の表記 | 直接 | src/theme/DetailPanel.test.tsx |
```

`specs/importance-filter.md`:

```markdown
# 頻出度フィルタ

## 軸
| 軸 | 値 | フレーズ |
| --- | --- | --- |
| フィルタ | ★1のみ | 頻出度フィルタを「★1のみ」に切り替える |
| フィルタ | ★1〜2 | 頻出度フィルタを「★1〜2」に切り替える |
| フィルタ | すべて | 頻出度フィルタを「すべて」に切り替える |
| 選択中のフィーチャー | なし | |
| 選択中のフィーチャー | ★1都市 | 都市マーカー「バビロン」を選択している |
| 選択中のフィーチャー | ★2都市 | 都市マーカー「ウル」を選択している |
| 選択中のフィーチャー | 地形ラベル | 地形ラベル「ユーフラテス川」を選択している |

## 選択中のフィーチャー × フィルタ
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| # | 状態（選択中のフィーチャー） | 操作（フィルタ） | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | なし | ★1のみ | 都市マーカー「バビロン」が表示されている<br>都市マーカー「ウル」が表示されていない | e2e | |
| 2 | なし | ★1〜2 | 都市マーカー「ウル」が表示されている<br>都市マーカー「ウルク」が表示されていない | e2e | |
| 3 | なし | すべて | 都市マーカー「ウルク」が表示されている | e2e | 前置き: 頻出度フィルタを「★1のみ」に切り替える |
| 4 | ★1都市 | ★1のみ | 解説パネルに「バビロン」と表示されている | c | |
| 5 | ★1都市 | ★1〜2 | | =4 | 選択対象が表示に残る点で同値 |
| 6 | ★1都市 | すべて | | =4 | 同上 |
| 7 | ★2都市 | ★1のみ | 解説パネルが表示されていない<br>都市マーカー「ウル」が表示されていない | c | |
| 8 | ★2都市 | ★1〜2 | | =4 | ★2 は表示に残る |
| 9 | ★2都市 | すべて | | =4 | 同上 |
| 10 | 地形ラベル | ★1のみ | | =4 | ★1 地形は表示に残る（導出は種別非依存） |
| 11 | 地形ラベル | ★1〜2 | | =4 | 同上 |
| 12 | 地形ラベル | すべて | | =4 | 同上 |

## テーマ切替との組み合わせ
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 切替後のフィルタ維持 | | 頻出度フィルタを「★1のみ」に切り替える<br>テーマ「壊れたテーマ」を選択する<br>テーマ「古代オリエント」を選択する | 都市マーカー「バビロン」が表示されている<br>都市マーカー「ウル」が表示されていない | c | 現状挙動の固定。仕様として正しいかは要判断 |

## unit
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 絞り込みの境界（importance 1/2/3） | | | 1 は★1のみ、2 は★1〜2、3 は全件 | unit | src/theme/filter.test.ts |
```

`specs/color-theme.md`:

```markdown
# カラーテーマ

## カラーテーマ
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | OS ダークの初期表示 | OS のカラースキームがダークである<br>アプリを開いている | | ダークテーマが適用されている | c | |
| 2 | トグルで切替 | アプリを開いている | カラーテーマトグルをクリックする | ダークテーマが適用されている | c | |
| 3 | リロード後の維持 | アプリを開いている | カラーテーマトグルをクリックする<br>ページをリロードする | ダークテーマが適用されている | e2e | |
| 4 | 初期値の解決ロジック | | | 保存値優先・不正値は OS 設定へフォールバック | unit | src/app/colorTheme.test.ts |
```

`specs/error-handling.md`:

```markdown
# エラー処理

## 軸
| 軸 | 値 |
| --- | --- |
| 失敗対象 | マニフェスト |
| 失敗対象 | テーマ一覧 |
| 失敗対象 | テーマ本体 |
| 失敗対象 | 地図タイル |
| 段階 | 表示 |
| 段階 | 回復 |

## 失敗対象 × 段階
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | マニフェスト × 表示 | マニフェストの取得が失敗する状態である<br>アプリを開いている | | エラーメッセージ「マニフェストの取得に失敗しました」が表示されている<br>再試行ボタンが表示されている | c | |
| 2 | マニフェスト × 回復 | マニフェストの取得が失敗する状態である<br>アプリを開いている | データ取得を正常に戻す<br>再試行ボタンをクリックする | サイドバーにテーマ「古代オリエント」が表示されている | c | |
| 3 | テーマ一覧 × 表示 | テーマ一覧の取得が失敗する状態である<br>アプリを開いている | | エラーメッセージ「データの取得に失敗しました」が表示されている<br>再試行ボタンが表示されている<br>テーマ選択を促すメッセージが表示されていない | c | |
| 4 | テーマ一覧 × 回復 | テーマ一覧の取得が失敗する状態である<br>アプリを開いている | データ取得を正常に戻す<br>再試行ボタンをクリックする | サイドバーにテーマ「古代オリエント」が表示されている | c | |
| 5 | テーマ本体 × 表示 | テーマ本体の取得が失敗する状態である<br>アプリを開いている | テーマ「古代オリエント」を選択する | エラーメッセージ「テーマの読み込みに失敗しました」が表示されている | c | |
| 6 | テーマ本体 × 回復 | | | 別テーマの選択し直しで回復する | 対象外 | 専用の再試行 UI が存在しない |
| 7 | 地図タイル × 表示 | アプリを開いている | 地図の読み込みエラーが発生する | エラーメッセージ「地図の読み込みに失敗しました」が表示されている | c | |
| 8 | 地図タイル × 回復 | アプリを開いている | 地図の読み込みエラーが発生する<br>再試行ボタンをクリックする | エラーメッセージが表示されていない | c | |

## unit
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | テーマ fetch 境界の Result 変換 | | | HTTP エラー・例外・スキーマ違反を Result で返す | unit | src/theme/fetch.test.ts |
| 2 | マニフェスト fetch 境界 | | | 同上 | unit | src/data/manifest.test.ts |
```

`specs/mobile.md`:

```markdown
# モバイル表示

## モバイル
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 初期状態（閉） | モバイル幅である<br>アプリを開いている | | ドロワーが閉じている<br>サイドバーが操作不能になっている | c | |
| 2 | ドロワーの開閉 | モバイル幅である<br>アプリを開いている | メニューボタンでドロワーを開く | ドロワーが開いている | c | |
| 3 | ドロワーから選択 | アプリを開いている | メニューボタンでドロワーを開く<br>テーマ「古代オリエント」を選択する | 都市マーカー「バビロン」が表示されている | e2e(mobile) | |
| 4 | 解説の表示位置 | アプリを開いている<br>テーマ「古代オリエント」を選択している | 都市マーカー「バビロン」をクリックする | 解説パネルが画面の下半分に表示されている | e2e(mobile) | |

## unit
| # | 観点 | 状態 | 操作 | 期待 | 層 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | メディアクエリの購読 | | | 変化の反映とリスナー解除 | unit | src/shared/useMediaQuery.test.ts |
```

- [ ] **Step 2: コミット**

```bash
git add specs
git commit -m "docs(specs): author executable perspective tables for all features"
```

---

### Task 4: E2E を表実行へ切り替える

**Files:**
- Create: `e2e/catalog.spec.ts`, `e2e/steps/index.ts`（フレーズ実装）
- Modify: `playwright.config.ts`, `package.json`, `biome.json`, `.gitignore`
- Delete: `e2e/features/**`, 旧 `e2e/steps/*.steps.ts`, `e2e/steps/fixtures.ts`, devDependency `playwright-bdd`

- [ ] **Step 1: フレーズ実装を作る（`e2e/steps/index.ts`）**

`createRegistry<{ page: Page }>()` を作り、旧 `e2e/steps/*.steps.ts` の実装本体を流用して次のフレーズを登録し、`export const registry` する。

| フレーズ（正規表現） | 実装（旧ステップ流用） |
| --- | --- |
| `^アプリを開いている$` | `page.goto('/')` |
| `^クエリ「(.+)」でアプリを開いている$` | `page.goto('/' + arg)` |
| `^地図が表示されている$` | `map-view` testid と `.maplibregl-canvas` 可視 |
| `^テーマ「(.+)」を選択(?:する\|している)$` | 必要ならドロワーを開き `nav[aria-label="テーマ一覧"]` 内ボタン click |
| `^都市マーカー「(.+)」が表示されている$` / `…表示されていない$` / `…を(?:クリックする\|選択している)$` | `button[data-marker-kind="city"][aria-label="…"]` の visible / count0 / click |
| `^地形ラベル「(.+)」が表示されている$` / `^地形ラベル「(.+)」をクリックする$` | terrain locator |
| `^解説パネルに「(.+)」と表示されている$`（`…を含む解説文…` / `頻出度「(.+)」…`） | `detail-panel` の `toContainText` |
| `^解説パネルが表示されていない$` | `detail-panel` count0 |
| `^解説パネルが画面の下半分に表示されている$` | boundingBox の y > viewport 半分 |
| `^頻出度フィルタを「(.+)」に切り替える$` | group「頻出度フィルタ」内ボタン click |
| `^メニューボタンでドロワーを開く$` | 「テーマ一覧を開く」click |
| `^カラーテーマトグルをクリックする$` | 「カラーテーマを切り替える」click |
| `^ページをリロードする$` | `page.reload()` |
| `^ダークテーマが適用されている$` | `html` の `data-color-theme=dark` |

- [ ] **Step 2: `e2e/catalog.spec.ts` を作る**

```ts
import { test } from '@playwright/test';
import { loadSpecs } from '../tests/spec-runner/load';
import { rowLabel, rowPhrases } from '../tests/spec-runner/parse';
import { registry } from './steps/index';

const E2E = /^e2e(?:\((smoke|mobile)\))?$/;

for (const feature of loadSpecs()) {
  for (const table of feature.tables) {
    for (const row of table.rows) {
      const matched = row.layer.match(E2E);
      if (!matched) continue;
      const tag = matched[1] ? [`@${matched[1]}`] : [];
      const title = `${feature.name} ${table.heading} #${row.id} ${rowLabel(table, row)}`;
      test(title, { tag }, async ({ page }) => {
        for (const phrase of rowPhrases(feature, table, row)) {
          await registry.run({ page }, phrase);
        }
      });
    }
  }
}
```

- [ ] **Step 3: playwright-bdd を撤去する**

`playwright.config.ts`: `defineBddConfig` を削除し `testDir: 'e2e'` に。projects の grep（`@mobile`）は現状のまま。
`package.json`: scripts を `"e2e": "playwright test"` / `"e2e:smoke": "playwright test --grep @smoke"`。`pnpm remove playwright-bdd`。
`biome.json` の `"!.features-gen"` と `.gitignore` の `.features-gen/` を削除。

```bash
git rm -r e2e/features
git rm e2e/steps/app.steps.ts e2e/steps/theme.steps.ts e2e/steps/marker.steps.ts e2e/steps/detail.steps.ts e2e/steps/filter.steps.ts e2e/steps/color-theme.steps.ts e2e/steps/error.steps.ts e2e/steps/mobile.steps.ts e2e/steps/fixtures.ts
```

- [ ] **Step 4: 検証** — Run: `pnpm exec playwright test --list && pnpm typecheck && pnpm lint`
Expected: `--list` で 12 テスト（app-boot 1 / theme-selection 3 / feature-detail 2 / importance-filter 3 / color-theme 1 の e2e 行 + mobile 2）が列挙され、未定義フレーズのエラーが出ない。実ブラウザ実行は Task 7。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "test(e2e): run perspective tables directly and drop playwright-bdd"
```

---

### Task 5: component を表実行へ（フレーズ実装 + 既存テスト整理）

**Files:**
- Create: `tests/component-steps/{index.ts,mocks.tsx,phrases.tsx}`, `tests/component.spec.ts`
- Modify: `vite.config.ts`（projects 化）, `src/app/App.test.tsx`, `src/theme/DetailPanel.test.tsx`

- [ ] **Step 1: vite.config.ts を projects 構成にする**

```ts
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: [
            'src/**/*.test.{ts,tsx}',
            'scripts/**/*.test.ts',
            'tests/spec-runner/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts', './tests/component-steps/index.ts'],
          include: ['tests/component.spec.ts'],
        },
      },
    ],
  },
```

- [ ] **Step 2: モックとフレーズ実装を作る**

`tests/component-steps/mocks.tsx`: `src/app/App.test.tsx` のモック群を移植し、`FeatureMarkers` モックは実装と同じ `data-marker-kind` + `aria-label` のボタンを描画する。フィクスチャ: 古代オリエント（バビロン★1 / ウル★2 / ユーフラテス川★1・terrain）+ 壊れたテーマ（fetch 失敗）。`fakeMap` / `mapHandlers` / `mapErrorHandlerRef` も移植。

`tests/component-steps/phrases.tsx`: `createRegistry<Record<string, never>>()` に登録。語彙と実装の要点:

| フレーズ | 実装の要点 |
| --- | --- |
| アプリを開いている | `render(<StrictMode><App /></StrictMode>)` |
| クエリ「(.+)」でアプリを開いている | `history.replaceState` → render |
| モバイル幅である | matchMedia スタブを `max-width: 767px` にマッチさせる（render 前） |
| OS のカラースキームがダークである | matchMedia スタブを `prefers-color-scheme: dark` にマッチさせる |
| WebGL2 に対応していない環境である | `vi.mocked(isWebgl2Supported).mockReturnValue(false)` |
| テーマ「(.+)」を選択(する\|している) | `await screen.findByRole('button', { name: 正規表現 })` を click |
| 都市マーカー／地形ラベル系（表示・非表示・クリック・選択している） | `waitFor(() => document.querySelector('button[data-marker-kind=…][aria-label=…]'))` で有無検証・click |
| 解説パネル系（〜と表示・解説文・頻出度・表示されていない・閉じるボタン） | `detail-panel` testid + `toHaveTextContent` / `waitFor` null / `within().getByRole` |
| 地図の余白をクリックする | `act(() => mapHandlers.get('click')?.())` |
| 頻出度フィルタを「(.+)」に切り替える | フィルタボタン click |
| メニューボタンでドロワーを開く / ドロワーが開いている・閉じている | 「テーマ一覧を開く」click / `aria-expanded` |
| サイドバーが操作不能になっている | `getByRole('complementary')` が `inert` |
| サイドバーにテーマ「(.+)」が表示されている | `findByRole('button', { name: 正規表現 })` |
| サイドバーのテーマが「(.+)」の順に並んでいる | nav 内ボタンの並びを `,` 区切りで検証 |
| テーマ選択を促すメッセージが表示されている・いない | `empty-state` testid |
| URL のクエリが「(.+)」を含んでいる / URL から theme パラメータが除去されている | `window.location.search` |
| カラーテーマトグルをクリックする / ダークテーマが適用されている | ボタン click / `data-color-theme` |
| マニフェスト・テーマ一覧・テーマ本体の取得が失敗する状態である | 対応 fetch モックを `{ ok: false, error: { type: 'network' } }` に |
| データ取得を正常に戻す | 失敗させたモックを既定実装へ戻す |
| 再試行ボタンをクリックする / 再試行ボタンが表示されている | 「再試行」ボタン |
| エラーメッセージ「(.+)」が表示されている / 表示されていない | `findByRole('alert')` / `waitFor` null |
| 地図の読み込みエラーが発生する | `act(() => mapErrorHandlerRef.current?.('地図の読み込みに失敗しました'))` |
| 地図の代わりに非対応の案内が表示されている | 「WebGL2 に対応していない」文言 |

実装規約: 検証・操作は `find*` / `waitFor` で待つ。`tests/component-steps/index.ts` で mocks → phrases を import し、`afterEach` で cleanup・localStorage・`data-color-theme`・URL・matchMedia スタブ・モック既定値を復元する。

- [ ] **Step 3: `tests/component.spec.ts` を作る**

```ts
import { describe, test } from 'vitest';
import { registry } from './component-steps/phrases';
import { loadSpecs } from './spec-runner/load';
import { rowLabel, rowPhrases } from './spec-runner/parse';

for (const feature of loadSpecs()) {
  describe(feature.name, () => {
    for (const table of feature.tables) {
      for (const row of table.rows.filter((row) => row.layer === 'c')) {
        test(`${table.heading} #${row.id} ${rowLabel(table, row)}`, async () => {
          for (const phrase of rowPhrases(feature, table, row)) {
            await registry.run({}, phrase);
          }
        });
      }
    }
  });
}
```

- [ ] **Step 4: 既存テストを整理する** — `src/app/App.test.tsx` を「fitBounds が呼ばれる」「古いマニフェスト応答は新しい応答を上書きしない」の 2 件（+ 必要な最小モック）に縮小。`src/theme/DetailPanel.test.tsx` の「閉じるボタンで onClose」テストを削除（c 行が担保）。c 行はすべて既存挙動の backfill なので初回から green になること（アプリコードは変更しない。落ちる場合はフレーズ実装を実挙動へ合わせる。合わせられなければ BLOCKED で報告）
- [ ] **Step 5: 検証** — Run: `pnpm vitest run`（unit + component 全 green・出力 pristine）、`pnpm typecheck && pnpm lint`
- [ ] **Step 6: コミット**

```bash
git add vite.config.ts tests src/app/App.test.tsx src/theme/DetailPanel.test.tsx
git commit -m "test(component): run perspective tables with testing-library phrases"
```

---

### Task 6: check-specs + CI

**Files:**
- Create: `scripts/check-specs.ts`
- Modify: `package.json`, `.github/workflows/ci.yml`

- [ ] **Step 1: check-specs を実装する**（パーサは spec-runner を共有）

```ts
import { existsSync } from 'node:fs';
import { loadSpecs } from '../tests/spec-runner/load';

const LAYER = /^(e2e(?:\((?:smoke|mobile)\))?|c|unit|直接|=\d+|対象外)$/;
const errors: string[] = [];

function product(valueLists: string[][]): string[][] {
  return valueLists.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

for (const feature of loadSpecs()) {
  for (const table of feature.tables) {
    const at = (id: string) => `${feature.file}「${table.heading}」#${id}`;

    for (const row of table.rows) {
      if (!LAYER.test(row.layer)) {
        errors.push(`${at(row.id)}: 層「${row.layer}」が不正`);
        continue;
      }
      if (/^(e2e|c)/.test(row.layer) && row.expects.length === 0) {
        errors.push(`${at(row.id)}: 実行行に期待がない`);
      }
      const equivalent = row.layer.match(/^=(\d+)$/);
      if (equivalent && !table.rows.some((other) => other.id === equivalent[1])) {
        errors.push(`${at(row.id)}: =${equivalent[1]} の参照先がない`);
      }
      if ((row.layer === 'unit' || row.layer === '直接') && !existsSync(row.note)) {
        errors.push(`${at(row.id)}: 備考のパスが存在しない「${row.note}」`);
      }
      if ((equivalent || row.layer === '対象外') && row.note.trim() === '') {
        errors.push(`${at(row.id)}: 理由（備考）がない`);
      }
      if (table.mode === 'matrix') {
        for (const { name } of table.axisColumns) {
          const value = row.axisValues.get(name) ?? '';
          if (!feature.axes.get(name)?.some((v) => v.value === value)) {
            errors.push(`${at(row.id)}: ${name}「${value}」が軸に宣言されていない`);
          }
        }
      }
    }

    const cross = table.heading.split('×').map((part) => part.trim());
    if (cross.length >= 2 && cross.every((axis) => feature.axes.has(axis))) {
      const covered = new Set(
        table.mode === 'matrix'
          ? table.rows.map((row) =>
              cross.map((axis) => row.axisValues.get(axis)).join(' × '),
            )
          : table.rows.map((row) => row.label),
      );
      for (const combo of product(
        cross.map((axis) => feature.axes.get(axis)?.map((v) => v.value) ?? []),
      )) {
        const key = combo.join(' × ');
        if (!covered.has(key)) {
          errors.push(`${feature.file}「${table.heading}」に ${key} の行がない`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`check-specs: ${errors.length} 件のエラー`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('check-specs: OK');
```

`package.json` scripts: `"check-specs": "tsx scripts/check-specs.ts"`。`.github/workflows/ci.yml` の `- run: pnpm validate-data` の直後に `- run: pnpm check-specs` を追加。

- [ ] **Step 2: 検証** — Run: `pnpm check-specs`（エラーが出たら**観点表側を直す**。仕様の意図が変わる場合は要相談）、`pnpm typecheck && pnpm lint && pnpm vitest run`
- [ ] **Step 3: コミット**

```bash
git add scripts/check-specs.ts package.json .github/workflows/ci.yml
git commit -m "test(specs): add frame and reference consistency check"
```

---

### Task 7: ドキュメント更新と全体検証

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: CLAUDE.md の E2E 節を置換する**

`## E2E テスト仕様書（e2e/features/）` から `## データ作成` の直前までを以下へ置換:

```markdown
## テスト仕様書（specs/）

- テスト仕様は「実行可能な観点表」。機能ごとの `specs/<機能>.md` が唯一の一次情報で、人間がレビューする唯一の定常対象。ランナーが表を直接実行するため、仕様からテストへの変換・生成工程は存在しない
- すべての表は 状態（Given）→ 操作（When）→ 期待（Then）で読む。表は 2 形式: 軸マトリクス表（`## A × B`、列 `状態（A） | 操作（B） | 期待`、セルは軸の値で MECE を確認）と単発表（`# | 観点 | 状態 | 操作 | 期待 | 層 | 備考`）
- 機能の追加・変更は「AI が specs/GUIDELINE.md に従って観点表を差分更新 → 人間が diff をレビュー → 機械検査（フレーズ束縛 + check-specs）→ CI」の順で進める
- 層の境界は技術基準のみ: e2e = jsdom で検証できないもの（実 MapLibre 描画・実ビューポートのレイアウト・実リロード）/ c = 画面の状態遷移・モジュール連携（地図はモック）/ unit・直接 = 純ロジック等（ポインタ参照）。同じ振る舞いを 2 層で検証しない
- セルは既存フレーズのみで書く（E2E: `e2e/steps/`、component: `tests/component-steps/`）。新しい操作が必要なときだけフレーズ実装を追加し、その diff は人間が検収する。書式・導出手順は specs/GUIDELINE.md
```

- [ ] **Step 2: README.md を更新する** — `## テスト仕様書` 節を以下へ置換し、コマンド表（README と CLAUDE 両方）の `pnpm e2e` の内容を「E2E テスト（Playwright。smoke は `@smoke` のみ）」に変更:

```markdown
## テスト仕様書

テストの受け入れ基準は `specs/<機能>.md`（実行可能な観点表）が一次情報。
機能の追加・変更は観点表の更新とレビューから始める。詳細は `specs/GUIDELINE.md` と
CLAUDE.md の「テスト仕様書」を参照。
```

- [ ] **Step 3: 全体検証（コントローラ実施）**

Run（サンドボックス内）: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm exec playwright test --list && pnpm check-specs`
Run（サンドボックス無効・実ブラウザ）: `pnpm e2e`
Expected: すべて green。E2E 12 実行（desktop 10 + mobile 2）、component は c 行 23、unit は既存 + spec-runner

- [ ] **Step 4: コミットと PR（ユーザー承認後）**

```bash
git add CLAUDE.md README.md
git commit -m "docs: describe the executable perspective table workflow"
```

push・新 PR 作成・旧 PR #6 の close はユーザーの承認を得てから行う。PR には「テーマ切替後のフィルタ維持は現状挙動の固定。仕様として正しいかは要判断」を明記する。

---

## Self-Review

- **Spec coverage:** 観点表 = 実行される仕様 → Task 1（ランナー）+ 3（表）+ 4-5（両層の実行）。状態→操作→期待の統一 → parse の states/operations/axisValues と rowPhrases の順序（Task 1）。軸マトリクスと単発表の 2 形式 → mode 判定（Task 1）。枠の網羅・参照整合 → Task 6。凝集 → `specs/<機能>.md` 1 ファイル。フレーズ束縛 → registry の未定義エラー。GUIDELINE → Task 2。ドキュメント → Task 7
- **Placeholder scan:** parse / registry / load / catalog.spec / component.spec / check-specs は完全なコード。フレーズ実装は語彙 × 実装要点の表で仕様化（旧 e2e/steps と App.test.tsx のモックの移植であり、転記元がリポジトリ内に実在）
- **Type consistency:** specs の全フレーズ（Task 3）を Task 4・5 の語彙表と突き合わせ済み。matrix の軸列見出しは全角括弧 `状態（軸）`/`操作（軸）` で AXIS_HEADER と一致。matrix の軸値（importance-filter）は軸辞書の宣言値と一致。error-handling の `失敗対象 × 段階` は 4×2=8 行で網羅（check-specs が観点の組ラベルで照合）。c 行のフィクスチャ（バビロン★1・ウル★2・ユーフラテス川★1・壊れたテーマ）は mocks.tsx と一致。e2e 行の実データ（アテネ / ancient-greece / ウルク★3）は public/data と一致
- **リスク:** ①自作ランナーの品質 → パーサは TDD（Task 1）、束縛エラーは `--list` / vitest で検出 ②`vi.mock` × setupFiles の相性 → 効かない場合は `vi.doMock` + 動的 import に切替（Task 5 実装時） ③「切替後のフィルタ維持」は現状挙動の固定で仕様未決（PR に明記） ④マニフェストエラーの実文言（specs では「マニフェストの取得に失敗しました」）は App.tsx と一致するか実装時に確認し、異なれば観点表の期待を実装に合わせる
