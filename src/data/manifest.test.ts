import { describe, expect, it } from 'vitest';
import { fetchAssetManifest } from './manifest';

const validManifest = {
  basemap: '/tiles/basemap.pmtiles',
  themeIndex: '/data/themes/index.json',
  themes: {
    'ancient-orient': '/data/themes/ancient-orient.json',
  },
};

function jsonResponse(body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status: 200 });
}

describe('fetchAssetManifest', () => {
  it('渡した URL をそのまま叩く', async () => {
    let requestedUrl = '';
    const spy: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify(validManifest), { status: 200 });
    };
    await fetchAssetManifest(spy);
    expect(requestedUrl).toBe('/asset-manifest.json');
  });

  it('正しい JSON なら ok で返す', async () => {
    const result = await fetchAssetManifest(jsonResponse(validManifest));
    expect(result).toEqual({ ok: true, value: validManifest });
  });

  it('HTTP エラーなら network エラー', async () => {
    const notFound: typeof fetch = async () =>
      new Response('not found', { status: 404 });
    const result = await fetchAssetManifest(notFound);
    expect(result).toEqual({ ok: false, error: { type: 'network' } });
  });

  it('スキーマ違反なら invalid-data エラー', async () => {
    const result = await fetchAssetManifest(
      jsonResponse({ basemap: '/tiles/basemap.pmtiles' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe('invalid-data');
  });
});
