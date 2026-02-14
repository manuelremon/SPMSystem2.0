/**
 * OC Service - API calls for Purchase Order (Ordenes de Compra) management
 */
import api from './api'

const BASE = '/ordenes-compra'

// =============================================================================
// CRUD
// =============================================================================

export const getOrdenes = (params = {}) =>
  api.get(BASE, { params }).then(r => r.data)

export const getOrden = (id) =>
  api.get(`${BASE}/${id}`).then(r => r.data)

export const createOrden = (data) =>
  api.post(BASE, data).then(r => r.data)

export const createOrdenDesdeSolicitud = (data) =>
  api.post(`${BASE}/desde-solicitud`, data).then(r => r.data)

// =============================================================================
// State transitions
// =============================================================================

export const cambiarEstadoOrden = (id, estado, razon = null) =>
  api.put(`${BASE}/${id}/estado`, { estado, razon }).then(r => r.data)

// =============================================================================
// Goods Receipt (Recepcion)
// =============================================================================

export const registrarRecepcion = (id, data) =>
  api.post(`${BASE}/${id}/recepcion`, data).then(r => r.data)

// =============================================================================
// Statistics & PDF
// =============================================================================

export const getEstadisticas = (params = {}) =>
  api.get(`${BASE}/estadisticas`, { params }).then(r => r.data)

export const getOrdenPdf = (id) =>
  api.get(`${BASE}/${id}/pdf`, { responseType: 'blob' }).then(r => r.data)
