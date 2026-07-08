import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAssetManifest } from '../data/manifest';
import { isWebgl2Supported } from '../shared/webgl';
import { fetchThemeIndex } from '../theme/fetch';
import { App } from './App';

const manifestFixture = {
  basemap: '/tiles/basemap.pmtiles',
  themeIndex: '/data/themes/index.json',
  themes: {
    'ancient-orient': '/data/themes/ancient-orient.json',
    'broken-theme': '/data/themes/broken-theme.json',
  },
};

const { fakeMap, mapHandlers, mapErrorHandlerRef } = vi.hoisted(() => {
  const mapHandlers = new Map<string, (...args: unknown[]) => void>();
  const mapErrorHandlerRef: {
    current: ((message: string) => void) | undefined;
  } = { current: undefined };
  return {
    mapHandlers,
    mapErrorHandlerRef,
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

vi.mock('../shared/webgl', () => ({
  isWebgl2Supported: vi.fn(() => true),
}));

vi.mock('../map/MapView', async () => {
  const { useEffect } = await import('react');
  return {
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

vi.mock('../data/manifest', () => ({
  fetchAssetManifest: vi.fn(async () => ({ ok: true, value: manifestFixture })),
}));

vi.mock('../theme/fetch', () => ({
  fetchThemeIndex: vi.fn(async () => ({
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
  })),
  fetchTheme: vi.fn(async (url: string) =>
    url === manifestFixture.themes['ancient-orient']
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
  ),
}));

beforeEach(() => {
  fakeMap.fitBounds.mockClear();
  mapHandlers.clear();
  mapErrorHandlerRef.current = undefined;
  vi.mocked(isWebgl2Supported).mockReturnValue(true);
  vi.mocked(fetchAssetManifest).mockResolvedValue({
    ok: true,
    value: manifestFixture,
  });
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
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'テーマの読み込みに失敗しました',
    );
  });

  it('テーマ一覧の取得失敗でエラービューが出て、再試行で回復する', async () => {
    vi.mocked(fetchThemeIndex).mockResolvedValueOnce({
      ok: false,
      error: { type: 'network' },
    });
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'データの取得に失敗しました',
    );
    await userEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    ).toBeInTheDocument();
  });

  it('マニフェストの取得失敗でエラービューが出て、再試行で回復する', async () => {
    vi.mocked(fetchAssetManifest).mockResolvedValueOnce({
      ok: false,
      error: { type: 'network' },
    });
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'マニフェストの取得に失敗しました',
    );
    await userEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    ).toBeInTheDocument();
  });

  it('WebGL2 非対応なら地図の代わりに案内文を表示する', async () => {
    vi.mocked(isWebgl2Supported).mockReturnValue(false);
    render(<App />);
    await screen.findByRole('button', { name: /古代オリエント/ });
    expect(screen.getByText(/WebGL2/)).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  });

  it('古いマニフェスト応答は新しい応答を上書きしない', async () => {
    let resolveStale!: (
      value: Awaited<ReturnType<typeof fetchAssetManifest>>,
    ) => void;
    let resolveLatest!: (
      value: Awaited<ReturnType<typeof fetchAssetManifest>>,
    ) => void;
    const stale = new Promise<Awaited<ReturnType<typeof fetchAssetManifest>>>(
      (resolve) => {
        resolveStale = resolve;
      },
    );
    const latest = new Promise<Awaited<ReturnType<typeof fetchAssetManifest>>>(
      (resolve) => {
        resolveLatest = resolve;
      },
    );
    vi.mocked(fetchAssetManifest)
      .mockReturnValueOnce(stale)
      .mockReturnValueOnce(latest);

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    resolveLatest({ ok: true, value: manifestFixture });
    expect(await screen.findByTestId('map-view')).toHaveAttribute(
      'data-basemap-path',
      manifestFixture.basemap,
    );

    resolveStale({
      ok: true,
      value: { ...manifestFixture, basemap: '/tiles/basemap-stale.pmtiles' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('map-view')).toHaveAttribute(
        'data-basemap-path',
        manifestFixture.basemap,
      ),
    );
  });

  it('不正な直リンクは未選択にフォールバックし URL から theme を除去する', async () => {
    window.history.replaceState(null, '', '/?theme=no-such-theme');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(window.location.search).toBe('');
    });
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

  it('メニューボタンでドロワーの開閉状態が切り替わる', async () => {
    render(<App />);
    const menuButton = await screen.findByRole('button', {
      name: 'テーマ一覧を開く',
    });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('ドロワーを開くと解説パネルが閉じる', async () => {
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    );
    await userEvent.click(await screen.findByTestId('marker-babylon'));
    expect(await screen.findByTestId('detail-panel')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'テーマ一覧を開く' }),
    );

    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
  });

  it('地図の読み込みエラーでエラービューを表示し、再試行で消える', async () => {
    render(<App />);
    await screen.findByTestId('map-view');

    act(() => {
      mapErrorHandlerRef.current?.('地図の読み込みに失敗しました');
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '地図の読み込みに失敗しました',
    );

    await userEvent.click(screen.getByRole('button', { name: '再試行' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('モバイル幅でドロワーが閉じている間は aside が inert になる', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;

    render(<App />);
    await screen.findByRole('button', { name: /古代オリエント/ });
    expect(screen.getByRole('complementary')).toHaveAttribute('inert');

    await userEvent.click(
      screen.getByRole('button', { name: 'テーマ一覧を開く' }),
    );
    expect(screen.getByRole('complementary')).not.toHaveAttribute('inert');

    window.matchMedia = originalMatchMedia;
  });
});
