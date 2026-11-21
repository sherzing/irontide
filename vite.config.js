import { defineConfig } from 'vite';
export default defineConfig({
  root: 'client',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 2000 },
  server: { port: 5173, proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } } },
});
