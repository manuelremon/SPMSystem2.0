import axios from 'axios'
import { logger } from '../utils/logger.js'
import { translateError } from '../utils/errorTranslation'

/**
 * API Configuration
 *
 * Estrategia de autenticacion:
 *
 * MISMO DOMINIO (produccion): COOKIES ONLY (httpOnly)
 * - Tokens se manejan via cookies httpOnly (spm_token, spm_token_refresh)
 * - NO se usa localStorage (protege contra XSS)
 * - CSRF token se envia en header X-CSRF-Token
 *
 * CROSS-ORIGIN (GitHub Pages, desarrollo remoto):
 * - Cookies no funcionan cross-domain con SameSite=Lax
 * - Se usa Bearer token en header como fallback
 * - Token almacenado en localStorage (menos seguro, pero necesario)
 *
 * La decision se toma automaticamente comparando origenes.
 */

const log = logger.withContext('API')

/**
 * Detecta si estamos en modo cross-origin (frontend y API en dominios diferentes)
 */
const isCrossOrigin = () => {
  const apiUrl = import.meta?.env?.VITE_API_URL || ''
  if (!apiUrl) return false // No API URL = same origin
  try {
    const apiOrigin = new URL(apiUrl).origin
    return apiOrigin !== window.location.origin
  } catch {
    return false
  }
}

// En produccion usa URL relativa, en desarrollo usa localhost
const API_BASE_URL = import.meta?.env?.VITE_API_URL || '/api'

// URL de refresh usa la misma base que la API
const REFRESH_URL = `${API_BASE_URL}/auth/refresh`

let isRefreshing = false
let failedQueue = []

const processQueue = (error) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve()
    }
  })
  failedQueue = []
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // IMPORTANTE: Envía cookies en cada request
  headers: {
    'Content-Type': 'application/json',
  }
})

// Request interceptor - add CSRF token, Bearer token (cross-origin only), and logging
api.interceptors.request.use((config) => {
  // Track request timing
  config._startTime = performance.now()

  // Add CSRF token (always needed for state-changing requests)
  const csrfToken = localStorage.getItem('csrf_token')
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  // Add Bearer token ONLY for cross-domain auth (GitHub Pages + Cloudflare Tunnel)
  // In same-origin mode, we rely on httpOnly cookies (more secure against XSS)
  if (isCrossOrigin()) {
    const accessToken = localStorage.getItem('spm_access_token')
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    }
  }

  // Log request
  log.debug(`${config.method?.toUpperCase()} ${config.url}`, config.data ? { data: config.data } : '')

  return config
})

// Response interceptor - handle errors and logging
api.interceptors.response.use(
  response => {
    // Log successful response with timing
    const duration = response.config._startTime
      ? (performance.now() - response.config._startTime).toFixed(0)
      : '?'
    log.debug(`${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status} (${duration}ms)`)

    // Capturar token CSRF del header si viene
    const csrfHeader = response.headers['x-csrf-token']
    if (csrfHeader) {
      localStorage.setItem('csrf_token', csrfHeader)
    }
    return response
  },
  async error => {
    // Log error response (unless silenced)
    const config = error.config || {}
    const status = error.response?.status || 'NETWORK'
    const duration = config._startTime
      ? (performance.now() - config._startTime).toFixed(0)
      : '?'

    // Allow silencing specific errors (e.g., expected 401s for optional endpoints)
    const shouldSilence = config._silenceErrors === true ||
                          (Array.isArray(config._silenceErrors) && config._silenceErrors.includes(status))

    if (!shouldSilence) {
      log.error(`${config.method?.toUpperCase()} ${config.url} -> ${status} (${duration}ms)`, error.response?.data || error.message)
    }

    // Translate backend error messages to the user's language
    if (error.response?.data) {
      const data = error.response.data
      if (typeof data.error === 'string') {
        data.error = translateError(data.error)
      } else if (data.error?.message && typeof data.error.message === 'string') {
        data.error.message = translateError(data.error.message)
      }
      if (typeof data.message === 'string') {
        data.message = translateError(data.message)
      }
    }

    const originalRequest = error.config
    const responseStatus = error.response?.status
    const errorCode = error.response?.data?.error?.code

    // CSRF error (403) - intentar renovar token
    if (responseStatus === 403 && errorCode === 'csrf_error' && !originalRequest._csrf_retry) {
      originalRequest._csrf_retry = true
      try {
        const csrfResponse = await axios.get(`${API_BASE_URL}/auth/csrf`, {
          withCredentials: true
        })
        const newToken = csrfResponse.headers['x-csrf-token'] || csrfResponse.data?.csrf_token
        if (newToken) {
          localStorage.setItem('csrf_token', newToken)
          originalRequest.headers['X-CSRF-Token'] = newToken
          return api(originalRequest)
        }
      } catch {
        // Si falla obtener CSRF, continuar con el error original
      }
    }

    // 401 Unauthorized - intentar refresh o redirigir a login
    if (responseStatus === 401) {
      // Skip retry if explicitly disabled (e.g., optional admin endpoints)
      if (originalRequest._skipAuthRetry) {
        return Promise.reject(error)
      }

      // Evitar loop: si /auth/me o /auth/refresh fallan, ir directo a login
      const isAuthEndpoint = originalRequest?.url?.includes('/auth/me') ||
                             originalRequest?.url?.includes('/auth/refresh')

      if (isAuthEndpoint || originalRequest._retry) {
        // Limpiar estado y redirigir
        clearAuthState()
        redirectToLogin()
        return Promise.reject(error)
      }

      // Intentar refresh
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
        .then(() => api(originalRequest))
        .catch(err => {
          redirectToLogin()
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const csrfToken = localStorage.getItem('csrf_token')
        await axios.post(REFRESH_URL, {}, {
          withCredentials: true,
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
        })
        processQueue(null)
        return api(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr)
        clearAuthState()
        redirectToLogin()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

/**
 * Limpia el estado de autenticación del cliente
 */
function clearAuthState() {
  localStorage.removeItem('csrf_token')
  localStorage.removeItem('csrf_expiry')
  // Clear auth tokens (only used in cross-origin mode, but safe to always clear)
  localStorage.removeItem('spm_access_token')
  localStorage.removeItem('spm_refresh_token')
}

/**
 * Redirige a login evitando loops
 */
function redirectToLogin() {
  // Evitar redirección si ya estamos en login
  if (!window.location.pathname.includes('/login')) {
    // Usar BASE_URL para GitHub Pages
    const baseUrl = import.meta?.env?.BASE_URL || '/'
    window.location.href = `${baseUrl}login`
  }
}

export default api
