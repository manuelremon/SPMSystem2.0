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

// Web Audio API para sonido de notificacion
let audioContext = null

/**
 * Verifica si el sonido esta habilitado en las preferencias del usuario
 * Se almacena en localStorage para acceso rapido
 */
function isSoundEnabled() {
  try {
    const prefs = localStorage.getItem('spm-notification-prefs')
    if (prefs) {
      const parsed = JSON.parse(prefs)
      return parsed.soundEnabled !== false // Default true
    }
  } catch {
    // Ignorar errores de parsing
  }
  return true // Habilitado por defecto
}

function playNotificationSound() {
  // Verificar preferencia de sonido
  if (!isSoundEnabled()) {
    return
  }

  try {
    // Crear contexto solo una vez
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }

    // Crear un beep corto y agradable
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Frecuencia agradable (C6 - 1046.5 Hz)
    oscillator.frequency.setValueAtTime(1046.5, audioContext.currentTime)
    oscillator.type = 'sine'

    // Volume fade out
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.15)
  } catch (err) {
    // Ignorar errores de audio (puede fallar si no hay interaccion previa)
    console.debug('Audio notification failed:', err)
  }
}

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
    toasts,
    setConnected,
    setConnectionError,
    setNotifications,
    addNotification,
    markAllNotificationsRead,
    removeNotification,
    setUnreadCount,
    addAlert,
    addToast,
    removeToast,
    emitEvent,
    registerEventHandler,
    unregisterEventHandler
  } = useRealtimeStore()

  // Handler para nuevas notificaciones desde SSE
  const handleNotification = useCallback((notification) => {
    if (!isMountedRef.current) return

    // Agregar al store
    addNotification(notification)

    // Mostrar toast para la notificacion nueva
    if (!notification.leido) {
      addToast({
        id: `toast_notif_${notification.id}`,
        message: notification.mensaje || "Nueva notificacion",
        type: notification.tipo || "info",
        solicitudId: notification.solicitud_id,
        duration: 5000 // Auto-dismiss despues de 5s
      })

      // Reproducir sonido de notificacion
      playNotificationSound()
    }

    // Emitir evento para handlers suscritos
    emitEvent('notification', notification)

    // Si es una notificacion de tipo especifico, emitir tambien ese evento
    if (notification.tipo) {
      emitEvent(`notification:${notification.tipo}`, notification)
    }
  }, [addNotification, addToast, emitEvent])

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
    if (hookUnreadCount !== undefined) {
      setUnreadCount(hookUnreadCount)
    }
  }, [hookUnreadCount, setUnreadCount])

  // Sincronizar las notificaciones del hook con el store
  useEffect(() => {
    if (hookNotifications && hookNotifications.length > 0) {
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
  // Nota: NO llamar markNotificationRead() aqui porque markAsRead() ya
  // actualiza hookUnreadCount, que se sincroniza al store via useEffect (linea 153).
  // Llamar ambos causaba doble decremento (10 -> 8 en vez de 10 -> 9).
  const handleMarkAsRead = useCallback(async (notificationId) => {
    const success = await markAsRead(notificationId)
    return success
  }, [markAsRead])

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

    // Toasts
    toasts,
    addToast,
    removeToast,

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
