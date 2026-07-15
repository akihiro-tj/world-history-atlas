import { afterEach } from 'vitest';
import { resetMocks } from './mocks';

afterEach(() => {
  resetMocks();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  document.documentElement.removeAttribute('data-color-theme');
  window.history.replaceState(null, '', '/');
});
