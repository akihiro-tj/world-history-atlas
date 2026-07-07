import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const { fakeMap, mapHandlers } = vi.hoisted(() => {
  const mapHandlers = new Map<string, (...args: unknown[]) => void>();
  return {
    mapHandlers,
    fakeMap: {
      fitBounds: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        mapHandlers.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        mapHandlers.delete(event);
      }),
    },
  };
});

vi.mock('../map/MapView', async () => {
  const { useEffect } = await import('react');
  return {
    MapView: ({ onMapReady }: { onMapReady?: (map: unknown) => void }) => {
      useEffect(() => {
        onMapReady?.(fakeMap);
      }, [onMapReady]);
      return <div data-testid="map-view" />;
    },
  };
});

vi.mock('../map/FeatureMarkers', () => ({
  FeatureMarkers: ({
    features,
    onSelectFeature,
  }: {
    features: readonly { id: string; name: string }[];
    onSelectFeature: (id: string) => void;
  }) => (
    <>
      {features.map((feature) => (
        <button
          key={feature.id}
          type="button"
          data-testid={`marker-${feature.id}`}
          onClick={() => onSelectFeature(feature.id)}
        >
          {feature.name}
        </button>
      ))}
    </>
  ),
}));

vi.mock('../theme/fetch', () => ({
  fetchThemeIndex: async () => ({
    ok: true,
    value: [
      {
        id: 'ancient-orient',
        title: '古代オリエント',
        era: '前3000年頃〜前330年',
        order: 1,
      },
      {
        id: 'broken-theme',
        title: '壊れたテーマ',
        era: 'era',
        order: 2,
      },
    ],
  }),
  fetchTheme: async (id: string) =>
    id === 'ancient-orient'
      ? {
          ok: true,
          value: {
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
            ],
          },
        }
      : { ok: false, error: { type: 'network' } },
}));

beforeEach(() => {
  fakeMap.fitBounds.mockClear();
  mapHandlers.clear();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('テーマ一覧を表示する', async () => {
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    ).toBeInTheDocument();
  });

  it('テーマ未選択なら空状態メッセージを表示する', async () => {
    render(<App />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('テーマを選択すると URL に反映され空状態が消える', async () => {
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    );
    expect(window.location.search).toBe('?theme=ancient-orient');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('テーマを選択すると読み込み完了後に fitBounds が呼ばれる', async () => {
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    );
    await waitFor(() =>
      expect(fakeMap.fitBounds).toHaveBeenCalledWith([25, 22, 60, 42], {
        padding: 40,
        duration: 800,
      }),
    );
  });

  it('クリック由来の読み込み失敗でエラーメッセージを表示する', async () => {
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: /壊れたテーマ/ }),
    );
    expect(await screen.findByTestId('theme-error')).toBeInTheDocument();
  });

  it('不正な直リンクは未選択にフォールバックし URL から theme を除去する', async () => {
    window.history.replaceState(null, '', '/?theme=no-such-theme');
    render(<App />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('有効な直リンクで読み込みから fitBounds まで到達する', async () => {
    window.history.replaceState(null, '', '/?theme=ancient-orient');
    render(<App />);
    await waitFor(() =>
      expect(fakeMap.fitBounds).toHaveBeenCalledWith([25, 22, 60, 42], {
        padding: 40,
        duration: 800,
      }),
    );
  });

  it('マーカー選択後に地図の余白クリックで解説パネルが閉じる', async () => {
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    );
    await userEvent.click(await screen.findByTestId('marker-babylon'));
    expect(await screen.findByTestId('detail-panel')).toBeInTheDocument();

    act(() => {
      mapHandlers.get('click')?.();
    });

    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
  });
});
