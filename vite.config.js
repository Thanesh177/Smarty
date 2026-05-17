import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'icon-192.png',
        'icon-512.png',
      ],

      manifest: {
        name: 'Smarty',
        short_name: 'Smarty',
        description: 'Learn while you scroll',

        start_url: '/',
        scope: '/',

        display: 'standalone',
        orientation: 'portrait',

        background_color: '#020617',
        theme_color: '#020617',

        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        navigateFallback: '/index.html',

        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'image',

            handler: 'CacheFirst',

            options: {
              cacheName: 'smarty-images',

              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },

          {
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style',

            handler: 'StaleWhileRevalidate',

            options: {
              cacheName: 'smarty-assets',
            },
          },
        ],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],

  build: {
    target: 'es2018',

    modulePreload: false,

    sourcemap: false,

    cssCodeSplit: true,

    chunkSizeWarningLimit: 1200,

    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
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