/**
 * TMS Store - Zustand store for Transport Management state
 */
import { create } from 'zustand'
import * as tmsService from '../services/tms'

export const useTmsStore = create((set, get) => ({
  // Shipments
  shipments: [],
  shipmentsTotal: 0,
  shipmentsPage: 1,
  shipmentsLoading: false,
  currentShipment: null,

  // Consolidations
  consolidations: [],
  suggestedConsolidations: [],

  // Routes
  routes: [],

  // Settlements
  settlements: [],
  settlementsTotal: 0,

  // Tariffs
  tariffs: [],

  // KPIs
  kpis: null,
  kpisLoading: false,

  // In-transit tracking
  inTransitShipments: [],

  // Error
  error: null,

  // ==========================================================================
  // Shipments Actions
  // ==========================================================================

  fetchShipments: async (params = {}) => {
    set({ shipmentsLoading: true, error: null })
    try {
      const res = await tmsService.getShipments(params)
      if (res.ok) {
        set({
          shipments: res.data?.items || res.data || [],
          shipmentsTotal: res.data?.total || 0,
          shipmentsPage: res.data?.page || 1,
          shipmentsLoading: false,
        })
      }
      return res
    } catch (err) {
      set({ shipmentsLoading: false, error: err.message })
      return { ok: false }
    }
  },

  fetchShipment: async (id) => {
    try {
      const res = await tmsService.getShipment(id)
      if (res.ok) set({ currentShipment: res.data })
      return res
    } catch (err) {
      set({ error: err.message })
      return { ok: false }
    }
  },

  createShipment: async (data) => {
    try {
      const res = await tmsService.createShipment(data)
      if (res.ok) {
        const { shipments } = get()
        set({ shipments: [res.data, ...shipments] })
      }
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  transitionShipment: async (id, estado, razon) => {
    try {
      const res = await tmsService.transitionShipment(id, estado, razon)
      if (res.ok) {
        // Refresh current shipment
        get().fetchShipment(id)
      }
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  assignShipment: async (id, data) => {
    try {
      const res = await tmsService.assignShipment(id, data)
      if (res.ok) get().fetchShipment(id)
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  // ==========================================================================
  // Tracking
  // ==========================================================================

  fetchInTransit: async () => {
    try {
      const res = await tmsService.getInTransitShipments()
      if (res.ok) set({ inTransitShipments: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // Consolidations
  // ==========================================================================

  fetchConsolidations: async (params = {}) => {
    try {
      const res = await tmsService.getConsolidations(params)
      if (res.ok) set({ consolidations: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  fetchSuggestedConsolidations: async () => {
    try {
      const res = await tmsService.getSuggestedConsolidations()
      if (res.ok) set({ suggestedConsolidations: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // Routes
  // ==========================================================================

  fetchRoutes: async () => {
    try {
      const res = await tmsService.getRoutes()
      if (res.ok) set({ routes: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // Tariffs
  // ==========================================================================

  fetchTariffs: async () => {
    try {
      const res = await tmsService.getTariffs()
      if (res.ok) set({ tariffs: res.data || [] })
      return res
    } catch (err) {
      return { ok: false }
    }
  },

  // ==========================================================================
  // Settlements
  // ==========================================================================

  fetchSettlements: async (params = {}) => {
    try {
      const res = await tmsService.getSettlements(params)
      if (res.ok) {
        set({
          settlements: res.data?.items || res.data || [],
          settlementsTotal: res.data?.total || 0,
        })
      }
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
      const res = await tmsService.getTmsKpis()
      if (res.ok) set({ kpis: res.data, kpisLoading: false })
      return res
    } catch (err) {
      set({ kpisLoading: false })
      return { ok: false }
    }
  },

  // Reset
  reset: () => set({
    shipments: [],
    shipmentsTotal: 0,
    currentShipment: null,
    consolidations: [],
    routes: [],
    settlements: [],
    tariffs: [],
    kpis: null,
    error: null,
  }),
}))
