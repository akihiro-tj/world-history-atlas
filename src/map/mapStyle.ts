import type { StyleSpecification } from 'maplibre-gl';
import { type ColorTheme, MAP_COLORS } from './mapColors';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const BASEMAP_SOURCE_ID = 'basemap';

export function buildMapStyle(
  colorTheme: ColorTheme,
  origin: string,
  basemapPath: string,
): StyleSpecification {
  const colors = MAP_COLORS[colorTheme];
  return {
    version: 8,
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${origin}${basemapPath}`,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': colors.sea },
      },
      {
        id: 'land',
        type: 'fill',
        source: BASEMAP_SOURCE_ID,
        'source-layer': 'land',
        paint: { 'fill-color': colors.land },
      },
      {
        id: 'land-outline',
        type: 'line',
        source: BASEMAP_SOURCE_ID,
        'source-layer': 'land',
        paint: { 'line-color': colors.landOutline, 'line-width': 0.6 },
      },
      {
        id: 'rivers',
        type: 'line',
        source: BASEMAP_SOURCE_ID,
        'source-layer': 'rivers',
        paint: { 'line-color': colors.river, 'line-width': 1 },
      },
      {
        id: 'lakes',
        type: 'fill',
        source: BASEMAP_SOURCE_ID,
        'source-layer': 'lakes',
        paint: { 'fill-color': colors.lake },
      },
    ],
  };
}
