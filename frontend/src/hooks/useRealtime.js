/**
 * Hook para tiempo real integrado con el store global
 *
 * Extiende useNotifications para:
 * - Integrar con realtimeStore
 * - Permitir suscripcion a eventos especificos
 * - Proveer estado unificado de tiempo real
 */

import { useEffect, useCallback, useRef } from 'react'
import { useRealtimeStore } from '../store/realtimeStore'
import { useNotifications } from './useNotifications'

/**
 * Hook principal de tiempo real
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Si el tiempo real esta habilitado
 * @param {string[]} options.subscriptions - Tipos de eventos a suscribir
 * @returns {Object} Estado y metodos de tiempo real
 */
export function useRealtime({ enabled = true, subscriptions = [] } = {}) {
  const isMountedRef = useRef(true)

  // Store de tiempo real
  const {
    isConnected,
    connectionError,
    notifications,
    unreadCount,
    alerts,
    setConnected,
    setConnectionError,
    setNotifications,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    setUnreadCount,
    addAlert,
    emitEvent,
    registerEventHandler,
    unregisterEventHandler
  } = useRealtimeStore()

  // Handler para nuevas notificaciones desde SSE
  const handleNotification = useCallback((notification) => {
    if (!isMountedRef.current) return

    // Agregar al store
    addNotification(notification)

    // Emitir evento para handlers suscritos
    emitEvent('notification', notification)

    // Si es una notificacion de tipo especifico, emitir tambien ese evento
    if (notification.tipo) {
      emitEvent(`notification:${notification.tipo}`, notification)
    }
  }, [addNotification, emitEvent])

  // Usar el hook de notificaciones existente
  const {
    isConnected: sseConnected,
    isLoading,
    error: sseError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    connect,
    disconnect,
    notifications: hookNotifications,
    unreadCount: hookUnreadCount
  } = useNotifications({
    enabled,
    onNotification: handleNotification
  })

  // Sincronizar el unreadCount del hook con el store
  useEffect(() => {
    if (hookUnreadCount !== undefined && hookUnreadCount !== unreadCount) {
      setUnreadCount(hookUnreadCount)
    }
  }, [hookUnreadCount, setUnreadCount])

  // Sincronizar las notificaciones del hook con el store (solo inicial)
  useEffect(() => {
    if (hookNotifications && hookNotifications.length > 0 && notifications.length === 0) {
      setNotifications(hookNotifications)
    }
  }, [hookNotifications, setNotifications])

  // Sincronizar estado de conexion con el store
  useEffect(() => {
    setConnected(sseConnected)
    if (sseError) {
      setConnectionError(sseError)
    }
  }, [sseConnected, sseError, setConnected, setConnectionError])

  // Wrapper para marcar como leida que actualiza el store
  const handleMarkAsRead = useCallback(async (notificationId) => {
    const success = await markAsRead(notificationId)
    if (success) {
      markNotificationRead(notificationId)
    }
    return success
  }, [markAsRead, markNotificationRead])

  // Wrapper para marcar todas como leidas
  const handleMarkAllAsRead = useCallback(async () => {
    const success = await markAllAsRead()
    if (success) {
      markAllNotificationsRead()
    }
    return success
  }, [markAllAsRead, markAllNotificationsRead])

  // Wrapper para eliminar
  const handleDeleteNotification = useCallback(async (notificationId) => {
    const success = await deleteNotification(notificationId)
    if (success) {
      removeNotification(notificationId)
    }
    return success
  }, [deleteNotification, removeNotification])

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    // Estado de conexion
    isConnected,
    connectionError,
    isLoading,

    // Notificaciones
    notifications,
    unreadCount,

    // Alertas
    alerts,
    addAlert,

    // Acciones de notificaciones
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
    refresh,

    // Control de conexion
    connect,
    disconnect,

    // Sistema de eventos
    subscribe: registerEventHandler,
    unsubscribe: unregisterEventHandler,
    emit: emitEvent
  }
}

/**
 * Hook para suscribirse a un tipo de evento especifico
 *
 * @param {string} eventType - Tipo de evento
 * @param {Function} handler - Handler a llamar
 * @param {Array} deps - Dependencias del handler
 */
export function useRealtimeEvent(eventType, handler, deps = []) {
  const { registerEventHandler, unregisterEventHandler } = useRealtimeStore()
  const handlerIdRef = useRef(`${eventType}_${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    const handlerId = handlerIdRef.current
    registerEventHandler(eventType, handlerId, handler)

    return () => {
      unregisterEventHandler(eventType, handlerId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, registerEventHandler, unregisterEventHandler, ...deps])
}

/**
 * Hook para obtener solo el estado de conexion
 */
export function useRealtimeConnection() {
  const { isConnected, connectionError } = useRealtimeStore()
  return { isConnected, connectionError }
}

/**
 * Hook para obtener solo las alertas
 */
export function useRealtimeAlerts() {
  const { alerts, addAlert, removeAlert, clearAlerts } = useRealtimeStore(
    (state) => ({
      alerts: state.alerts,
      addAlert: state.addAlert,
      removeAlert: state.removeAlert,
      clearAlerts: state.clearAlerts
    })
  )
  return { alerts, addAlert, removeAlert, clearAlerts }
}

export default useRealtime
