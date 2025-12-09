import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages deployment flag - set via GITHUB_PAGES=true environment variable
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  plugins: [react()],
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
