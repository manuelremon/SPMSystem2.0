import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// GitHub Pages deployment flag - set via GITHUB_PAGES=true environment variable
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

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
  ],
  // Base path para GitHub Pages (nombre del repo)
  base: isGitHubPages ? '/SPMSystem2.0/' : '/',
  // Define environment variables that can be used in the app
  define: {
    // This allows us to check at runtime if we're on GitHub Pages
    'import.meta.env.IS_GITHUB_PAGES': JSON.stringify(isGitHubPages)
  },
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
