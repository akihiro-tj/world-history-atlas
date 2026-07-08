import { describe, expect, it } from 'vitest';
import {
  buildContentRangeHeader,
  byteRangeLength,
  resolveByteRange,
} from './range';

describe('resolveByteRange', () => {
  it('range が未指定なら undefined を返す（フルボディ）', () => {
    expect(resolveByteRange(undefined, 1000)).toBeUndefined();
  });

  it('offset と length から start/end を計算する', () => {
    expect(resolveByteRange({ offset: 100, length: 50 }, 1000)).toEqual({
      start: 100,
      end: 149,
    });
  });

  it('length 省略時はファイル末尾までを end にする', () => {
    expect(resolveByteRange({ offset: 900 }, 1000)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it('offset 省略時は先頭からの length バイトにする', () => {
    expect(resolveByteRange({ length: 10 }, 1000)).toEqual({
      start: 0,
      end: 9,
    });
  });

  it('suffix はファイル末尾から指定バイト数を返す', () => {
    expect(resolveByteRange({ suffix: 100 }, 1000)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it('suffix がサイズを超えても先頭でクランプする', () => {
    expect(resolveByteRange({ suffix: 5000 }, 1000)).toEqual({
      start: 0,
      end: 999,
    });
  });

  it('end がサイズを超える場合はサイズ末尾でクランプする', () => {
    expect(resolveByteRange({ offset: 900, length: 500 }, 1000)).toEqual({
      start: 900,
      end: 999,
    });
  });
});

describe('buildContentRangeHeader', () => {
  it('bytes start-end/size の形式で返す', () => {
    expect(buildContentRangeHeader({ start: 100, end: 149 }, 1000)).toBe(
      'bytes 100-149/1000',
    );
  });
});

describe('byteRangeLength', () => {
  it('start から end までの長さ（両端含む）を返す', () => {
    expect(byteRangeLength({ start: 100, end: 149 })).toBe(50);
  });
});
