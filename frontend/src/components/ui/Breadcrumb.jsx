import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useI18n } from "../../context/i18n";

/**
 * Enterprise Breadcrumb Component
 *
 * Provides wayfinding navigation based on current route.
 * Only renders when route depth > 1 (not on top-level pages).
 *
 * Accessibility: Uses <nav aria-label="Breadcrumb"> per WCAG 2.1 SC 2.4.8
 */

// Route name mappings for breadcrumb labels
const ROUTE_NAMES = {
  // Dashboard
  '/dashboard': 'nav_dashboard',

  // Solicitudes
  '/solicitudes': 'nav_solicitudes',
  '/solicitudes/nueva': 'nav_nueva',
  '/mis-solicitudes': 'nav_mis',

  // Materiales
  '/materiales': 'nav_materiales',
  '/materiales/catalogo': 'nav_catalogo_materiales',
  '/materiales/equivalencias': 'nav_equivalencias',

  // Aprobaciones
  '/aprobaciones': 'nav_aprobaciones',
  '/aprobaciones/historial': 'nav_historial_aprobaciones',

  // Planificador
  '/planificador': 'nav_planificador',
  '/planificador/asignadas': 'nav_asignadas',
  '/planificador/no-asignadas': 'nav_no_asignadas',
  '/planificador/mrp': 'nav_mrp',
  '/planificador/mrp/alertas': 'nav_mrp_alertas',
  '/planificador/mrp/kpis': 'nav_mrp_kpis',

  // Presupuesto
  '/presupuestos': 'nav_presupuesto',
  '/presupuestos/nueva': 'nav_nueva_solicitud_presupuesto',

  // KPI
  '/kpi': 'nav_kpi',

  // Foro
  '/foro': 'nav_foro',

  // Admin
  '/admin': 'nav_admin',
  '/admin/usuarios': 'admin_usuarios',
  '/admin/planificadores': 'admin_planificadores',
  '/admin/roles': 'admin_roles',
  '/admin/puestos': 'admin_puestos',
  '/admin/sectores': 'admin_sectores',
  '/admin/presupuestos': 'admin_presupuestos',
  '/admin/centros': 'admin_centros',
  '/admin/almacenes': 'admin_almacenes',
  '/admin/metricas': 'admin_metricas',
  '/admin/estado': 'admin_estado',
  '/admin/proveedores': 'admin_proveedores',
  '/admin/solicitudes-perfil': 'admin_solicitudes_perfil',
  '/admin/materiales': 'admin_materiales',

  // User
  '/mi-cuenta': 'nav_mi_cuenta',
  '/mensajes': 'nav_mensajes',
  '/notificaciones': 'nav_notificaciones',
  '/trivias': 'nav_trivias',
  '/ayuda': 'nav_ayuda',
};

// Fallback labels for routes not in i18n
const ROUTE_FALLBACKS = {
  '/dashboard': 'Dashboard',
  '/solicitudes': 'Solicitudes',
  '/solicitudes/nueva': 'Nueva Solicitud',
  '/mis-solicitudes': 'Mis Solicitudes',
  '/materiales': 'Materiales',
  '/materiales/catalogo': 'Catalogo',
  '/materiales/equivalencias': 'Equivalencias',
  '/aprobaciones': 'Aprobaciones',
  '/aprobaciones/historial': 'Historial',
  '/planificador': 'Planificador',
  '/planificador/asignadas': 'Asignadas',
  '/planificador/no-asignadas': 'No Asignadas',
  '/planificador/mrp': 'MRP',
  '/planificador/mrp/alertas': 'Alertas',
  '/planificador/mrp/kpis': 'KPIs',
  '/presupuestos': 'Presupuestos',
  '/presupuestos/nueva': 'Nueva',
  '/kpi': 'KPIs',
  '/foro': 'Foro',
  '/admin': 'Admin',
  '/admin/usuarios': 'Usuarios',
  '/admin/planificadores': 'Planificadores',
  '/admin/roles': 'Roles',
  '/admin/puestos': 'Puestos',
  '/admin/sectores': 'Sectores',
  '/admin/presupuestos': 'Presupuestos',
  '/admin/centros': 'Centros',
  '/admin/almacenes': 'Almacenes',
  '/admin/metricas': 'Metricas',
  '/admin/estado': 'Estado',
  '/admin/proveedores': 'Proveedores',
  '/admin/solicitudes-perfil': 'Solicitudes Perfil',
  '/admin/materiales': 'Materiales',
  '/mi-cuenta': 'Mi Cuenta',
  '/mensajes': 'Mensajes',
  '/notificaciones': 'Notificaciones',
  '/trivias': 'Trivias',
  '/ayuda': 'Ayuda',
};

export function Breadcrumb() {
  const location = useLocation();
  const { t } = useI18n();

  // Build breadcrumbs from current path
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumb on single-level routes or home
  if (pathSegments.length <= 1) {
    return null;
  }

  // Build hierarchical breadcrumb items
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const trKey = ROUTE_NAMES[path];
    const fallback = ROUTE_FALLBACKS[path] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const label = trKey ? t(trKey, fallback) : fallback;
    const isLast = index === pathSegments.length - 1;

    return { path, label, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm mb-6"
    >
      {/* Home icon */}
      <Link
        to="/dashboard"
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--primary)] transition-colors"
        aria-label={t('nav_dashboard', 'Dashboard')}
      >
        <Home className="w-4 h-4" />
      </Link>

      {/* Breadcrumb items */}
      {breadcrumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          <ChevronRight className="w-4 h-4 text-[var(--fg-subtle)]" />
          {crumb.isLast ? (
            <span
              className="text-[var(--fg)] font-medium"
              aria-current="page"
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="text-[var(--fg-muted)] hover:text-[var(--primary)] transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default Breadcrumb;
