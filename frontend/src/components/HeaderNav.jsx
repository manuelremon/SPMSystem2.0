/**
 * HeaderNav Component - Navegación horizontal en el header
 * Estructura data-driven con 8 dropdowns organizados por dominio SCM/ERP
 */

import React, { useState, useEffect, memo, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListSubheader from "@mui/material/ListSubheader";
import { ChevronDown } from "./ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useModuleStore } from "../store/moduleStore";

/* ───────── Styles ───────── */

const menuItemSx = {
  fontSize: '0.75rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  py: 1,
  px: 2,
  color: 'white',
  borderBottom: '1px solid var(--header-border, #424242)',
  '&:hover': { backgroundColor: 'var(--header-border, #424242)' },
  '&:last-child': { borderBottom: 'none' },
};

const activeMenuItemSx = {
  ...menuItemSx,
  backgroundColor: 'var(--primary)',
  color: 'white',
  '&:hover': { backgroundColor: 'var(--primary-dark)', color: 'white' },
};

const menuPaperSx = {
  backgroundColor: 'var(--header-bg, #212121)',
  border: '1px solid var(--header-border, #424242)',
};

const subheaderSx = {
  fontSize: '0.6rem',
  fontWeight: 700,
  color: 'var(--fg-subtle, #9e9e9e)',
  lineHeight: 1,
  py: 0.5,
  px: 2,
  backgroundColor: 'transparent',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

/* ───────── Menu Configuration ───────── */

/**
 * Each menu has: id, labelKey, labelFallback, visibility, activePrefixes, sections[]
 * Each section has: header (optional i18n key), items[]
 * Each item has: to, labelKey, labelFallback, visibility (optional)
 */
const getMenuConfig = ({ canApprove, canSeeBudget, canSeePlanner, isAdmin, isCompartidos }) => [
  // 1. SOLICITUDES
  {
    id: 'solicitudes',
    labelKey: 'nav_solicitudes',
    labelFallback: 'Solicitudes',
    visible: !isCompartidos,
    dataTour: 'nav-solicitudes',
    activePrefixes: ['/solicitudes', '/mis-solicitudes', '/aprobaciones', '/presupuestos'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_gestiones', fallback: 'GESTIONES' },
        items: [
          { to: '/solicitudes/nueva', labelKey: 'nav_nueva', labelFallback: 'Nueva Solicitud' },
          { to: '/mis-solicitudes', labelKey: 'nav_mis', labelFallback: 'Mis Solicitudes' },
          { to: '/solicitudes/todas', labelKey: 'nav_todas', labelFallback: 'Todas las Solicitudes' },
        ],
      },
      {
        header: { key: 'nav_header_aprobacion', fallback: 'APROBACION' },
        visible: canApprove,
        items: [
          { to: '/aprobaciones', labelKey: 'nav_aprobaciones', labelFallback: 'Aprobaciones' },
          { to: '/presupuestos', labelKey: 'nav_presupuesto', labelFallback: 'Presupuesto', visible: canSeeBudget },
        ],
      },
    ],
  },
  // 2. COMPRAS
  {
    id: 'compras',
    labelKey: 'nav_compras',
    labelFallback: 'Compras',
    visible: canSeePlanner,
    activePrefixes: ['/procurement', '/finance/supplier-finance'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_sourcing', fallback: 'ABASTECIMIENTO' },
        items: [
          { to: '/procurement', labelKey: 'nav_procurement_dashboard', labelFallback: 'Compras SAP' },
          { to: '/procurement/rfq', labelKey: 'nav_rfq', labelFallback: 'Licitaciones (RFQ)' },
          { to: '/procurement/contracts', labelKey: 'nav_contracts', labelFallback: 'Contratos' },
          { to: '/procurement/prices', labelKey: 'nav_prices', labelFallback: 'Precios' },
        ],
      },
      {
        header: { key: 'nav_header_proveedores', fallback: 'PROVEEDORES' },
        items: [
          { to: '/procurement/scorecard', labelKey: 'nav_scorecard', labelFallback: 'Evaluación Proveedores' },
          { to: '/procurement/supplier-risk', labelKey: 'nav_supplier_risk', labelFallback: 'Riesgo Proveedores' },
          { to: '/procurement/certifications', labelKey: 'nav_certifications', labelFallback: 'Certificaciones' },
          { to: '/procurement/audits', labelKey: 'nav_supplier_audits', labelFallback: 'Auditorias Prov.' },
        ],
      },
      {
        header: { key: 'nav_header_facturas', fallback: 'FACTURAS' },
        items: [
          { to: '/procurement/invoices', labelKey: 'nav_invoices', labelFallback: 'Facturas (3-Way)' },
          { to: '/procurement/compliance', labelKey: 'nav_compliance', labelFallback: 'Cumplimiento' },
          { to: '/procurement/rebates', labelKey: 'nav_rebates', labelFallback: 'Bonificaciones' },
          { to: '/finance/supplier-finance', labelKey: 'nav_supplier_finance', labelFallback: 'Financiamiento' },
        ],
      },
    ],
  },
  // 3. PLANIFICACION
  {
    id: 'planificacion',
    labelKey: 'nav_planificacion',
    labelFallback: 'Planificacion',
    visible: canSeePlanner,
    dataTour: 'nav-planificador',
    activePrefixes: ['/planificador', '/mrp', '/forecast', '/planning/demand', '/operations/production', '/operations/kanban'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_panel', fallback: 'PANEL' },
        items: [
          { to: '/planificador', labelKey: 'nav_panel_tratamiento', labelFallback: 'Panel de Tratamiento' },
          { to: '/planificador/asignadas', labelKey: 'nav_asignadas', labelFallback: 'Mis Asignadas' },
          { to: '/planificador/no-asignadas', labelKey: 'nav_no_asignadas', labelFallback: 'No Asignadas' },
        ],
      },
      {
        header: { key: 'nav_header_mrp', fallback: 'MRP' },
        items: [
          { to: '/mrp/portfolio', labelKey: 'nav_mrp_portfolio', labelFallback: 'Portfolio MRP' },
          { to: '/mrp/parametrizar', labelKey: 'nav_mrp_parametrizar', labelFallback: 'Parametrizar' },
          { to: '/mrp/alertas', labelKey: 'nav_mrp_alertas', labelFallback: 'Alertas MRP' },
          { to: '/mrp/kpis', labelKey: 'nav_mrp_kpis', labelFallback: 'KPIs MRP' },
        ],
      },
      {
        header: { key: 'nav_header_demanda', fallback: 'DEMANDA' },
        items: [
          { to: '/forecast/individual', labelKey: 'nav_forecast_individual', labelFallback: 'Pronóstico Individual' },
          { to: '/forecast/masivo', labelKey: 'nav_forecast_masivo', labelFallback: 'Pronóstico Masivo' },
          { to: '/planning/demand', labelKey: 'nav_demand_planning', labelFallback: 'Demanda (S&OP)' },
          { to: '/operations/production', labelKey: 'nav_production', labelFallback: 'Produccion (MPS)' },
          { to: '/operations/kanban', labelKey: 'nav_kanban', labelFallback: 'Kanban' },
        ],
      },
    ],
  },
  // 4. INVENTARIO
  {
    id: 'inventario',
    labelKey: 'nav_inventario',
    labelFallback: 'Inventario',
    visible: canSeePlanner,
    activePrefixes: ['/materiales', '/operations/warehouse', '/operations/putaway', '/operations/cycle-count', '/operations/slob', '/operations/vmi', '/operations/consignment', '/operations/lots', '/operations/recalls', '/operations/inventory-optimization', '/operations/niveles-de-servicio'],
    minWidth: 210,
    sections: [
      {
        header: { key: 'nav_header_almacen', fallback: 'ALMACEN' },
        items: [
          { to: '/operations/warehouse', labelKey: 'nav_warehouse', labelFallback: 'Recepcion' },
          { to: '/operations/putaway', labelKey: 'nav_putaway', labelFallback: 'Ubicaciones' },
          { to: '/operations/cycle-count', labelKey: 'nav_cycle_count', labelFallback: 'Conteo Ciclico' },
        ],
      },
      {
        header: { key: 'nav_header_stock', fallback: 'STOCK' },
        items: [
          { to: '/materiales/catalogo', labelKey: 'nav_catalogo_materiales', labelFallback: 'Catalogo' },
          { to: '/materiales/equivalencias', labelKey: 'nav_equivalencias', labelFallback: 'Alternativos' },
          { to: '/materiales/stock', labelKey: 'nav_stock', labelFallback: 'Stock' },
          { to: '/operations/slob', labelKey: 'nav_slob', labelFallback: 'Antigüedad e Inmovilizado' },
        ],
      },
      {
        header: { key: 'nav_header_gestion', fallback: 'GESTION' },
        items: [
          { to: '/operations/vmi', labelKey: 'nav_vmi', labelFallback: 'VMI' },
          { to: '/operations/consignment', labelKey: 'nav_consignment', labelFallback: 'Consignacion' },
          { to: '/operations/lots', labelKey: 'nav_lots', labelFallback: 'Lotes & Trazabilidad' },
          { to: '/operations/recalls', labelKey: 'nav_recalls', labelFallback: 'Retiros de Mercado' },
          { to: '/operations/inventory-optimization', labelKey: 'nav_inv_optimization', labelFallback: 'Optimización Inventario' },
        ],
      },
    ],
  },
  // 5. LOGISTICA
  {
    id: 'logistica',
    labelKey: 'nav_logistica',
    labelFallback: 'Logistica',
    visible: canSeePlanner,
    activePrefixes: ['/tms', '/fms', '/operations/customs', '/operations/packaging', '/operations/returns', '/operations/warranty'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_transporte', fallback: 'TRANSPORTE' },
        items: [
          { to: '/tms/shipments', labelKey: 'nav_shipments', labelFallback: 'Envios' },
          { to: '/tms/consolidation', labelKey: 'nav_consolidation', labelFallback: 'Consolidacion LTL' },
          { to: '/tms/routes', labelKey: 'nav_tms_routes', labelFallback: 'Rutas' },
          { to: '/tms/kpis', labelKey: 'nav_tms_kpis', labelFallback: 'KPIs Transporte' },
        ],
      },
      {
        header: { key: 'nav_header_comercio', fallback: 'COMERCIO' },
        items: [
          { to: '/operations/customs', labelKey: 'nav_customs', labelFallback: 'Aduanas' },
          { to: '/operations/packaging', labelKey: 'nav_packaging', labelFallback: 'Empaque y Etiquetas' },
          { to: '/operations/returns', labelKey: 'nav_returns', labelFallback: 'Devoluciones (RMA)' },
          { to: '/operations/warranty', labelKey: 'nav_warranty', labelFallback: 'Garantias' },
        ],
      },
      {
        header: { key: 'nav_header_flete_flota', fallback: 'FLETE & FLOTA' },
        items: [
          { to: '/tms/freight', labelKey: 'nav_freight_audit', labelFallback: 'Auditoria Fletes' },
          { to: '/tms/tariffs', labelKey: 'nav_freight_tariffs', labelFallback: 'Tarifas Flete' },
          { to: '/fms/vehicles', labelKey: 'nav_vehicles', labelFallback: 'Vehiculos' },
          { to: '/fms/work-orders', labelKey: 'nav_work_orders', labelFallback: 'Ordenes de Trabajo' },
        ],
      },
    ],
  },
  // 6. CALIDAD
  {
    id: 'calidad',
    labelKey: 'nav_quality',
    labelFallback: 'Calidad',
    visible: canSeePlanner,
    activePrefixes: ['/quality', '/engineering/eco', '/operations/kitting'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_inspeccion', fallback: 'INSPECCION' },
        items: [
          { to: '/quality/inspections', labelKey: 'nav_inspections', labelFallback: 'Inspecciones' },
          { to: '/quality/ncr', labelKey: 'nav_ncr', labelFallback: 'NCR' },
          { to: '/quality/capa', labelKey: 'nav_capa', labelFallback: 'CAPA' },
        ],
      },
      {
        header: { key: 'nav_header_ingenieria', fallback: 'INGENIERIA' },
        items: [
          { to: '/engineering/eco', labelKey: 'nav_eco', labelFallback: 'Ordenes de Cambio (ECO)' },
          { to: '/operations/kitting/boms', labelKey: 'nav_kitting_boms', labelFallback: 'BOMs de Kit' },
          { to: '/operations/kitting/orders', labelKey: 'nav_kitting_orders', labelFallback: 'Ordenes de Kit' },
        ],
      },
    ],
  },
  // 7. ANALYTICS
  {
    id: 'analytics',
    labelKey: 'nav_analytics',
    labelFallback: 'Analítica',
    visible: canSeePlanner,
    activePrefixes: ['/analytics', '/ai/copilot', '/planificador/ai', '/reportes/programados'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_dashboards', fallback: 'TABLEROS' },
        items: [
          { to: '/analytics/control-tower', labelKey: 'nav_control_tower', labelFallback: 'Torre de Control' },
          { to: '/analytics/executive', labelKey: 'nav_executive', labelFallback: 'Dashboard Ejecutivo' },
          { to: '/analytics/sustainability', labelKey: 'nav_sustainability', labelFallback: 'Sostenibilidad (ESG)' },
        ],
      },
      {
        header: { key: 'nav_header_analisis', fallback: 'ANALISIS' },
        items: [
          { to: '/analytics/spend', labelKey: 'nav_spend_analytics', labelFallback: 'Análisis de Gastos' },
          { to: '/analytics/abc', labelKey: 'nav_abc_analysis', labelFallback: 'Análisis ABC' },
          { to: '/analytics/what-if', labelKey: 'nav_whatif', labelFallback: 'Simulación de Inventario' },
          { to: '/procurement/savings', labelKey: 'nav_savings', labelFallback: 'Ahorros de Costos' },
        ],
      },
      {
        header: { key: 'nav_header_inteligencia', fallback: 'INTELIGENCIA' },
        items: [
          { to: '/ai/copilot', labelKey: 'nav_copilot', labelFallback: 'Copiloto IA' },
          { to: '/planificador/ai', labelKey: 'nav_ai', labelFallback: 'IA Analytics' },
          { to: '/reportes/programados', labelKey: 'nav_reportes_programados', labelFallback: 'Reportes Programados' },
        ],
      },
    ],
  },
  // 8. ADMIN
  {
    id: 'admin',
    labelKey: 'nav_admin',
    labelFallback: 'Admin',
    visible: isAdmin,
    activePrefixes: ['/admin'],
    minWidth: 200,
    sections: [
      {
        header: { key: 'nav_header_usuarios', fallback: 'USUARIOS' },
        items: [
          { to: '/admin/usuarios', labelKey: 'admin_usuarios', labelFallback: 'Usuarios' },
          { to: '/admin/monitor-usuarios', labelKey: 'admin_monitor_usuarios', labelFallback: 'Monitor Usuarios' },
          { to: '/admin/roles', labelKey: 'admin_roles', labelFallback: 'Roles' },
          { to: '/admin/planificadores', labelKey: 'admin_planificadores', labelFallback: 'Planificadores' },
        ],
      },
      {
        header: { key: 'nav_header_organizacion', fallback: 'ORGANIZACION' },
        items: [
          { to: '/admin/centros', labelKey: 'admin_centros', labelFallback: 'Centros' },
          { to: '/admin/sectores', labelKey: 'admin_sectores', labelFallback: 'Sectores' },
          { to: '/admin/almacenes', labelKey: 'admin_almacenes', labelFallback: 'Almacenes' },
          { to: '/admin/puestos', labelKey: 'admin_puestos', labelFallback: 'Puestos' },
          { to: '/admin/proveedores', labelKey: 'admin_proveedores', labelFallback: 'Proveedores' },
        ],
      },
      {
        header: { key: 'nav_header_sistema', fallback: 'SISTEMA' },
        items: [
          { to: '/admin/modules', labelKey: 'admin_modules', labelFallback: 'Modulos' },
          { to: '/admin/estado', labelKey: 'admin_estado', labelFallback: 'Estado del Sistema' },
          { to: '/admin/bases-datos', labelKey: 'admin_bases_datos', labelFallback: 'Bases de Datos' },
          { to: '/admin/currency', labelKey: 'nav_currency', labelFallback: 'Monedas' },
        ],
      },
      {
        header: { key: 'nav_header_configuracion', fallback: 'CONFIGURACION' },
        items: [
          { to: '/admin/presupuestos', labelKey: 'admin_presupuestos', labelFallback: 'Presupuestos' },
          { to: '/admin/auto-aprobacion', labelKey: 'admin_auto_aprobacion', labelFallback: 'Auto-Aprobacion' },
          { to: '/admin/escalacion', labelKey: 'admin_escalacion', labelFallback: 'Escalado Aprobaciones' },
          { to: '/admin/webhooks', labelKey: 'admin_webhooks', labelFallback: 'Webhooks' },
          { to: '/admin/audit-log', labelKey: 'admin_audit_log', labelFallback: 'Registro de Auditoría' },
          { to: '/admin/analisis-puntual', labelKey: 'admin_ap_importar', labelFallback: 'Analisis Puntual' },
          { to: '/admin/supplier-portal', labelKey: 'nav_supplier_portal', labelFallback: 'Portal Proveedores' },
          { to: '/admin/supplier-onboarding', labelKey: 'nav_supplier_onboarding', labelFallback: 'Onboarding Proveedores' },
          { to: '/compartidos', labelKey: 'nav_compartidos', labelFallback: 'Compartidos' },
        ],
      },
    ],
  },
  // 9. COMPARTIDOS (visible for compartidos role when not admin)
  {
    id: 'compartidos',
    labelKey: 'nav_compartidos',
    labelFallback: 'Compartidos',
    visible: isCompartidos && !isAdmin,
    activePrefixes: ['/compartidos'],
    minWidth: 180,
    sections: [
      {
        items: [
          { to: '/compartidos', labelKey: 'nav_shared_files', labelFallback: 'Archivos Compartidos' },
        ],
      },
    ],
  },
];

/* ───────── Component ───────── */

function HeaderNav() {
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isModuleEnabled = useModuleStore(s => s.isModuleEnabled);

  // Single state for open menu
  const [openMenuId, setOpenMenuId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  // Role helpers
  const getUserRoles = useCallback(() => {
    if (!user?.rol) return [];
    const rolStr = String(user.rol);
    if (rolStr.startsWith("[")) {
      try {
        const parsed = JSON.parse(rolStr);
        return Array.isArray(parsed) ? parsed : [rolStr];
      } catch {
        return [rolStr];
      }
    }
    return [rolStr];
  }, [user?.rol]);

  const hasRole = useCallback((targetRole) => {
    const roles = getUserRoles();
    return roles.some((r) => String(r).toLowerCase().includes(targetRole.toLowerCase()));
  }, [getUserRoles]);

  const isAdminRole = hasRole("admin");
  const isPlannerRole = hasRole("planificador");
  const isJefeRole = hasRole("jefe");
  const isCoordinadorRole = hasRole("coordinador");
  const isBudgetApprover = hasRole("aprobador presupuestos") || hasRole("aprobador_presupuestos") || hasRole("aprobador de presupuesto");
  const isRequestApprover = hasRole("aprobador solicitudes") || hasRole("aprobador_solicitudes");
  const isGerenteRole = hasRole("gerente");
  const isCompartidosRole = hasRole("compartidos");

  const canSeePlanner = isPlannerRole || isAdminRole;
  const canSeeBudget = isAdminRole || isJefeRole || isCoordinadorRole || isBudgetApprover;
  const canApprove = isAdminRole || isJefeRole || isCoordinadorRole || isRequestApprover || isGerenteRole;

  const isPathActive = useCallback((path) =>
    location.pathname === path || location.pathname.startsWith(path + "/"),
  [location.pathname]);

  const isMenuActive = useCallback((prefixes) =>
    prefixes.some((p) => isPathActive(p)),
  [isPathActive]);

  // Close menus on route change
  useEffect(() => {
    setOpenMenuId(null);
    setAnchorEl(null);
  }, [location.pathname]);

  const handleOpen = useCallback((menuId, event) => {
    setOpenMenuId(menuId);
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setOpenMenuId(null);
    setAnchorEl(null);
  }, []);

  const menuConfig = getMenuConfig({ canApprove, canSeeBudget, canSeePlanner, isAdmin: isAdminRole, isCompartidos: isCompartidosRole });

  return (
    <nav className="flex items-center h-[43px]" data-tour="main-navigation">
      {menuConfig.map((menu) => {
        if (!menu.visible) return null;
        if (!isModuleEnabled(menu.id)) return null;

        const isOpen = openMenuId === menu.id;
        const isActive = isMenuActive(menu.activePrefixes);

        return (
          <div key={menu.id} className="border-r border-[var(--header-border,#424242)]">
            <button
              type="button"
              data-tour={menu.dataTour}
              onClick={(e) => handleOpen(menu.id, e)}
              className={clsx(
                "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
                "text-[10px] font-semibold uppercase tracking-wide",
                isOpen || isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-white hover:bg-[var(--header-border,#424242)]"
              )}
            >
              <span>{t(menu.labelKey, menu.labelFallback)}</span>
              <ChevronDown className={clsx("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
            </button>
            <Menu
              anchorEl={isOpen ? anchorEl : null}
              open={isOpen}
              disableScrollLock={true}
              onClose={handleClose}
              MenuListProps={{ sx: { py: 0 } }}
              PaperProps={{
                sx: {
                  minWidth: menu.minWidth || 180,
                  maxHeight: menu.maxHeight || 'calc(100vh - 60px)',
                  overflow: 'auto',
                  ...menuPaperSx,
                },
              }}
            >
              {menu.sections.map((section, sIdx) => {
                if (section.visible === false) return null;

                const visibleItems = section.items.filter((item) => item.visible !== false);
                if (visibleItems.length === 0) return null;

                return (
                  <React.Fragment key={sIdx}>
                    {section.header && (
                      <ListSubheader sx={subheaderSx} disableSticky>
                        {t(section.header.key, section.header.fallback)}
                      </ListSubheader>
                    )}
                    {visibleItems.map((item) => (
                      <MenuItem
                        key={item.to}
                        component={NavLink}
                        to={item.to}
                        onClick={handleClose}
                        sx={isPathActive(item.to) ? activeMenuItemSx : menuItemSx}
                      >
                        {t(item.labelKey, item.labelFallback)}
                      </MenuItem>
                    ))}
                  </React.Fragment>
                );
              })}
            </Menu>
          </div>
        );
      })}
    </nav>
  );
}

export default memo(HeaderNav);
