/**
 * HistorialAprobaciones - El historial vive como pestaña dentro de Aprobaciones.
 * Esta ruta se mantiene por compatibilidad y redirige a /aprobaciones?tab=historial.
 */

import { Navigate } from "react-router-dom";

export default function HistorialAprobaciones() {
  return <Navigate to="/aprobaciones?tab=historial" replace />;
}
