import type { StyleSpecification } from 'maplibre-gl';
import { type ColorTheme, MAP_COLORS } from './mapColors';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function buildMapStyle(
  colorTheme: ColorTheme,
  origin: string,
  basemapPath: string,
): StyleSpecification {
  const colors = MAP_COLORS[colorTheme];
  return {
    version: 8,
    sources: {
      basemap: {
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
        source: 'basemap',
        'source-layer': 'land',
        paint: { 'fill-color': colors.land },
      },
      {
        id: 'land-outline',
        type: 'line',
        source: 'basemap',
        'source-layer': 'land',
        paint: { 'line-color': colors.landOutline, 'line-width': 0.6 },
      },
      {
        id: 'rivers',
        type: 'line',
        source: 'basemap',
        'source-layer': 'rivers',
        paint: { 'line-color': colors.river, 'line-width': 1 },
      },
      {
        id: 'lakes',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'lakes',
        paint: { 'fill-color': colors.lake },
      },
    ],
  };
}
