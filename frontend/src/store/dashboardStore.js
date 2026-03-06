/**
 * Dashboard Store - Estado global para dashboards editables
 */

import { create } from 'zustand';
import {
  dashboardService,
  sheetService,
  shareService,
  datasourceService,
  grupoService,
} from '../services/dashboard';

export const useDashboardStore = create((set, get) => ({
  // Estado
  dashboards: [],
  currentDashboard: null,
  grupos: [],
  isLoading: false,
  isSaving: false,
  error: null,
  hasChanges: false,

  // Cambios pendientes (para auto-save)
  pendingChanges: null,

  // ===== Dashboards =====

  /**
   * Carga la lista de dashboards
   */
  fetchDashboards: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await dashboardService.list(params);
      set({
        dashboards: response.dashboards || [],
        isLoading: false,
      });
      return response.dashboards;
    } catch (error) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Carga un dashboard especifico
   */
  fetchDashboard: async (uuid) => {
    set({ isLoading: true, error: null, hasChanges: false });
    try {
      const response = await dashboardService.get(uuid);
      set({
        currentDashboard: response.dashboard,
        isLoading: false,
      });
      return response;
    } catch (error) {
      set({
        error: error.message,
        isLoading: false,
        currentDashboard: null,
      });
      throw error;
    }
  },

  /**
   * Crea un nuevo dashboard
   */
  createDashboard: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const response = await dashboardService.create(data);
      if (response.ok && response.dashboard) {
        set((state) => ({
          dashboards: [response.dashboard, ...state.dashboards],
          isSaving: false,
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message, isSaving: false });
      throw error;
    }
  },

  /**
   * Actualiza un dashboard
   */
  updateDashboard: async (uuid, data) => {
    set({ isSaving: true, error: null });
    try {
      const response = await dashboardService.update(uuid, data);
      if (response.ok && response.dashboard) {
        set((state) => ({
          currentDashboard:
            state.currentDashboard?.uuid === uuid
              ? response.dashboard
              : state.currentDashboard,
          dashboards: state.dashboards.map((d) =>
            d.uuid === uuid ? response.dashboard : d
          ),
          isSaving: false,
          hasChanges: false,
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message, isSaving: false });
      throw error;
    }
  },

  /**
   * Elimina un dashboard
   */
  deleteDashboard: async (uuid) => {
    try {
      const response = await dashboardService.delete(uuid);
      if (response.ok) {
        set((state) => ({
          dashboards: state.dashboards.filter((d) => d.uuid !== uuid),
          currentDashboard:
            state.currentDashboard?.uuid === uuid ? null : state.currentDashboard,
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Toggle favorito
   */
  toggleFavorite: async (uuid) => {
    try {
      const response = await dashboardService.toggleFavorite(uuid);
      if (response.ok) {
        set((state) => ({
          currentDashboard:
            state.currentDashboard?.uuid === uuid
              ? { ...state.currentDashboard, es_favorito: response.es_favorito }
              : state.currentDashboard,
          dashboards: state.dashboards.map((d) =>
            d.uuid === uuid ? { ...d, es_favorito: response.es_favorito } : d
          ),
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // ===== Sheets =====

  /**
   * Actualiza datos de una hoja
   */
  updateSheet: async (sheetId, data) => {
    set({ isSaving: true });
    try {
      const response = await sheetService.update(sheetId, data);
      set({ isSaving: false, hasChanges: false });
      return response;
    } catch (error) {
      set({ error: error.message, isSaving: false });
      throw error;
    }
  },

  /**
   * Agrega una hoja
   */
  addSheet: async (nombre) => {
    const { currentDashboard } = get();
    if (!currentDashboard) return null;

    set({ isSaving: true });
    try {
      const response = await sheetService.add(currentDashboard.uuid, nombre);
      if (response.ok && response.sheet) {
        set((state) => ({
          currentDashboard: {
            ...state.currentDashboard,
            sheets: [...(state.currentDashboard?.sheets || []), response.sheet],
          },
          isSaving: false,
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message, isSaving: false });
      throw error;
    }
  },

  /**
   * Elimina una hoja
   */
  deleteSheet: async (sheetId) => {
    try {
      const response = await sheetService.delete(sheetId);
      if (response.ok) {
        set((state) => ({
          currentDashboard: {
            ...state.currentDashboard,
            sheets: state.currentDashboard?.sheets?.filter((s) => s.id !== sheetId) || [],
          },
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // ===== Comparticion =====

  /**
   * Crea un link de comparticion
   */
  createShare: async (options = {}) => {
    const { currentDashboard } = get();
    if (!currentDashboard) return null;

    try {
      return await shareService.create(currentDashboard.uuid, options);
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Lista shares
   */
  listShares: async () => {
    const { currentDashboard } = get();
    if (!currentDashboard) return { shares: [] };

    try {
      return await shareService.list(currentDashboard.uuid);
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Revoca share
   */
  revokeShare: async (shareId) => {
    try {
      return await shareService.revoke(shareId);
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // ===== Datasources =====

  /**
   * Agrega una fuente de datos
   */
  addDatasource: async (data) => {
    const { currentDashboard } = get();
    if (!currentDashboard) return null;

    try {
      const response = await datasourceService.add(currentDashboard.uuid, data);
      if (response.ok && response.datasource) {
        set((state) => ({
          currentDashboard: {
            ...state.currentDashboard,
            datasources: [
              ...(state.currentDashboard?.datasources || []),
              response.datasource,
            ],
          },
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Elimina una fuente de datos
   */
  removeDatasource: async (datasourceId) => {
    try {
      const response = await datasourceService.delete(datasourceId);
      if (response.ok) {
        set((state) => ({
          currentDashboard: {
            ...state.currentDashboard,
            datasources:
              state.currentDashboard?.datasources?.filter((d) => d.id !== datasourceId) || [],
          },
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // ===== Grupos =====

  /**
   * Carga grupos
   */
  fetchGrupos: async () => {
    try {
      const response = await grupoService.list();
      set({ grupos: response.grupos || [] });
      return response.grupos;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Crea grupo
   */
  createGrupo: async (data) => {
    try {
      const response = await grupoService.create(data);
      if (response.ok && response.grupo) {
        set((state) => ({
          grupos: [...state.grupos, response.grupo],
        }));
      }
      return response;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // ===== Utilidades =====

  /**
   * Marca cambios pendientes
   */
  setHasChanges: (hasChanges) => set({ hasChanges }),

  /**
   * Guarda cambios pendientes en memoria
   */
  setPendingChanges: (changes) => set({ pendingChanges: changes, hasChanges: true }),

  /**
   * Limpia el dashboard actual
   */
  clearCurrentDashboard: () =>
    set({
      currentDashboard: null,
      hasChanges: false,
      pendingChanges: null,
    }),

  /**
   * Limpia errores
   */
  clearError: () => set({ error: null }),
}));

// Granular selectors
export const useDashboards = () => useDashboardStore(s => s.dashboards);
export const useCurrentDashboard = () => useDashboardStore(s => s.currentDashboard);
export const useDashboardLoading = () => useDashboardStore(s => s.isLoading);
export const useDashboardError = () => useDashboardStore(s => s.error);
