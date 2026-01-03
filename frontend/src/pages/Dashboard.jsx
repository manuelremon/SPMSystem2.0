import React, { useMemo } from "react";
import { useAuthStore } from "../store/authStore";
import SEO from "../components/SEO";
import DashboardSolicitante from "./DashboardSolicitante";
import DashboardAprobador from "./DashboardAprobador";
import DashboardPlanificador from "./DashboardPlanificador";
import DashboardAdmin from "./DashboardAdmin";

/**
 * Dashboard Principal - Router inteligente que delega a dashboards especificos por rol
 *
 * Estructura de delegacion:
 * - Admin: DashboardAdmin (vista completa del sistema)
 * - Planificador: DashboardPlanificador (foco en planificacion)
 * - Aprobador: DashboardAprobador (foco en aprobaciones)
 * - Solicitante: DashboardSolicitante (vista de usuario regular)
 *
 * Prioridad de roles (de mayor a menor):
 * 1. Admin (vista mas completa)
 * 2. Planificador
 * 3. Aprobador
 * 4. Solicitante (vista por defecto)
 */
export default function Dashboard() {
  const { user } = useAuthStore();

  // Determinar rol del usuario con memoizacion para evitar recalculos
  const userRole = useMemo(() => {
    const roles = user?.roles || [];
    const isAdmin = user?.is_admin || roles.some(r => ['admin', 'administrador'].includes(r?.toLowerCase?.() || r));
    const isPlanificador = roles.some(r => ['planificador', 'planner'].includes(r?.toLowerCase?.() || r));
    const isAprobador = roles.some(r => ['aprobador', 'approver', 'jefe', 'gerente1', 'gerente2', 'aprobador_solicitudes'].includes(r?.toLowerCase?.() || r));

    // Prioridad: Admin > Planificador > Aprobador > Solicitante
    if (isAdmin) return 'admin';
    if (isPlanificador) return 'planificador';
    if (isAprobador) return 'aprobador';
    return 'solicitante';
  }, [user]);

  // Delegar al dashboard especifico segun el rol de mayor prioridad
  const DashboardComponent = {
    admin: DashboardAdmin,
    planificador: DashboardPlanificador,
    aprobador: DashboardAprobador,
    solicitante: DashboardSolicitante
  }[userRole] || DashboardSolicitante;

  return (
    <>
      <SEO title="Dashboard" description="Panel principal del Sistema de Planificación de Materiales" />
      <DashboardComponent />
    </>
  );
}
