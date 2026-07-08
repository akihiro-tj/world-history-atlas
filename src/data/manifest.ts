import { z } from 'zod';
import type { Result } from '../shared/result';
import { fetchJson, type ThemeDataError } from '../theme/fetch';

export const assetManifestSchema = z.strictObject({
  basemap: z.string().min(1),
  themeIndex: z.string().min(1),
  themes: z.record(z.string(), z.string()),
});

export type AssetManifest = z.infer<typeof assetManifestSchema>;

export function fetchAssetManifest(
  fetchFn: typeof fetch = fetch,
): Promise<Result<AssetManifest, ThemeDataError>> {
  return fetchJson('/asset-manifest.json', assetManifestSchema, fetchFn);
}
