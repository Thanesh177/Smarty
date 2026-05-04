import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: ['icon-192.png', 'icon-512.png'],

      manifest: {
        name: 'Smarty',
        short_name: 'Smarty',
        description: 'Learn while you scroll',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',

        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  server: {
    proxy: {
      '/bbc-api': {
        target: 'https://bbc-news-api.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bbc-api/, ''),
      },
      '/openlibrary': {
        target: 'https://openlibrary.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openlibrary/, ''),
      },
    },
  },
});