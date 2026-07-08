import { describe, expect, it } from 'vitest';
import { buildMapStyle } from './mapStyle';

describe('buildMapStyle', () => {
  const style = buildMapStyle(
    'light',
    'http://localhost:5173',
    '/tiles/basemap.pmtiles',
  );

  it('PMTiles ソースを絶対 URL で参照する', () => {
    const source = style.sources.basemap;
    expect(source).toMatchObject({
      type: 'vector',
      url: 'pmtiles://http://localhost:5173/tiles/basemap.pmtiles',
    });
  });

  it('basemapPath を反映した URL を組み立てる', () => {
    const hashedStyle = buildMapStyle(
      'light',
      'http://localhost:5173',
      '/r2/basemap-abc123.pmtiles',
    );
    expect(hashedStyle.sources.basemap).toMatchObject({
      url: 'pmtiles://http://localhost:5173/r2/basemap-abc123.pmtiles',
    });
  });

  it('background / land / rivers / lakes のレイヤーを持つ', () => {
    expect(style.layers.map((layer) => layer.id)).toEqual([
      'background',
      'land',
      'land-outline',
      'rivers',
      'lakes',
    ]);
  });

  it('source-layer 名がタイルのレイヤー名と一致する', () => {
    const sourceLayers = style.layers.flatMap((layer) =>
      'source-layer' in layer ? [layer['source-layer']] : [],
    );
    expect(sourceLayers).toEqual(['land', 'land', 'rivers', 'lakes']);
  });

  it('ライトとダークで配色が異なる', () => {
    const dark = buildMapStyle(
      'dark',
      'http://localhost:5173',
      '/tiles/basemap.pmtiles',
    );
    expect(dark.layers[0]).not.toEqual(style.layers[0]);
  });
});
