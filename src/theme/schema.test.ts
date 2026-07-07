import { describe, expect, it } from 'vitest';
import { themeIndexSchema, themeSchema } from './schema';

const validCity = {
  id: 'babylon',
  kind: 'city',
  name: 'バビロン',
  coordinates: [44.421, 32.542],
  importance: 1,
  description:
    'ハンムラビ王の時代に栄えたメソポタミアの中心都市。新バビロニアの都。',
};

const validTerrain = {
  id: 'euphrates',
  kind: 'terrain',
  terrainKind: 'river',
  name: 'ユーフラテス川',
  coordinates: [43.5, 34.5],
  importance: 1,
  description: 'メソポタミア文明を育んだ大河。肥沃な三日月地帯を形成した。',
};

const validTheme = {
  id: 'ancient-orient',
  title: '古代オリエント',
  era: '前3000年頃〜前330年',
  summary: 'メソポタミアとエジプトに最古の都市文明が生まれた。',
  bounds: [25.0, 22.0, 60.0, 42.0],
  features: [validCity, validTerrain],
};

describe('themeSchema', () => {
  it('正しいテーマを受理する', () => {
    expect(themeSchema.safeParse(validTheme).success).toBe(true);
  });

  it('city に terrainKind があると拒否する', () => {
    const theme = {
      ...validTheme,
      features: [{ ...validCity, terrainKind: 'river' }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('terrain に terrainKind がないと拒否する', () => {
    const { terrainKind: _drop, ...noKind } = validTerrain;
    expect(
      themeSchema.safeParse({ ...validTheme, features: [noKind] }).success,
    ).toBe(false);
  });

  it('経度が範囲外なら拒否する', () => {
    const theme = {
      ...validTheme,
      features: [{ ...validCity, coordinates: [181, 0] }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('importance が 1..3 以外なら拒否する', () => {
    const theme = {
      ...validTheme,
      features: [{ ...validCity, importance: 4 }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('description が 120 文字を超えると拒否する', () => {
    const theme = {
      ...validTheme,
      features: [{ ...validCity, description: 'あ'.repeat(121) }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it('west >= east の bounds を拒否する', () => {
    expect(
      themeSchema.safeParse({ ...validTheme, bounds: [60, 22, 25, 42] })
        .success,
    ).toBe(false);
  });

  it('テーマ内のフィーチャー id 重複を拒否する', () => {
    const theme = {
      ...validTheme,
      features: [validCity, { ...validTerrain, id: 'babylon' }],
    };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });
});

describe('themeIndexSchema', () => {
  it('正しい一覧を受理する', () => {
    const index = [
      {
        id: 'ancient-orient',
        title: '古代オリエント',
        era: '前3000年頃〜前330年',
        order: 1,
      },
    ];
    expect(themeIndexSchema.safeParse(index).success).toBe(true);
  });

  it('order が整数でなければ拒否する', () => {
    const index = [{ id: 'a', title: 'A', era: 'era', order: 1.5 }];
    expect(themeIndexSchema.safeParse(index).success).toBe(false);
  });
});
