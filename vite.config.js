import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import deletionPagesPlugin from './scripts/deletion-pages.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_BASE_URL
    || 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com';

  return {
  base: '/',
  plugins: [
    deletionPagesPlugin(),
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12', 'Android >= 6'],
    }),
  ],
  // The optional WebCodecs worker uses BigInt; it is never loaded by legacy
  // clients. Preserve the legacy bundle targets for the rest of Smarty.
  esbuild: { supported: { bigint: true } },

  build: {
    // Let Vite use default optimal targets for production bundling
    target: 'modules',

    modulePreload: true,

    sourcemap: false,

    assetsInlineLimit: 4096, // Inlining small assets reduces HTTP requests

    cssCodeSplit: true, // Split CSS to match chunk loading
    manifest: true,

    chunkSizeWarningLimit: 1200,

    minify: 'esbuild',

    rollupOptions: {
      output: {
        // Dynamic route imports own their dependencies instead of forcing
        // every screen's libraries into one eagerly downloaded vendor chunk.
      },
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },

  server: {
    proxy: {
      '/smarty-api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: true,
        timeout: 30000,
        proxyTimeout: 30000,
        rewrite: (path) => path.replace(/^\/smarty-api/, ''),
      },
      '/bbc-api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: true,
        timeout: 30000,
        proxyTimeout: 30000,
        rewrite: (path) => path.replace(/^\/bbc-api/, ''),
      },
      '/openlibrary': {
        target: 'https://openlibrary.org',
        changeOrigin: true,
        secure: true,
        ws: false,
        timeout: 30000,
        proxyTimeout: 30000,
        rewrite: (path) => path.replace(/^\/openlibrary/, ''),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('OpenLibrary proxy error:', err.message);
          });
        },
      },
    },
  },
  };
});
