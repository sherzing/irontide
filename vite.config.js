import { defineConfig } from 'vite';
// The menu asks /status on every start, also on a bench that runs no game server: there the answer is "null", not an error.
const noServer = (proxy) => proxy.on('error', (e, req, res) => { if (res.writeHead && !res.headersSent) res.writeHead(200, { 'content-type': 'application/json' }).end('null'); });
export default defineConfig({
  root: 'client',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 2000 },
  server: { port: 5173, proxy: { '/ws': { target: 'ws://localhost:8787', ws: true }, '/status': { target: 'http://localhost:8787', configure: noServer } } },
});
