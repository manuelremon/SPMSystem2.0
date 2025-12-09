import { create } from 'zustand'

/**
 * Real-time Store
 *
 * Estado global para eventos en tiempo real.
 * Maneja notificaciones, alertas, y eventos del sistema.
 */
export const useRealtimeStore = create((set, get) => ({
  // Estado de conexion
  isConnected: false,
  connectionError: null,

  // Notificaciones
  notifications: [],
  unreadCount: 0,

  // Alertas del sistema (MRP, SLA, etc.)
  alerts: [],

  // Eventos recientes (para debug/monitoring)
  recentEvents: [],

  // Callbacks registrados por componentes
  _eventHandlers: {},

  // ==================== Conexion ====================

  setConnected: (isConnected) => set({ isConnected, connectionError: null }),

  setConnectionError: (error) => set({
    isConnected: false,
    connectionError: error
  }),

  // ==================== Notificaciones ====================

  setNotifications: (notifications) => set({ notifications }),

  addNotification: (notification) => set((state) => {
    // Evitar duplicados
    if (state.notifications.some(n => n.id === notification.id)) {
      return state
    }
    return {
      notifications: [notification, ...state.notifications].slice(0, 100), // Max 100
      unreadCount: notification.leido ? state.unreadCount : state.unreadCount + 1
    }
  }),

  markNotificationRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === notificationId ? { ...n, leido: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),

  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, leido: true })),
    unreadCount: 0
  })),

  removeNotification: (notificationId) => set((state) => {
    const notif = state.notifications.find(n => n.id === notificationId)
    return {
      notifications: state.notifications.filter(n => n.id !== notificationId),
      unreadCount: notif && !notif.leido
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount
    }
  }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  // ==================== Alertas ====================

  addAlert: (alert) => set((state) => {
    // Evitar duplicados por id
    if (alert.id && state.alerts.some(a => a.id === alert.id)) {
      return state
    }
    return {
      alerts: [
        { ...alert, timestamp: alert.timestamp || Date.now() },
        ...state.alerts
      ].slice(0, 50) // Max 50 alertas
    }
  }),

  removeAlert: (alertId) => set((state) => ({
    alerts: state.alerts.filter(a => a.id !== alertId)
  })),

  clearAlerts: () => set({ alerts: [] }),

  // ==================== Eventos ====================

  /**
   * Registrar un handler para un tipo de evento
   * @param {string} eventType - Tipo de evento (ej: 'solicitud_nueva', 'mrp_alert')
   * @param {string} handlerId - ID unico del handler (para cleanup)
   * @param {Function} handler - Funcion a llamar cuando llega el evento
   */
  registerEventHandler: (eventType, handlerId, handler) => set((state) => ({
    _eventHandlers: {
      ...state._eventHandlers,
      [eventType]: {
        ...(state._eventHandlers[eventType] || {}),
        [handlerId]: handler
      }
    }
  })),

  /**
   * Desregistrar un handler
   */
  unregisterEventHandler: (eventType, handlerId) => set((state) => {
    const handlers = { ...(state._eventHandlers[eventType] || {}) }
    delete handlers[handlerId]
    return {
      _eventHandlers: {
        ...state._eventHandlers,
        [eventType]: handlers
      }
    }
  }),

  /**
   * Emitir un evento a todos los handlers registrados
   */
  emitEvent: (eventType, data) => {
    const state = get()
    const handlers = state._eventHandlers[eventType] || {}

    // Agregar a eventos recientes (para debug)
    set((s) => ({
      recentEvents: [
        { type: eventType, data, timestamp: Date.now() },
        ...s.recentEvents
      ].slice(0, 20) // Max 20 eventos recientes
    }))

    // Llamar a todos los handlers registrados
    Object.values(handlers).forEach(handler => {
      try {
        handler(data)
      } catch (err) {
        console.error(`Error in event handler for ${eventType}:`, err)
      }
    })
  },

  // ==================== Reset ====================

  reset: () => set({
    isConnected: false,
    connectionError: null,
    notifications: [],
    unreadCount: 0,
    alerts: [],
    recentEvents: [],
    _eventHandlers: {}
  })
}))

export default useRealtimeStore
