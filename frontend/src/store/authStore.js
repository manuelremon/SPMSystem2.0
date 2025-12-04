import { create } from 'zustand'
import * as authService from '../services/auth'
import { ensureCsrfToken, clearCsrfToken } from '../services/csrf'

/**
 * Auth Store
 *
 * Estrategia de autenticación: COOKIES ONLY
 * - Tokens (access/refresh) se manejan via cookies httpOnly
 * - NO almacenamos tokens en localStorage (vulnerables a XSS)
 * - Solo almacenamos CSRF token en localStorage (necesario para headers)
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null })

    // Limpiar CSRF previo antes de login (puede ser de otro usuario)
    clearCsrfToken()

    try {
      const response = await authService.login(username, password)

      // Obtener nuevo token CSRF para este usuario
      await ensureCsrfToken()

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
      return response
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message
      set({
        error: errorMsg,
        isLoading: false
      })
      throw error
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authService.register(userData)

      // Obtener CSRF para el nuevo usuario
      await ensureCsrfToken()

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
      return response
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message
      set({
        error: errorMsg,
        isLoading: false
      })
      throw error
    }
  },

  getCurrentUser: async () => {
    // Evitar llamadas múltiples simultáneas
    if (get().isLoading) return

    set({ isLoading: true })
    try {
      const response = await authService.getCurrentUser()
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
      return response
    } catch (error) {
      // El interceptor en api.js redirige a login si es 401
      // Solo actualizamos estado local
      clearCsrfToken()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      })
      // No re-throw - el redirect ya está manejado
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await authService.logout()
    } catch (error) {
      // Ignorar errores de logout - continuar limpieza local
    } finally {
      // Siempre limpiar estado local
      clearCsrfToken()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
    }
  },

  clearError: () => set({ error: null })
}))
