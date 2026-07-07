import { describe, expect, it } from 'vitest';
import { resolveInitialColorTheme, toggleColorTheme } from './colorTheme';

describe('resolveInitialColorTheme', () => {
  it('保存値があればそれを使う', () => {
    expect(resolveInitialColorTheme('dark', false)).toBe('dark');
    expect(resolveInitialColorTheme('light', true)).toBe('light');
  });

  it('保存値がなければ OS 設定に従う', () => {
    expect(resolveInitialColorTheme(null, true)).toBe('dark');
    expect(resolveInitialColorTheme(null, false)).toBe('light');
  });

  it('不正な保存値は OS 設定にフォールバックする', () => {
    expect(resolveInitialColorTheme('blue', true)).toBe('dark');
  });
});

describe('toggleColorTheme', () => {
  it('light と dark を反転する', () => {
    expect(toggleColorTheme('light')).toBe('dark');
    expect(toggleColorTheme('dark')).toBe('light');
  });
});
