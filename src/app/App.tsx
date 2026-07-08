import type maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AssetManifest, fetchAssetManifest } from '../data/manifest';
import { FeatureMarkers } from '../map/FeatureMarkers';
import { MapView } from '../map/MapView';
import type { ColorTheme } from '../map/mapColors';
import { ErrorView } from '../shared/ErrorView';
import { err, type Result } from '../shared/result';
import { isWebgl2Supported } from '../shared/webgl';
import { DetailPanel } from '../theme/DetailPanel';
import {
  fetchTheme,
  fetchThemeIndex,
  type ThemeDataError,
} from '../theme/fetch';
import {
  filterFeaturesByImportance,
  type ImportanceFilter,
} from '../theme/filter';
import { ImportanceFilterControl } from '../theme/ImportanceFilterControl';
import { Sidebar } from '../theme/Sidebar';
import type { Theme, ThemeIndexEntry } from '../theme/schema';
import {
  buildSearchWithTheme,
  parseThemeIdFromSearch,
} from '../theme/urlState';
import {
  COLOR_THEME_STORAGE_KEY,
  resolveInitialColorTheme,
  toggleColorTheme,
} from './colorTheme';

type ManifestState =
  | { status: 'loading' }
  | { status: 'loaded'; manifest: AssetManifest }
  | { status: 'error' };

type ThemeIndexState =
  | { status: 'loading' }
  | { status: 'loaded'; entries: ThemeIndexEntry[] }
  | { status: 'error' };

type ThemeSelection =
  | { status: 'none' }
  | { status: 'loading'; themeId: string }
  | { status: 'loaded'; theme: Theme }
  | { status: 'error'; themeId: string };

function syncThemeToUrl(themeId: string | undefined): void {
  const search = buildSearchWithTheme(window.location.search, themeId);
  window.history.replaceState(null, '', `${window.location.pathname}${search}`);
}

export function App() {
  const [manifestState, setManifestState] = useState<ManifestState>({
    status: 'loading',
  });
  const [indexState, setIndexState] = useState<ThemeIndexState>({
    status: 'loading',
  });
  const [selection, setSelection] = useState<ThemeSelection>({
    status: 'none',
  });
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>(3);
  const [selectedFeatureId, setSelectedFeatureId] = useState<
    string | undefined
  >(undefined);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() =>
    resolveInitialColorTheme(
      window.localStorage.getItem(COLOR_THEME_STORAGE_KEY),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mapError, setMapError] = useState<string | undefined>(undefined);
  const [mapRetryCount, setMapRetryCount] = useState(0);

  const latestManifestRequestRef = useRef(0);
  const loadManifest = useCallback(() => {
    const requestId = ++latestManifestRequestRef.current;
    setManifestState({ status: 'loading' });
    void fetchAssetManifest().then((result) => {
      if (requestId !== latestManifestRequestRef.current) return;
      setManifestState(
        result.ok
          ? { status: 'loaded', manifest: result.value }
          : { status: 'error' },
      );
    });
  }, []);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  const selectTheme = useCallback(
    (themeId: string, options?: { fallbackToNoneOnError: boolean }) => {
      if (manifestState.status !== 'loaded') return;
      const themeUrl = manifestState.manifest.themes[themeId];
      setSelectedFeatureId(undefined);
      setSelection({ status: 'loading', themeId });
      syncThemeToUrl(themeId);
      const themeResult: Promise<Result<Theme, ThemeDataError>> =
        themeUrl !== undefined
          ? fetchTheme(themeUrl)
          : Promise.resolve(err({ type: 'network' }));
      void themeResult.then((result) => {
        setSelection((current) => {
          if (current.status !== 'loading' || current.themeId !== themeId) {
            return current;
          }
          if (result.ok) return { status: 'loaded', theme: result.value };
          if (options?.fallbackToNoneOnError) {
            syncThemeToUrl(undefined);
            return { status: 'none' };
          }
          return { status: 'error', themeId };
        });
      });
    },
    [manifestState],
  );

  const latestIndexRequestRef = useRef(0);
  const loadThemeIndex = useCallback(() => {
    if (manifestState.status !== 'loaded') return;
    const requestId = ++latestIndexRequestRef.current;
    setIndexState({ status: 'loading' });
    void fetchThemeIndex(manifestState.manifest.themeIndex).then((result) => {
      if (requestId !== latestIndexRequestRef.current) return;
      setIndexState(
        result.ok
          ? { status: 'loaded', entries: result.value }
          : { status: 'error' },
      );
    });
  }, [manifestState]);

  useEffect(() => {
    loadThemeIndex();
  }, [loadThemeIndex]);

  const [isWebglAvailable] = useState(() => isWebgl2Supported());

  useEffect(() => {
    const initialThemeId = parseThemeIdFromSearch(window.location.search);
    if (initialThemeId !== undefined) {
      selectTheme(initialThemeId, { fallbackToNoneOnError: true });
    }
  }, [selectTheme]);

  useEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme;
  }, [colorTheme]);

  const handleToggleColorTheme = () => {
    const next = toggleColorTheme(colorTheme);
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, next);
    setColorTheme(next);
  };

  const handleMapRetry = useCallback(() => {
    setMapError(undefined);
    setMapRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (map && selection.status === 'loaded') {
      map.fitBounds(selection.theme.bounds, { padding: 40, duration: 800 });
    }
  }, [map, selection]);

  // パネル外（地図の余白）クリックで閉じる。マーカーのクリックは
  // buildMarkerElement 内の stopPropagation により map まで届かない
  useEffect(() => {
    if (!map) return;
    const closePanel = () => setSelectedFeatureId(undefined);
    map.on('click', closePanel);
    return () => {
      map.off('click', closePanel);
    };
  }, [map]);

  const selectedThemeId =
    selection.status === 'loaded'
      ? selection.theme.id
      : selection.status === 'none'
        ? undefined
        : selection.themeId;

  const visibleFeatures = useMemo(
    () =>
      selection.status === 'loaded'
        ? filterFeaturesByImportance(selection.theme.features, importanceFilter)
        : [],
    [selection, importanceFilter],
  );

  const selectedFeature = visibleFeatures.find(
    (feature) => feature.id === selectedFeatureId,
  );

  if (manifestState.status === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <p className="text-sm">読み込み中…</p>
      </div>
    );
  }

  if (manifestState.status === 'error') {
    return (
      <div className="flex h-dvh items-center justify-center bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <ErrorView
          message="マニフェストの取得に失敗しました"
          onRetry={loadManifest}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-center border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <button
          type="button"
          aria-label="テーマ一覧を開く"
          aria-expanded={isDrawerOpen}
          onClick={() => {
            setSelectedFeatureId(undefined);
            setIsDrawerOpen(true);
          }}
          className="mr-2 rounded p-2 hover:bg-slate-100 md:hidden dark:hover:bg-slate-700"
        >
          ☰
        </button>
        <h1 className="text-lg font-bold">世界史マップ</h1>
        <button
          type="button"
          aria-label="カラーテーマを切り替える"
          onClick={handleToggleColorTheme}
          className="ml-auto rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {colorTheme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        {isDrawerOpen && (
          <button
            type="button"
            aria-label="テーマ一覧を閉じる"
            onClick={() => setIsDrawerOpen(false)}
            // Warning: left-64 は aside の w-64 と一致させること。ずれるとバックドロップがドロワー本体に重なり、クリック領域が壊れる
            className="absolute inset-y-0 right-0 left-64 z-20 bg-black/40 md:hidden"
          />
        )}
        <aside
          className={`w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:transition-transform dark:border-slate-700 dark:bg-slate-900 ${
            isDrawerOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
          }`}
        >
          {indexState.status === 'loaded' && (
            <Sidebar
              entries={indexState.entries}
              selectedThemeId={selectedThemeId}
              onSelectTheme={(id) => {
                setIsDrawerOpen(false);
                selectTheme(id);
              }}
            />
          )}
          {indexState.status === 'error' && (
            <div className="p-4">
              <ErrorView
                message="データの取得に失敗しました"
                onRetry={loadThemeIndex}
              />
            </div>
          )}
        </aside>
        <main className="relative min-w-0 flex-1">
          {isWebglAvailable ? (
            <MapView
              key={mapRetryCount}
              colorTheme={colorTheme}
              basemapPath={manifestState.manifest.basemap}
              onMapReady={setMap}
              onError={setMapError}
            />
          ) : (
            <p className="flex h-full items-center justify-center p-8 text-center text-sm">
              {
                'お使いのブラウザは WebGL2 に対応していないため、地図を表示できません。最新のブラウザでお試しください。'
              }
            </p>
          )}
          {mapError !== undefined && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <ErrorView message={mapError} onRetry={handleMapRetry} />
            </div>
          )}
          <FeatureMarkers
            map={map}
            features={visibleFeatures}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
          />
          {selectedFeature && (
            <DetailPanel
              feature={selectedFeature}
              onClose={() => setSelectedFeatureId(undefined)}
            />
          )}
          {selection.status === 'loaded' && (
            <div className="absolute top-4 left-4 z-10">
              <ImportanceFilterControl
                value={importanceFilter}
                onChange={setImportanceFilter}
              />
            </div>
          )}
          {selection.status === 'none' && (
            <p
              data-testid="empty-state"
              className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/90 px-4 py-2 text-sm shadow dark:bg-slate-800/90"
            >
              テーマを選んで地図を探索しましょう
            </p>
          )}
          {selection.status === 'error' && (
            <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2">
              <ErrorView
                message="テーマの読み込みに失敗しました"
                onRetry={() => selectTheme(selection.themeId)}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
