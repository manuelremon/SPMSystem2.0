/**
 * Servicio API para exportacion de reportes
 *
 * Endpoints:
 * - GET /api/export/solicitudes    - Exportar solicitudes
 * - GET /api/export/inventario     - Exportar inventario
 * - GET /api/export/alertas-mrp    - Exportar alertas MRP
 * - GET /api/export/kpis           - Exportar KPIs
 * - GET /api/export/formatos       - Lista formatos disponibles
 */

import api from './api'

const FORMATOS = ['xlsx', 'csv', 'pdf']

/**
 * Descarga un archivo desde un endpoint de export
 * @param {string} endpoint - Endpoint relativo (ej: '/export/solicitudes')
 * @param {Object} params - Parametros de query
 * @param {string} filename - Nombre base del archivo
 * @returns {Promise<void>}
 */
const downloadFile = async (endpoint, params = {}, filename = 'export') => {
  const response = await api.get(endpoint, {
    params,
    responseType: 'blob'
  })

  // Obtener nombre del archivo del header o usar el proporcionado
  const contentDisposition = response.headers['content-disposition']
  let downloadFilename = filename
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      downloadFilename = match[1].replace(/['"]/g, '')
    }
  }

  // Si no tiene extension, agregar segun formato
  const formato = params.formato || 'xlsx'
  if (!downloadFilename.includes('.')) {
    downloadFilename = `${downloadFilename}.${formato}`
  }

  // Crear blob y descargar
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream'
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = downloadFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Exportar solicitudes
 * @param {Object} params
 * @param {string} params.formato - xlsx, csv, pdf
 * @param {string} params.estado - Filtrar por estado
 * @param {string} params.centro - Filtrar por centro
 * @param {string} params.fechaDesde - Fecha inicio
 * @param {string} params.fechaHasta - Fecha fin
 * @returns {Promise<void>}
 */
export const exportSolicitudes = async ({
  formato = 'xlsx',
  estado,
  centro,
  fechaDesde,
  fechaHasta
} = {}) => {
  const params = { formato }
  if (estado) params.estado = estado
  if (centro) params.centro = centro
  if (fechaDesde) params.fecha_desde = fechaDesde
  if (fechaHasta) params.fecha_hasta = fechaHasta

  await downloadFile('/export/solicitudes', params, `solicitudes_${new Date().toISOString().split('T')[0]}`)
}

/**
 * Exportar inventario
 * @param {Object} params
 * @param {string} params.formato - xlsx, csv, pdf
 * @param {string} params.centro - Filtrar por centro
 * @param {boolean} params.incluirAlertas - Incluir alertas de stock
 * @returns {Promise<void>}
 */
export const exportInventario = async ({
  formato = 'xlsx',
  centro,
  incluirAlertas = true
} = {}) => {
  const params = {
    formato,
    incluir_alertas: incluirAlertas
  }
  if (centro) params.centro = centro

  await downloadFile('/export/inventario', params, `inventario_${new Date().toISOString().split('T')[0]}`)
}

/**
 * Exportar alertas MRP
 * @param {Object} params
 * @param {string} params.formato - xlsx, csv, pdf
 * @param {string} params.centro - Filtrar por centro
 * @param {string} params.severidad - Filtrar por severidad
 * @param {string} params.estado - Estado de la alerta
 * @returns {Promise<void>}
 */
export const exportAlertasMRP = async ({
  formato = 'xlsx',
  centro,
  severidad,
  estado = 'activa'
} = {}) => {
  const params = { formato, estado }
  if (centro) params.centro = centro
  if (severidad) params.severidad = severidad

  await downloadFile('/export/alertas-mrp', params, `alertas_mrp_${new Date().toISOString().split('T')[0]}`)
}

/**
 * Exportar KPIs
 * @param {Object} params
 * @param {string} params.formato - xlsx, csv, pdf
 * @param {string} params.periodoInicio - Fecha inicio
 * @param {string} params.periodoFin - Fecha fin
 * @returns {Promise<void>}
 */
export const exportKPIs = async ({
  formato = 'xlsx',
  periodoInicio,
  periodoFin
} = {}) => {
  const params = { formato }
  if (periodoInicio) params.periodo_inicio = periodoInicio
  if (periodoFin) params.periodo_fin = periodoFin

  await downloadFile('/export/kpis', params, `kpis_${new Date().toISOString().split('T')[0]}`)
}

/**
 * Obtener formatos disponibles
 * @returns {Promise<Object>} Lista de formatos y default
 */
export const getFormatos = async () => {
  try {
    const response = await api.get('/export/formatos')
    return response.data || { formatos: FORMATOS, default: 'xlsx' }
  } catch {
    return { formatos: FORMATOS, default: 'xlsx' }
  }
}

// Export default
export default {
  exportSolicitudes,
  exportInventario,
  exportAlertasMRP,
  exportKPIs,
  getFormatos,
  FORMATOS
}
