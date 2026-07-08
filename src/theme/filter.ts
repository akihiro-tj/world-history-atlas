import type { Importance, ThemeFeature } from './schema';

export type ImportanceFilter = Importance;

export function filterFeaturesByImportance(
  features: readonly ThemeFeature[],
  maxImportance: ImportanceFilter,
): ThemeFeature[] {
  return features.filter((feature) => feature.importance <= maxImportance);
}
