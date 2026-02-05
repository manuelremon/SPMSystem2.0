/**
 * TMS Service - API calls for Transport Management System
 */
import api from './api'

const BASE = '/tms'

// =============================================================================
// Shipments
// =============================================================================

export const getShipments = (params = {}) =>
  api.get(`${BASE}/shipments`, { params }).then(r => r.data)

export const getShipment = (id) =>
  api.get(`${BASE}/shipments/${id}`).then(r => r.data)

export const createShipment = (data) =>
  api.post(`${BASE}/shipments`, data).then(r => r.data)

export const updateShipment = (id, data) =>
  api.put(`${BASE}/shipments/${id}`, data).then(r => r.data)

export const transitionShipment = (id, estado, razon = null) =>
  api.post(`${BASE}/shipments/${id}/transition`, { estado, razon }).then(r => r.data)

export const assignShipment = (id, data) =>
  api.post(`${BASE}/shipments/${id}/assign`, data).then(r => r.data)

export const deliverShipment = (id, data) =>
  api.post(`${BASE}/shipments/${id}/deliver`, data).then(r => r.data)

// =============================================================================
// Tracking
// =============================================================================

export const getShipmentTracking = (id) =>
  api.get(`${BASE}/shipments/${id}/tracking`).then(r => r.data)

export const addTrackingEvent = (id, data) =>
  api.post(`${BASE}/shipments/${id}/tracking`, data).then(r => r.data)

export const getInTransitShipments = () =>
  api.get(`${BASE}/tracking/in-transit`).then(r => r.data)

// =============================================================================
// Consolidation LTL
// =============================================================================

export const getConsolidations = (params = {}) =>
  api.get(`${BASE}/consolidations`, { params }).then(r => r.data)

export const createConsolidation = (data) =>
  api.post(`${BASE}/consolidations`, data).then(r => r.data)

export const getSuggestedConsolidations = (params = {}) =>
  api.get(`${BASE}/consolidations/suggest`, { params }).then(r => r.data)

export const addShipmentToConsolidation = (consolId, shipmentId) =>
  api.post(`${BASE}/consolidations/${consolId}/add-shipment`, { shipment_id: shipmentId }).then(r => r.data)

export const removeShipmentFromConsolidation = (consolId, shipmentId) =>
  api.post(`${BASE}/consolidations/${consolId}/remove-shipment`, { shipment_id: shipmentId }).then(r => r.data)

// =============================================================================
// Routes
// =============================================================================

export const getRoutes = (params = {}) =>
  api.get(`${BASE}/routes`, { params }).then(r => r.data)

export const getRoute = (id) =>
  api.get(`${BASE}/routes/${id}`).then(r => r.data)

export const createRoute = (data) =>
  api.post(`${BASE}/routes`, data).then(r => r.data)

export const updateRoute = (id, data) =>
  api.put(`${BASE}/routes/${id}`, data).then(r => r.data)

// =============================================================================
// Costs & Tariffs
// =============================================================================

export const getShipmentCosts = (id) =>
  api.get(`${BASE}/shipments/${id}/costs`).then(r => r.data)

export const addShipmentCost = (id, data) =>
  api.post(`${BASE}/shipments/${id}/costs`, data).then(r => r.data)

export const calculateFreight = (id) =>
  api.get(`${BASE}/shipments/${id}/calculate-freight`).then(r => r.data)

export const getTariffs = (params = {}) =>
  api.get(`${BASE}/tariffs`, { params }).then(r => r.data)

export const createTariff = (data) =>
  api.post(`${BASE}/tariffs`, data).then(r => r.data)

export const updateTariff = (id, data) =>
  api.put(`${BASE}/tariffs/${id}`, data).then(r => r.data)

// =============================================================================
// Settlements
// =============================================================================

export const getSettlements = (params = {}) =>
  api.get(`${BASE}/settlements`, { params }).then(r => r.data)

export const settleShipment = (id, data = {}) =>
  api.post(`${BASE}/shipments/${id}/settle`, data).then(r => r.data)

export const getShipmentSettlement = (id) =>
  api.get(`${BASE}/shipments/${id}/settlement`).then(r => r.data)

// =============================================================================
// Fuel
// =============================================================================

export const addFuelRecord = (data) =>
  api.post(`${BASE}/fuel`, data).then(r => r.data)

// =============================================================================
// Config & KPIs
// =============================================================================

export const getTmsConfig = () =>
  api.get(`${BASE}/config`).then(r => r.data)

export const updateTmsConfig = (key, value) =>
  api.put(`${BASE}/config/${key}`, { valor: value }).then(r => r.data)

export const getTmsKpis = () =>
  api.get(`${BASE}/kpis`).then(r => r.data)
