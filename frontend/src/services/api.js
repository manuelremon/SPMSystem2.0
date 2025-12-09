import axios from 'axios'
import { logger } from '../utils/logger'

/**
 * API Configuration
 *
 * Estrategia de autenticacion: COOKIES ONLY (httpOnly)
 * - NO usamos Bearer token en headers
 * - Tokens se manejan via cookies httpOnly (spm_token, spm_token_refresh)
 * - CSRF token se envia en header X-CSRF-Token
 *
 * Esto es mas seguro porque:
 * 1. Cookies httpOnly no son accesibles desde JS (protege contra XSS)
 * 2. CSRF token protege contra ataques CSRF
 */

const log = logger.withContext('API')

// En produccion usa URL relativa, en desarrollo usa localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

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
    // Bypass localtunnel verification page
    'bypass-tunnel-reminder': 'true'
  }
})

// Request interceptor - add CSRF token, Bearer token, and logging
api.interceptors.request.use((config) => {
  // Track request timing
  config._startTime = performance.now()

  // Add CSRF token
  const csrfToken = localStorage.getItem('csrf_token')
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  // Add Bearer token for cross-domain auth (GitHub Pages + Cloudflare Tunnel)
  const accessToken = localStorage.getItem('spm_access_token')
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`
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
    // Log error response
    const config = error.config || {}
    const status = error.response?.status || 'NETWORK'
    const duration = config._startTime
      ? (performance.now() - config._startTime).toFixed(0)
      : '?'
    log.error(`${config.method?.toUpperCase()} ${config.url} -> ${status} (${duration}ms)`, error.response?.data || error.message)

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
  // Clear auth tokens for cross-domain auth
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
    const baseUrl = import.meta.env.BASE_URL || '/'
    window.location.href = `${baseUrl}login`
  }
}

export default api
