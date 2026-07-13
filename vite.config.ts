/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { assetManifestPlugin } from './vite-plugin-asset-manifest';

export default defineConfig({
  plugins: [react(), tailwindcss(), assetManifestPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/**/*.test.ts',
      'tests/spec-runner/**/*.test.ts',
    ],
  },
});
