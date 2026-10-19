import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { handleFdcBarcode } from './api/fdc-barcode'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    fdcBarcodeApi(loadEnv(mode, process.cwd(), '').FDC_API_KEY),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Fitness Tracker',
        short_name: 'Fitness',
        description: 'Fast food, macro and workout logging.',
        theme_color: '#05070b',
        background_color: '#05070b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/off-search\//],
        // Only the app shell is precached. Supabase and Open Food Facts responses are
        // deliberately not cached here: TanStack Query owns server-state caching.
        // The barcode reader's .wasm (~1 MB, only needed without native BarcodeDetector) is not
        // precached; it is cached on first use so scanning then works offline.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        globIgnores: ['**/*.wasm'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.wasm$/,
            handler: 'CacheFirst',
            options: { cacheName: 'barcode-wasm', expiration: { maxEntries: 2 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Mirrors the /off-search rewrite in vercel.json (OFF search has no CORS headers).
  server: { proxy: { '/off-search': offSearchProxy() } },
  preview: { proxy: { '/off-search': offSearchProxy() } },
}))

function offSearchProxy() {
  return {
    target: 'https://search.openfoodfacts.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/off-search/, ''),
  }
}

/** Serves the Vercel function api/fdc-barcode.ts in `vite dev` and `vite preview` too. */
function fdcBarcodeApi(apiKey: string | undefined): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/fdc-barcode')) return next()
    void handleFdcBarcode(new Request(new URL(req.url, 'http://localhost')), apiKey).then(
      async (response) => {
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(await response.text())
      },
      next,
    )
  }
  return {
    name: 'fdc-barcode-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}
