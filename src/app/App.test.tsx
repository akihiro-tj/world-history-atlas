import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const fakeMap = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

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
  FeatureMarkers: () => null,
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
});
