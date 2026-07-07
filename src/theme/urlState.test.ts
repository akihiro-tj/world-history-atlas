import { describe, expect, it } from 'vitest';
import { buildSearchWithTheme, parseThemeIdFromSearch } from './urlState';

describe('parseThemeIdFromSearch', () => {
  it('theme パラメータを取り出す', () => {
    expect(parseThemeIdFromSearch('?theme=ancient-orient')).toBe(
      'ancient-orient',
    );
  });

  it('パラメータがなければ undefined', () => {
    expect(parseThemeIdFromSearch('')).toBeUndefined();
    expect(parseThemeIdFromSearch('?other=1')).toBeUndefined();
  });

  it('空値は undefined', () => {
    expect(parseThemeIdFromSearch('?theme=')).toBeUndefined();
  });
});

describe('buildSearchWithTheme', () => {
  it('theme パラメータを設定する', () => {
    expect(buildSearchWithTheme('', 'ancient-orient')).toBe(
      '?theme=ancient-orient',
    );
  });

  it('既存パラメータを保持する', () => {
    expect(buildSearchWithTheme('?other=1', 'ancient-orient')).toBe(
      '?other=1&theme=ancient-orient',
    );
  });

  it('undefined なら theme を除去する', () => {
    expect(buildSearchWithTheme('?theme=ancient-orient', undefined)).toBe('');
  });
});
