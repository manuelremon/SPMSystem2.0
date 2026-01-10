/**
 * Servicio API para IA y ML
 *
 * Endpoints:
 * - GET  /api/ai/status              - Estado de pipelines ML
 * - POST /api/ai/train               - Entrenar modelos
 * - GET  /api/ai/solicitudes/priorizar - Priorizar solicitudes
 * - GET  /api/ai/materiales/similares  - Materiales similares
 * - GET  /api/ai/materiales/forecast   - Proyeccion demanda
 * - GET  /api/ai/materiales/analisis   - Analisis completo
 * - POST /api/ai/sugerir-accion        - Sugerir accion
 * - GET  /api/ai/alertas               - Alertas inteligentes
 * - POST /api/ai/cantidad-optima       - EOQ sugerido
 */

import api from './api'

/**
 * Obtener estado de los pipelines ML
 * @returns {Promise<Object>} Estado de cada pipeline
 */
export const getStatus = async () => {
  const response = await api.get('/ai/status')
  return response.data?.data || {}
}

/**
 * Entrenar modelos ML (solo admin/planner)
 * @param {Object} params
 * @param {boolean} params.force - Forzar reentrenamiento
 * @returns {Promise<Object>} Resultado del entrenamiento
 */
export const trainModels = async ({ force = false } = {}) => {
  const response = await api.post('/ai/train', { force })
  return response.data?.data || {}
}

/**
 * Priorizar solicitudes pendientes
 * @param {Object} params
 * @param {string} params.estado - Estado a filtrar (default: submitted)
 * @param {string} params.centro - Centro a filtrar
 * @param {number} params.limit - Limite de resultados
 * @returns {Promise<Array>} Solicitudes rankeadas
 */
export const priorizarSolicitudes = async ({ estado = 'submitted', centro, limit = 20 } = {}) => {
  const response = await api.get('/ai/solicitudes/priorizar', {
    params: { estado, centro, limit }
  })
  // Backend returns {solicitudes_rankeadas: [...], total_solicitudes: N, ...}
  // Extract the array and transform to match frontend expectations
  const data = response.data?.data
  const items = data?.solicitudes_rankeadas || []
  // Map backend fields to frontend expectations
  return items.map(item => ({
    id: item.solicitud_id || item.id,
    criticidad: item.criticidad || item.priority_level,
    score: item.total_score ?? item.score,
    scores: item.scores,
    rank: item.rank,
    razon: item.razon,
    recomendacion: item.recomendacion
  }))
}

/**
 * Obtener materiales similares
 * @param {string} materialCodigo - Codigo del material
 * @param {Object} params
 * @param {string} params.centro - Centro de costo
 * @param {number} params.max - Maximo de resultados
 * @returns {Promise<Array>} Materiales similares
 */
export const getMaterialesSimilares = async (materialCodigo, { centro = '1000', max = 5 } = {}) => {
  const response = await api.get(`/ai/materiales/similares/${materialCodigo}`, {
    params: { centro, max }
  })
  return response.data?.data || []
}

/**
 * Proyectar demanda de un material
 * @param {string} materialCodigo - Codigo del material
 * @param {Object} params
 * @param {string} params.centro - Centro de costo
 * @param {number} params.dias - Dias a proyectar
 * @returns {Promise<Object>} Proyeccion con intervalo de confianza
 */
export const getForecast = async (materialCodigo, { centro = '1000', dias = 30 } = {}) => {
  const response = await api.get(`/ai/materiales/forecast/${materialCodigo}`, {
    params: { centro, dias }
  })
  return response.data?.data || {}
}

/**
 * Analisis completo de un material (MRP + ML)
 * @param {string} materialCodigo - Codigo del material
 * @param {Object} params
 * @param {string} params.centro - Centro de costo
 * @returns {Promise<Object>} Analisis completo
 */
export const getAnalisisMaterial = async (materialCodigo, { centro = '1000' } = {}) => {
  const response = await api.get(`/ai/materiales/analisis/${materialCodigo}`, {
    params: { centro }
  })
  return response.data?.data || {}
}

/**
 * Sugerir accion para una solicitud
 * @param {Object} params
 * @param {number} params.solicitudId - ID de la solicitud
 * @param {Object} params.solicitud - Datos de la solicitud (alternativo)
 * @returns {Promise<Object>} Accion sugerida con confianza
 */
export const sugerirAccion = async ({ solicitudId, solicitud } = {}) => {
  const body = solicitud ? { solicitud } : { solicitud_id: solicitudId }
  const response = await api.post('/ai/sugerir-accion', body)
  return response.data?.data || {}
}

/**
 * Obtener alertas inteligentes basadas en ML
 * @param {string} centro - Centro de costo (requerido)
 * @returns {Promise<Array>} Alertas con severidad
 */
export const getAlertasInteligentes = async (centro) => {
  const response = await api.get('/ai/alertas', {
    params: { centro }
  })
  // Backend returns {alertas: [...], centro: ..., total_alertas: N}
  // Extract the alertas array
  const data = response.data?.data
  return data?.alertas || []
}

/**
 * Calcular cantidad optima de pedido (EOQ)
 * @param {Object} params
 * @param {string} params.materialCodigo - Codigo del material
 * @param {string} params.centro - Centro de costo
 * @param {number} params.demandaAnual - Demanda anual estimada
 * @param {number} params.costoOrden - Costo por orden
 * @param {number} params.costoMantenimiento - Costo de mantenimiento
 * @returns {Promise<Object>} EOQ sugerido con justificacion
 */
export const getCantidadOptima = async ({
  materialCodigo,
  centro = '1000',
  demandaAnual,
  costoOrden = 50,
  costoMantenimiento = 2
} = {}) => {
  const response = await api.post('/ai/cantidad-optima', {
    material_codigo: materialCodigo,
    centro,
    demanda_anual: demandaAnual,
    costo_orden: costoOrden,
    costo_mantenimiento: costoMantenimiento
  })
  return response.data?.data || {}
}

// Export default con todos los metodos
export default {
  getStatus,
  trainModels,
  priorizarSolicitudes,
  getMaterialesSimilares,
  getForecast,
  getAnalisisMaterial,
  sugerirAccion,
  getAlertasInteligentes,
  getCantidadOptima
}
