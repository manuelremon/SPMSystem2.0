/**
 * Configuración de estilos unificados para el sistema SPM
 * Incluye: Estados, Criticidad, y estilos de botones
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
// CONFIGURACIÓN DE ESTADOS
// ═══════════════════════════════════════════════════════════════
export const estadoConfig = {
  // Estados de Solicitudes
  "Borrador": {
    color: "#6b7280",
    icon: FileText,
    label: "Borrador"
  },
  "Draft": {
    color: "#6b7280",
    icon: FileText,
    label: "Borrador"
  },
  "Enviada": {
    color: "#06b6d4",
    icon: Send,
    label: "Enviada"
  },
  "Submitted": {
    color: "#06b6d4",
    icon: Send,
    label: "Enviada"
  },
  "Pendiente": {
    color: "#1e40af",
    icon: Clock,
    label: "Pendiente"
  },
  "Pending": {
    color: "#1e40af",
    icon: Clock,
    label: "Pendiente"
  },
  "Pendiente_de_Aprobacion": {
    color: "#1e40af",
    icon: Clock,
    label: "Pendiente"
  },
  "En Proceso": {
    color: "#ea580c",
    icon: Play,
    label: "En Proceso"
  },
  "Processing": {
    color: "#ea580c",
    icon: Play,
    label: "En Proceso"
  },
  "En Progreso": {
    color: "#ea580c",
    icon: Play,
    label: "En Proceso"
  },
  "Aprobada": {
    color: "#059669",
    icon: CheckCircle,
    label: "Aprobada"
  },
  "Approved": {
    color: "#059669",
    icon: CheckCircle,
    label: "Aprobada"
  },
  "Completada": {
    color: "#16a34a",
    icon: CheckCircle,
    label: "Completada"
  },
  "Completed": {
    color: "#16a34a",
    icon: CheckCircle,
    label: "Completada"
  },
  "Rechazada": {
    color: "#dc2626",
    icon: XCircle,
    label: "Rechazada"
  },
  "Rejected": {
    color: "#dc2626",
    icon: XCircle,
    label: "Rechazada"
  },
  "En Despacho": {
    color: "#f59e0b",
    icon: Package,
    label: "En Despacho"
  },
  "Dispatching": {
    color: "#f59e0b",
    icon: Package,
    label: "En Despacho"
  },
  "Despachada": {
    color: "#0891b2",
    icon: Truck,
    label: "Despachada"
  },
  "Dispatched": {
    color: "#0891b2",
    icon: Truck,
    label: "Despachada"
  },
  "Cerrada": {
    color: "#166534",
    icon: Archive,
    label: "Cerrada"
  },
  "Closed": {
    color: "#166534",
    icon: Archive,
    label: "Cerrada"
  },
  "Cancelada": {
    color: "#991b1b",
    icon: XCircle,
    label: "Cancelada"
  },
  "Cancelled": {
    color: "#991b1b",
    icon: XCircle,
    label: "Cancelada"
  },
  "En Pausa": {
    color: "#9ca3af",
    icon: Pause,
    label: "En Pausa"
  },
  "En Tratamiento": {
    color: "#7c3aed",
    icon: Package,
    label: "En tratamiento"
  },
  "Tratado": {
    color: "#10b981",
    icon: CheckCircle,
    label: "Tratado"
  },
  "Treated": {
    color: "#10b981",
    icon: CheckCircle,
    label: "Tratado"
  },
  // Estados en minúsculas (desde BD)
  "draft": {
    color: "#6b7280",
    icon: FileText,
    label: "Borrador"
  },
  "submitted": {
    color: "#06b6d4",
    icon: Send,
    label: "Enviada"
  },
  "pending": {
    color: "#1e40af",
    icon: Clock,
    label: "Pendiente"
  },
  "processing": {
    color: "#ea580c",
    icon: Play,
    label: "En Proceso"
  },
  "in_planning": {
    color: "#ea580c",
    icon: Play,
    label: "En Progreso"
  },
  "in_treatment": {
    color: "#7c3aed",
    icon: Package,
    label: "En tratamiento"
  },
  "treated": {
    color: "#10b981",
    icon: Package,
    label: "Tratado"
  },
  "approved": {
    color: "#059669",
    icon: CheckCircle,
    label: "Aprobada"
  },
  "completed": {
    color: "#16a34a",
    icon: CheckCircle,
    label: "Completada"
  },
  "closed": {
    color: "#166534",
    icon: Archive,
    label: "Cerrada"
  },
  "rejected": {
    color: "#dc2626",
    icon: XCircle,
    label: "Rechazada"
  },
  "dispatched": {
    color: "#0891b2",
    icon: Truck,
    label: "Despachada"
  },
  "cancelled": {
    color: "#991b1b",
    icon: XCircle,
    label: "Cancelada"
  },
  "On Hold": {
    color: "#9ca3af",
    icon: Pause,
    label: "En Pausa"
  },

  // Estados genéricos
  "Activo": {
    color: "#059669",
    icon: CheckCircle,
    label: "Activo"
  },
  "Active": {
    color: "#059669",
    icon: CheckCircle,
    label: "Activo"
  },
  "Inactivo": {
    color: "#9ca3af",
    icon: Pause,
    label: "Inactivo"
  },
  "Inactive": {
    color: "#9ca3af",
    icon: Pause,
    label: "Inactivo"
  },
  "Suspendido": {
    color: "#991b1b",
    icon: XCircle,
    label: "Suspendido"
  },
  "Suspended": {
    color: "#991b1b",
    icon: XCircle,
    label: "Suspendido"
  },
};

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CRITICIDAD
// ═══════════════════════════════════════════════════════════════
export const criticidadConfig = {
  "Urgente": {
    color: "#d32f2f",
    icon: AlertTriangle,
    label: "Urgente"
  },
  "Urgent": {
    color: "#d32f2f",
    icon: AlertTriangle,
    label: "Urgente"
  },
  "Alta": {
    color: "#d32f2f",
    icon: AlertCircle,
    label: "Alta"
  },
  "High": {
    color: "#d32f2f",
    icon: AlertCircle,
    label: "Alta"
  },
  "Normal": {
    color: "#1976d2",
    icon: Clock,
    label: "Normal"
  },
  "Medium": {
    color: "#1976d2",
    icon: Clock,
    label: "Normal"
  },
  "Baja": {
    color: "#689f38",
    icon: Clock,
    label: "Baja"
  },
  "Low": {
    color: "#689f38",
    icon: Clock,
    label: "Baja"
  },
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
