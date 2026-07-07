import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../map/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
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
});
