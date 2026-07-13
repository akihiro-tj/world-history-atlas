import { test } from '@playwright/test';
import { loadSpecs } from '../tests/spec-runner/load';
import { rowLabel, rowPhrases } from '../tests/spec-runner/parse';
import { assertPhrasesResolve } from '../tests/spec-runner/validate';
import { registry } from './steps/index';

const E2E = /^e2e(?:\((smoke|mobile)\))?$/;
const features = loadSpecs();

assertPhrasesResolve(features, registry, (layer) => E2E.test(layer));

for (const feature of features) {
  for (const table of feature.tables) {
    for (const row of table.rows) {
      const matched = row.layer.match(E2E);
      if (!matched) continue;
      const tag = matched[1] ? [`@${matched[1]}`] : [];
      const title = `${feature.name} ${table.heading} #${row.id} ${rowLabel(table, row)}`;
      test(title, { tag }, async ({ page }) => {
        for (const phrase of rowPhrases(feature, table, row)) {
          await registry.run({ page }, phrase);
        }
      });
    }
  }
}
