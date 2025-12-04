import api from './api'
import { ensureCsrfToken } from './csrf'

export const login = async (username, password) => {
  // Asegura token CSRF antes de llamar al login para evitar 403
  await ensureCsrfToken()
  const response = await api.post('/auth/login', { username, password })
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
  return response.data
}
