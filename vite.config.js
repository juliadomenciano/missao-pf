import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const forAndroid = process.env.CAP_BUILD === '1';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [
    VitePWA({
      disable: forAndroid,
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Missão PF · Estudos',
        short_name: 'Missão PF',
        description: 'Estudos para Agente da Polícia Federal: ciclo, pomodoro, aulas e TAF.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1117',
        theme_color: '#0e1117',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        globIgnores: ['aulas/**'],
        navigateFallbackDenylist: [/^\/aulas\//],
        runtimeCaching: [
          { urlPattern: /\/aulas\//, handler: 'NetworkFirst', options: { cacheName: 'aulas', networkTimeoutSeconds: 5 } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'CacheFirst', options: { cacheName: 'fontes', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
  ],
});
