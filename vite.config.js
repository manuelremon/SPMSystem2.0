import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Middleware para servir rutas limpias (SPA routing)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // Fallback a index.html para rutas no encontradas
  appType: 'spa'
})
