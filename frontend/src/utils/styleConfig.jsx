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

// Helper para crear elemento de ícono con estilos
const createIcon = (IconComponent, color) => (
  <IconComponent className="w-4 h-4" style={{ color }} />
);

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ESTADOS (con componentes de referencia)
// ═══════════════════════════════════════════════════════════════
const estadoConfigBase = {
  // Estados de Solicitudes
  "Borrador": { color: "#f57c00", IconComponent: FileText, label: "Borrador" },
  "Draft": { color: "#f57c00", IconComponent: FileText, label: "Borrador" },
  "Enviada": { color: "#606d80", IconComponent: Send, label: "Enviada" },
  "Submitted": { color: "#606d80", IconComponent: Send, label: "Enviada" },
  "Pendiente": { color: "#606d80", IconComponent: Clock, label: "Pendiente" },
  "Pending": { color: "#606d80", IconComponent: Clock, label: "Pendiente" },
  "Pendiente_de_Aprobacion": { color: "#606d80", IconComponent: Clock, label: "Pendiente" },
  "En Proceso": { color: "#c2185b", IconComponent: Play, label: "En Proceso" },
  "Processing": { color: "#c2185b", IconComponent: Play, label: "En Proceso" },
  "En Progreso": { color: "#c2185b", IconComponent: Play, label: "En Proceso" },
  "Aprobada": { color: "#689f38", IconComponent: CheckCircle, label: "Aprobada" },
  "Approved": { color: "#689f38", IconComponent: CheckCircle, label: "Aprobada" },
  "Completada": { color: "#689f38", IconComponent: CheckCircle, label: "Completada" },
  "Completed": { color: "#689f38", IconComponent: CheckCircle, label: "Completada" },
  "Rechazada": { color: "#d32f2f", IconComponent: XCircle, label: "Rechazada" },
  "Rejected": { color: "#d32f2f", IconComponent: XCircle, label: "Rechazada" },
  "En Despacho": { color: "#c2185b", IconComponent: Package, label: "En Despacho" },
  "Dispatching": { color: "#c2185b", IconComponent: Package, label: "En Despacho" },
  "Despachada": { color: "#689f38", IconComponent: Truck, label: "Despachada" },
  "Dispatched": { color: "#689f38", IconComponent: Truck, label: "Despachada" },
  "Cerrada": { color: "#689f38", IconComponent: Archive, label: "Cerrada" },
  "Closed": { color: "#689f38", IconComponent: Archive, label: "Cerrada" },
  "Cancelada": { color: "#d32f2f", IconComponent: XCircle, label: "Cancelada" },
  "Cancelled": { color: "#d32f2f", IconComponent: XCircle, label: "Cancelada" },
  "En Pausa": { color: "#606d80", IconComponent: Pause, label: "En Pausa" },
  "On Hold": { color: "#606d80", IconComponent: Pause, label: "En Pausa" },
  // Estados genéricos
  "Activo": { color: "#689f38", IconComponent: CheckCircle, label: "Activo" },
  "Active": { color: "#689f38", IconComponent: CheckCircle, label: "Activo" },
  "Inactivo": { color: "#606d80", IconComponent: Pause, label: "Inactivo" },
  "Inactive": { color: "#606d80", IconComponent: Pause, label: "Inactivo" },
  "Suspendido": { color: "#d32f2f", IconComponent: XCircle, label: "Suspendido" },
  "Suspended": { color: "#d32f2f", IconComponent: XCircle, label: "Suspendido" },
};

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CRITICIDAD (con componentes de referencia)
// ═══════════════════════════════════════════════════════════════
const criticidadConfigBase = {
  "Urgente": { color: "#d32f2f", IconComponent: AlertTriangle, label: "Urgente" },
  "Urgent": { color: "#d32f2f", IconComponent: AlertTriangle, label: "Urgente" },
  "Alta": { color: "#d32f2f", IconComponent: AlertCircle, label: "Alta" },
  "High": { color: "#d32f2f", IconComponent: AlertCircle, label: "Alta" },
  "Normal": { color: "#567ebb", IconComponent: Clock, label: "Normal" },
  "Medium": { color: "#567ebb", IconComponent: Clock, label: "Normal" },
  "Baja": { color: "#689f38", IconComponent: Clock, label: "Baja" },
  "Low": { color: "#689f38", IconComponent: Clock, label: "Baja" },
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Obtener configuración de estado (devuelve icon como JSX)
// ═══════════════════════════════════════════════════════════════
export function getEstadoConfig(estado) {
  const config = estadoConfigBase[estado] || estadoConfigBase["Pendiente"];
  return {
    color: config.color,
    label: config.label,
    icon: createIcon(config.IconComponent, config.color),
    IconComponent: config.IconComponent
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Obtener configuración de criticidad (devuelve icon como JSX)
// ═══════════════════════════════════════════════════════════════
export function getCriticidadConfig(criticidad) {
  const config = criticidadConfigBase[criticidad] || criticidadConfigBase["Normal"];
  return {
    color: config.color,
    label: config.label,
    icon: createIcon(config.IconComponent, config.color),
    IconComponent: config.IconComponent
  };
}

// Exportar config bases para compatibilidad (si alguien las usa directamente)
export const estadoConfig = estadoConfigBase;
export const criticidadConfig = criticidadConfigBase;
