import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const base = env.FOURCEE_BASE || process.env.FOURCEE_BASE || '/';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
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
