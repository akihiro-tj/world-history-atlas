import { describe, expect, it } from 'vitest';
import type { Theme, ThemeIndexEntry } from './schema';
import { validateThemeData } from './validation';

function makeTheme(overrides: Partial<Theme>): Theme {
  return {
    id: 'theme-a',
    title: 'テーマA',
    era: '前100年〜後100年',
    summary: '概要。',
    bounds: [0, 0, 50, 50],
    features: [
      {
        id: 'city-a',
        kind: 'city',
        name: '都市A',
        coordinates: [10, 10],
        importance: 1,
        description: '解説。',
      },
    ],
    ...overrides,
  };
}

function makeIndex(...ids: string[]): ThemeIndexEntry[] {
  return ids.map((id, i) => ({ id, title: id, era: 'era', order: i + 1 }));
}

describe('validateThemeData', () => {
  it('整合したデータなら issue なし', () => {
    expect(validateThemeData(makeIndex('theme-a'), [makeTheme({})])).toEqual(
      [],
    );
  });

  it('index にあるのにテーマファイルがなければ error', () => {
    const issues = validateThemeData(makeIndex('theme-a', 'theme-b'), [
      makeTheme({}),
    ]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('theme-b'),
      }),
    );
  });

  it('テーマファイルが index に載っていなければ error', () => {
    const issues = validateThemeData(makeIndex(), [makeTheme({})]);
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('theme-a')),
    ).toBe(true);
  });

  it('テーマ id が重複していれば error', () => {
    const issues = validateThemeData(makeIndex('theme-a'), [
      makeTheme({}),
      makeTheme({}),
    ]);
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('theme-a')),
    ).toBe(true);
  });

  it('同名フィーチャーの座標が 0.1 度以上ズレていれば error', () => {
    const themeA = makeTheme({});
    const themeB = makeTheme({
      id: 'theme-b',
      features: [
        {
          id: 'city-a2',
          kind: 'city',
          name: '都市A',
          coordinates: [10.2, 10],
          importance: 1,
          description: '解説。',
        },
      ],
    });
    const issues = validateThemeData(makeIndex('theme-a', 'theme-b'), [
      themeA,
      themeB,
    ]);
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('都市A')),
    ).toBe(true);
  });

  it('同名フィーチャーの座標が 0.1 度未満のズレなら issue なし', () => {
    const themeA = makeTheme({});
    const themeB = makeTheme({
      id: 'theme-b',
      features: [
        {
          id: 'city-a2',
          kind: 'city',
          name: '都市A',
          coordinates: [10.05, 10.05],
          importance: 1,
          description: '解説。',
        },
      ],
    });
    expect(
      validateThemeData(makeIndex('theme-a', 'theme-b'), [themeA, themeB]),
    ).toEqual([]);
  });

  it('同名フィーチャーの非先頭ペア間の座標ズレも error', () => {
    const themeA = makeTheme({
      bounds: [-1, -1, 50, 50],
      features: [
        {
          id: 'city-a',
          kind: 'city',
          name: '都市A',
          coordinates: [0, 0],
          importance: 1,
          description: '解説。',
        },
      ],
    });
    const themeB = makeTheme({
      id: 'theme-b',
      bounds: [-1, -1, 50, 50],
      features: [
        {
          id: 'city-a2',
          kind: 'city',
          name: '都市A',
          coordinates: [0.09, 0],
          importance: 1,
          description: '解説。',
        },
      ],
    });
    const themeC = makeTheme({
      id: 'theme-c',
      bounds: [-1, -1, 50, 50],
      features: [
        {
          id: 'city-a3',
          kind: 'city',
          name: '都市A',
          coordinates: [-0.09, 0],
          importance: 1,
          description: '解説。',
        },
      ],
    });
    const issues = validateThemeData(
      makeIndex('theme-a', 'theme-b', 'theme-c'),
      [themeA, themeB, themeC],
    );
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('都市A')),
    ).toBe(true);
  });

  it('bounds 外のフィーチャーは warning', () => {
    const theme = makeTheme({
      features: [
        {
          id: 'city-a',
          kind: 'city',
          name: '都市A',
          coordinates: [60, 10],
          importance: 1,
          description: '解説。',
        },
      ],
    });
    const issues = validateThemeData(makeIndex('theme-a'), [theme]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('city-a'),
      }),
    );
  });
});
