export function parseThemeIdFromSearch(search: string): string | undefined {
  const value = new URLSearchParams(search).get('theme');
  return value === null || value === '' ? undefined : value;
}

export function buildSearchWithTheme(
  search: string,
  themeId: string | undefined,
): string {
  const params = new URLSearchParams(search);
  if (themeId === undefined) {
    params.delete('theme');
  } else {
    params.set('theme', themeId);
  }
  const queryString = params.toString();
  return queryString === '' ? '' : `?${queryString}`;
}
