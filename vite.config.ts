import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * Landing motion imports framer-motion. The audit page already loads that library inside the
 * incoming-call chunk. A second importer makes Rollup extract a shared chunk, and the audit page
 * then requests it. A private copy for the landing modules keeps the audit request set unchanged.
 */
const LANDING_FRAMER = '?fc-landing-copy';
const landingFramerCopy = (): Plugin => ({
  name: 'fourcee-landing-framer-copy',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer) return null;
    const fromCopy = importer.includes(LANDING_FRAMER);
    const fromLanding = /(?:^|[/\\])(?:motion-polish|view-fade)\.tsx$/.test(importer);
    if (!fromCopy && !fromLanding) return null;
    if (fromLanding && source !== 'framer-motion' && !source.startsWith('framer-motion/')) return null;
    const realImporter = fromCopy ? importer.slice(0, importer.indexOf(LANDING_FRAMER)) : importer;
    const resolved = await this.resolve(source, realImporter, { ...options, skipSelf: true });
    if (!resolved || resolved.external) return null;
    const id = resolved.id.replace(/^\0/, '').split('?')[0];
    const shared = /[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/.test(id);
    if (shared || (!id.includes(`${path.sep}node_modules${path.sep}`) && !id.includes('/node_modules/'))) {
      return fromCopy ? id : null;
    }
    return id + LANDING_FRAMER;
  },
  load(id) {
    if (!id.includes(LANDING_FRAMER)) return null;
    const real = id.replace(/^\0/, '').slice(0, id.replace(/^\0/, '').indexOf(LANDING_FRAMER));
    return fs.readFileSync(real, 'utf8');
  },
});

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
/** The compiled stylesheet is not needed for the poster’s first paint. Load it without blocking render. */
const deferCssPlugin = (): Plugin => ({
  name: 'fourcee-defer-css',
  transformIndexHtml(html) {
    return html.replace(
      /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g,
      '<link rel="stylesheet" crossorigin href="$1" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="$1"></noscript>',
    );
  },
});

const arMimePlugin = (): Plugin => {
  const middleware = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const path = (req.url ?? '').split('?')[0].toLowerCase();
    const ext = path.slice(path.lastIndexOf('.'));
    if (AR_MIME[ext]) res.setHeader('Content-Type', AR_MIME[ext]);
    // versioned (?v=) AR/MediaPipe binaries never change under the same URL -> long-lived immutable cache (dev/preview only; production
    // headers are set by the web server, see docs/AR-TRYON.md)
    if (/[?&]v=/.test(req.url ?? '') && /\.(wasm|gz|task|glb)$/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
      plugins: [landingFramerCopy(), react(), tailwindcss(), deferCssPlugin(), arMimePlugin()],
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
