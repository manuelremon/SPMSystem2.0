/**
 * Servicio para gestión de datos temporales (Excel import).
 *
 * Permite a administradores importar archivos Excel para operar
 * MRP y Forecast con datos temporales, sin afectar las bases de datos.
 */

import api from './api'

const ENDPOINTS = {
  IMPORT: '/admin/import-excel',
  STATUS: '/admin/temp-data/status',
  CLEAR: '/admin/temp-data/clear',
  TEMPLATE: '/admin/temp-data/template',
  PREVIEW: '/admin/temp-data/preview'
}

/**
 * Importa un archivo Excel para modo temporal.
 *
 * @param {File} file - Archivo Excel (.xlsx)
 * @returns {Promise<Object>} Resultado con session_id, resumen y advertencias
 */
export async function importExcel(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post(ENDPOINTS.IMPORT, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data
}

/**
 * Obtiene el estado del modo temporal.
 * Silencia errores 401/403 ya que son esperados para usuarios no admin.
 *
 * @returns {Promise<Object>} Estado con active, data (si activo), o {ok: false} si error
 */
export async function getTempDataStatus() {
  try {
    // Silenciar errores 401/403 y no reintentar auth - es un endpoint opcional
    const response = await api.get(ENDPOINTS.STATUS, {
      _silenceErrors: [401, 403],
      _skipAuthRetry: true
    })
    return response.data
  } catch (err) {
    // Silenciar errores de autenticación/autorización
    if (err.response?.status === 401 || err.response?.status === 403) {
      return { ok: false, active: false }
    }
    throw err
  }
}

/**
 * Desactiva el modo temporal y elimina los datos importados.
 *
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function clearTempData() {
  const response = await api.post(ENDPOINTS.CLEAR)
  return response.data
}

/**
 * Descarga la plantilla Excel con la estructura correcta.
 * Silencia errores 401/403 ya que requiere autenticación.
 *
 * @returns {Promise<void>} Inicia descarga del archivo
 */
export async function downloadTemplate() {
  try {
    const response = await api.get(ENDPOINTS.TEMPLATE, {
      responseType: 'blob',
      _silenceErrors: [401, 403],
      _skipAuthRetry: true
    })

    // Crear URL temporal y descargar
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla_mrp_forecast.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    // Silenciar errores de autenticación
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.warn('No autorizado para descargar plantilla')
      return
    }
    throw err
  }
}

/**
 * Valida un Excel y retorna preview sin importar.
 *
 * @param {File} file - Archivo Excel (.xlsx)
 * @returns {Promise<Object>} Validación con errores, advertencias y preview
 */
export async function previewExcel(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post(ENDPOINTS.PREVIEW, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data
}

/**
 * Hook helper para verificar si el modo temporal está activo.
 * Se puede usar en componentes para mostrar banner.
 *
 * @returns {Promise<boolean>} true si modo temporal está activo
 */
export async function isTempModeActive() {
  try {
    const status = await getTempDataStatus()
    return status.ok && status.active
  } catch {
    return false
  }
}

export default {
  importExcel,
  getTempDataStatus,
  clearTempData,
  downloadTemplate,
  previewExcel,
  isTempModeActive
}
