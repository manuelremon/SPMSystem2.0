import api from './api'
import { ensureCsrfToken } from './csrf'

// Token storage keys
const ACCESS_TOKEN_KEY = 'spm_access_token'
const REFRESH_TOKEN_KEY = 'spm_refresh_token'

/**
 * Store tokens in localStorage (needed for cross-domain auth with GitHub Pages)
 */
export const storeTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/**
 * Get access token from localStorage
 */
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY)

/**
 * Get refresh token from localStorage
 */
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY)

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
 * NOTA: El endpoint /auth/register NO está implementado en el backend (retorna 501).
 * Esta función lanza un error explícito para evitar estados inconsistentes.
 *
 * Cuando se implemente el registro en backend, actualizar esta función.
 */
export const register = async (/* userData */) => {
  throw new Error(
    'El registro de usuarios no está disponible. ' +
    'Contacta al administrador del sistema para crear una cuenta.'
  )
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
