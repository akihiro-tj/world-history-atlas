import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Theme } from '../src/theme/schema';
import { themeIndexSchema, themeSchema } from '../src/theme/schema';
import {
  type ValidationIssue,
  validateThemeData,
} from '../src/theme/validation';

const DATA_DIR = path.join(import.meta.dirname, '../public/data/themes');

async function main(): Promise<void> {
  const issues: ValidationIssue[] = [];

  const indexRaw = JSON.parse(
    await readFile(path.join(DATA_DIR, 'index.json'), 'utf8'),
  );
  const indexParsed = themeIndexSchema.safeParse(indexRaw);
  if (!indexParsed.success) {
    fail([
      { level: 'error', message: `index.json: ${indexParsed.error.message}` },
    ]);
    return;
  }

  const themes: Theme[] = [];
  const files = (await readdir(DATA_DIR)).filter(
    (f) => f.endsWith('.json') && f !== 'index.json',
  );
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
    const parsed = themeSchema.safeParse(raw);
    if (parsed.success) {
      themes.push(parsed.data);
      if (`${parsed.data.id}.json` !== file) {
        issues.push({
          level: 'error',
          message: `${file}: ファイル名とテーマ id「${parsed.data.id}」が一致しない`,
        });
      }
    } else {
      issues.push({
        level: 'error',
        message: `${file}: ${parsed.error.message}`,
      });
    }
  }

  issues.push(...validateThemeData(indexParsed.data, themes));
  fail(issues);
}

function fail(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    console.log(`[${issue.level}] ${issue.message}`);
  }
  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  if (errorCount > 0) {
    console.error(`NG: ${errorCount} 件のエラー`);
    process.exitCode = 1;
  } else {
    console.log(`OK: テーマデータの検証を通過（警告 ${issues.length} 件）`);
  }
}

await main();
