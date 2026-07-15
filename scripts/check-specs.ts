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
