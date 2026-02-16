/**
 * Hooks personalizados de la aplicación
 */

// useDebounced es un alias de useDebouncedValue (consolidación de hooks duplicados)
export { useDebouncedValue as useDebounced } from './useDebouncedValue'
export { useNotifications } from './useNotifications'
export {
  useRealtime,
  useRealtimeEvent,
  useRealtimeConnection,
  useRealtimeAlerts
} from './useRealtime'
export { usePlanner, renderSolicitante } from './usePlanner'
export { useParallax, parallaxPresets } from './useParallax'
