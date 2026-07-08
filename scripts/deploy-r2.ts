import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetManifest } from '../src/data/manifest';

const HASH_LENGTH = 16;
const R2_BUCKET_NAME = 'world-history-atlas-tiles';
const PUBLIC_DIR = path.join(import.meta.dirname, '../public');
const THEMES_DIR = path.join(PUBLIC_DIR, 'data/themes');
const BASEMAP_PATH = path.join(PUBLIC_DIR, 'tiles/basemap.pmtiles');
const DIST_DIR = path.join(import.meta.dirname, '../dist');

export function computeContentHash(content: Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, HASH_LENGTH);
}

export function buildHashedFileName(
  baseName: string,
  extension: string,
  hash: string,
): string {
  return `${baseName}-${hash}${extension}`;
}

export function buildProdAssetManifest(
  basemapHash: string,
  themeIndexHash: string,
  themeHashes: Record<string, string>,
): AssetManifest {
  return {
    basemap: `/r2/${buildHashedFileName('basemap', '.pmtiles', basemapHash)}`,
    themeIndex: `/r2/themes/${buildHashedFileName('index', '.json', themeIndexHash)}`,
    themes: Object.fromEntries(
      Object.entries(themeHashes).map(([id, hash]) => [
        id,
        `/r2/themes/${buildHashedFileName(id, '.json', hash)}`,
      ]),
    ),
  };
}

type UploadTarget = {
  filePath: string;
  r2Key: string;
};

function uploadToR2(upload: UploadTarget): void {
  const result = spawnSync(
    'wrangler',
    [
      'r2',
      'object',
      'put',
      `${R2_BUCKET_NAME}/${upload.r2Key}`,
      '--file',
      upload.filePath,
      '--remote',
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`wrangler r2 object put に失敗した: ${upload.r2Key}`);
  }
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  const basemapContent = await readFile(BASEMAP_PATH);
  const basemapHash = computeContentHash(basemapContent);
  const uploads: UploadTarget[] = [
    {
      filePath: BASEMAP_PATH,
      r2Key: buildHashedFileName('basemap', '.pmtiles', basemapHash),
    },
  ];

  const themeFiles = (await readdir(THEMES_DIR)).filter((file) =>
    file.endsWith('.json'),
  );
  const themeHashes: Record<string, string> = {};
  let themeIndexHash = '';

  for (const file of themeFiles) {
    const filePath = path.join(THEMES_DIR, file);
    const content = await readFile(filePath);
    const hash = computeContentHash(content);
    const id = path.basename(file, '.json');

    if (id === 'index') {
      themeIndexHash = hash;
      uploads.push({
        filePath,
        r2Key: `themes/${buildHashedFileName('index', '.json', hash)}`,
      });
      continue;
    }

    themeHashes[id] = hash;
    uploads.push({
      filePath,
      r2Key: `themes/${buildHashedFileName(id, '.json', hash)}`,
    });
  }

  const manifest = buildProdAssetManifest(
    basemapHash,
    themeIndexHash,
    themeHashes,
  );

  if (isDryRun) {
    console.log('[dry-run] R2 へのアップロードをスキップする');
    for (const upload of uploads) {
      console.log(
        `[dry-run] ${upload.filePath} -> ${R2_BUCKET_NAME}/${upload.r2Key}`,
      );
    }
  } else {
    for (const upload of uploads) {
      uploadToR2(upload);
    }
  }

  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(
    path.join(DIST_DIR, 'asset-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  console.log('dist/asset-manifest.json:');
  console.log(JSON.stringify(manifest, null, 2));
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  await main();
}
