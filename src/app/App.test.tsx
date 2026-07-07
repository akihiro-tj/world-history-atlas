import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
}));

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
});
