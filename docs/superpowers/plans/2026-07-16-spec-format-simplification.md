# 観点表フォーマット簡素化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実行可能な観点表を「1 形式・5 列（観点／状態／操作／期待／層）」に統一し、軸辞書・軸マトリクス表・非実行行の混在を廃してレビューの認知負荷を下げる。

**Architecture:** パーサ（`tests/spec-runner/parse.ts`）から軸・マトリクスの概念を撤去してフラットな表だけを読む形に縮小し、ランナーと `check-specs` を新シグネチャ・新語彙へ追従させ、7 本の観点表を新書式へ書き換える。「観点表 = 実行される仕様（変換工程ゼロ）」の核は維持する。

**Tech Stack:** TypeScript / Vitest（unit + component projects）/ Playwright / Node スクリプト（`tsx`）。

## Global Constraints

- 層値は `e2e` / `e2e(smoke)` / `e2e(mobile)` / `結合` の 4 種のみ（旧 `c` は `結合` に改称）。
- フレーズ実装（`e2e/steps/`・`tests/component-steps/`）は変更しない。セルの文言は既存語彙をそのまま使う。
- コメントは Why / Warning のみ・英語。動作説明・自明な JSDoc は書かない。
- 作業ブランチ `test/spec-driven-testing` 上で行う。main へ直接コミット・push しない。
- コミットメッセージは英語・Conventional Commits。末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` を付ける。
- 6 本の観点表の書き換えは subagent（sonnet）に委譲する。メインは参照実装・パーサ・検査・統合を担う。

---

## File Structure

- `tests/spec-runner/parse.ts`（Modify）— パーサ。軸・マトリクスを撤去。
- `tests/spec-runner/parse.test.ts`（Modify）— パーサの unit テスト。新書式の fixture に置換。
- `tests/spec-runner/validate.ts`（Modify）— `rowPhrases` 新シグネチャ・エラー文言の `row.id` 除去。
- `tests/component.spec.ts`（Modify）— 層フィルタ `c`→`結合`、`rowPhrases`/`rowLabel` 新シグネチャ、タイトルの `#id` 除去。
- `e2e/catalog.spec.ts`（Modify）— `rowPhrases`/`rowLabel` 新シグネチャ、タイトルの `#id` 除去。
- `scripts/check-specs.ts`（Modify）— 3 チェックへ縮小し、`## 別層で検証` の散文パスを検査。
- `specs/importance-filter.md`（Modify）— 参照実装。
- `specs/{app-boot,color-theme,error-handling,feature-detail,mobile,theme-selection}.md`（Modify）— 新書式へ。
- `specs/GUIDELINE.md`・`CLAUDE.md`・`README.md`（Modify）— 新書式の運用へ更新。

---

## Task 1: パーサとその unit テストを新書式へ縮小

**Files:**
- Modify: `tests/spec-runner/parse.ts`
- Modify: `tests/spec-runner/parse.test.ts`
- Modify: `tests/spec-runner/validate.ts`
- Modify: `tests/component.spec.ts`
- Modify: `e2e/catalog.spec.ts`

**Interfaces:**
- Produces:
  - `type SpecRow = { label: string; states: string[]; operations: string[]; expects: string[]; layer: string }`
  - `type SpecTable = { heading: string; premise: string[]; rows: SpecRow[] }`
  - `type SpecFeature = { name: string; file: string; tables: SpecTable[] }`
  - `parseSpec(markdown: string, file: string): SpecFeature`
  - `rowPhrases(table: SpecTable, row: SpecRow): string[]`
  - `rowLabel(row: SpecRow): string`

- [ ] **Step 1: parse.test.ts を新書式の fixture へ置換（失敗するテスト）**

`tests/spec-runner/parse.test.ts` の全内容を次に置き換える:

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

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `pnpm vitest run tests/spec-runner/parse.test.ts`
Expected: FAIL（`rowPhrases` の引数不一致・`feature.axes` 依存の消滅などで型/実行エラー）

- [ ] **Step 3: parse.ts を新書式へ縮小**

`tests/spec-runner/parse.ts` の全内容を次に置き換える:

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

function collectRawTables(markdown: string): { name: string; raws: RawTable[] } {
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

- [ ] **Step 4: 呼び出し側 3 ファイルを新シグネチャへ追従**

`tests/spec-runner/validate.ts` の内側ループを次へ（`rowPhrases` の引数と、エラー文言の `#${row.id}` → `${row.label}`）:

```ts
        if (!includesLayer(row.layer)) continue;
        for (const phrase of rowPhrases(table, row)) {
          if (!registry.resolves(phrase)) {
            unresolved.push(
              `${feature.file}「${table.heading}」${row.label}: ${phrase}`,
            );
          }
        }
```

`tests/component.spec.ts` を次へ（`c`→`結合`、シグネチャ、タイトルの `#id` 除去）:

```ts
import { describe, test } from 'vitest';
import { registry } from './component-steps/phrases';
import { loadSpecs } from './spec-runner/load';
import { rowLabel, rowPhrases } from './spec-runner/parse';
import { assertPhrasesResolve } from './spec-runner/validate';

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

`e2e/catalog.spec.ts` の内側 2 箇所を次へ（シグネチャ、タイトルの `#id` 除去）:

```ts
      const title = `${feature.name} ${table.heading} ${rowLabel(row)}`;
      test(title, { tag }, async ({ page }) => {
        for (const phrase of rowPhrases(table, row)) {
          await registry.run({ page }, phrase);
        }
      });
```

- [ ] **Step 5: パーサ unit テストと型チェックが通ることを確認**

Run: `pnpm vitest run tests/spec-runner/parse.test.ts && pnpm typecheck`
Expected: parse.test.ts PASS、typecheck PASS。

> 注意: この時点で `pnpm test`（全体）と `pnpm check-specs` は**赤**になる。実 specs がまだ旧書式で、`assertPhrasesResolve` がモジュールロード時に未定義フレーズ（`★1のみ` 等）で throw するため。Task 4 で全 specs 移行後に緑へ戻す。

- [ ] **Step 6: コミット**

```bash
git add tests/spec-runner/parse.ts tests/spec-runner/parse.test.ts tests/spec-runner/validate.ts tests/component.spec.ts e2e/catalog.spec.ts
git commit -m "$(cat <<'EOF'
refactor(spec-runner): flatten parser to the 5-column table format

Drop axis dictionary and matrix mode; parse only 観点/状態/操作/期待/層.
Rename component layer c -> 結合. Full suite stays red until specs migrate.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: importance-filter.md を新書式へ（参照実装）

**Files:**
- Modify: `specs/importance-filter.md`

- [ ] **Step 1: 新書式へ全面書き換え**

`specs/importance-filter.md` の全内容を次に置き換える（`## 軸` 廃止、`=N` 行の削除、`## unit` → `## 別層で検証`、`c`→`結合`、`#`/`備考` 列削除）:

```markdown
# 頻出度フィルタ

## 選択中のフィーチャー × フィルタ
前提: アプリを開いている<br>テーマ「古代オリエント」を選択している

| 観点 | 状態 | 操作 | 期待 | 層 |
| --- | --- | --- | --- | --- |
| なし × ★1のみ | | 頻出度フィルタを「★1のみ」に切り替える | 都市マーカー「バビロン」が表示されている<br>都市マーカー「ウル」が表示されていない | e2e |
| なし × ★1〜2 | | 頻出度フィルタを「★1〜2」に切り替える | 都市マーカー「ウル」が表示されている<br>都市マーカー「ウルク」が表示されていない | e2e |
| なし × すべて | 頻出度フィルタを「★1のみ」に切り替えている | 頻出度フィルタを「すべて」に切り替える | 都市マーカー「ウルク」が表示されている | e2e |
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

> 「なし × すべて」の行は、旧仕様の「前置き: 頻出度フィルタを『★1のみ』に切り替える」を `状態` 列へ畳んだもの。フレーズは操作形（〜する）でなく状態形（〜している）に読み替える必要があるため、`頻出度フィルタを「★1のみ」に切り替えている` が `tests/component-steps/phrases.tsx`・`e2e/steps/index.ts` に無ければ Step 3 で未定義フレーズとして落ちる。その場合はこの行の `状態` を空にし、代わりに `操作` 先頭へ `頻出度フィルタを「★1のみ」に切り替える<br>` を足す（操作を 2 手にする）。

- [ ] **Step 2: フレーズ解決を単体で確認**

Run: `pnpm vitest run tests/component.spec.ts -t "頻出度フィルタ"`
Expected: 「テーマ切替との組み合わせ」「選択中のフィーチャー × フィルタ」の `結合` 行が PASS。未定義フレーズが出たら Step 1 の注記に従い操作 2 手へ修正して再実行。

（この Task では他機能の spec が旧書式のままなので全体テストは実行しない。単一ファイル指定で確認する。）

---

## Task 3: 残り 6 本の観点表を新書式へ（subagent 並列）

**Files:**
- Modify: `specs/app-boot.md` / `specs/color-theme.md` / `specs/error-handling.md` / `specs/feature-detail.md` / `specs/mobile.md` / `specs/theme-selection.md`

**実行:** メインは 6 本それぞれに sonnet の subagent を割り当てて並列に書き換える（機械的作業の委譲）。各 subagent へ渡す指示は共通で「対象ファイルの現内容 + Task 2 の `importance-filter.md`（参照実装）+ 下記の変換ルールと per-file 注記」。

- [ ] **Step 1: 全 subagent 共通の変換ルールを渡す**

各 subagent に次を指示する:
- 表は `| 観点 | 状態 | 操作 | 期待 | 層 |` の 1 形式のみ。`#`・`備考` 列を削除する。
- `## 軸` セクションがあれば削除する（辞書・間接参照は使わない）。マトリクス表は各行のセルへフレーズを直接書く（値ではなくフレーズ）。
- 層 `c` は `結合` に置換する。`e2e` 系はそのまま。
- 層 `unit` / `直接` の行は表から出し、ファイル末尾の `## 別層で検証` に `- 観点: \`パス\`` の箇条書きで移す（パスは旧「備考」のパス）。
- 層 `対象外` の行は表から出し、ファイル末尾の `## 対象外` に `- 観点: 理由` の箇条書きで移す。
- 層 `=N`（同値・非実行）の行は削除する。
- 旧「前置き:」の行別準備は当該行の `状態` 列へ畳む。フレーズ文言（セルの日本語）は一字一句変えない。既存フレーズにない言い回しを作らない。
- 表の直前の `前提:` 行はそのまま残す。

- [ ] **Step 2: per-file 注記を各 subagent に渡す**

- `app-boot.md`（`## 起動`）: 行「WebGL2 対応」e2e(smoke) と「WebGL2 非対応」`結合` を表に残す。「起動中の表示（対象外）」→ `## 対象外`。「WebGL 判定ロジック（unit, src/shared/webgl.test.ts）」→ `## 別層で検証`。
- `color-theme.md`（`## カラーテーマ`）: 行 1〜3（`結合`/`結合`/e2e）を残す。「初期値の解決ロジック（unit, src/app/colorTheme.test.ts）」→ `## 別層で検証`。
- `error-handling.md`: `## 軸` を削除。`## 失敗対象 × 段階` の 8 行のうち「テーマ本体 × 回復（対象外）」→ `## 対象外`、残り 7 行は `結合`。`## unit` の 2 行（src/theme/fetch.test.ts / src/data/manifest.test.ts）→ `## 別層で検証`。
- `feature-detail.md`: `## 開く`（e2e 2 行）はそのまま。`## 閉じる` の 3 行 `c`→`結合`。`## 直接テスト`（src/theme/DetailPanel.test.tsx）→ `## 別層で検証`。
- `mobile.md`（`## モバイル`）: 4 行のうち `c`→`結合`、e2e(mobile) はそのまま。`## unit`（src/shared/useMediaQuery.test.ts）→ `## 別層で検証`。
- `theme-selection.md`: `## 基本動作`（6 行）の `c`→`結合`、e2e はそのまま。`## 直リンク`（2 行）の `c`→`結合`。`## 直接テスト・unit`（4 行: src/app/App.test.tsx ×2 / src/theme/urlState.test.ts / src/theme/Sidebar.test.tsx）→ `## 別層で検証`。

- [ ] **Step 3: メインで各ファイルの体裁を検収**

各ファイルが `| 観点 | 状態 | 操作 | 期待 | 層 |` の列見出しを持ち、`## 軸`・`#`・`備考`・`=N`・`c` が残っていないことを確認する:

Run: `grep -nE "^## 軸|^\| # \||\| 備考 \|| c \||=[0-9]" specs/*.md`
Expected: 出力なし（該当なし）。

---

## Task 4: check-specs を縮小し、全体を緑にする

**Files:**
- Modify: `scripts/check-specs.ts`

- [ ] **Step 1: check-specs.ts を 3 チェックへ縮小**

`scripts/check-specs.ts` の全内容を次に置き換える:

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

- [ ] **Step 2: 全体の検査を実行して緑を確認**

Run: `pnpm typecheck && pnpm test && pnpm check-specs && pnpm exec playwright test --list && pnpm e2e:smoke`
Expected: typecheck PASS / Vitest（parse unit + 全 `結合` 行）PASS / `check-specs: OK` / e2e 行が list に出る / smoke PASS。落ちたら該当 spec のフレーズ・層を Task 2/3 の注記に照らして修正する。

- [ ] **Step 3: コミット**

```bash
git add specs/ scripts/check-specs.ts
git commit -m "$(cat <<'EOF'
refactor(specs): migrate perspective tables to the flat 5-column format

Drop axis dictionaries, equivalence rows, and non-executable table rows;
move pointers/exclusions to prose. Shrink check-specs to 3 checks.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: ガイドラインとドキュメントを更新

**Files:**
- Modify: `specs/GUIDELINE.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: GUIDELINE.md を新書式へ書き換え**

「読み方の統一」「観点の導出手順」は維持しつつ、「表の書き分け」「表の書式」節を次の 1 形式ルールへ置換する:
- すべての表は `| 観点 | 状態 | 操作 | 期待 | 層 |`。状態・操作・期待はフレーズを直接書く（`<br>` 区切り）。
- 組み合わせ観点は `観点` を `A × B` の組ラベルにし、人が目視で網羅を確認する（機械の直積検査は無い）。
- 層は `e2e` / `e2e(smoke)` / `e2e(mobile)` / `結合` のみ。非実行の検証は `## 別層で検証`（`- 観点: \`パス\``）、テストしない観点は `## 対象外`（`- 観点: 理由`）に散文で書く。
- `前提:` は表直前の共通 Given。実行順は 前提 → 状態 → 操作 → 期待。
「機械検査」節を新 `check-specs`（層値・実行行の期待・別層ポインタの実在）に合わせて書き換える。軸・直積・`=N`・マトリクスへの言及を削除する。

- [ ] **Step 2: CLAUDE.md の specs 節を更新**

「テスト仕様書（specs/）」節から軸マトリクス表・単発表の 2 形式、`=N`、`対象外` の旧記法の記述を削除し、1 形式・5 列・`結合`・散文分離（別層で検証／対象外）へ更新する。層の境界の説明で `c` を使っている箇所を `結合` に改める。

- [ ] **Step 3: README.md の該当箇所を更新**

観点表・`check-specs` に触れている箇所があれば新書式・新チェック内容へ更新する（`pnpm check-specs` の説明の直積網羅 → 層値・期待・ポインタ実在）。

- [ ] **Step 4: 最終確認とコミット**

Run: `pnpm typecheck && pnpm test && pnpm check-specs`
Expected: すべて PASS / OK。

```bash
git add specs/GUIDELINE.md CLAUDE.md README.md
git commit -m "$(cat <<'EOF'
docs: update spec guideline and docs for the flat table format

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- **Spec coverage:** 新書式（1 形式 5 列・フレーズ直書き）= Task 1〜3 / 層語彙 `結合` = Task 1・3 / 非実行行の散文分離 = Task 3・4 / check-specs 縮小 = Task 4 / GUIDELINE・CLAUDE.md・README = Task 5。設計スペックの全節に対応タスクあり。
- **Type consistency:** `SpecRow`（label/states/operations/expects/layer）・`rowPhrases(table,row)`・`rowLabel(row)` は Task 1 で定義し、validate.ts・component.spec.ts・catalog.spec.ts・check-specs.ts の呼び出しと一致。`row.id`・`table.mode`・`feature.axes` への参照は全呼び出し側から除去済み。
- **Placeholder scan:** コードステップはすべて完全なコード。per-file 変換は具体的な行・パスを明記。
- **既知の非常態:** Task 1 のコミットは全体テストが赤（実 specs 未移行）。Task 4 で緑へ戻す。これは結合スイートが全 specs に依存するための不可避な中間状態で、パーサ自体は unit テストで緑を担保する。
