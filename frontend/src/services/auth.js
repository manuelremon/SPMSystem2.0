import api from './api'
import { ensureCsrfToken } from './csrf'

// Token storage keys
const ACCESS_TOKEN_KEY = 'spm_access_token'
const REFRESH_TOKEN_KEY = 'spm_refresh_token'

/**
 * SECURITY: Cross-origin token storage
 *
 * En producción (mismo dominio): Los tokens se manejan SOLO via cookies httpOnly.
 * En desarrollo/GitHub Pages (cross-origin): Se usa localStorage como fallback.
 *
 * Detectamos cross-origin comparando el origen del frontend con la API.
 * Si son diferentes, habilitamos localStorage (menos seguro pero necesario).
 *
 * RIESGO XSS: localStorage es accesible desde JavaScript. En producción
 * con mismo dominio, esto está deshabilitado.
 */
const isCrossOrigin = () => {
  const apiUrl = import.meta.env.VITE_API_URL || ''
  if (!apiUrl) return false // Same origin, use cookies only
  try {
    const apiOrigin = new URL(apiUrl).origin
    return apiOrigin !== window.location.origin
  } catch {
    return false
  }
}

/**
 * Store tokens in localStorage (ONLY for cross-domain auth with GitHub Pages)
 * In same-origin production, this is a no-op for security.
 */
export const storeTokens = (accessToken, refreshToken) => {
  if (!isCrossOrigin()) return // Same origin: use cookies only (more secure)
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/**
 * Get access token from localStorage (only in cross-origin mode)
 */
export const getAccessToken = () => {
  if (!isCrossOrigin()) return null // Same origin: rely on cookies
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * Get refresh token from localStorage (only in cross-origin mode)
 */
export const getRefreshToken = () => {
  if (!isCrossOrigin()) return null // Same origin: rely on cookies
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Clear tokens from localStorage
 */
export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export const login = async (username, password) => {
  // Asegura token CSRF antes de llamar al login para evitar 403
  await ensureCsrfToken()
  const response = await api.post('/auth/login', { username, password })

  // Store tokens for cross-domain auth (GitHub Pages + Cloudflare Tunnel)
  if (response.data.access_token) {
    storeTokens(response.data.access_token, response.data.refresh_token)
  }

  return response.data
}

/**
 * Registro de usuarios
 *
 * Crea un nuevo usuario y lo autentica automáticamente.
 */
export const register = async (userData) => {
  await ensureCsrfToken()
  const response = await api.post('/auth/register', {
    email: userData.email,
    nombre: userData.nombre,
    password: userData.password
  })

  // Store tokens for cross-domain auth (igual que login)
  if (response.data.access_token) {
    storeTokens(response.data.access_token, response.data.refresh_token)
  }

  return response.data
}

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me')
  return response.data
}

export const refreshToken = async () => {
  const response = await api.post('/auth/refresh')
  return response.data
}

export const logout = async () => {
  const response = await api.post('/auth/logout')
  // Clear tokens on logout
  clearTokens()
  return response.data
}
