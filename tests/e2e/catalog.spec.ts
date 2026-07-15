import { test } from '@playwright/test';
import { loadSpecs } from '../spec-runner/load';
import { rowLabel, rowPhrases } from '../spec-runner/parse';
import { assertPhrasesResolve } from '../spec-runner/validate';
import { registry } from './steps';

const E2E = /^e2e(?:\((smoke|mobile)\))?$/;
const features = loadSpecs();

assertPhrasesResolve(features, registry, (layer) => E2E.test(layer));

for (const feature of features) {
  for (const table of feature.tables) {
    for (const row of table.rows) {
      const matched = row.layer.match(E2E);
      if (!matched) continue;
      const tag = matched[1] ? [`@${matched[1]}`] : [];
      const title = `${feature.name} ${table.heading} ${rowLabel(row)}`;
      test(title, { tag }, async ({ page }) => {
        for (const phrase of rowPhrases(table, row)) {
          await registry.run({ page }, phrase);
        }
      });
    }
  }
}
