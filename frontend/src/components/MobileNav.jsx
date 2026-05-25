/**
 * MobileNav - Drawer de navegación para dispositivos móviles
 * Se activa con el botón hamburguesa en el header cuando isMobile=true
 */

import React, { useState, useCallback, memo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
} from "@mui/material";
import { ChevronDown, Home } from "./ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useModuleStore } from "../store/moduleStore";

/* ───────── Menu config (misma lógica que HeaderNav) ───────── */

const getMenuConfig = ({ canApprove, canSeeBudget, canSeePlanner, isAdmin, isCompartidos }) => [
  {
    id: 'solicitudes',
    labelKey: 'nav_solicitudes',
    labelFallback: 'Solicitudes',
    visible: !isCompartidos,
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
  {
    id: 'compras',
    labelKey: 'nav_compras',
    labelFallback: 'Compras',
    visible: canSeePlanner,
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
        ],
      },
      {
        header: { key: 'nav_header_facturas', fallback: 'FACTURAS' },
        items: [
          { to: '/procurement/invoices', labelKey: 'nav_invoices', labelFallback: 'Facturas (3-Way)' },
          { to: '/procurement/compliance', labelKey: 'nav_compliance', labelFallback: 'Cumplimiento' },
        ],
      },
    ],
  },
  {
    id: 'planificacion',
    labelKey: 'nav_planificacion',
    labelFallback: 'Planificacion',
    visible: canSeePlanner,
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
        ],
      },
    ],
  },
  {
    id: 'inventario',
    labelKey: 'nav_inventario',
    labelFallback: 'Inventario',
    visible: canSeePlanner,
    sections: [
      {
        header: { key: 'nav_header_almacen', fallback: 'ALMACEN' },
        items: [
          { to: '/operations/warehouse', labelKey: 'nav_warehouse', labelFallback: 'Recepcion' },
          { to: '/operations/cycle-count', labelKey: 'nav_cycle_count', labelFallback: 'Conteo Ciclico' },
        ],
      },
      {
        header: { key: 'nav_header_stock', fallback: 'STOCK' },
        items: [
          { to: '/materiales/catalogo', labelKey: 'nav_catalogo_materiales', labelFallback: 'Catalogo' },
          { to: '/materiales/stock', labelKey: 'nav_stock', labelFallback: 'Stock' },
          { to: '/operations/slob', labelKey: 'nav_slob', labelFallback: 'Inmovilizado' },
        ],
      },
    ],
  },
  {
    id: 'logistica',
    labelKey: 'nav_logistica',
    labelFallback: 'Logistica',
    visible: canSeePlanner,
    sections: [
      {
        header: { key: 'nav_header_transporte', fallback: 'TRANSPORTE' },
        items: [
          { to: '/tms/shipments', labelKey: 'nav_shipments', labelFallback: 'Envios' },
          { to: '/tms/routes', labelKey: 'nav_tms_routes', labelFallback: 'Rutas' },
          { to: '/tms/kpis', labelKey: 'nav_tms_kpis', labelFallback: 'KPIs Transporte' },
        ],
      },
    ],
  },
  {
    id: 'calidad',
    labelKey: 'nav_quality',
    labelFallback: 'Calidad',
    visible: canSeePlanner,
    sections: [
      {
        items: [
          { to: '/quality/inspections', labelKey: 'nav_inspections', labelFallback: 'Inspecciones' },
          { to: '/quality/ncr', labelKey: 'nav_ncr', labelFallback: 'NCR' },
          { to: '/quality/capa', labelKey: 'nav_capa', labelFallback: 'CAPA' },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    labelKey: 'nav_analytics',
    labelFallback: 'Analítica',
    visible: canSeePlanner,
    sections: [
      {
        items: [
          { to: '/analytics/control-tower', labelKey: 'nav_control_tower', labelFallback: 'Torre de Control' },
          { to: '/analytics/executive', labelKey: 'nav_executive', labelFallback: 'Dashboard Ejecutivo' },
          { to: '/analytics/spend', labelKey: 'nav_spend_analytics', labelFallback: 'Análisis de Gastos' },
          { to: '/ai/copilot', labelKey: 'nav_copilot', labelFallback: 'Copiloto IA' },
        ],
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'nav_admin',
    labelFallback: 'Admin',
    visible: isAdmin,
    sections: [
      {
        items: [
          { to: '/admin/usuarios', labelKey: 'admin_usuarios', labelFallback: 'Usuarios' },
          { to: '/admin/roles', labelKey: 'admin_roles', labelFallback: 'Roles' },
          { to: '/admin/estado', labelKey: 'admin_estado', labelFallback: 'Estado del Sistema' },
          { to: '/admin/modules', labelKey: 'admin_modules', labelFallback: 'Modulos' },
        ],
      },
    ],
  },
  {
    id: 'compartidos',
    labelKey: 'nav_compartidos',
    labelFallback: 'Compartidos',
    visible: isCompartidos && !isAdmin,
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

function MobileNav({ open, onClose }) {
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isModuleEnabled = useModuleStore(s => s.isModuleEnabled);
  const [expandedMenu, setExpandedMenu] = useState(null);

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

  const menuConfig = getMenuConfig({ canApprove, canSeeBudget, canSeePlanner, isAdmin: isAdminRole, isCompartidos: isCompartidosRole });

  const isPathActive = useCallback((path) =>
    location.pathname === path || location.pathname.startsWith(path + "/"),
  [location.pathname]);

  const toggleMenu = (menuId) => {
    setExpandedMenu(prev => prev === menuId ? null : menuId);
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 280,
          backgroundColor: 'var(--header-bg, #212121)',
          color: 'white',
          borderRight: '1px solid var(--header-border, #424242)',
        },
      }}
    >
      {/* Header del drawer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 43,
          px: 2,
          backgroundColor: 'var(--primary-dark)',
          borderBottom: '1px solid var(--header-border, #424242)',
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: 'var(--primary-light, #bbdefb)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {t("app_name", "SPM")} — {t("nav_menu", "Menú")}
        </Typography>
        <Box
          component="button"
          onClick={onClose}
          aria-label={t("aria_close_menu", "Cerrar menú")}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '4px',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        </Box>
      </Box>

      {/* Dashboard link directo */}
      <Box
        component={NavLink}
        to="/dashboard"
        onClick={onClose}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          textDecoration: 'none',
          color: 'white',
          borderBottom: '1px solid var(--header-border, #424242)',
          backgroundColor: isPathActive("/dashboard") ? 'var(--primary)' : 'transparent',
          '&:hover': {
            backgroundColor: isPathActive("/dashboard") ? 'var(--primary-dark)' : 'rgba(255,255,255,0.05)',
          },
        }}
      >
        <Home style={{ width: 16, height: 16, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t("nav_dashboard", "Dashboard")}
        </Typography>
      </Box>

      {/* Menús desplegables */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        <List disablePadding>
          {menuConfig.map((menu) => {
            if (!menu.visible) return null;
            if (!isModuleEnabled(menu.id)) return null;

            const isExpanded = expandedMenu === menu.id;

            return (
              <React.Fragment key={menu.id}>
                <ListItemButton
                  onClick={() => toggleMenu(menu.id)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid var(--header-border, #424242)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <ListItemText
                    primary={t(menu.labelKey, menu.labelFallback)}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'white',
                      },
                    }}
                  />
                  <ChevronDown
                    style={{
                      width: 14,
                      height: 14,
                      color: 'rgba(255,255,255,0.5)',
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </ListItemButton>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    {menu.sections.map((section, sIdx) => {
                      if (section.visible === false) return null;
                      const visibleItems = section.items.filter(item => item.visible !== false);
                      if (visibleItems.length === 0) return null;

                      return (
                        <React.Fragment key={sIdx}>
                          {section.header && (
                            <Typography
                              sx={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                px: 2,
                                pt: 1.5,
                                pb: 0.5,
                              }}
                            >
                              {t(section.header.key, section.header.fallback)}
                            </Typography>
                          )}
                          {visibleItems.map(item => (
                            <Box
                              key={item.to}
                              component={NavLink}
                              to={item.to}
                              onClick={onClose}
                              sx={{
                                display: 'block',
                                px: 3,
                                py: 1.25,
                                textDecoration: 'none',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                color: isPathActive(item.to) ? 'var(--primary-light, #bbdefb)' : 'rgba(255,255,255,0.75)',
                                backgroundColor: isPathActive(item.to) ? 'rgba(0,112,243,0.2)' : 'transparent',
                                borderLeft: isPathActive(item.to) ? '3px solid var(--primary)' : '3px solid transparent',
                                '&:hover': {
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                },
                              }}
                            >
                              {t(item.labelKey, item.labelFallback)}
                            </Box>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </Box>
                </Collapse>
              </React.Fragment>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
}

export default memo(MobileNav);
