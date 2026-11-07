import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
// MaaSetu — installable PWA for low-end Android phones (360px reference width).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new build waits until the person chooses to reload, so a
      // half-entered visit is never thrown away by an update.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'MaaSetu — Her care travels with her',
        short_name: 'MaaSetu',
        description:
          'Consent-based handover between ASHA and ANM workers. Prototype with synthetic data only.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Every screen, chunk and asset is precached, so the app opens fully
        // offline after one visit. `/ping.txt` is deliberately left out: the
        // connection probe must hit the network, not the cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/ping\.txt/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  // Make VITE_* env vars available to the client code
  envPrefix: ['VITE_'],
  envDir: './',
})
