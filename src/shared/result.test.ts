import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result', () => {
  it('ok は成功の値を包む', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('err は失敗の値を包む', () => {
    const result = err('boom');
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});
