import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

const THEMES_DIR = path.join(import.meta.dirname, 'public/data/themes');

type LocalAssetManifest = {
  basemap: string;
  themeIndex: string;
  themes: Record<string, string>;
};

function buildLocalAssetManifest(): LocalAssetManifest {
  const indexRaw = readFileSync(path.join(THEMES_DIR, 'index.json'), 'utf8');
  const entries = JSON.parse(indexRaw) as { id: string }[];
  const themes = Object.fromEntries(
    entries.map((entry) => [entry.id, `/data/themes/${entry.id}.json`]),
  );
  return {
    basemap: '/tiles/basemap.pmtiles',
    themeIndex: '/data/themes/index.json',
    themes,
  };
}

export function assetManifestPlugin(): Plugin[] {
  let outDir = path.join(import.meta.dirname, 'dist');

  return [
    {
      name: 'asset-manifest:serve',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/asset-manifest.json', (req, res) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405;
            res.end();
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(
            req.method === 'HEAD'
              ? undefined
              : JSON.stringify(buildLocalAssetManifest()),
          );
        });
      },
    },
    {
      name: 'asset-manifest:build',
      apply: 'build',
      configResolved(config) {
        outDir = path.resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        await mkdir(outDir, { recursive: true });
        await writeFile(
          path.join(outDir, 'asset-manifest.json'),
          JSON.stringify(buildLocalAssetManifest(), null, 2),
        );
      },
    },
  ];
}
