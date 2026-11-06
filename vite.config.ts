import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages user site (https://cipher.github.io) is served from the domain root.
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    // Shared types, validation and API client (copied from cipher-platform/packages/shared).
    alias: { '@cipher/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)) },
  },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  server: { port: 5173, strictPort: true },
});
