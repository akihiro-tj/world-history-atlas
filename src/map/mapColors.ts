export type ColorTheme = 'light' | 'dark';

export type MapColors = {
  sea: string;
  land: string;
  landOutline: string;
  river: string;
  lake: string;
};

export const MAP_COLORS: Record<ColorTheme, MapColors> = {
  light: {
    sea: '#cfe0ec',
    land: '#faf7ef',
    landOutline: '#9fb8c9',
    river: '#7fa8c9',
    lake: '#cfe0ec',
  },
  dark: {
    sea: '#1b222b',
    land: '#2e3844',
    landOutline: '#46586a',
    river: '#4a6a85',
    lake: '#1b222b',
  },
};
