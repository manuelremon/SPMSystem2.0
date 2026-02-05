/**
 * statusStyles.js - Utilidades centralizadas para estilos de estados/badges
 * Elimina duplicacion de funciones getEstadoStyle, getRoleStyle, etc.
 */

/**
 * Estilos para estados de solicitudes/presupuestos
 */
export const estadoStyles = {
  // Estados de solicitudes
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  submitted: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  aprobado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  aprobado_l1: "bg-blue-100 text-blue-800 border-blue-300",
  aprobado_l2: "bg-indigo-100 text-indigo-800 border-indigo-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  rechazado: "bg-red-100 text-red-800 border-red-300",
  rechazada: "bg-red-100 text-red-800 border-red-300",
  processing: "bg-blue-100 text-blue-800 border-blue-300",
  in_planning: "bg-purple-100 text-purple-800 border-purple-300",
  dispatched: "bg-cyan-100 text-cyan-800 border-cyan-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  closed: "bg-slate-100 text-slate-700 border-slate-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

export function getEstadoStyle(estado) {
  const key = (estado || "").toLowerCase().replace(/\s+/g, "_");
  return estadoStyles[key] || "bg-slate-100 text-slate-700 border-slate-300";
}

/**
 * Estilos para roles de usuario
 */
export const roleStyles = {
  admin: "bg-red-100 text-red-800 border-red-300",
  administrador: "bg-red-100 text-red-800 border-red-300",
  coordinador: "bg-purple-100 text-purple-800 border-purple-300",
  jefe: "bg-indigo-100 text-indigo-800 border-indigo-300",
  gerente: "bg-blue-100 text-blue-800 border-blue-300",
  planner: "bg-cyan-100 text-cyan-800 border-cyan-300",
  planificador: "bg-cyan-100 text-cyan-800 border-cyan-300",
  usuario: "bg-slate-100 text-slate-700 border-slate-300",
  solicitante: "bg-emerald-100 text-emerald-800 border-emerald-300",
  aprobador: "bg-amber-100 text-amber-800 border-amber-300",
};

export function getRoleStyle(role) {
  const key = (role || "").toLowerCase().replace(/\s+/g, "_");
  return roleStyles[key] || "bg-slate-100 text-slate-700 border-slate-300";
}

/**
 * Abreviaciones de roles
 */
export const roleAbbreviations = {
  admin: "ADM",
  administrador: "ADM",
  coordinador: "COORD",
  jefe: "JEFE",
  gerente: "GTE",
  planner: "PLAN",
  planificador: "PLAN",
  usuario: "USR",
  solicitante: "SOL",
  aprobador: "APR",
};

export function getRoleAbbr(role) {
  const key = (role || "").toLowerCase().replace(/\s+/g, "_");
  return roleAbbreviations[key] || role?.substring(0, 3).toUpperCase() || "---";
}

/**
 * Estilos para tipos de movimiento de ledger
 */
export const tipoMovimientoStyles = {
  incorporacion: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ajuste_positivo: "bg-emerald-100 text-emerald-800 border-emerald-300",
  consumo: "bg-red-100 text-red-800 border-red-300",
  reversion: "bg-amber-100 text-amber-800 border-amber-300",
  ajuste_negativo: "bg-red-100 text-red-800 border-red-300",
};

export function getTipoStyle(tipo) {
  const tipoLower = (tipo || "").toLowerCase();

  if (tipoLower.includes("consumo")) {
    return tipoMovimientoStyles.consumo;
  }
  if (tipoLower.includes("incorporacion") || tipoLower.includes("ajuste_positivo")) {
    return tipoMovimientoStyles.incorporacion;
  }
  if (tipoLower.includes("reversion")) {
    return tipoMovimientoStyles.reversion;
  }

  return "bg-slate-100 text-slate-700 border-slate-300";
}

/**
 * Estilos para niveles de aprobacion
 */
export const nivelStyles = {
  L1: "bg-blue-100 text-blue-800 border-blue-300",
  L2: "bg-indigo-100 text-indigo-800 border-indigo-300",
  ADMIN: "bg-red-100 text-red-800 border-red-300",
};

export function getNivelStyle(nivel) {
  return nivelStyles[nivel] || "bg-slate-100 text-slate-700 border-slate-300";
}

/**
 * Estilos para criticidad
 */
export const criticidadStyles = {
  alta: "bg-red-100 text-red-800 border-red-300",
  high: "bg-red-100 text-red-800 border-red-300",
  media: "bg-amber-100 text-amber-800 border-amber-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  baja: "bg-emerald-100 text-emerald-800 border-emerald-300",
  low: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export function getCriticidadStyle(criticidad) {
  const key = (criticidad || "").toLowerCase();
  return criticidadStyles[key] || "bg-slate-100 text-slate-700 border-slate-300";
}

/**
 * Labels para estados
 */
export const estadoLabels = {
  draft: "Borrador",
  pendiente: "Pendiente",
  submitted: "Enviada",
  approved: "Aprobada",
  aprobado: "Aprobada",
  aprobado_l1: "Aprobado L1",
  aprobado_l2: "Aprobado L2",
  rejected: "Rechazada",
  rechazado: "Rechazada",
  rechazada: "Rechazada",
  processing: "En Proceso",
  in_planning: "En Planificacion",
  dispatched: "Despachada",
  completed: "Completada",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export function getEstadoLabel(estado) {
  const key = (estado || "").toLowerCase().replace(/\s+/g, "_");
  return estadoLabels[key] || estado;
}

/**
 * Labels para niveles de aprobacion
 */
export const nivelLabels = {
  L1: "Nivel 1",
  L2: "Nivel 2",
  ADMIN: "Admin",
};

export function getNivelLabel(nivel) {
  return nivelLabels[nivel] || nivel;
}
