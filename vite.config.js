import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
  ],

  build: {
    target: 'es2018',

    modulePreload: false,

    sourcemap: false,

    assetsInlineLimit: 0,

    cssCodeSplit: false,

    chunkSizeWarningLimit: 1200,

    minify: 'esbuild',

    rollupOptions: {
      output: {
        manualChunks: () => 'everything.js',
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
      '/bbc-api': {
        target: 'https://bbc-news-api.vercel.app',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/bbc-api/, ''),
      },

      '/openlibrary': {
        target: 'https://openlibrary.org',

        changeOrigin: true,
        secure: true,
        ws: false,

        timeout: 30000,
        proxyTimeout: 30000,

        rewrite: (path) =>
          path.replace(/^\/openlibrary/, ''),

        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log(
              'OpenLibrary proxy error:',
              err.message
            );
          });
        },
      },
    },
  },
});