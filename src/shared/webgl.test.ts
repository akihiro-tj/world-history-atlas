import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebgl2Supported } from './webgl';

describe('isWebgl2Supported', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getContext が webgl2 コンテキストを返すと true', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as RenderingContext,
    );
    expect(isWebgl2Supported()).toBe(true);
  });

  it('getContext が null を返すと false', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(isWebgl2Supported()).toBe(false);
  });

  it('getContext が例外を投げても false を返す', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        throw new Error('WebGL disabled');
      },
    );
    expect(isWebgl2Supported()).toBe(false);
  });
});
