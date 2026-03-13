/**
 * Configuración de estilos unificados para el sistema SPM
 * Incluye: Estados, Criticidad, y estilos de botones
 *
 * Colores alineados con CSS variables de index.css
 */

import {
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Package,
  Truck,
  Archive,
  AlertTriangle,
  AlertCircle,
  FileText,
  Pause,
  Play
} from "../components/ui/Icons";

// ═══════════════════════════════════════════════════════════════
// PALETA SEMÁNTICA — Single source of truth
// Referencia: index.css CSS variables
// ═══════════════════════════════════════════════════════════════
const COLORS = {
  neutral:      "var(--neutral)",          // #64748b
  neutralMuted: "var(--fg-subtle)",        // #94a3b8
  cyan:         "var(--cyan)",             // #06b6d4
  cyanDark:     "var(--cyan-dark)",        // #0891b2
  info:         "var(--info)",             // #0284c7
  primary:      "var(--primary)",          // #0070f3
  orange:       "var(--warning-light)",    // #f59e0b
  orangeDark:   "var(--warning-text)",     // #b45309
  success:      "var(--success)",          // #16a34a
  successDark:  "var(--success-text)",     // #15803d
  successLight: "var(--success-light)",    // #22c55e
  danger:       "var(--danger)",           // #dc2626
  dangerDark:   "var(--danger-text)",      // #b91c1c
  warning:      "var(--warning)",          // #d97706
  purple:       "var(--purple-dark)",      // #7c3aed
};

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ESTADOS
// ═══════════════════════════════════════════════════════════════
const estadoBase = {
  borrador:       { color: COLORS.neutral,      icon: FileText,    label: "Borrador" },
  enviada:        { color: COLORS.cyan,          icon: Send,        label: "Enviada" },
  pendiente:      { color: COLORS.info,          icon: Clock,       label: "Pendiente" },
  en_proceso:     { color: COLORS.warning,       icon: Play,        label: "En Proceso" },
  aprobada:       { color: COLORS.successDark,   icon: CheckCircle, label: "Aprobada" },
  completada:     { color: COLORS.success,       icon: CheckCircle, label: "Completada" },
  rechazada:      { color: COLORS.danger,        icon: XCircle,     label: "Rechazada" },
  en_despacho:    { color: COLORS.orange,        icon: Package,     label: "En Despacho" },
  despachada:     { color: COLORS.cyanDark,      icon: Truck,       label: "Despachada" },
  cerrada:        { color: COLORS.successDark,   icon: Archive,     label: "Cerrada" },
  cancelada:      { color: COLORS.dangerDark,    icon: XCircle,     label: "Cancelada" },
  en_pausa:       { color: COLORS.neutralMuted,  icon: Pause,       label: "En Pausa" },
  en_tratamiento: { color: COLORS.purple,        icon: Package,     label: "En tratamiento" },
  tratado:        { color: COLORS.successLight,  icon: CheckCircle, label: "Tratado" },
  activo:         { color: COLORS.successDark,   icon: CheckCircle, label: "Activo" },
  inactivo:       { color: COLORS.neutralMuted,  icon: Pause,       label: "Inactivo" },
  suspendido:     { color: COLORS.dangerDark,    icon: XCircle,     label: "Suspendido" },
};

export const estadoConfig = {
  // Estados con mayúscula (UI)
  "Borrador":              estadoBase.borrador,
  "Draft":                 estadoBase.borrador,
  "Enviada":               estadoBase.enviada,
  "Submitted":             estadoBase.enviada,
  "Pendiente":             estadoBase.pendiente,
  "Pending":               estadoBase.pendiente,
  "Pendiente_de_Aprobacion": estadoBase.pendiente,
  "En Proceso":            estadoBase.en_proceso,
  "Processing":            estadoBase.en_proceso,
  "En Progreso":           estadoBase.en_proceso,
  "Aprobada":              estadoBase.aprobada,
  "Approved":              estadoBase.aprobada,
  "Completada":            estadoBase.completada,
  "Completed":             estadoBase.completada,
  "Rechazada":             estadoBase.rechazada,
  "Rejected":              estadoBase.rechazada,
  "En Despacho":           estadoBase.en_despacho,
  "Dispatching":           estadoBase.en_despacho,
  "Despachada":            estadoBase.despachada,
  "Dispatched":            estadoBase.despachada,
  "Cerrada":               estadoBase.cerrada,
  "Closed":                estadoBase.cerrada,
  "Cancelada":             estadoBase.cancelada,
  "Cancelled":             estadoBase.cancelada,
  "En Pausa":              estadoBase.en_pausa,
  "On Hold":               estadoBase.en_pausa,
  "En Tratamiento":        estadoBase.en_tratamiento,
  "Tratado":               estadoBase.tratado,
  "Treated":               estadoBase.tratado,
  // Estados en minúsculas (desde BD)
  "draft":                 estadoBase.borrador,
  "submitted":             estadoBase.enviada,
  "pending":               estadoBase.pendiente,
  "processing":            estadoBase.en_proceso,
  "in_planning":           estadoBase.en_proceso,
  "in_treatment":          estadoBase.en_tratamiento,
  "treated":               estadoBase.tratado,
  "approved":              estadoBase.aprobada,
  "completed":             estadoBase.completada,
  "closed":                estadoBase.cerrada,
  "rejected":              estadoBase.rechazada,
  "dispatched":            estadoBase.despachada,
  "cancelled":             estadoBase.cancelada,
  // Estados genéricos
  "Activo":                estadoBase.activo,
  "Active":                estadoBase.activo,
  "Inactivo":              estadoBase.inactivo,
  "Inactive":              estadoBase.inactivo,
  "Suspendido":            estadoBase.suspendido,
  "Suspended":             estadoBase.suspendido,
};

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CRITICIDAD
// ═══════════════════════════════════════════════════════════════
export const criticidadConfig = {
  "Urgente": { color: COLORS.danger,  icon: AlertTriangle, label: "Urgente" },
  "Urgent":  { color: COLORS.danger,  icon: AlertTriangle, label: "Urgente" },
  "Alta":    { color: COLORS.danger,  icon: AlertCircle,   label: "Alta" },
  "High":    { color: COLORS.danger,  icon: AlertCircle,   label: "Alta" },
  "Normal":  { color: COLORS.primary, icon: Clock,         label: "Normal" },
  "Medium":  { color: COLORS.primary, icon: Clock,         label: "Normal" },
  "Baja":    { color: COLORS.success, icon: Clock,         label: "Baja" },
  "Low":     { color: COLORS.success, icon: Clock,         label: "Baja" },
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Obtener configuración de estado
// ═══════════════════════════════════════════════════════════════
export function getEstadoConfig(estado) {
  if (!estado) return estadoConfig["Pendiente"];
  return estadoConfig[estado] || estadoConfig["Pendiente"];
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Obtener configuración de criticidad
// ═══════════════════════════════════════════════════════════════
export function getCriticidadConfig(criticidad) {
  if (!criticidad) return criticidadConfig["Normal"];
  return criticidadConfig[criticidad] || criticidadConfig["Normal"];
}
