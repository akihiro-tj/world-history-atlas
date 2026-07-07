import { describe, expect, it } from 'vitest';
import { fetchTheme, fetchThemeIndex } from './fetch';

const validIndex = [
  {
    id: 'ancient-orient',
    title: '古代オリエント',
    era: '前3000年頃〜前330年',
    order: 1,
  },
];

function jsonResponse(body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status: 200 });
}

describe('fetchThemeIndex', () => {
  it('正しい JSON なら ok で返す', async () => {
    const result = await fetchThemeIndex(jsonResponse(validIndex));
    expect(result).toEqual({ ok: true, value: validIndex });
  });

  it('HTTP エラーなら network エラー', async () => {
    const notFound: typeof fetch = async () =>
      new Response('not found', { status: 404 });
    const result = await fetchThemeIndex(notFound);
    expect(result).toEqual({ ok: false, error: { type: 'network' } });
  });

  it('fetch が例外を投げたら network エラー', async () => {
    const broken: typeof fetch = async () => {
      throw new TypeError('failed to fetch');
    };
    const result = await fetchThemeIndex(broken);
    expect(result).toEqual({ ok: false, error: { type: 'network' } });
  });

  it('スキーマ違反なら invalid-data エラー', async () => {
    const result = await fetchThemeIndex(jsonResponse([{ id: 'x' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('invalid-data');
  });

  it('JSON でないレスポンスなら invalid-data エラー', async () => {
    const html: typeof fetch = async () =>
      new Response('<html></html>', { status: 200 });
    const result = await fetchThemeIndex(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('invalid-data');
  });
});

describe('fetchTheme', () => {
  it('テーマ id から URL を組み立てる', async () => {
    let requestedUrl = '';
    const spy: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response('{}', { status: 404 });
    };
    await fetchTheme('ancient-orient', spy);
    expect(requestedUrl).toBe('/data/themes/ancient-orient.json');
  });
});
