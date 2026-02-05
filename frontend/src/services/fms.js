/**
 * FMS Service - API calls for Fleet Management System
 */
import api from './api'

const BASE = '/fms'

// =============================================================================
// Vehicles
// =============================================================================

export const getVehicles = (params = {}) =>
  api.get(`${BASE}/vehicles`, { params }).then(r => r.data)

export const getVehicle = (id) =>
  api.get(`${BASE}/vehicles/${id}`).then(r => r.data)

export const createVehicle = (data) =>
  api.post(`${BASE}/vehicles`, data).then(r => r.data)

export const updateVehicle = (id, data) =>
  api.put(`${BASE}/vehicles/${id}`, data).then(r => r.data)

export const changeVehicleStatus = (id, estado) =>
  api.post(`${BASE}/vehicles/${id}/status`, { estado }).then(r => r.data)

export const getAvailableVehicles = (params = {}) =>
  api.get(`${BASE}/vehicles/available`, { params }).then(r => r.data)

// =============================================================================
// Drivers
// =============================================================================

export const getDrivers = (params = {}) =>
  api.get(`${BASE}/drivers`, { params }).then(r => r.data)

export const getDriver = (id) =>
  api.get(`${BASE}/drivers/${id}`).then(r => r.data)

export const createDriver = (data) =>
  api.post(`${BASE}/drivers`, data).then(r => r.data)

export const updateDriver = (id, data) =>
  api.put(`${BASE}/drivers/${id}`, data).then(r => r.data)

export const getAvailableDrivers = (params = {}) =>
  api.get(`${BASE}/drivers/available`, { params }).then(r => r.data)

// =============================================================================
// Work Orders
// =============================================================================

export const getWorkOrders = (params = {}) =>
  api.get(`${BASE}/work-orders`, { params }).then(r => r.data)

export const getWorkOrder = (id) =>
  api.get(`${BASE}/work-orders/${id}`).then(r => r.data)

export const createWorkOrder = (data) =>
  api.post(`${BASE}/work-orders`, data).then(r => r.data)

export const transitionWorkOrder = (id, estado, datos = {}) =>
  api.post(`${BASE}/work-orders/${id}/transition`, { estado, ...datos }).then(r => r.data)

export const addWorkOrderPart = (id, data) =>
  api.post(`${BASE}/work-orders/${id}/parts`, data).then(r => r.data)

export const requestPartFromSPM = (id, data) =>
  api.post(`${BASE}/work-orders/${id}/request-part`, data).then(r => r.data)

// =============================================================================
// Maintenance Plans
// =============================================================================

export const getMaintenancePlans = (vehicleId) =>
  api.get(`${BASE}/vehicles/${vehicleId}/maintenance-plans`).then(r => r.data)

export const createMaintenancePlan = (vehicleId, data) =>
  api.post(`${BASE}/vehicles/${vehicleId}/maintenance-plans`, data).then(r => r.data)

export const updateMaintenancePlan = (planId, data) =>
  api.put(`${BASE}/maintenance-plans/${planId}`, data).then(r => r.data)

export const evaluatePreventiveMaintenance = () =>
  api.post(`${BASE}/maintenance/evaluate`).then(r => r.data)

// =============================================================================
// Inspections
// =============================================================================

export const getInspections = (params = {}) =>
  api.get(`${BASE}/inspections`, { params }).then(r => r.data)

export const getInspection = (id) =>
  api.get(`${BASE}/inspections/${id}`).then(r => r.data)

export const createInspection = (data) =>
  api.post(`${BASE}/inspections`, data).then(r => r.data)

export const completeInspection = (id, data) =>
  api.post(`${BASE}/inspections/${id}/complete`, data).then(r => r.data)

// =============================================================================
// Documents
// =============================================================================

export const getVehicleDocuments = (vehicleId) =>
  api.get(`${BASE}/vehicles/${vehicleId}/documents`).then(r => r.data)

export const addVehicleDocument = (vehicleId, data) =>
  api.post(`${BASE}/vehicles/${vehicleId}/documents`, data).then(r => r.data)

export const getExpiringDocuments = (params = {}) =>
  api.get(`${BASE}/documents/expiring`, { params }).then(r => r.data)

// =============================================================================
// KPIs
// =============================================================================

export const getFmsKpis = () =>
  api.get(`${BASE}/kpis`).then(r => r.data)
