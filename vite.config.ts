/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { assetManifestPlugin } from './vite-plugin-asset-manifest';

export default defineConfig({
  plugins: [react(), tailwindcss(), assetManifestPlugin()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: [
            'src/**/*.test.{ts,tsx}',
            'scripts/**/*.test.ts',
            'tests/spec-runner/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts', './tests/component/setup.ts'],
          include: ['tests/component/component.spec.ts'],
        },
      },
    ],
  },
});
