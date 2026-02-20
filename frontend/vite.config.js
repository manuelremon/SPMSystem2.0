import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
            // Remove fixed width/height for proper scaling
            {
              name: 'removeAttrs',
              params: { attrs: '(width|height)' },
            },
            // Convert fill to currentColor for CSS color control
            {
              name: 'convertColors',
              params: { currentColor: true },
            },
          ],
        },
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      // Include existing sw.js for push notifications
      injectRegister: 'auto',
      workbox: {
        // Cache built assets (JS, CSS, fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Allow large chunks (fortune-sheet ~2.8MB)
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // SPA fallback: serve index.html for all navigation requests
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Include push notification handlers from existing SW
        importScripts: ['/push-sw.js'],
        // Runtime caching for API endpoints
        runtimeCaching: [
          {
            // Cache catalogs (rarely change)
            urlPattern: /\/api\/catalogos\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'catalogos-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }, // 24h
            },
          },
          {
            // Cache material search
            urlPattern: /\/api\/materiales\/search.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'materiales-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 }, // 1h
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache dashboard data (short lived)
            urlPattern: /\/api\/dashboards\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dashboards-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 300 }, // 5min
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: false, // Use existing public/manifest.json
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-charts': ['chart.js', 'react-chartjs-2', '@mui/x-charts'],
          'vendor-grid': ['@tanstack/react-table', '@mui/x-data-grid', 'ag-grid-community', 'ag-grid-react'],
          'vendor-utils': ['axios', 'zustand', 'xlsx', 'clsx'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true
  }
})
