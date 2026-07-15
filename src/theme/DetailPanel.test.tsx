import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailPanel } from './DetailPanel';
import type { ThemeFeature } from './schema';

const city: ThemeFeature = {
  id: 'babylon',
  kind: 'city',
  name: 'バビロン',
  coordinates: [44.421, 32.542],
  importance: 1,
  description: 'ハンムラビ王の時代に栄えたメソポタミアの中心都市。',
};

const terrain: ThemeFeature = {
  id: 'euphrates',
  kind: 'terrain',
  terrainKind: 'river',
  name: 'ユーフラテス川',
  coordinates: [43.5, 34.5],
  importance: 1,
  description: 'メソポタミア文明を育んだ大河。',
};

describe('DetailPanel', () => {
  it('都市の名前・種別・頻出度・解説を表示する', () => {
    render(<DetailPanel feature={city} onClose={() => {}} />);
    expect(
      screen.getByRole('heading', { name: 'バビロン' }),
    ).toBeInTheDocument();
    expect(screen.getByText('都市')).toBeInTheDocument();
    expect(screen.getByText('★1')).toBeInTheDocument();
    expect(screen.getByText(/ハンムラビ王/)).toBeInTheDocument();
  });

  it('地形は terrainKind のラベルを表示する', () => {
    render(<DetailPanel feature={terrain} onClose={() => {}} />);
    expect(screen.getByText('河川')).toBeInTheDocument();
  });
});
