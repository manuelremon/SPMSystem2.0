import { create } from 'zustand'
import api from '../services/api'

const CORE_MODULES = new Set(['solicitudes', 'admin'])

// Prefijos de ruta que pertenecen a cada modulo toggleable.
// Si el modulo esta deshabilitado, ProtectedRoute bloquea estas rutas.
// Submodulos usan clave "padre.hijo" y se listan antes que su padre.
const MODULE_ROUTE_PREFIXES = {
  'planificacion.kanban': ['/operations/kanban'],
  'planificacion.mps': ['/operations/production'],
  'inventario.vmi': ['/operations/vmi'],
  'inventario.consignacion': ['/operations/consignment'],
  'inventario.lotes': ['/operations/lots'],
  'inventario.retiros': ['/operations/recalls'],
  'inventario.conteo_ciclico': ['/operations/cycle-count'],
  'inventario.ubicaciones': ['/operations/putaway'],
  'inventario.slob': ['/operations/slob'],
  compras: ['/procurement', '/admin/supplier-portal', '/admin/supplier-onboarding'],
  logistica: ['/tms', '/fms', '/operations/customs', '/operations/packaging', '/operations/returns', '/operations/warranty'],
  calidad: ['/quality', '/engineering', '/operations/kitting'],
}

export const getModuleForPath = (pathname) => {
  for (const [key, prefixes] of Object.entries(MODULE_ROUTE_PREFIXES)) {
    if (prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))) return key
  }
  return null
}

export const useModuleStore = create((set, get) => ({
  modules: [],
  isLoaded: false,
  isLoading: false,

  fetchModules: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const res = await api.get('/admin/modules')
      set({ modules: res.data.modules || [], isLoaded: true, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  updateModules: async (modulesData) => {
    const res = await api.put('/admin/modules', { modules: modulesData })
    set({ modules: res.data.modules || [] })
    return res.data
  },

  isModuleEnabled: (key) => {
    if (CORE_MODULES.has(key)) return true
    const { modules, isLoaded } = get()
    if (!isLoaded) return true
    // Un submodulo ("padre.hijo") queda deshabilitado si su padre lo esta
    const dot = key.indexOf('.')
    if (dot > 0 && !get().isModuleEnabled(key.slice(0, dot))) return false
    const mod = modules.find(m => m.module_key === key)
    return mod ? mod.enabled : true
  },

  // true si la ruta no pertenece a un modulo deshabilitado
  isPathEnabled: (pathname) => {
    const key = getModuleForPath(pathname)
    return key ? get().isModuleEnabled(key) : true
  },

  clearModules: () => set({ modules: [], isLoaded: false, isLoading: false }),
}))

// Granular selectors
export const useIsModuleEnabled = (key) => useModuleStore(s => s.isModuleEnabled(key))
export const useModulesLoaded = () => useModuleStore(s => s.isLoaded)
