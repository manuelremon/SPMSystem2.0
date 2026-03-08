import { create } from 'zustand'
import api from '../services/api'

const CORE_MODULES = new Set(['solicitudes', 'admin'])

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
    const mod = modules.find(m => m.module_key === key)
    return mod ? mod.enabled : true
  },

  clearModules: () => set({ modules: [], isLoaded: false, isLoading: false }),
}))

// Granular selectors
export const useIsModuleEnabled = (key) => useModuleStore(s => s.isModuleEnabled(key))
export const useModulesLoaded = () => useModuleStore(s => s.isLoaded)
