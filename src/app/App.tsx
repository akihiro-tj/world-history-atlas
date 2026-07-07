import type maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeatureMarkers } from '../map/FeatureMarkers';
import { MapView } from '../map/MapView';
import { DetailPanel } from '../theme/DetailPanel';
import { fetchTheme, fetchThemeIndex } from '../theme/fetch';
import {
  filterFeaturesByImportance,
  type ImportanceFilter,
} from '../theme/filter';
import { Sidebar } from '../theme/Sidebar';
import type { Theme, ThemeIndexEntry } from '../theme/schema';
import {
  buildSearchWithTheme,
  parseThemeIdFromSearch,
} from '../theme/urlState';

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
  const [indexState, setIndexState] = useState<ThemeIndexState>({
    status: 'loading',
  });
  const [selection, setSelection] = useState<ThemeSelection>({
    status: 'none',
  });
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [importanceFilter] = useState<ImportanceFilter>(3);
  const [selectedFeatureId, setSelectedFeatureId] = useState<
    string | undefined
  >(undefined);

  const selectTheme = useCallback(
    (themeId: string, options?: { fallbackToNoneOnError: boolean }) => {
      setSelectedFeatureId(undefined);
      setSelection({ status: 'loading', themeId });
      syncThemeToUrl(themeId);
      void fetchTheme(themeId).then((result) => {
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
    [],
  );

  useEffect(() => {
    let isCancelled = false;
    void fetchThemeIndex().then((result) => {
      if (isCancelled) return;
      setIndexState(
        result.ok
          ? { status: 'loaded', entries: result.value }
          : { status: 'error' },
      );
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const initialThemeId = parseThemeIdFromSearch(window.location.search);
    if (initialThemeId !== undefined) {
      selectTheme(initialThemeId, { fallbackToNoneOnError: true });
    }
  }, [selectTheme]);

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

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center border-b border-slate-200 px-4 py-2">
        <h1 className="text-lg font-bold">世界史マップ</h1>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 md:block">
          {indexState.status === 'loaded' && (
            <Sidebar
              entries={indexState.entries}
              selectedThemeId={selectedThemeId}
              onSelectTheme={(id) => selectTheme(id)}
            />
          )}
          {indexState.status === 'error' && (
            <p className="p-4 text-sm">データの取得に失敗しました</p>
          )}
        </aside>
        <main className="relative min-w-0 flex-1">
          <MapView colorTheme="light" onMapReady={setMap} />
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
          {selection.status === 'none' && (
            <p
              data-testid="empty-state"
              className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/90 px-4 py-2 text-sm shadow"
            >
              テーマを選んで地図を探索しましょう
            </p>
          )}
          {selection.status === 'error' && (
            <p
              data-testid="theme-error"
              className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/90 px-4 py-2 text-sm shadow"
            >
              テーマの読み込みに失敗しました
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
