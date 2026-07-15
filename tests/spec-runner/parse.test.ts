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
