import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * AR/3D assets need exact MIME types: iOS AR Quick Look only opens `.usdz` served as model/vnd.usdz+zip, Android Scene Viewer
 * wants model/gltf-binary, and MediaPipe needs application/wasm for streaming compile. Vite's static server has no entry for
 * usdz, so set them for `vite` and `vite preview`. Production servers: see docs/AR-TRYON.md.
 */
const AR_MIME: Record<string, string> = {
  '.usdz': 'model/vnd.usdz+zip',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
};
const arMimePlugin = (): Plugin => {
  const middleware = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const path = (req.url ?? '').split('?')[0].toLowerCase();
    const ext = path.slice(path.lastIndexOf('.'));
    if (AR_MIME[ext]) res.setHeader('Content-Type', AR_MIME[ext]);
    next();
  };
  return {
    name: 'fourcee-ar-mime',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const base = env.FOURCEE_BASE || process.env.FOURCEE_BASE || '/';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss(), arMimePlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      optimizeDeps: {
        include: ['webgi'],
        esbuildOptions: { target: 'esnext' },
      },
      build: {
        target: 'esnext',
        chunkSizeWarningLimit: 3500,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          webgi: path.resolve(__dirname, 'node_modules/webgi/dist/examples/runtime/bundle.m.js'),
        }
      }
    };
});
