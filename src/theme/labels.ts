import type { TerrainKind, ThemeFeature } from './schema';

export const TERRAIN_KIND_LABELS: Record<TerrainKind, string> = {
  river: '河川',
  mountain: '山脈',
  sea: '海',
  strait: '海峡',
  lake: '湖',
  desert: '砂漠',
  region: '地域',
};

export function featureKindLabel(feature: ThemeFeature): string {
  return feature.kind === 'city'
    ? '都市'
    : TERRAIN_KIND_LABELS[feature.terrainKind];
}
