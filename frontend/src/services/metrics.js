/**
 * Servicio API para metricas y monitoreo
 *
 * Endpoints:
 * - GET /api/metrics           - Todas las metricas
 * - GET /api/metrics/requests  - Metricas de requests
 * - GET /api/metrics/endpoints - Metricas por endpoint
 * - GET /api/metrics/business  - Metricas de negocio
 * - GET /api/metrics/system    - Metricas de sistema
 * - GET /api/metrics/cache     - Metricas de cache
 * - GET /api/metrics/db        - Metricas de BD
 * - POST /api/metrics/reset    - Reiniciar metricas (admin)
 */

import api from './api'

/**
 * Obtener todas las metricas
 * @returns {Promise<Object>} Metricas completas
 */
export const getAllMetrics = async () => {
  const response = await api.get('/metrics')
  return response.data?.data || {}
}

/**
 * Obtener metricas de requests HTTP
 * @returns {Promise<Object>} Estadisticas de requests
 */
export const getRequestMetrics = async () => {
  const response = await api.get('/metrics/requests')
  return response.data?.data || {}
}

/**
 * Obtener metricas por endpoint
 * @returns {Promise<Object>} Metricas por endpoint
 */
export const getEndpointMetrics = async () => {
  const response = await api.get('/metrics/endpoints')
  return response.data?.data || {}
}

/**
 * Obtener metricas de negocio
 * @returns {Promise<Object>} Contadores de negocio
 */
export const getBusinessMetrics = async () => {
  const response = await api.get('/metrics/business')
  return response.data?.data || {}
}

/**
 * Obtener metricas de sistema
 * @returns {Promise<Object>} CPU, memoria, etc.
 */
export const getSystemMetrics = async () => {
  const response = await api.get('/metrics/system')
  return response.data?.data || {}
}

/**
 * Obtener metricas de cache
 * @returns {Promise<Object>} Hit rate, misses, etc.
 */
export const getCacheMetrics = async () => {
  const response = await api.get('/metrics/cache')
  return response.data?.data || {}
}

/**
 * Obtener metricas de base de datos
 * @returns {Promise<Object>} Pool size, connections, etc.
 */
export const getDatabaseMetrics = async () => {
  const response = await api.get('/metrics/db')
  return response.data?.data || {}
}

/**
 * Reiniciar metricas (solo admin)
 * @returns {Promise<boolean>} true si se reiniciaron
 */
export const resetMetrics = async () => {
  const response = await api.post('/metrics/reset')
  return response.data?.ok === true
}

// Export default
export default {
  getAllMetrics,
  getRequestMetrics,
  getEndpointMetrics,
  getBusinessMetrics,
  getSystemMetrics,
  getCacheMetrics,
  getDatabaseMetrics,
  resetMetrics
}
