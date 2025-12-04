/**
 * Servicio centralizado de gestión CSRF Token
 * Garantiza un único punto de obtención, renovación y validación
 */

import api from './api'

const CSRF_TOKEN_KEY = 'csrf_token'
const CSRF_EXPIRY_KEY = 'csrf_expiry'
const CSRF_EXPIRY_MINUTES = 55 // Renovar antes de que expire (típicamente 60 min)

/**
 * Obtiene token CSRF del servidor
 * Se ejecuta automáticamente si no existe o ha expirado
 */
export const ensureCsrfToken = async () => {
  const stored = localStorage.getItem(CSRF_TOKEN_KEY)
  const expiry = localStorage.getItem(CSRF_EXPIRY_KEY)
  const now = Date.now()

  // Si existe token y NO ha expirado, usar existente
  if (stored && expiry && now < parseInt(expiry)) {
    return stored
  }

  // Token ausente o expirado: obtener nuevo
  try {
    const response = await api.get('/auth/csrf')
    const token = response.headers['x-csrf-token'] || response.data?.csrf_token

    if (token) {
      // Guardar token con expiración
      localStorage.setItem(CSRF_TOKEN_KEY, token)
      localStorage.setItem(CSRF_EXPIRY_KEY, String(now + CSRF_EXPIRY_MINUTES * 60 * 1000))
      return token
    }
  } catch (err) {
    console.error('Error obteniendo CSRF token:', err)
    // Continuar sin token (algunos endpoints pueden no requerirlo)
  }

  return null
}

/**
 * Función legacy (compat)
 */
export const fetchCsrfToken = async () => {
  return ensureCsrfToken()
}

/**
 * Renovar token forzadamente (ej. después de refresh de auth)
 */
export const refreshCsrfToken = async () => {
  localStorage.removeItem(CSRF_TOKEN_KEY)
  localStorage.removeItem(CSRF_EXPIRY_KEY)
  return ensureCsrfToken()
}

/**
 * Obtener token actualmente almacenado (sin renovar)
 */
export const getCsrfToken = () => {
  return localStorage.getItem(CSRF_TOKEN_KEY)
}

/**
 * Limpiar token (ej. en logout)
 */
export const clearCsrfToken = () => {
  localStorage.removeItem(CSRF_TOKEN_KEY)
  localStorage.removeItem(CSRF_EXPIRY_KEY)
}

/**
 * Ejecutar request POST/PATCH/DELETE con manejo automático de CSRF
 * Reintenta una vez si falla por 403 (token expirado)
 */
export const requestWithCsrf = async (method, url, data = null, retries = 1) => {
  try {
    await ensureCsrfToken()

    const config = { method, url }
    if (data) config.data = data

    return await api(config)
  } catch (error) {
    // Si 403 (forbidden por CSRF) y aún tenemos reintentos, renovar y volver a intentar
    if (error?.response?.status === 403 && retries > 0) {
      console.warn('CSRF token expirado, renovando...')
      await refreshCsrfToken()
      return requestWithCsrf(method, url, data, retries - 1)
    }

    throw error
  }
}
