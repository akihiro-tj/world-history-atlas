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
    expect(row.precondition).toEqual([
      '頻出度フィルタを「すべて」に切り替える',
    ]);
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
    expect(rowLabel(feature.tables[0], feature.tables[0].rows[1])).toBe(
      '★2都市 × ★1のみ',
    );
    expect(rowLabel(feature.tables[1], feature.tables[1].rows[0])).toBe('切替');
  });
});
