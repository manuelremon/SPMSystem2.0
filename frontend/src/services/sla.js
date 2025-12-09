/**
 * Servicio API para SLA (Service Level Agreement)
 *
 * Endpoints:
 * - GET /api/sla/metricas - Metricas de cumplimiento
 * - GET /api/sla/alertas - Alertas activas
 * - PUT /api/sla/alertas/:id/resolver - Resolver alerta
 * - GET /api/sla/configuraciones - Listar configuraciones
 * - POST /api/sla/configuraciones - Crear configuracion (admin)
 * - PUT /api/sla/configuraciones/:id - Actualizar (admin)
 * - DELETE /api/sla/configuraciones/:id - Eliminar (admin)
 */

import api from './api'

/**
 * Obtener metricas de cumplimiento SLA
 * @param {Object} params
 * @param {number} params.periodoDias - Dias hacia atras (default: 30)
 * @param {boolean} params.porCriticidad - Incluir desglose por criticidad
 * @returns {Promise<Object>} Metricas SLA
 */
export const getMetricas = async ({ periodoDias = 30, porCriticidad = false } = {}) => {
  const response = await api.get('/sla/metricas', {
    params: {
      periodo_dias: periodoDias,
      por_criticidad: porCriticidad
    }
  })
  return response.data?.data || {}
}

/**
 * Obtener alertas SLA activas
 * @param {Object} params
 * @param {number} params.solicitudId - Filtrar por solicitud
 * @param {string} params.tipo - Filtrar por tipo (warning, breach, escalated)
 * @returns {Promise<Array>} Lista de alertas
 */
export const getAlertas = async ({ solicitudId, tipo } = {}) => {
  const response = await api.get('/sla/alertas', {
    params: {
      solicitud_id: solicitudId,
      tipo
    }
  })
  return response.data?.data || []
}

/**
 * Resolver una alerta SLA
 * @param {number} alertaId - ID de la alerta
 * @returns {Promise<boolean>} true si se resolvio
 */
export const resolverAlerta = async (alertaId) => {
  const response = await api.put(`/sla/alertas/${alertaId}/resolver`)
  return response.data?.ok === true
}

/**
 * Listar configuraciones SLA
 * @param {Object} params
 * @param {boolean} params.activo - Filtrar por estado activo
 * @returns {Promise<Array>} Lista de configuraciones
 */
export const getConfiguraciones = async ({ activo } = {}) => {
  const response = await api.get('/sla/configuraciones', {
    params: activo !== undefined ? { activo } : {}
  })
  return response.data?.data || []
}

/**
 * Crear nueva configuracion SLA (solo admin)
 * @param {Object} data
 * @param {string} data.nombre - Nombre descriptivo
 * @param {string} data.estadoDesde - Estado inicial
 * @param {string} data.estadoHasta - Estado destino
 * @param {number} data.tiempoObjetivoHoras - Tiempo objetivo
 * @param {string} data.criticidad - Criticidad (opcional)
 * @param {string} data.descripcion - Descripcion (opcional)
 * @param {number} data.tiempoAlertaHoras - Horas para alertar (opcional)
 * @param {boolean} data.notificarAlVencer - Notificar al vencer
 * @param {boolean} data.escalarAlVencer - Escalar al vencer
 * @param {string} data.escalarARol - Rol de escalamiento
 * @returns {Promise<Object>} Configuracion creada
 */
export const crearConfiguracion = async (data) => {
  const response = await api.post('/sla/configuraciones', {
    nombre: data.nombre,
    estado_desde: data.estadoDesde,
    estado_hasta: data.estadoHasta,
    tiempo_objetivo_horas: data.tiempoObjetivoHoras,
    criticidad: data.criticidad,
    descripcion: data.descripcion,
    tiempo_alerta_horas: data.tiempoAlertaHoras,
    notificar_al_vencer: data.notificarAlVencer ?? true,
    escalar_al_vencer: data.escalarAlVencer ?? false,
    escalar_a_rol: data.escalarARol
  })
  return response.data?.data
}

/**
 * Actualizar configuracion SLA (solo admin)
 * @param {number} configId - ID de la configuracion
 * @param {Object} data - Campos a actualizar
 * @returns {Promise<boolean>} true si se actualizo
 */
export const actualizarConfiguracion = async (configId, data) => {
  const payload = {}
  if (data.nombre !== undefined) payload.nombre = data.nombre
  if (data.estadoDesde !== undefined) payload.estado_desde = data.estadoDesde
  if (data.estadoHasta !== undefined) payload.estado_hasta = data.estadoHasta
  if (data.tiempoObjetivoHoras !== undefined) payload.tiempo_objetivo_horas = data.tiempoObjetivoHoras
  if (data.criticidad !== undefined) payload.criticidad = data.criticidad
  if (data.descripcion !== undefined) payload.descripcion = data.descripcion
  if (data.tiempoAlertaHoras !== undefined) payload.tiempo_alerta_horas = data.tiempoAlertaHoras
  if (data.notificarAlVencer !== undefined) payload.notificar_al_vencer = data.notificarAlVencer
  if (data.escalarAlVencer !== undefined) payload.escalar_al_vencer = data.escalarAlVencer
  if (data.escalarARol !== undefined) payload.escalar_a_rol = data.escalarARol
  if (data.activo !== undefined) payload.activo = data.activo

  const response = await api.put(`/sla/configuraciones/${configId}`, payload)
  return response.data?.ok === true
}

/**
 * Eliminar configuracion SLA (solo admin)
 * @param {number} configId - ID de la configuracion
 * @returns {Promise<boolean>} true si se elimino
 */
export const eliminarConfiguracion = async (configId) => {
  const response = await api.delete(`/sla/configuraciones/${configId}`)
  return response.data?.ok === true
}

// Export default con todos los metodos
export default {
  getMetricas,
  getAlertas,
  resolverAlerta,
  getConfiguraciones,
  crearConfiguracion,
  actualizarConfiguracion,
  eliminarConfiguracion
}
