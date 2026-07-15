# テスト戦略実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計スペック（docs/superpowers/specs/2026-07-13-test-strategy-design.md）を実装する。テスト仕様を「実行可能な観点表」（`specs/<機能>.md`）に一本化し、ランナーが表を 1 行 = 1 テストとして直接実行、`check-specs` が層・期待・ポインタを CI で検査する。

**Architecture:** `tests/spec-runner/`（表パース + フレーズディスパッチ、純ロジック）を共有ライブラリとし、`tests/e2e/catalog.spec.ts`（Playwright）が e2e 行を、`tests/component/component.spec.ts`（Vitest）が 結合 行を実行する。フレーズ実装は `tests/e2e/steps.ts`（Playwright）と `tests/component/steps.tsx`（Testing Library + モック）。playwright-bdd / bddgen / Gherkin は撤去し、外部依存は素の Playwright / Vitest のみ。

**Tech Stack:** Playwright / Vitest + React Testing Library（jsdom）/ tsx。

## Global Constraints

- ブランチ `test/spec-driven-testing`。実行開始・コミット・push・PR 操作はユーザーの指示後
- コミットは英語 Conventional Commits。ドキュメントは日本語。コード内コメントは Why / Warning のみ英語
- 二重テスト禁止。層の境界は技術基準のみ
- すべての表は 1 形式 `| 観点 | 状態 | 操作 | 期待 | 層 |`。状態（Given）→ 操作（When）→ 期待（Then）を左から右に読み、セルにフレーズを直接書く。組み合わせ観点は `観点` を `A × B` の組ラベルにする。未定義フレーズはランナーがモジュールロード時にエラーにする
- 層の値は `e2e` / `e2e(smoke)` / `e2e(mobile)` / `結合` のみ。セル内の複数フレーズは `<br>` 区切り
- 非実行の検証（純ロジック等のポインタ・テストしない観点）は表に混ぜず、`## 別層で検証`（`- 観点: `パス``）・`## 対象外`（`- 観点: 理由`）の散文に書く
- サンドボックス内では dev サーバ（localhost）不可。`pnpm e2e` はコントローラがサンドボックス無効で実行。タスク内の検証は typecheck / lint / vitest / `pnpm exec playwright test --list` / `pnpm check-specs` まで
- 結合 行はモックのフィクスチャ（古代オリエント: バビロン★1・ウル★2・ユーフラテス川★1、壊れたテーマ）を、e2e 行は実データ（古代ギリシア等を含む）を参照する

## File Structure

- Create: `tests/spec-runner/{parse.ts,registry.ts,load.ts,validate.ts,parse.test.ts}`、`specs/GUIDELINE.md`、`specs/<機能>.md` × 7、`tests/e2e/{catalog.spec.ts,steps.ts}`、`tests/component/{steps.tsx,mocks.tsx,setup.ts,component.spec.ts}`、`scripts/check-specs.ts`
- Modify: `playwright.config.ts`、`vite.config.ts`、`tsconfig.json`、`package.json`、`.github/workflows/ci.yml`、`biome.json`、`.gitignore`、`src/app/App.test.tsx`、`src/theme/DetailPanel.test.tsx`、`CLAUDE.md`、`README.md`
- Delete: `e2e/features/**`、旧 `e2e/steps/*.steps.ts` と `e2e/steps/fixtures.ts`、devDependency `playwright-bdd`

---

### Task 1: spec-runner（表パース + ディスパッチ + フレーズ解決検査）

**Files:**
- Create: `tests/spec-runner/{parse.ts,registry.ts,load.ts,validate.ts,parse.test.ts}`
- Modify: `vite.config.ts`（unit include に `tests/spec-runner/**/*.test.ts` を追加）

**Interfaces（Produces）:**

```ts
export type SpecRow = {
  label: string;        // 観点
  states: string[];     // 状態フレーズ
  operations: string[]; // 操作フレーズ
  expects: string[];    // 期待フレーズ
  layer: string;
};
export type SpecTable = { heading: string; premise: string[]; rows: SpecRow[] };
export type SpecFeature = { name: string; file: string; tables: SpecTable[] };
export function parseSpec(markdown: string, file: string): SpecFeature;
export function rowPhrases(table: SpecTable, row: SpecRow): string[];
export function rowLabel(row: SpecRow): string;
```

- [ ] **Step 1: 失敗するテストを書く（`tests/spec-runner/parse.test.ts`）**

```ts
import { describe, expect, it } from 'vitest';
import { parseSpec, rowLabel, rowPhrases } from './parse';

const sample = `# サンプル

## 選択中のフィーチャー × フィルタ
前提: アプリを開いている

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| なし × ★1のみ | | 頻出度フィルタを「★1のみ」に切り替える | 都市マーカー「バビロン」が表示されている | e2e |
| ★2都市 × ★1のみ | 都市マーカー「ウル」を選択している | 頻出度フィルタを「★1のみ」に切り替える | 解説パネルが表示されていない | 結合 |

## 別層で検証
- 絞り込みの境界: \`src/theme/filter.test.ts\`
`;

const feature = parseSpec(sample, 'sample.md');
const table = feature.tables[0];
if (!table) throw new Error('サンプル仕様の表がパースできていない');
const row = table.rows[1];
if (!row) throw new Error('サンプル仕様の行がパースできていない');

describe('parseSpec', () => {
  it('表のみを収集し、前提と見出しを読む', () => {
    expect(feature.tables).toHaveLength(1);
    expect(table.heading).toBe('選択中のフィーチャー × フィルタ');
    expect(table.premise).toEqual(['アプリを開いている']);
  });

  it('行の観点・状態・操作・期待・層を読む', () => {
    expect(row.label).toBe('★2都市 × ★1のみ');
    expect(row.states).toEqual(['都市マーカー「ウル」を選択している']);
    expect(row.operations).toEqual(['頻出度フィルタを「★1のみ」に切り替える']);
    expect(row.expects).toEqual(['解説パネルが表示されていない']);
    expect(row.layer).toBe('結合');
  });

  it('rowPhrases は 前提 → 状態 → 操作 → 期待 の順', () => {
    expect(rowPhrases(table, row)).toEqual([
      'アプリを開いている',
      '都市マーカー「ウル」を選択している',
      '頻出度フィルタを「★1のみ」に切り替える',
      '解説パネルが表示されていない',
    ]);
  });

  it('rowLabel は観点をそのまま返す', () => {
    expect(rowLabel(row)).toBe('★2都市 × ★1のみ');
  });
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `pnpm vitest run tests/spec-runner/parse.test.ts`（include 追加後）。Expected: FAIL

- [ ] **Step 3: 実装する（`tests/spec-runner/parse.ts`）**

```ts
export type SpecRow = {
  label: string;
  states: string[];
  operations: string[];
  expects: string[];
  layer: string;
};
export type SpecTable = {
  heading: string;
  premise: string[];
  rows: SpecRow[];
};
export type SpecFeature = {
  name: string;
  file: string;
  tables: SpecTable[];
};

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

type RawTable = {
  heading: string;
  premise: string[];
  header: string[];
  rows: string[][];
};

function collectRawTables(markdown: string): {
  name: string;
  raws: RawTable[];
} {
  const lines = markdown.split('\n');
  const raws: RawTable[] = [];
  let name = '';
  let heading = '';
  let premise: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      name = (h1[1] ?? '').trim();
      continue;
    }
    const h2 = line.match(/^#{2,}\s+(.+)$/);
    if (h2) {
      heading = (h2[1] ?? '').trim();
      premise = [];
      continue;
    }
    const premiseMatch = line.match(/^前提:\s*(.+)$/);
    if (premiseMatch) {
      premise = splitPhrases(premiseMatch[1] ?? '');
      continue;
    }
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      const header = splitCells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j] ?? '')) {
        rows.push(splitCells(lines[j] ?? ''));
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

  const tables: SpecTable[] = [];
  for (const raw of raws) {
    const col = (header: string) => raw.header.indexOf(header);
    if (col('期待') < 0 || col('層') < 0) continue;

    const rows: SpecRow[] = raw.rows.map((cells) => ({
      label: col('観点') >= 0 ? (cells[col('観点')] ?? '') : '',
      states: col('状態') >= 0 ? splitPhrases(cells[col('状態')] ?? '') : [],
      operations:
        col('操作') >= 0 ? splitPhrases(cells[col('操作')] ?? '') : [],
      expects: splitPhrases(cells[col('期待')] ?? ''),
      layer: cells[col('層')] ?? '',
    }));

    tables.push({ heading: raw.heading, premise: raw.premise, rows });
  }

  return { name: name || file, file, tables };
}

export function rowPhrases(table: SpecTable, row: SpecRow): string[] {
  return [...table.premise, ...row.states, ...row.operations, ...row.expects];
}

export function rowLabel(row: SpecRow): string {
  return row.label;
}
```

`registry.ts`（ディスパッチ + フレーズ解決判定）と `load.ts`（specs 読み込み）:

```ts
// tests/spec-runner/registry.ts
export type PhraseHandler<Ctx> = (
  ctx: Ctx,
  ...args: string[]
) => Promise<void> | void;

export function createRegistry<Ctx>() {
  const entries: { pattern: RegExp; handler: PhraseHandler<Ctx> }[] = [];
  return {
    phrase(pattern: RegExp, handler: PhraseHandler<Ctx>) {
      entries.push({ pattern, handler });
    },
    resolves(text: string): boolean {
      return entries.some((entry) => entry.pattern.test(text));
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
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpec, type SpecFeature } from './parse';

export function loadSpecs(dir = 'specs'): SpecFeature[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'GUIDELINE.md')
    .sort()
    .map((file) => parseSpec(readFileSync(join(dir, file), 'utf8'), file));
}
```

`validate.ts`（実行層のフレーズが解決するかをモジュールロード時に検査）:

```ts
// tests/spec-runner/validate.ts
import { rowPhrases, type SpecFeature } from './parse';

type PhraseResolver = { resolves(text: string): boolean };

// Fail at module load so an undefined phrase surfaces even when its row is not
// selected (e.g. a non-@smoke e2e row under `playwright test --grep @smoke`).
export function assertPhrasesResolve(
  features: SpecFeature[],
  registry: PhraseResolver,
  includesLayer: (layer: string) => boolean,
): void {
  const unresolved: string[] = [];
  for (const feature of features) {
    for (const table of feature.tables) {
      for (const row of table.rows) {
        if (!includesLayer(row.layer)) continue;
        for (const phrase of rowPhrases(table, row)) {
          if (!registry.resolves(phrase)) {
            unresolved.push(
              `${feature.file}「${table.heading}」${row.label}: ${phrase}`,
            );
          }
        }
      }
    }
  }
  if (unresolved.length > 0) {
    throw new Error(
      `未定義のフレーズ:\n${unresolved.map((entry) => `  - ${entry}`).join('\n')}`,
    );
  }
}
```

`vite.config.ts` の test.include に `'tests/spec-runner/**/*.test.ts'` を追加（projects 化は Task 5）。

- [ ] **Step 4: green を確認してコミット**

Run: `pnpm vitest run tests/spec-runner/parse.test.ts && pnpm typecheck && pnpm lint`

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

## 表の形

すべての表は次の 1 形式のみ。状態（Given）→ 操作（When）→ 期待（Then）を左から右に読む。

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |

- 状態・操作・期待にはフレーズを直接書く（`<br>` 区切り）。状態・操作は空欄可、期待は実行行では必須。
- 観点は行の一言ラベル。組み合わせ観点は `A × B` の組ラベルにする。
- 表の直前の `前提: フレーズ<br>フレーズ` はその表の全行の先頭で実行される共通 Given。行だけの追加準備は状態列に書く。
- 実行順は 前提 → 状態 → 操作 → 期待。

## 観点の導出手順

1. 対象機能の状態変数とその値域を洗い出す
2. 6 カテゴリを順に当てて観点を出す: ①状態の単体（loading / error / empty / success）②状態の組み合わせ（変更した状態 × 既存の状態）③派生状態の追従 ④境界値 ⑤エラー経路と回復 ⑥永続化・リロード
3. 相互作用する変数の組み合わせは、観点を `A × B` の組ラベルにして各組を 1 行ずつ並べる。網羅（MECE）は観点の列を目視で確認する（機械の直積検査はない）。相互作用しない組は書かない
4. 各行を層へ振り分ける（技術基準のみ。下記）
5. セルは既存フレーズのみで書く（語彙は `tests/e2e/steps.ts`・`tests/component/steps.tsx`。未定義フレーズはテスト収集時にエラーになる）

## 層

`層` は「どこで走るか」だけを表す。実行される層のみを書く。

- `e2e` / `e2e(smoke)` / `e2e(mobile)` — 実ブラウザ（Playwright）を要する: 実 MapLibre 描画・実ビューポートのレイアウト・実リロード
- `結合` — 実 App を jsdom で動かし、地図とデータ取得をモックする。画面の状態遷移・モジュール連携でしか確認できないもの
- 同じ振る舞いを 2 層で検証しない。分岐・変形は下位層に置く

## 非実行の検証は散文へ

表には実行行だけを書く。純ロジック等の非実行検証と、テストしない観点は、ファイル末尾の散文に分ける。

- `## 別層で検証` — `- 観点: `パス`` の箇条書き。既存の unit・直接テストへのポインタ
- `## 対象外` — `- 観点: 理由` の箇条書き

## フレーズの規約

- 状態は「〜している / 〜である」、操作は「〜する」、期待は「〜されている / 〜されていない」
- `「」` 内を引数に取るフレーズは正規表現で定義する
- 表記ゆれ禁止。既存フレーズを再利用し、同義の新しい言い回しを作らない
- ロケータ・クエリは role / アクセシブルネーム / `data-*` を優先。component 実装は `find*` / `waitFor` で待つ

## フレーズ実装を増やすとき

- 新しい UI 操作・検証が必要な場合のみ追加する（E2E: `tests/e2e/steps.ts`、component: `tests/component/steps.tsx`）
- 追加・変更の diff は人間が検収する。見る点は 3 つ: 文と実装の意味の一致 / 対象を正しく指しているか / 否定形・待機の実装
- 同じ文は層をまたいで同じ意味に保つ（実装は層ごとに別でよい）

## レビューの分担

- 毎回: `specs/<機能>.md` の diff（観点の抜け・状態・操作・期待・層・別層/対象外の判断）
- 語彙の増減時のみ: フレーズ実装の diff（上記 3 点）
- ランナー・unit・直接テストのコードは定常の精読対象にしない

## 機械検査

- ランナー: 未定義フレーズをエラーにする
- `pnpm check-specs`: 層値が既知集合（e2e 系 / 結合）に含まれる / 実行行に期待がある / `## 別層で検証` のポインタ先が実在する / 表が期待・層列の欠落で無言のうちに落ちていない
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
| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| WebGL2 対応 | アプリを開いている | | 地図が表示されている | e2e(smoke) |
| WebGL2 非対応 | WebGL2 に対応していない環境である<br>アプリを開いている | | 地図の代わりに非対応の案内が表示されている | 結合 |

## 別層で検証
- WebGL 判定ロジック: `src/shared/webgl.test.ts`

## 対象外
- 起動中の表示: 遷移状態。成功・失敗の行で通過確認される
```

`specs/theme-selection.md`:

```markdown
# テーマ選択

## 基本動作
前提: アプリを開いている

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| 未選択の初期表示 | | | テーマ選択を促すメッセージが表示されている | 結合 |
| サイドバーから選択 | | テーマ「古代オリエント」を選択する | 都市マーカー「バビロン」が表示されている<br>地形ラベル「ユーフラテス川」が表示されている | e2e |
| 選択の URL 反映 | | テーマ「古代オリエント」を選択する | URL のクエリが「theme=ancient-orient」を含んでいる<br>テーマ選択を促すメッセージが表示されていない | 結合 |
| テーマの切替 | テーマ「古代オリエント」を選択している | テーマ「古代ギリシア」を選択する | 都市マーカー「アテネ」が表示されている<br>都市マーカー「バビロン」が表示されていない | e2e |
| 切替で解説が閉じる | テーマ「古代オリエント」を選択している<br>都市マーカー「バビロン」を選択している | テーマ「壊れたテーマ」を選択する | 解説パネルが表示されていない | 結合 |
| 一覧の表示順 | | | サイドバーのテーマが「古代オリエント,壊れたテーマ」の順に並んでいる | 結合 |

## 直リンク
| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| 正常な直リンク | クエリ「?theme=ancient-greece」でアプリを開いている | | 都市マーカー「アテネ」が表示されている | e2e |
| 不正な直リンク | クエリ「?theme=no-such-theme」でアプリを開いている | | テーマ選択を促すメッセージが表示されている<br>URL から theme パラメータが除去されている | 結合 |

## 別層で検証
- 読み込み完了の範囲移動: `src/app/App.test.tsx`
- 競合する応答: `src/app/App.test.tsx`
- URL クエリの解析・生成: `src/theme/urlState.test.ts`
- 一覧の並びロジック: `src/theme/Sidebar.test.tsx`
```

`specs/feature-detail.md`:

```markdown
# フィーチャーの解説表示

## 開く
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| 都市 | | 都市マーカー「バビロン」をクリックする | 解説パネルに「バビロン」と表示されている<br>解説パネルに「メソポタミア」を含む解説文が表示されている<br>解説パネルに頻出度「★1」が表示されている | e2e |
| 地形 | | 地形ラベル「ユーフラテス川」をクリックする | 解説パネルに「ユーフラテス川」と表示されている | e2e |

## 閉じる
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している<br>都市マーカー「バビロン」を選択している

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| 閉じるボタン | | 解説パネルの閉じるボタンをクリックする | 解説パネルが表示されていない | 結合 |
| 地図の余白 | | 地図の余白をクリックする | 解説パネルが表示されていない | 結合 |
| ドロワーを開く | | メニューボタンでドロワーを開く | 解説パネルが表示されていない | 結合 |

## 別層で検証
- パネルの表示内容: `src/theme/DetailPanel.test.tsx`
```

`specs/importance-filter.md`:

```markdown
# 頻出度フィルタ

## 選択中のフィーチャー × フィルタ
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| なし × ★1のみ | | 頻出度フィルタを「★1のみ」に切り替える | 都市マーカー「バビロン」が表示されている<br>都市マーカー「ウル」が表示されていない | e2e |
| なし × ★1〜2 | | 頻出度フィルタを「★1〜2」に切り替える | 都市マーカー「ウル」が表示されている<br>都市マーカー「ウルク」が表示されていない | e2e |
| なし × すべて | | 頻出度フィルタを「★1のみ」に切り替える<br>頻出度フィルタを「すべて」に切り替える | 都市マーカー「ウルク」が表示されている | e2e |
| ★1都市を選択 | 都市マーカー「バビロン」を選択している | 頻出度フィルタを「★1のみ」に切り替える | 解説パネルに「バビロン」と表示されている | 結合 |
| ★2都市を選択 | 都市マーカー「ウル」を選択している | 頻出度フィルタを「★1のみ」に切り替える | 解説パネルが表示されていない<br>都市マーカー「ウル」が表示されていない | 結合 |

## テーマ切替との組み合わせ
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| 切替後もフィルタ維持 | | 頻出度フィルタを「★1のみ」に切り替える<br>テーマ「壊れたテーマ」を選択する<br>テーマ「古代オリエント」を選択する | 都市マーカー「バビロン」が表示されている<br>都市マーカー「ウル」が表示されていない | 結合 |

## 別層で検証
- 絞り込みの境界（importance 1/2/3 → ★1のみ / ★1〜2 / 全件）: `src/theme/filter.test.ts`
```

`specs/color-theme.md`:

```markdown
# カラーテーマ

## カラーテーマ
| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| OS ダークの初期表示 | OS のカラースキームがダークである<br>アプリを開いている | | ダークテーマが適用されている | 結合 |
| トグルで切替 | アプリを開いている | カラーテーマトグルをクリックする | ダークテーマが適用されている | 結合 |
| リロード後の維持 | アプリを開いている | カラーテーマトグルをクリックする<br>ページをリロードする | ダークテーマが適用されている | e2e |

## 別層で検証
- 初期値の解決ロジック: `src/app/colorTheme.test.ts`
```

`specs/error-handling.md`:

```markdown
# エラー処理

## 失敗対象 × 段階
| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| マニフェスト × 表示 | マニフェストの取得が失敗する状態である<br>アプリを開いている | | エラーメッセージ「マニフェストの取得に失敗しました」が表示されている<br>再試行ボタンが表示されている | 結合 |
| マニフェスト × 回復 | マニフェストの取得が失敗する状態である<br>アプリを開いている | データ取得を正常に戻す<br>再試行ボタンをクリックする | サイドバーにテーマ「古代オリエント」が表示されている | 結合 |
| テーマ一覧 × 表示 | テーマ一覧の取得が失敗する状態である<br>アプリを開いている | | エラーメッセージ「データの取得に失敗しました」が表示されている<br>再試行ボタンが表示されている<br>テーマ選択を促すメッセージが表示されていない | 結合 |
| テーマ一覧 × 回復 | テーマ一覧の取得が失敗する状態である<br>アプリを開いている | データ取得を正常に戻す<br>再試行ボタンをクリックする | サイドバーにテーマ「古代オリエント」が表示されている | 結合 |
| テーマ本体 × 表示 | テーマ本体の取得が失敗する状態である<br>アプリを開いている | テーマ「古代オリエント」を選択する | エラーメッセージ「テーマの読み込みに失敗しました」が表示されている | 結合 |
| 地図タイル × 表示 | アプリを開いている | 地図の読み込みエラーが発生する | エラーメッセージ「地図の読み込みに失敗しました」が表示されている | 結合 |
| 地図タイル × 回復 | アプリを開いている | 地図の読み込みエラーが発生する<br>再試行ボタンをクリックする | エラーメッセージが表示されていない | 結合 |

## 別層で検証
- テーマ fetch 境界の Result 変換: `src/theme/fetch.test.ts`
- マニフェスト fetch 境界: `src/data/manifest.test.ts`

## 対象外
- テーマ本体 × 回復: 専用の再試行 UI が存在しない
```

`specs/mobile.md`:

```markdown
# モバイル表示

## モバイル
| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| 初期状態（閉） | モバイル幅である<br>アプリを開いている | | ドロワーが閉じている<br>サイドバーが操作不能になっている | 結合 |
| ドロワーの開閉 | モバイル幅である<br>アプリを開いている | メニューボタンでドロワーを開く | ドロワーが開いている | 結合 |
| ドロワーから選択 | アプリを開いている | メニューボタンでドロワーを開く<br>テーマ「古代オリエント」を選択する | 都市マーカー「バビロン」が表示されている | e2e(mobile) |
| 解説の表示位置 | アプリを開いている<br>テーマ「古代オリエント」を選択している | 都市マーカー「バビロン」をクリックする | 解説パネルが画面の下半分に表示されている | e2e(mobile) |

## 別層で検証
- メディアクエリの購読: `src/shared/useMediaQuery.test.ts`
```

- [ ] **Step 2: コミット**

```bash
git add specs
git commit -m "docs(specs): author executable perspective tables for all features"
```

---

### Task 4: E2E を表実行へ切り替える

**Files:**
- Create: `tests/e2e/catalog.spec.ts`, `tests/e2e/steps.ts`（フレーズ実装）
- Modify: `playwright.config.ts`, `tsconfig.json`, `package.json`, `biome.json`, `.gitignore`
- Delete: `e2e/features/**`, 旧 `e2e/steps/*.steps.ts`, `e2e/steps/fixtures.ts`, devDependency `playwright-bdd`

- [ ] **Step 1: フレーズ実装を作る（`tests/e2e/steps.ts`）**

`createRegistry<{ page: Page }>()` を作り、旧 `e2e/steps/*.steps.ts` の実装本体を流用して次のフレーズを登録し、`export const registry` する。import は `../spec-runner/registry`。

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

- [ ] **Step 2: `tests/e2e/catalog.spec.ts` を作る**

```ts
import { test } from '@playwright/test';
import { loadSpecs } from '../spec-runner/load';
import { rowLabel, rowPhrases } from '../spec-runner/parse';
import { assertPhrasesResolve } from '../spec-runner/validate';
import { registry } from './steps';

const E2E = /^e2e(?:\((smoke|mobile)\))?$/;
const features = loadSpecs();

assertPhrasesResolve(features, registry, (layer) => E2E.test(layer));

for (const feature of features) {
  for (const table of feature.tables) {
    for (const row of table.rows) {
      const matched = row.layer.match(E2E);
      if (!matched) continue;
      const tag = matched[1] ? [`@${matched[1]}`] : [];
      const title = `${feature.name} ${table.heading} ${rowLabel(row)}`;
      test(title, { tag }, async ({ page }) => {
        for (const phrase of rowPhrases(table, row)) {
          await registry.run({ page }, phrase);
        }
      });
    }
  }
}
```

- [ ] **Step 3: playwright-bdd を撤去し、テストディレクトリを移す**

`playwright.config.ts`: `defineBddConfig` を削除し `testDir: 'tests/e2e'` に。projects の grep（`@mobile`）は現状のまま。
`tsconfig.json`: include に `tests` を含める（`e2e` を個別指定しない）。
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
- Create: `tests/component/{steps.tsx,mocks.tsx,setup.ts,component.spec.ts}`
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
          setupFiles: ['./src/test-setup.ts', './tests/component/setup.ts'],
          include: ['tests/component/component.spec.ts'],
        },
      },
    ],
  },
```

- [ ] **Step 2: モックとフレーズ実装を作る**

`tests/component/mocks.tsx`: `src/app/App.test.tsx` のモック群を移植し、`FeatureMarkers` モックは実装と同じ `data-marker-kind` + `aria-label` のボタンを描画する。フィクスチャ: 古代オリエント（バビロン★1 / ウル★2 / ユーフラテス川★1・terrain）+ 壊れたテーマ（本体 fetch は常に失敗、一覧では `order: 2` でわざと未整列に置きソート検証を成立させる）。`fakeMap` / `mapHandlers` / `mapErrorHandlerRef` / `fetchControl` も移植し `resetMocks` を export する。

`tests/component/steps.tsx`: `createRegistry<Record<string, never>>()`（import は `../spec-runner/registry`）に登録。語彙と実装の要点:

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

実装規約: 検証・操作は `find*` / `waitFor` で待つ。`tests/component/setup.ts` で mocks → steps を import し、`afterEach` で cleanup・localStorage・`data-color-theme`・URL・matchMedia スタブ・モック既定値を復元する。

- [ ] **Step 3: `tests/component/component.spec.ts` を作る**

```ts
import { describe, test } from 'vitest';
import { registry } from './steps';
import { loadSpecs } from '../spec-runner/load';
import { rowLabel, rowPhrases } from '../spec-runner/parse';
import { assertPhrasesResolve } from '../spec-runner/validate';

const features = loadSpecs();

assertPhrasesResolve(features, registry, (layer) => layer === '結合');

for (const feature of features) {
  describe(feature.name, () => {
    for (const table of feature.tables) {
      for (const row of table.rows.filter((row) => row.layer === '結合')) {
        test(`${table.heading} ${rowLabel(row)}`, async () => {
          for (const phrase of rowPhrases(table, row)) {
            await registry.run({}, phrase);
          }
        });
      }
    }
  });
}
```

- [ ] **Step 4: 既存テストを整理する** — `src/app/App.test.tsx` を「fitBounds が呼ばれる」「古いマニフェスト応答は新しい応答を上書きしない」の 2 件（+ 必要な最小モック）に縮小。`src/theme/DetailPanel.test.tsx` の「閉じるボタンで onClose」テストを削除（結合 行が担保）。結合 行はすべて既存挙動の backfill なので初回から green になること（アプリコードは変更しない。落ちる場合はフレーズ実装を実挙動へ合わせる。合わせられなければ BLOCKED で報告）
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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSpecs } from '../tests/spec-runner/load';

const LAYER = /^(e2e(?:\((?:smoke|mobile)\))?|結合)$/;
const errors: string[] = [];

// Warning: a table whose header omits 期待/層 is silently dropped by the parser.
// Flag any heading that has a table in the source but produced no parsed table.
function headingsWithTables(markdown: string): string[] {
  const lines = markdown.split('\n');
  const headings: string[] = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const matched = line.match(/^#{2,}\s+(.+)$/);
    if (matched) {
      heading = (matched[1] ?? '').trim();
      continue;
    }
    const isTableHeader =
      /^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '');
    if (isTableHeader && heading && !headings.includes(heading)) {
      headings.push(heading);
    }
  }
  return headings;
}

// Pointer paths declared as `path` in the prose "## 別層で検証" section.
function pointerPaths(markdown: string): string[] {
  const lines = markdown.split('\n');
  const paths: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const heading = line.match(/^#{2,}\s+(.+)$/);
    if (heading) {
      inSection = (heading[1] ?? '').trim() === '別層で検証';
      continue;
    }
    if (!inSection) continue;
    const matched = line.match(/`([^`]+)`/);
    if (matched?.[1]) paths.push(matched[1]);
  }
  return paths;
}

for (const feature of loadSpecs()) {
  const source = readFileSync(join('specs', feature.file), 'utf8');
  const parsedHeadings = new Set(feature.tables.map((table) => table.heading));
  for (const heading of headingsWithTables(source)) {
    if (!parsedHeadings.has(heading)) {
      errors.push(
        `${feature.file}「${heading}」の表が解析されていない（期待/層 列の欠落か）`,
      );
    }
  }

  for (const table of feature.tables) {
    for (const row of table.rows) {
      const at = `${feature.file}「${table.heading}」${row.label}`;
      if (!LAYER.test(row.layer)) {
        errors.push(`${at}: 層「${row.layer}」が不正`);
        continue;
      }
      if (row.expects.length === 0) {
        errors.push(`${at}: 実行行に期待がない`);
      }
    }
  }

  for (const path of pointerPaths(source)) {
    if (!existsSync(path)) {
      errors.push(`${feature.file}「別層で検証」: パスが存在しない「${path}」`);
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
git commit -m "test(specs): add layer and reference consistency check"
```

---

### Task 7: ドキュメント更新と全体検証

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: CLAUDE.md の E2E 節を置換する**

旧 `## E2E テスト仕様書（e2e/features/）` を以下へ置換:

```markdown
## テスト仕様書（specs/）

- テスト仕様は「実行可能な観点表」。機能ごとの `specs/<機能>.md` が唯一の一次情報で、人間がレビューする唯一の定常対象。ランナーが表を直接実行するため、仕様からテストへの変換・生成工程は存在しない
- すべての表は `| 観点 | 状態 | 操作 | 期待 | 層 |` の 1 形式。状態（Given）→ 操作（When）→ 期待（Then）で読み、セルにフレーズを直接書く。組み合わせ観点は `観点` を `A × B` の組ラベルにし、網羅は人が目視で確認する
- 機能の追加・変更は「AI が specs/GUIDELINE.md に従って観点表を差分更新 → 人間が diff をレビュー → 機械検査（フレーズ束縛 + check-specs）→ CI」の順で進める
- 層の境界は技術基準のみ: e2e = jsdom で検証できないもの（実 MapLibre 描画・実ビューポートのレイアウト・実リロード）/ 結合 = 画面の状態遷移・モジュール連携（地図はモック）。同じ振る舞いを 2 層で検証しない。純ロジック等の非実行検証は表に混ぜず、`## 別層で検証`（ポインタ）・`## 対象外`（理由）に散文で書く
- セルは既存フレーズのみで書く（E2E: `tests/e2e/steps.ts`、component: `tests/component/steps.tsx`）。新しい操作が必要なときだけフレーズ実装を追加し、その diff は人間が検収する。書式・導出手順は specs/GUIDELINE.md
```

コマンド表の `check-specs` の説明を「観点表の層・期待・別層ポインタの検査」にする。

- [ ] **Step 2: README.md を更新する** — `## テスト仕様書` 節を以下へ置換し、コマンド表の `pnpm e2e` を「E2E テスト（Playwright。smoke は `@smoke` のみ）」に変更:

```markdown
## テスト仕様書

テストの受け入れ基準は `specs/<機能>.md`（実行可能な観点表）が一次情報。
機能の追加・変更は観点表の更新とレビューから始める。詳細は `specs/GUIDELINE.md` と
CLAUDE.md の「テスト仕様書」を参照。
```

- [ ] **Step 3: 全体検証（コントローラ実施）**

Run（サンドボックス内）: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm exec playwright test --list && pnpm check-specs`
Run（サンドボックス無効・実ブラウザ）: `pnpm e2e`
Expected: すべて green。E2E 12 実行（desktop 10 + mobile 2）、component は結合 行、unit は既存 + spec-runner

- [ ] **Step 4: コミットと PR（ユーザー承認後）**

```bash
git add CLAUDE.md README.md
git commit -m "docs: describe the executable perspective table workflow"
```

push・PR 操作はユーザーの承認を得てから行う。PR には「テーマ切替後のフィルタ維持は現状挙動の固定。仕様として正しいかは要判断」を明記する。

---

## Self-Review

- **Spec coverage:** 観点表 = 実行される仕様 → Task 1（ランナー）+ 3（表）+ 4-5（両層の実行）。状態→操作→期待の統一 → parse の states/operations と rowPhrases の順序（Task 1）。1 形式・5 列 → parse の列読み取り（Task 1）。層・期待・ポインタ検査 → Task 6。凝集 → `specs/<機能>.md` 1 ファイル。フレーズ束縛 → registry の未定義エラー + assertPhrasesResolve（Task 1）。GUIDELINE → Task 2。ドキュメント → Task 7
- **Placeholder scan:** parse / registry / load / validate / catalog.spec / component.spec / check-specs は完全なコード。フレーズ実装は語彙 × 実装要点の表で仕様化（旧 e2e/steps と App.test.tsx のモックの移植であり、転記元がリポジトリ内に実在）
- **Type consistency:** `SpecRow`（label/states/operations/expects/layer）・`rowPhrases(table,row)`・`rowLabel(row)` は Task 1 で定義し、catalog.spec・component.spec・validate・check-specs の呼び出しと一致。層の値は e2e 系 / 結合 のみで、catalog.spec の E2E 正規表現・component.spec の `=== '結合'`・check-specs の LAYER と整合。結合 行のフィクスチャ（バビロン★1・ウル★2・ユーフラテス川★1・壊れたテーマ）は mocks.tsx と一致。e2e 行の実データ（アテネ / ancient-greece / ウルク★3）は public/data と一致
- **リスク:** ①自作ランナーの品質 → パーサは TDD（Task 1）、束縛エラーは assertPhrasesResolve / `--list` / vitest で検出 ②`vi.mock` × setupFiles の相性 → 効かない場合は `vi.doMock` + 動的 import に切替（Task 5 実装時） ③「切替後もフィルタ維持」は現状挙動の固定で仕様未決（PR に明記） ④マニフェストエラーの実文言（specs では「マニフェストの取得に失敗しました」）は App.tsx と一致するか実装時に確認し、異なれば観点表の期待を実装に合わせる
```

