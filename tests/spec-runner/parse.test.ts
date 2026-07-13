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

const matrixTable = feature.tables[0];
const stepTable = feature.tables[1];
if (!matrixTable || !stepTable) {
  throw new Error('サンプル仕様の表がパースできていない');
}
const matrixRow = matrixTable.rows[1];
const stepRow = stepTable.rows[0];
if (!matrixRow || !stepRow) {
  throw new Error('サンプル仕様の行がパースできていない');
}

describe('parseSpec', () => {
  it('軸表を辞書として読む', () => {
    expect(feature.axes.get('選択中のフィーチャー')).toEqual([
      { value: 'なし', phrases: [] },
      { value: '★2都市', phrases: ['都市マーカー「ウル」を選択している'] },
    ]);
  });

  it('状態（軸）・操作（軸）列を持つ表を matrix と判定する', () => {
    expect(matrixTable.mode).toBe('matrix');
    expect(matrixTable.axisColumns).toEqual([
      { name: '選択中のフィーチャー', header: '状態（選択中のフィーチャー）' },
      { name: 'フィルタ', header: '操作（フィルタ）' },
    ]);
    expect(matrixTable.premise).toEqual(['アプリを開いている']);
  });

  it('matrix 行の軸値・期待・前置きを読む', () => {
    expect(matrixRow.axisValues.get('選択中のフィーチャー')).toBe('★2都市');
    expect(matrixRow.axisValues.get('フィルタ')).toBe('★1のみ');
    expect(matrixRow.expects).toEqual(['解説パネルが表示されていない']);
    expect(matrixRow.precondition).toEqual([
      '頻出度フィルタを「すべて」に切り替える',
    ]);
    expect(matrixRow.note).toBe('');
  });

  it('状態・操作列を持つ表を step と判定する', () => {
    expect(stepTable.mode).toBe('step');
    expect(stepRow.label).toBe('切替');
    expect(stepRow.states).toEqual(['テーマ「A」を選択している']);
    expect(stepRow.operations).toEqual(['テーマ「B」を選択する']);
  });

  it('matrix 行を 前提 → 前置き → 状態軸 → 操作軸 → 期待 に解決する', () => {
    expect(rowPhrases(feature, matrixTable, matrixRow)).toEqual([
      'アプリを開いている',
      '頻出度フィルタを「すべて」に切り替える',
      '都市マーカー「ウル」を選択している',
      '頻出度フィルタを「★1のみ」に切り替える',
      '解説パネルが表示されていない',
    ]);
  });

  it('step 行を 前提 → 状態 → 操作 → 期待 に解決する', () => {
    expect(rowPhrases(feature, stepTable, stepRow)).toEqual([
      'テーマ「A」を選択している',
      'テーマ「B」を選択する',
      '都市マーカー「アテネ」が表示されている',
    ]);
  });

  it('rowLabel は matrix では軸値の連結、step では観点', () => {
    expect(rowLabel(matrixTable, matrixRow)).toBe('★2都市 × ★1のみ');
    expect(rowLabel(stepTable, stepRow)).toBe('切替');
  });
});
