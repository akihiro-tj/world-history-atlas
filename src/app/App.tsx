import { useEffect, useState } from 'react';
import { MapView } from '../map/MapView';
import { fetchThemeIndex } from '../theme/fetch';
import { Sidebar } from '../theme/Sidebar';
import type { ThemeIndexEntry } from '../theme/schema';

type ThemeIndexState =
  | { status: 'loading' }
  | { status: 'loaded'; entries: ThemeIndexEntry[] }
  | { status: 'error' };

export function App() {
  const [indexState, setIndexState] = useState<ThemeIndexState>({
    status: 'loading',
  });
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(
    undefined,
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
              onSelectTheme={setSelectedThemeId}
            />
          )}
          {indexState.status === 'error' && (
            <p className="p-4 text-sm">データの取得に失敗しました</p>
          )}
        </aside>
        <main className="relative min-w-0 flex-1">
          <MapView colorTheme="light" />
          {selectedThemeId === undefined && (
            <p
              data-testid="empty-state"
              className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-white/90 px-4 py-2 text-sm shadow"
            >
              テーマを選んで地図を探索しましょう
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
