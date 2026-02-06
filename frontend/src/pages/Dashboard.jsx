import React from "react";
import SEO from "../components/SEO";
import DashboardAdmin from "./DashboardAdmin";

/**
 * Dashboard Principal - Vista unificada para todos los roles
 *
 * Todos los usuarios ven el mismo dashboard completo con KPIs,
 * graficos, filtros avanzados y tablas interactivas.
 */
export default function Dashboard() {
  return (
    <>
      <SEO title="Dashboard" description="Panel principal del Sistema de Planificación de Materiales" />
      <DashboardAdmin />
    </>
  );
}
