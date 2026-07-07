import type { ZodType } from 'zod';
import { err, ok, type Result } from '../shared/result';
import {
  type Theme,
  type ThemeIndexEntry,
  themeIndexSchema,
  themeSchema,
} from './schema';

export type ThemeDataError =
  | { type: 'network' }
  | { type: 'invalid-data'; detail: string };

export function fetchThemeIndex(
  fetchFn: typeof fetch = fetch,
): Promise<Result<ThemeIndexEntry[], ThemeDataError>> {
  return fetchJson('/data/themes/index.json', themeIndexSchema, fetchFn);
}

export function fetchTheme(
  id: string,
  fetchFn: typeof fetch = fetch,
): Promise<Result<Theme, ThemeDataError>> {
  return fetchJson(`/data/themes/${id}.json`, themeSchema, fetchFn);
}

async function fetchJson<T>(
  url: string,
  schema: ZodType<T>,
  fetchFn: typeof fetch,
): Promise<Result<T, ThemeDataError>> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch {
    return err({ type: 'network' });
  }
  if (!response.ok) {
    return err({ type: 'network' });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return err({ type: 'invalid-data', detail: 'JSON として解釈できない' });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return err({ type: 'invalid-data', detail: parsed.error.message });
  }
  return ok(parsed.data);
}
