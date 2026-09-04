import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_BASE_URL
    || 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com';

  return {
  base: '/',
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12', 'Android >= 6'],
    }),
  ],

  build: {
    // Let Vite use default optimal targets for production bundling
    target: 'modules',

    modulePreload: true,

    sourcemap: false,

    assetsInlineLimit: 4096, // Inlining small assets reduces HTTP requests

    cssCodeSplit: true, // Split CSS to match chunk loading

    chunkSizeWarningLimit: 1200,

    minify: 'esbuild',

    rollupOptions: {
      output: {
        // REMOVED: manualChunks: () => 'everything.js'
        // This splits your vendor dependencies naturally so mobiles don't crash
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
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
        target: 'https://bbc-news-api.vercel.app',
        changeOrigin: true,
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
