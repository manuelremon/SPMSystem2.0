import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'
import { I18nProvider } from './context/i18n'

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

// Set light theme (dark mode was removed from project)
document.documentElement.setAttribute('data-theme', 'light')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
