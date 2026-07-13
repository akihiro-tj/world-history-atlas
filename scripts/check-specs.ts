import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSpecs } from '../tests/spec-runner/load';

const LAYER = /^(e2e(?:\((?:smoke|mobile)\))?|c|unit|直接|=\d+|対象外)$/;
const errors: string[] = [];

function product(valueLists: string[][]): string[][] {
  return valueLists.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

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
    if (
      isTableHeader &&
      heading &&
      heading !== '軸' &&
      !headings.includes(heading)
    ) {
      headings.push(heading);
    }
  }
  return headings;
}

for (const feature of loadSpecs()) {
  const parsedHeadings = new Set(feature.tables.map((table) => table.heading));
  const source = readFileSync(join('specs', feature.file), 'utf8');
  for (const heading of headingsWithTables(source)) {
    if (!parsedHeadings.has(heading)) {
      errors.push(
        `${feature.file}「${heading}」の表が解析されていない（期待/層 列の欠落か）`,
      );
    }
  }

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
      if (
        equivalent &&
        !table.rows.some((other) => other.id === equivalent[1])
      ) {
        errors.push(`${at(row.id)}: =${equivalent[1]} の参照先がない`);
      }
      if (
        (row.layer === 'unit' || row.layer === '直接') &&
        !existsSync(row.note)
      ) {
        errors.push(`${at(row.id)}: 備考のパスが存在しない「${row.note}」`);
      }
      if ((equivalent || row.layer === '対象外') && row.note.trim() === '') {
        errors.push(`${at(row.id)}: 理由（備考）がない`);
      }
      if (table.mode === 'matrix') {
        for (const { name } of table.axisColumns) {
          const value = row.axisValues.get(name) ?? '';
          if (!feature.axes.get(name)?.some((v) => v.value === value)) {
            errors.push(
              `${at(row.id)}: ${name}「${value}」が軸に宣言されていない`,
            );
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
          errors.push(
            `${feature.file}「${table.heading}」に ${key} の行がない`,
          );
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
