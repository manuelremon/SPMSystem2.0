import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { I18nProvider } from './context/i18n'

// Asegurar tema antes de renderizar: claro por defecto
const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
const initialTheme = storedTheme || 'light'
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme)
  if (!storedTheme) {
    localStorage.setItem('theme', initialTheme)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
)
