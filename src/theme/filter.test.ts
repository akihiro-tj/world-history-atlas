import { describe, expect, it } from 'vitest';
import { filterFeaturesByImportance } from './filter';
import type { ThemeFeature } from './schema';

function city(id: string, importance: 1 | 2 | 3): ThemeFeature {
  return {
    id,
    kind: 'city',
    name: id,
    coordinates: [0, 0],
    importance,
    description: '解説。',
  };
}

describe('filterFeaturesByImportance', () => {
  const features = [city('a', 1), city('b', 2), city('c', 3)];

  it('1 なら importance 1 のみ', () => {
    expect(filterFeaturesByImportance(features, 1).map((f) => f.id)).toEqual([
      'a',
    ]);
  });

  it('2 なら importance 1〜2', () => {
    expect(filterFeaturesByImportance(features, 2).map((f) => f.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('3 なら全件', () => {
    expect(filterFeaturesByImportance(features, 3)).toHaveLength(3);
  });
});
