import { describe, expect, it } from 'vitest';
import {
  buildHashedFileName,
  buildProdAssetManifest,
  computeContentHash,
} from './deploy-r2';

describe('computeContentHash', () => {
  it('同じ内容なら同じハッシュを返す', () => {
    const a = computeContentHash(Buffer.from('hello world'));
    const b = computeContentHash(Buffer.from('hello world'));
    expect(a).toBe(b);
  });

  it('異なる内容なら異なるハッシュを返す', () => {
    const a = computeContentHash(Buffer.from('hello world'));
    const b = computeContentHash(Buffer.from('goodbye world'));
    expect(a).not.toBe(b);
  });

  it('先頭 16 桁の16進文字列を返す', () => {
    const hash = computeContentHash(Buffer.from('hello world'));
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('buildHashedFileName', () => {
  it('baseName-hash.extension の形式で返す', () => {
    expect(buildHashedFileName('basemap', '.pmtiles', 'abc123')).toBe(
      'basemap-abc123.pmtiles',
    );
  });
});

describe('buildProdAssetManifest', () => {
  it('/r2/ 配下の prod パスでマニフェストを組み立てる', () => {
    const manifest = buildProdAssetManifest('aaa111', 'bbb222', {
      'ancient-orient': 'ccc333',
    });
    expect(manifest).toEqual({
      basemap: '/r2/basemap-aaa111.pmtiles',
      themeIndex: '/r2/themes/index-bbb222.json',
      themes: {
        'ancient-orient': '/r2/themes/ancient-orient-ccc333.json',
      },
    });
  });
});
