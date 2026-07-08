import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

type ChangeListener = (event: MediaQueryListEvent) => void;

let listeners: Set<ChangeListener>;
let matches: boolean;
let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  listeners = new Set();
  matches = false;
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_event: string, listener: ChangeListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: ChangeListener) => {
      listeners.delete(listener);
    },
  })) as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('useMediaQuery', () => {
  it('マッチする場合は true を返す', () => {
    matches = true;
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(true);
  });

  it('マッチしない場合は false を返す', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);
  });

  it('メディアクエリの変化を反映する', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });

  it('アンマウント時にリスナーを解除する', () => {
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
