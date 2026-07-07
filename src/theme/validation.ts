import type { Theme, ThemeIndexEntry } from './schema';

export type ValidationIssue = { level: 'error' | 'warning'; message: string };

const COORDINATE_MISMATCH_THRESHOLD = 0.1;

export function validateThemeData(
  index: ThemeIndexEntry[],
  themes: Theme[],
): ValidationIssue[] {
  return [
    ...checkIndexThemeConsistency(index, themes),
    ...checkThemeIdUniqueness(themes),
    ...checkSameNameCoordinates(themes),
    ...checkFeaturesWithinBounds(themes),
  ];
}

function checkIndexThemeConsistency(
  index: ThemeIndexEntry[],
  themes: Theme[],
): ValidationIssue[] {
  const indexIds = new Set(index.map((entry) => entry.id));
  const themeIds = new Set(themes.map((theme) => theme.id));
  const issues: ValidationIssue[] = [];
  for (const id of indexIds) {
    if (!themeIds.has(id)) {
      issues.push({
        level: 'error',
        message: `index.json の「${id}」に対応するテーマファイルがない`,
      });
    }
  }
  for (const id of themeIds) {
    if (!indexIds.has(id)) {
      issues.push({
        level: 'error',
        message: `テーマ「${id}」が index.json に載っていない`,
      });
    }
  }
  return issues;
}

function checkThemeIdUniqueness(themes: Theme[]): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const theme of themes) {
    if (seen.has(theme.id)) {
      issues.push({
        level: 'error',
        message: `テーマ id「${theme.id}」が重複している`,
      });
    }
    seen.add(theme.id);
  }
  return issues;
}

function checkSameNameCoordinates(themes: Theme[]): ValidationIssue[] {
  const byName = new Map<
    string,
    { themeId: string; coordinates: readonly [number, number] }[]
  >();
  for (const theme of themes) {
    for (const feature of theme.features) {
      const entries = byName.get(feature.name) ?? [];
      entries.push({ themeId: theme.id, coordinates: feature.coordinates });
      byName.set(feature.name, entries);
    }
  }
  const issues: ValidationIssue[] = [];
  for (const [name, entries] of byName) {
    for (const [i, base] of entries.entries()) {
      for (const other of entries.slice(i + 1)) {
        const lonGap = Math.abs(base.coordinates[0] - other.coordinates[0]);
        const latGap = Math.abs(base.coordinates[1] - other.coordinates[1]);
        if (
          lonGap >= COORDINATE_MISMATCH_THRESHOLD ||
          latGap >= COORDINATE_MISMATCH_THRESHOLD
        ) {
          issues.push({
            level: 'error',
            message: `「${name}」の座標がテーマ間で食い違っている（${base.themeId} と ${other.themeId}）`,
          });
        }
      }
    }
  }
  return issues;
}

function checkFeaturesWithinBounds(themes: Theme[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const theme of themes) {
    const [west, south, east, north] = theme.bounds;
    for (const feature of theme.features) {
      const [lon, lat] = feature.coordinates;
      if (lon < west || lon > east || lat < south || lat > north) {
        issues.push({
          level: 'warning',
          message: `テーマ「${theme.id}」のフィーチャー「${feature.id}」が bounds の外にある`,
        });
      }
    }
  }
  return issues;
}
