import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/frontend',
  server: {
    middlewareMode: false,
    host: 'localhost',
    port: 5173,
    strictPort: false,
    open: false
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  appType: 'spa'
})
