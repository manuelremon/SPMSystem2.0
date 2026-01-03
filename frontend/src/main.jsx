import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'
import { I18nProvider } from './context/i18n'
import { ThemeProvider } from './context/ThemeContext'

// Initialize Sentry for production error tracking
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'production',
    // Only send errors in production
    enabled: import.meta.env.PROD,
    // Sample rate for performance monitoring (10%)
    tracesSampleRate: 0.1,
    // Don't send errors from localhost
    beforeSend(event) {
      if (window.location.hostname === 'localhost') {
        return null
      }
      return event
    },
  })
}

// Aplicar tema inicial antes del primer render para evitar flash
// El ThemeProvider se encargara de mantener sincronizado el estado
const THEME_KEY = 'spm-theme'
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  // Migrar key viejo si existe
  const oldTheme = localStorage.getItem('theme')
  if (oldTheme) {
    localStorage.setItem(THEME_KEY, oldTheme)
    localStorage.removeItem('theme')
    return oldTheme
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}
document.documentElement.setAttribute('data-theme', getInitialTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
