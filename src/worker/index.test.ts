import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';
import type { ByteRange } from './range';

const OBJECT_SIZE = 7004811;

type FakeObject = {
  size: number;
  range?: ByteRange;
  body: string | null;
};

function fakeR2Object(overrides: Partial<FakeObject> = {}) {
  return {
    size: OBJECT_SIZE,
    body: 'tile-bytes',
    httpEtag: '"abc123"',
    writeHttpMetadata(headers: Headers) {
      headers.set('content-type', 'application/octet-stream');
    },
    ...overrides,
  };
}

function fakeEnv(options: {
  bucketObject?: ReturnType<typeof fakeR2Object> | null;
  assetsResponse?: Response;
}): { env: Env; getSpy: ReturnType<typeof vi.fn> } {
  const getSpy = vi.fn(async () => options.bucketObject ?? null);
  const env = {
    ASSETS: {
      fetch: vi.fn(async () => options.assetsResponse ?? new Response('asset')),
    },
    BUCKET: { get: getSpy },
  } as unknown as Env;
  return { env, getSpy };
}

describe('worker fetch', () => {
  it('非 /r2 かつ非マニフェストのパスは ASSETS に委譲する', async () => {
    const assetsResponse = new Response('index');
    const { env } = fakeEnv({ assetsResponse });
    const response = await worker.fetch(
      new Request('https://example.com/index.html'),
      env,
    );
    expect(await response.text()).toBe('index');
  });

  it('asset-manifest.json は no-cache で返す', async () => {
    const assetsResponse = new Response(
      '{"basemap":"/tiles/basemap.pmtiles"}',
      {
        headers: { 'cache-control': 'public, max-age=3600' },
      },
    );
    const { env } = fakeEnv({ assetsResponse });
    const response = await worker.fetch(
      new Request('https://example.com/asset-manifest.json'),
      env,
    );
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('Range なしの /r2 GET は 200 を返し range を渡さない', async () => {
    const { env, getSpy } = fakeEnv({ bucketObject: fakeR2Object() });
    const response = await worker.fetch(
      new Request('https://example.com/r2/basemap-abc.pmtiles'),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(OBJECT_SIZE));
    expect(getSpy.mock.calls[0]?.[1]).toMatchObject({ range: undefined });
  });

  it('Range ありの /r2 GET は 206 と content-range を返す', async () => {
    const { env, getSpy } = fakeEnv({
      bucketObject: fakeR2Object({ range: { offset: 0, length: 16384 } }),
    });
    const response = await worker.fetch(
      new Request('https://example.com/r2/basemap-abc.pmtiles', {
        headers: { Range: 'bytes=0-16383' },
      }),
      env,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(
      `bytes 0-16383/${OBJECT_SIZE}`,
    );
    expect(response.headers.get('content-length')).toBe('16384');
    expect(getSpy.mock.calls[0]?.[1]?.range).toBeDefined();
  });

  it('存在しない R2 キーは 404', async () => {
    const { env } = fakeEnv({ bucketObject: null });
    const response = await worker.fetch(
      new Request('https://example.com/r2/missing.pmtiles'),
      env,
    );
    expect(response.status).toBe(404);
  });

  it('/r2 への非 GET/HEAD は 405', async () => {
    const { env } = fakeEnv({ bucketObject: fakeR2Object() });
    const response = await worker.fetch(
      new Request('https://example.com/r2/basemap-abc.pmtiles', {
        method: 'POST',
      }),
      env,
    );
    expect(response.status).toBe(405);
  });

  it('immutable キャッシュ制御を R2 レスポンスに付ける', async () => {
    const { env } = fakeEnv({ bucketObject: fakeR2Object() });
    const response = await worker.fetch(
      new Request('https://example.com/r2/basemap-abc.pmtiles'),
      env,
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });
});
