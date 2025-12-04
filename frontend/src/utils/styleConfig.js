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
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ESTADOS
// ═══════════════════════════════════════════════════════════════
export const estadoConfig = {
  // Estados de Solicitudes
  "Borrador": {
    color: "var(--fg-muted)",
    icon: FileText,
    label: "Borrador"
  },
  "Draft": {
    color: "var(--fg-muted)",
    icon: FileText,
    label: "Borrador"
  },
  "Enviada": {
    color: "var(--info)",
    icon: Send,
    label: "Enviada"
  },
  "Submitted": {
    color: "var(--info)",
    icon: Send,
    label: "Enviada"
  },
  "Pendiente": {
    color: "var(--warning)",
    icon: Clock,
    label: "Pendiente"
  },
  "Pending": {
    color: "var(--warning)",
    icon: Clock,
    label: "Pendiente"
  },
  "En Proceso": {
    color: "var(--primary)",
    icon: Play,
    label: "En Proceso"
  },
  "Processing": {
    color: "var(--primary)",
    icon: Play,
    label: "En Proceso"
  },
  "Aprobada": {
    color: "var(--success)",
    icon: CheckCircle,
    label: "Aprobada"
  },
  "Approved": {
    color: "var(--success)",
    icon: CheckCircle,
    label: "Aprobada"
  },
  "Rechazada": {
    color: "var(--danger)",
    icon: XCircle,
    label: "Rechazada"
  },
  "Rejected": {
    color: "var(--danger)",
    icon: XCircle,
    label: "Rechazada"
  },
  "En Despacho": {
    color: "var(--accent)",
    icon: Package,
    label: "En Despacho"
  },
  "Dispatching": {
    color: "var(--accent)",
    icon: Package,
    label: "En Despacho"
  },
  "Despachada": {
    color: "var(--accent)",
    icon: Truck,
    label: "Despachada"
  },
  "Dispatched": {
    color: "var(--accent)",
    icon: Truck,
    label: "Despachada"
  },
  "Cerrada": {
    color: "var(--fg-subtle)",
    icon: Archive,
    label: "Cerrada"
  },
  "Closed": {
    color: "var(--fg-subtle)",
    icon: Archive,
    label: "Cerrada"
  },
  "Cancelada": {
    color: "var(--danger)",
    icon: XCircle,
    label: "Cancelada"
  },
  "Cancelled": {
    color: "var(--danger)",
    icon: XCircle,
    label: "Cancelada"
  },
  "En Pausa": {
    color: "var(--warning)",
    icon: Pause,
    label: "En Pausa"
  },
  "On Hold": {
    color: "var(--warning)",
    icon: Pause,
    label: "En Pausa"
  },

  // Estados genéricos
  "Activo": {
    color: "var(--success)",
    icon: CheckCircle,
    label: "Activo"
  },
  "Active": {
    color: "var(--success)",
    icon: CheckCircle,
    label: "Activo"
  },
  "Inactivo": {
    color: "var(--fg-muted)",
    icon: Pause,
    label: "Inactivo"
  },
  "Inactive": {
    color: "var(--fg-muted)",
    icon: Pause,
    label: "Inactivo"
  },
  "Suspendido": {
    color: "var(--danger)",
    icon: XCircle,
    label: "Suspendido"
  },
  "Suspended": {
    color: "var(--danger)",
    icon: XCircle,
    label: "Suspendido"
  },
};

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CRITICIDAD
// ═══════════════════════════════════════════════════════════════
export const criticidadConfig = {
  "Urgente": {
    color: "var(--danger)",
    icon: AlertTriangle,
    label: "Urgente"
  },
  "Urgent": {
    color: "var(--danger)",
    icon: AlertTriangle,
    label: "Urgente"
  },
  "Alta": {
    color: "var(--warning)",
    icon: AlertCircle,
    label: "Alta"
  },
  "High": {
    color: "var(--warning)",
    icon: AlertCircle,
    label: "Alta"
  },
  "Normal": {
    color: "var(--info)",
    icon: Clock,
    label: "Normal"
  },
  "Medium": {
    color: "var(--info)",
    icon: Clock,
    label: "Normal"
  },
  "Baja": {
    color: "var(--success)",
    icon: Clock,
    label: "Baja"
  },
  "Low": {
    color: "var(--success)",
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
