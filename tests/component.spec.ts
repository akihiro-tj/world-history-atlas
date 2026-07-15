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
