import type { ColorTheme } from '../map/mapColors';

export const COLOR_THEME_STORAGE_KEY = 'color-theme';

export function resolveInitialColorTheme(
  storedValue: string | null,
  prefersDark: boolean,
): ColorTheme {
  if (storedValue === 'light' || storedValue === 'dark') return storedValue;
  return prefersDark ? 'dark' : 'light';
}

export function toggleColorTheme(theme: ColorTheme): ColorTheme {
  return theme === 'light' ? 'dark' : 'light';
}
