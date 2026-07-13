import { useEffect } from 'react';
import { vi } from 'vitest';
import { isWebgl2Supported } from '../../src/shared/webgl';

const { fakeMap, mapHandlers, mapErrorHandlerRef, fetchControl } = vi.hoisted(
  () => {
    const mapHandlers = new Map<string, (...args: unknown[]) => void>();
    return {
      mapHandlers,
      mapErrorHandlerRef: { current: undefined } as {
        current: ((message: string) => void) | undefined;
      },
      fakeMap: {
        fitBounds: vi.fn(),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          mapHandlers.set(event, handler);
        }),
        off: vi.fn((event: string) => {
          mapHandlers.delete(event);
        }),
      },
      fetchControl: { manifest: 'ok', themeIndex: 'ok', themeBody: 'ok' } as {
        manifest: 'ok' | 'fail';
        themeIndex: 'ok' | 'fail';
        themeBody: 'ok' | 'fail';
      },
    };
  },
);

export { fakeMap, fetchControl, mapErrorHandlerRef, mapHandlers };

const manifestFixture = {
  basemap: '/tiles/basemap.pmtiles',
  themeIndex: '/data/themes/index.json',
  themes: {
    'ancient-orient': '/data/themes/ancient-orient.json',
    'broken-theme': '/data/themes/broken-theme.json',
  },
};

// Warning: intentionally out of `order` so the sidebar-order c row exercises
// the sort. Keeping it pre-sorted makes that row pass without sorting.
const themeIndexFixture = [
  { id: 'broken-theme', title: '壊れたテーマ', era: 'era', order: 2 },
  {
    id: 'ancient-orient',
    title: '古代オリエント',
    era: '前3000年頃〜前330年',
    order: 1,
  },
];

const ancientOrientTheme = {
  id: 'ancient-orient',
  title: '古代オリエント',
  era: '前3000年頃〜前330年',
  summary: '概要。',
  bounds: [25, 22, 60, 42],
  features: [
    {
      id: 'babylon',
      kind: 'city',
      name: 'バビロン',
      coordinates: [44.421, 32.542],
      importance: 1,
      description: '解説。',
    },
    {
      id: 'ur',
      kind: 'city',
      name: 'ウル',
      coordinates: [46.103, 30.962],
      importance: 2,
      description: '解説。',
    },
    {
      id: 'euphrates',
      kind: 'terrain',
      terrainKind: 'river',
      name: 'ユーフラテス川',
      coordinates: [44.0, 33.0],
      importance: 1,
      description: '解説。',
    },
  ],
};

const networkError = { ok: false, error: { type: 'network' } } as const;

vi.mock('../../src/shared/webgl', () => ({
  isWebgl2Supported: vi.fn(() => true),
}));

vi.mock('../../src/map/MapView', () => ({
  MapView: ({
    basemapPath,
    onMapReady,
    onError,
  }: {
    basemapPath: string;
    onMapReady?: (map: unknown) => void;
    onError?: (message: string) => void;
  }) => {
    useEffect(() => {
      onMapReady?.(fakeMap);
    }, [onMapReady]);
    useEffect(() => {
      mapErrorHandlerRef.current = onError;
      return () => {
        mapErrorHandlerRef.current = undefined;
      };
    }, [onError]);
    return <div data-testid="map-view" data-basemap-path={basemapPath} />;
  },
}));

vi.mock('../../src/map/FeatureMarkers', () => ({
  FeatureMarkers: ({
    features,
    onSelectFeature,
  }: {
    features: readonly { id: string; name: string; kind: 'city' | 'terrain' }[];
    onSelectFeature: (id: string) => void;
  }) => (
    <>
      {features.map((feature) => (
        <button
          key={feature.id}
          type="button"
          aria-label={feature.name}
          data-marker-kind={feature.kind}
          onClick={() => onSelectFeature(feature.id)}
        >
          {feature.name}
        </button>
      ))}
    </>
  ),
}));

vi.mock('../../src/data/manifest', () => ({
  fetchAssetManifest: vi.fn(async () =>
    fetchControl.manifest === 'ok'
      ? { ok: true, value: manifestFixture }
      : networkError,
  ),
}));

vi.mock('../../src/theme/fetch', () => ({
  fetchThemeIndex: vi.fn(async () =>
    fetchControl.themeIndex === 'ok'
      ? { ok: true, value: themeIndexFixture }
      : networkError,
  ),
  fetchTheme: vi.fn(async (url: string) =>
    url === manifestFixture.themes['ancient-orient'] &&
    fetchControl.themeBody === 'ok'
      ? { ok: true, value: ancientOrientTheme }
      : networkError,
  ),
}));

export function resetMocks(): void {
  fetchControl.manifest = 'ok';
  fetchControl.themeIndex = 'ok';
  fetchControl.themeBody = 'ok';
  fakeMap.fitBounds.mockClear();
  mapHandlers.clear();
  mapErrorHandlerRef.current = undefined;
  vi.mocked(isWebgl2Supported).mockReturnValue(true);
}
