import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('../map/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

describe('App', () => {
  it('アプリ名を表示する', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: '世界史マップ' }),
    ).toBeInTheDocument();
  });
});
