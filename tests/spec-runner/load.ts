import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpec, type SpecFeature } from './parse';

export function loadSpecs(dir = 'specs'): SpecFeature[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'GUIDELINE.md')
    .sort()
    .map((file) => parseSpec(readFileSync(join(dir, file), 'utf8'), file));
}
