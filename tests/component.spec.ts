import { describe, test } from 'vitest';
import { registry } from './component-steps/phrases';
import { loadSpecs } from './spec-runner/load';
import { rowLabel, rowPhrases } from './spec-runner/parse';
import { assertPhrasesResolve } from './spec-runner/validate';

const features = loadSpecs();

assertPhrasesResolve(features, registry, (layer) => layer === 'c');

for (const feature of features) {
  describe(feature.name, () => {
    for (const table of feature.tables) {
      for (const row of table.rows.filter((row) => row.layer === 'c')) {
        test(`${table.heading} #${row.id} ${rowLabel(table, row)}`, async () => {
          for (const phrase of rowPhrases(feature, table, row)) {
            await registry.run({}, phrase);
          }
        });
      }
    }
  });
}
