/**
 * useToast - Hook para mostrar toasts de forma sencilla
 *
 * Envuelve realtimeStore.addToast con una API simple:
 *   const toast = useToast()
 *   toast.success('Guardado correctamente')
 *   toast.error('Ocurrió un error')
 *   toast.info('Procesando...')
 *   toast.warning('Stock bajo')
 */

import { useCallback } from 'react'
import { useRealtimeStore } from '../store/realtimeStore'

const DEFAULT_DURATION = 4000

export function useToast() {
  const addToast = useRealtimeStore((s) => s.addToast)
  const removeToast = useRealtimeStore((s) => s.removeToast)

  const show = useCallback((message, type = 'info', options = {}) => {
    addToast({
      message,
      type,
      duration: options.duration ?? DEFAULT_DURATION,
      solicitudId: options.solicitudId,
    })
  }, [addToast])

  const success = useCallback((message, options) =>
    show(message, 'success', options), [show])

  const error = useCallback((message, options) =>
    show(message, 'error', { duration: 6000, ...options }), [show])

  const warning = useCallback((message, options) =>
    show(message, 'warning', options), [show])

  const info = useCallback((message, options) =>
    show(message, 'info', options), [show])

  return { show, success, error, warning, info, removeToast }
}

export default useToast
