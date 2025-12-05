/**
 * Hook para notificaciones en tiempo real via SSE
 *
 * Características:
 * - Conexión SSE al endpoint /api/notificaciones/stream
 * - Reconexión automática con backoff exponencial
 * - Fallback a polling si SSE no está disponible
 * - Limpieza automática al desmontar
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Configuración
const SSE_RECONNECT_BASE_DELAY = 1000 // 1 segundo inicial
const SSE_RECONNECT_MAX_DELAY = 30000 // 30 segundos máximo
const POLLING_INTERVAL = 30000 // 30 segundos para fallback polling

/**
 * Hook para gestionar notificaciones en tiempo real
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Si las notificaciones están habilitadas
 * @param {Function} options.onNotification - Callback cuando llega nueva notificación
 * @returns {Object} Estado y métodos de notificaciones
 */
export function useNotifications({ enabled = true, onNotification } = {}) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Refs para manejar reconexión y cleanup
  const eventSourceRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const pollingIntervalRef = useRef(null)
  const isMountedRef = useRef(true)

  /**
   * Obtener notificaciones del servidor (polling/inicial)
   */
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!isMountedRef.current) return

    setIsLoading(true)
    try {
      const response = await api.get('/notificaciones', {
        params: { unread_only: unreadOnly, limit: 50 }
      })

      if (isMountedRef.current && response.data?.ok) {
        setNotifications(response.data.notifications || [])
        setUnreadCount(response.data.unread_count || 0)
        setError(null)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Error al cargar notificaciones')
        console.error('Error fetching notifications:', err)
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  /**
   * Marcar notificación como leída
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.post(`/notificaciones/${notificationId}/marcar-leida`)

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, leido: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))

      return true
    } catch (err) {
      console.error('Error marking notification as read:', err)
      return false
    }
  }, [])

  /**
   * Marcar todas como leídas
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/notificaciones/marcar-todas-leidas')

      setNotifications(prev => prev.map(n => ({ ...n, leido: true })))
      setUnreadCount(0)

      return true
    } catch (err) {
      console.error('Error marking all as read:', err)
      return false
    }
  }, [])

  /**
   * Eliminar notificación
   */
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notificaciones/${notificationId}`)

      setNotifications(prev => {
        const notif = prev.find(n => n.id === notificationId)
        if (notif && !notif.leido) {
          setUnreadCount(c => Math.max(0, c - 1))
        }
        return prev.filter(n => n.id !== notificationId)
      })

      return true
    } catch (err) {
      console.error('Error deleting notification:', err)
      return false
    }
  }, [])

  /**
   * Conectar a SSE stream
   */
  const connectSSE = useCallback(() => {
    if (!enabled || eventSourceRef.current) return

    try {
      // Construir URL del stream
      const streamUrl = `${API_BASE_URL}/notificaciones/stream`

      // Crear EventSource
      // Nota: EventSource no envía cookies por defecto en cross-origin
      // Si el backend está en otro dominio, usar withCredentials polyfill
      const eventSource = new EventSource(streamUrl, {
        withCredentials: true
      })

      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (isMountedRef.current) {
          setIsConnected(true)
          setError(null)
          reconnectAttempts.current = 0
          // Detener polling si estaba activo
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }
      }

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return

        try {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            console.debug('SSE connected:', data.user_id)
            return
          }

          if (data.type === 'notification' || data.id) {
            // Nueva notificación recibida
            const notification = data.data || data

            setNotifications(prev => {
              // Evitar duplicados
              if (prev.some(n => n.id === notification.id)) {
                return prev
              }
              return [notification, ...prev]
            })

            if (!notification.leido) {
              setUnreadCount(c => c + 1)
            }

            // Callback opcional
            if (onNotification) {
              onNotification(notification)
            }
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('SSE error:', err)

        if (isMountedRef.current) {
          setIsConnected(false)

          // Cerrar conexión actual
          eventSource.close()
          eventSourceRef.current = null

          // Reconectar con backoff exponencial
          const delay = Math.min(
            SSE_RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
            SSE_RECONNECT_MAX_DELAY
          )

          reconnectAttempts.current++

          // Si muchos intentos fallidos, activar fallback a polling
          if (reconnectAttempts.current > 5) {
            setError('Conexión inestable, usando modo polling')
            startPolling()
            return
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && enabled) {
              connectSSE()
            }
          }, delay)
        }
      }
    } catch (err) {
      console.error('Error creating EventSource:', err)
      setError('SSE no disponible')
      startPolling()
    }
  }, [enabled, onNotification])

  /**
   * Iniciar fallback polling
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    // Fetch inicial
    fetchNotifications()

    // Polling periódico
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        fetchNotifications()
      }
    }, POLLING_INTERVAL)
  }, [fetchNotifications])

  /**
   * Desconectar SSE
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    setIsConnected(false)
  }, [])

  // Efecto para conectar/desconectar
  useEffect(() => {
    isMountedRef.current = true

    if (enabled) {
      // Cargar notificaciones iniciales
      fetchNotifications()

      // Intentar conectar SSE
      // Nota: SSE puede no funcionar si el navegador no lo soporta
      // o si hay problemas de CORS
      if (typeof EventSource !== 'undefined') {
        connectSSE()
      } else {
        // Fallback a polling si EventSource no está disponible
        startPolling()
      }
    }

    return () => {
      isMountedRef.current = false
      disconnect()
    }
  }, [enabled, fetchNotifications, connectSSE, startPolling, disconnect])

  return {
    // Estado
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    error,

    // Acciones
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,

    // Control de conexión
    connect: connectSSE,
    disconnect
  }
}

export default useNotifications
