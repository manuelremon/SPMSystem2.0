/**
 * FMS Store - Zustand store for Fleet Management state
 */
import { create } from 'zustand'
import * as fmsService from '../services/fms'

export const useFmsStore = create((set, get) => ({
  // Vehicles
  vehicles: [],
  currentVehicle: null,
  vehiclesLoading: false,
  availableVehicles: [],

  // Drivers
  drivers: [],
  currentDriver: null,
  availableDrivers: [],

  // Work Orders
  workOrders: [],
  workOrdersTotal: 0,
  workOrdersPage: 1,
  workOrdersLoading: false,
  currentWorkOrder: null,

  // Inspections
  inspections: [],

  // KPIs
  kpis: null,
  kpisLoading: false,

  // Error
  error: null,

  // ==========================================================================
  // Vehicles Actions
  // ==========================================================================

  fetchVehicles: async (params = {}) => {
    set({ vehiclesLoading: true, error: null })
    try {
      const res = await fmsService.getVehicles(params)
      if (res.ok) set({ vehicles: res.data || [], vehiclesLoading: false })
      return res
    } catch (err) {
      set({ vehiclesLoading: false, error: err.message })
      return { ok: false }
    }
  },

  fetchVehicle: async (id) => {
    try {
      const res = await fmsService.getVehicle(id)
      if (res.ok) set({ currentVehicle: res.data })
      return res
    } catch (err) {
      set({ error: err.message })
      return { ok: false }
    }
  },

  createVehicle: async (data) => {
    try {
      const res = await fmsService.createVehicle(data)
      if (res.ok) {
        const { vehicles } = get()
        set({ vehicles: [res.data, ...vehicles] })
      }
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  fetchAvailableVehicles: async (params = {}) => {
    try {
      const res = await fmsService.getAvailableVehicles(params)
      if (res.ok) set({ availableVehicles: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // Drivers Actions
  // ==========================================================================

  fetchDrivers: async (params = {}) => {
    try {
      const res = await fmsService.getDrivers(params)
      if (res.ok) set({ drivers: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  fetchDriver: async (id) => {
    try {
      const res = await fmsService.getDriver(id)
      if (res.ok) set({ currentDriver: res.data })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  createDriver: async (data) => {
    try {
      const res = await fmsService.createDriver(data)
      if (res.ok) {
        const { drivers } = get()
        set({ drivers: [res.data, ...drivers] })
      }
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  fetchAvailableDrivers: async (params = {}) => {
    try {
      const res = await fmsService.getAvailableDrivers(params)
      if (res.ok) set({ availableDrivers: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // Work Orders Actions
  // ==========================================================================

  fetchWorkOrders: async (params = {}) => {
    set({ workOrdersLoading: true, error: null })
    try {
      const res = await fmsService.getWorkOrders(params)
      if (res.ok) {
        set({
          workOrders: res.data?.items || res.data || [],
          workOrdersTotal: res.data?.total || 0,
          workOrdersPage: res.data?.page || 1,
          workOrdersLoading: false,
        })
      }
      return res
    } catch (err) {
      set({ workOrdersLoading: false, error: err.message })
      return { ok: false }
    }
  },

  fetchWorkOrder: async (id) => {
    try {
      const res = await fmsService.getWorkOrder(id)
      if (res.ok) set({ currentWorkOrder: res.data })
      return res
    } catch (err) {
      set({ error: err.message })
      return { ok: false }
    }
  },

  createWorkOrder: async (data) => {
    try {
      const res = await fmsService.createWorkOrder(data)
      if (res.ok) {
        const { workOrders } = get()
        set({ workOrders: [res.data, ...workOrders] })
      }
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  transitionWorkOrder: async (id, estado, datos = {}) => {
    try {
      const res = await fmsService.transitionWorkOrder(id, estado, datos)
      if (res.ok) get().fetchWorkOrder(id)
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  // ==========================================================================
  // Inspections
  // ==========================================================================

  fetchInspections: async (params = {}) => {
    try {
      const res = await fmsService.getInspections(params)
      if (res.ok) set({ inspections: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // KPIs
  // ==========================================================================

  fetchKpis: async () => {
    set({ kpisLoading: true })
    try {
      const res = await fmsService.getFmsKpis()
      if (res.ok) set({ kpis: res.data, kpisLoading: false })
      return res
    } catch (err) {
      set({ kpisLoading: false })
      return { ok: false }
    }
  },

  // Reset
  reset: () => set({
    vehicles: [],
    currentVehicle: null,
    drivers: [],
    currentDriver: null,
    workOrders: [],
    currentWorkOrder: null,
    inspections: [],
    kpis: null,
    error: null,
  }),
}))
