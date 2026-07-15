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
