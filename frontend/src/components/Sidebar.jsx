/**
 * Sidebar Component - Material UI Style
 * Translucent navigation with blur effect
 * Mobile responsive with hamburger menu
 */

import React, { useState, memo, useEffect, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Collapse,
  Tooltip,
  Badge,
  Typography,
} from "@mui/material";
import {
  FileText,
  FilePlus2,
  CheckCircle2,
  Workflow,
  Package,
  Search,
  GitCompare,
  Users,
  User,
  Building2,
  Boxes,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  AlertTriangle,
  TrendingUp,
  Home,
  Shield,
  Briefcase,
  Building,
  ClipboardList,
  MapPin,
  Server,
  Activity,
  Truck,
  Database,
  Bell,
  Clock,
  BarChart2,
  LineChart,
  FileSpreadsheet,
  Menu as MenuIcon,
  X,
  ICON_COLORS,
} from "./ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useRealtimeStore } from "../store/realtimeStore";

// Helper para obtener el color del icono
// Todos los iconos son var(--fg-strong), incluso cuando estan activos (excepto Bell con animacion)
const getIconColor = (iconName, isActive, hasNotifications = false) => {
  if (iconName === 'Bell' && hasNotifications) return ''; // Bell con notificaciones usa animacion
  return 'var(--fg-strong)'; // Todos los iconos siempre en var(--fg-strong)
};

// Navigation structure
// Base navigation items (without role-specific items)
const getMainNavItems = (canApprove) => [
  {
    key: "solicitudes",
    trKey: "nav_solicitudes",
    label: "Solicitudes",
    icon: FileText,
    iconName: "FileText",
    children: [
      { trKey: "nav_nueva", label: "Nueva Solicitud", to: "/solicitudes/nueva", icon: FilePlus2, iconName: "FilePlus2" },
      { trKey: "nav_mis", label: "Mis Solicitudes", to: "/mis-solicitudes", icon: FileText, iconName: "FileText" },
      { trKey: "nav_todas", label: "Todas las Solicitudes", to: "/solicitudes/todas", icon: ClipboardList, iconName: "ClipboardList" },
      // Aprobaciones - solo visible para aprobadores
      ...(canApprove ? [{ trKey: "nav_aprobaciones", label: "Aprobaciones", to: "/aprobaciones", icon: CheckCircle2, iconName: "CheckCircle2" }] : []),
    ],
  },
  {
    key: "materiales",
    trKey: "nav_materiales",
    label: "Materiales",
    icon: Package,
    iconName: "Package",
    children: [
      { trKey: "nav_catalogo_materiales", label: "Catalogo", to: "/materiales/catalogo", icon: Search, iconName: "Search" },
      { trKey: "nav_equivalencias", label: "Alternativos", to: "/materiales/equivalencias", icon: GitCompare, iconName: "GitCompare" },
      { trKey: "nav_stock_masivo", label: "Stock Masivo", to: "/materiales/stock", icon: Boxes, iconName: "Boxes" },
      { trKey: "nav_stock_individual", label: "Stock Individual", to: "/materiales/stock-individual", icon: Package, iconName: "Package" },
    ],
  },
  {
    key: "dashboards",
    trKey: "nav_dashboards",
    label: "Dashboards",
    icon: FileSpreadsheet,
    iconName: "FileSpreadsheet",
    to: "/dashboards",
  },
];

const plannerNavItems = [
  {
    key: "planificador",
    trKey: "nav_planificador",
    label: "Planificador",
    icon: Workflow,
    iconName: "Workflow",
    children: [
      { trKey: "nav_panel_tratamiento", label: "Panel", to: "/planificador", icon: CheckCircle2, iconName: "CheckCircle2" },
      { trKey: "nav_asignadas", label: "Mis Asignadas", to: "/planificador/asignadas", icon: FileText, iconName: "FileText" },
      { trKey: "nav_no_asignadas", label: "No Asignadas", to: "/planificador/no-asignadas", icon: FilePlus2, iconName: "FilePlus2" },
      {
        key: "procurement",
        trKey: "nav_procurement",
        label: "Compras SAP",
        icon: Truck,
        iconName: "Truck",
        children: [
          { trKey: "nav_procurement_dashboard", label: "Panel General", to: "/procurement", icon: Boxes, iconName: "Boxes" },
          { trKey: "nav_procurement_analytics", label: "Analitica", to: "/procurement/analytics", icon: BarChart2, iconName: "BarChart2" },
        ],
      },
      { trKey: "nav_ai", label: "IA Analytics", to: "/planificador/ai", icon: Activity, iconName: "Activity" },
    ],
  },
  {
    key: "mrp",
    trKey: "nav_mrp",
    label: "MRP",
    icon: Layers,
    iconName: "Layers",
    children: [
      { trKey: "nav_mrp_portfolio", label: "Portfolio MRP", to: "/mrp/portfolio", icon: Boxes, iconName: "Boxes" },
      { trKey: "nav_mrp_parametrizar", label: "Parametrizar", to: "/mrp/parametrizar", icon: BarChart2, iconName: "BarChart2" },
      { trKey: "nav_mrp_alertas", label: "Alertas", to: "/planificador/mrp/alertas", icon: AlertTriangle, iconName: "AlertTriangle" },
      { trKey: "nav_mrp_kpis", label: "KPIs", to: "/planificador/mrp/kpis", icon: TrendingUp, iconName: "TrendingUp" },
    ],
  },
  {
    key: "forecast",
    trKey: "nav_forecast",
    label: "Forecast",
    icon: LineChart,
    iconName: "LineChart",
    children: [
      { trKey: "nav_forecast_individual", label: "Individual", to: "/planificador/forecast", icon: BarChart2, iconName: "BarChart2" },
      { trKey: "nav_forecast_masivo", label: "Masivo", to: "/planificador/forecast/masivo", icon: TrendingUp, iconName: "TrendingUp" },
    ],
  },
];


// TMS/FMS Navigation - visible to admin, dispatcher, fleet_manager, driver
const tmsNavItems = [
  {
    key: "tms",
    trKey: "nav_tms",
    label: "Transporte",
    icon: Truck,
    iconName: "Truck",
    children: [
      { trKey: "nav_tms_envios", label: "Envios", to: "/tms/shipments", icon: Package, iconName: "Package" },
      { trKey: "nav_tms_consolidacion", label: "Consolidacion LTL", to: "/tms/consolidation", icon: Boxes, iconName: "Boxes" },
      { trKey: "nav_tms_rutas", label: "Rutas", to: "/tms/routes", icon: MapPin, iconName: "MapPin" },
      { trKey: "nav_tms_cierres", label: "Cierres Financieros", to: "/tms/settlements", icon: Wallet, iconName: "Wallet" },
      { trKey: "nav_tms_tarifas", label: "Tarifas", to: "/tms/tariffs", icon: ClipboardList, iconName: "ClipboardList" },
      { trKey: "nav_tms_kpis", label: "KPIs Transporte", to: "/tms/kpis", icon: BarChart2, iconName: "BarChart2" },
    ],
  },
];

const fmsNavItems = [
  {
    key: "fms",
    trKey: "nav_fms",
    label: "Flota",
    icon: Truck,
    iconName: "Truck",
    children: [
      { trKey: "nav_fms_vehiculos", label: "Vehiculos", to: "/fms/vehicles", icon: Truck, iconName: "Truck" },
      { trKey: "nav_fms_conductores", label: "Conductores", to: "/fms/drivers", icon: User, iconName: "User" },
      { trKey: "nav_fms_ots", label: "Ordenes de Trabajo", to: "/fms/work-orders", icon: Workflow, iconName: "Workflow" },
      { trKey: "nav_fms_kpis", label: "KPIs Flota", to: "/fms/kpis", icon: BarChart2, iconName: "BarChart2" },
    ],
  },
];

const adminNavHierarchy = [
  {
    key: "registros",
    trKey: "admin_cat_registros",
    label: "Registros",
    icon: Database,
    iconName: "Database",
    children: [
      { trKey: "admin_usuarios", label: "Usuarios", to: "/admin/usuarios", icon: Users, iconName: "Users" },
      { trKey: "admin_monitor_usuarios", label: "Monitor Usuarios", to: "/admin/monitor-usuarios", icon: Activity, iconName: "Activity" },
      { trKey: "admin_solicitudes_perfil", label: "Solicitudes Perfil", to: "/admin/solicitudes-perfil", icon: User, iconName: "User" },
      { trKey: "admin_planificadores", label: "Planificadores", to: "/admin/planificadores", icon: Workflow, iconName: "Workflow" },
      { trKey: "admin_roles", label: "Roles", to: "/admin/roles", icon: Shield, iconName: "Shield" },
      { trKey: "admin_puestos", label: "Puestos", to: "/admin/puestos", icon: Briefcase, iconName: "Briefcase" },
      { trKey: "admin_sectores", label: "Sectores", to: "/admin/sectores", icon: Building, iconName: "Building" },
      { trKey: "admin_presupuestos", label: "Presupuestos", to: "/admin/presupuestos", icon: ClipboardList, iconName: "ClipboardList" },
      { trKey: "admin_centros", label: "Centros", to: "/admin/centros", icon: Building2, iconName: "Building2" },
      { trKey: "admin_almacenes", label: "Almacenes", to: "/admin/almacenes", icon: Boxes, iconName: "Boxes" },
      { trKey: "admin_proveedores", label: "Proveedores", to: "/admin/proveedores", icon: Truck, iconName: "Truck" },
      { trKey: "admin_bases_datos", label: "Bases de Datos", to: "/admin/bases-datos", icon: Database, iconName: "Database" },
    ],
  },
  {
    key: "sistema",
    trKey: "admin_cat_sistema",
    label: "Sistema",
    icon: Server,
    iconName: "Server",
    children: [
      { trKey: "admin_estado", label: "Estado del Sistema", to: "/admin/estado", icon: Activity, iconName: "Activity" },
      { trKey: "admin_dashboards", label: "Dashboard 2", to: "/dashboards", icon: FileSpreadsheet, iconName: "FileSpreadsheet" },
      {
        key: "analisis-puntual",
        trKey: "admin_cat_analisis_puntual",
        label: "Analisis Puntual",
        icon: BarChart2,
        iconName: "BarChart2",
        children: [
          { trKey: "admin_ap_importar", label: "Importar Datos", to: "/admin/analisis-puntual", icon: Database, iconName: "Database" },
          { trKey: "admin_ap_mrp", label: "MRP Temporal", to: "/admin/analisis-puntual/mrp", icon: AlertTriangle, iconName: "AlertTriangle" },
          { trKey: "admin_ap_forecast", label: "Forecast Temporal", to: "/admin/analisis-puntual/forecast", icon: LineChart, iconName: "LineChart" },
        ],
      },
    ],
  },
];

function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);

  // Obtener unreadCount directamente del store (reactivo)
  const unreadCount = useRealtimeStore((state) => state.unreadCount);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Role helpers
  const getUserRoles = () => {
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
  };

  const hasRole = (targetRole) => {
    const roles = getUserRoles();
    return roles.some((r) => String(r).toLowerCase().includes(targetRole.toLowerCase()));
  };

  const isAdmin = () => hasRole("admin");
  const isPlanner = () => hasRole("planificador");
  const isJefe = () => hasRole("jefe");
  const isCoordinador = () => hasRole("coordinador");
  const isBudgetApprover = () => hasRole("aprobador presupuestos") || hasRole("aprobador_presupuestos") || hasRole("aprobador de presupuesto");
  const isRequestApprover = () => hasRole("aprobador solicitudes") || hasRole("aprobador_solicitudes");
  const canSeePlanner = isPlanner() || isAdmin();
  const canSeeBudget = isAdmin() || isJefe() || isCoordinador() || isBudgetApprover();
  const isGerente = () => hasRole("gerente");
  const canApprove = isAdmin() || isJefe() || isCoordinador() || isRequestApprover() || isGerente();

  // Get main nav items with role-based filtering
  const mainNavItems = getMainNavItems(canApprove);

  const toggleMenu = useCallback((key) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isPathActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  // Common styles
  const listItemButtonSx = (isActive, depth = 0) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    width: '100%',
    transition: 'all 0.2s',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
    px: depth === 0 ? 2 : 2,
    py: depth === 0 ? 1 : 0.75,
    pl: depth === 0 ? 2 : 3,
    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
    color: isActive ? 'white' : 'var(--fg-strong)',
    '&:hover': {
      color: isActive ? 'white' : 'var(--primary)',
      backgroundColor: isActive ? 'var(--primary)' : 'var(--border)',
    },
  });

  // Render a single nav item
  const renderNavItem = (item, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.key];
    const isActive = item.to ? isPathActive(item.to) : false;
    const label = t(item.trKey, item.label);
    const isNotifications = item.key === "bandeja-entrada";
    const hasNotifications = isNotifications && unreadCount > 0;
    const iconColor = getIconColor(item.iconName, isActive, hasNotifications);

    // Collapsed mode - show only icon with tooltip
    if (collapsed && depth === 0) {
      return (
        <Tooltip key={item.key || item.to} title={`${label}${hasNotifications ? ` (${unreadCount})` : ""}`} placement="right">
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.25 }}>
            {item.to ? (
              <ListItemButton
                component={NavLink}
                to={item.to}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: 0,
                  transition: 'all 0.2s',
                  '&:hover': { backgroundColor: 'var(--border)' },
                }}
              >
                <Badge
                  badgeContent={hasNotifications ? unreadCount : 0}
                  color="primary"
                  max={99}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.65rem',
                      minWidth: '16px',
                      height: '16px',
                    }
                  }}
                >
                  <Icon
                    style={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      color: iconColor,
                    }}
                    className={hasNotifications ? "animate-notification-blink" : ""}
                  />
                </Badge>
              </ListItemButton>
            ) : (
              <IconButton
                onClick={() => hasChildren && toggleMenu(item.key)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 0,
                  transition: 'all 0.2s',
                  '&:hover': { backgroundColor: 'var(--border)' },
                }}
              >
                <Icon style={{ width: 20, height: 20, flexShrink: 0, color: iconColor }} />
              </IconButton>
            )}
          </Box>
        </Tooltip>
      );
    }

    // Expanded mode
    if (item.to && !hasChildren) {
      return (
        <Badge
          key={item.to}
          badgeContent={hasNotifications ? unreadCount : 0}
          color="primary"
          max={99}
          sx={{
            width: '100%',
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              minWidth: '18px',
              height: '18px',
              top: 4,
              right: 8,
            }
          }}
        >
          <ListItemButton
            component={NavLink}
            to={item.to}
            sx={listItemButtonSx(isActive, depth)}
          >
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
              <Icon
                style={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  color: iconColor,
                }}
                className={hasNotifications ? "animate-notification-blink" : ""}
              />
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                sx: {
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }
              }}
            />
          </ListItemButton>
        </Badge>
      );
    }

    // Parent item with children
    return (
      <Box key={item.key}>
        <ListItemButton
          onClick={() => toggleMenu(item.key)}
          sx={{
            ...listItemButtonSx(false, depth),
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon style={{ width: 14, height: 14, flexShrink: 0, color: iconColor }} />
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {label}
            </Typography>
          </Box>
          <ChevronDown
            style={{
              width: 12,
              height: 12,
              color: 'var(--fg-strong)',
              transition: 'transform 0.2s',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </ListItemButton>

        {/* Children */}
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ mt: 0.5 }}>
            {item.children.map((child) => {
              // Nested children (like MRP)
              if (child.children) {
                return renderNavItem(child, depth + 1);
              }

              const ChildIcon = child.icon;
              const childActive = isPathActive(child.to);
              const childLabel = t(child.trKey, child.label);
              const childIconColor = getIconColor(child.iconName, childActive);

              return (
                <ListItemButton
                  key={child.to}
                  component={NavLink}
                  to={child.to}
                  sx={listItemButtonSx(childActive, depth + 1)}
                >
                  <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                    <ChildIcon style={{ width: 12, height: 12, flexShrink: 0, color: childIconColor }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={childLabel}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Collapse>
      </Box>
    );
  };

  const drawerWidth = collapsed ? 43 : 160;
  const mobileDrawerWidth = 288;

  const sidebarContent = (
    <Box
      component="nav"
      sx={{
        flex: 1,
        overflowY: 'auto',
        py: 1,
        px: 0.5,
        maxHeight: 'calc(100vh - 43px - 100px)',
      }}
    >
      {/* Section: Principal */}
      {!collapsed ? (
        <Box sx={{ pb: 0.5, px: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography
            sx={{
              fontSize: '8px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--fg-muted)',
            }}
          >
            {t("nav_principal", "Principal")}
          </Typography>
          <IconButton
            onClick={onToggle}
            size="small"
            sx={{
              width: 20,
              height: 20,
              borderRadius: 0,
              color: 'var(--fg-muted)',
              '&:hover': { color: 'var(--primary)', backgroundColor: 'var(--border)' },
            }}
            title={t("tooltip_colapsar", "Colapsar")}
            aria-label={t("tooltip_colapsar", "Colapsar")}
          >
            <ChevronLeft style={{ width: 12, height: 12, color: 'var(--fg-strong)' }} />
          </IconButton>
        </Box>
      ) : (
        <Box sx={{ pb: 0.5, px: 0.5, display: 'flex', justifyContent: 'center' }}>
          <IconButton
            onClick={onToggle}
            size="small"
            sx={{
              width: 24,
              height: 24,
              borderRadius: 0,
              color: 'var(--fg-muted)',
              '&:hover': { color: 'var(--primary)', backgroundColor: 'var(--border)' },
            }}
            title={t("tooltip_expandir", "Expandir")}
            aria-label={t("tooltip_expandir", "Expandir")}
          >
            <ChevronRight style={{ width: 14, height: 14, color: 'var(--fg-strong)' }} />
          </IconButton>
        </Box>
      )}

      {/* Section: Operaciones */}
      {!collapsed && (
        <Box sx={{ pt: 1, pb: 0.5, px: 1 }}>
          <Typography
            sx={{
              fontSize: '8px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--fg-muted)',
            }}
          >
            {t("nav_operaciones", "Operaciones")}
          </Typography>
        </Box>
      )}

      {/* Solicitudes y Materiales */}
      <List disablePadding>
        {mainNavItems.map((item) => renderNavItem(item))}
      </List>

      {/* Presupuesto - ahora en Operaciones */}
      {canSeeBudget && (
        collapsed ? (
          <Tooltip title={t("nav_presupuesto", "Presupuesto")} placement="right">
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.25 }}>
              <ListItemButton
                component={NavLink}
                to="/presupuestos"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  borderRadius: 0,
                  transition: 'all 0.15s',
                  backgroundColor: isPathActive("/presupuestos") ? 'var(--primary)' : 'transparent',
                  color: 'var(--fg-strong)',
                  '&:hover': { color: 'var(--primary)', backgroundColor: 'var(--border)' },
                }}
              >
                <Wallet style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--fg-strong)' }} />
              </ListItemButton>
            </Box>
          </Tooltip>
        ) : (
          <ListItemButton
            component={NavLink}
            to="/presupuestos"
            sx={listItemButtonSx(isPathActive("/presupuestos"))}
          >
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
              <Wallet style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--fg-strong)' }} />
            </ListItemIcon>
            <ListItemText
              primary={t("nav_presupuesto", "Presupuesto")}
              primaryTypographyProps={{
                sx: {
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }
              }}
            />
          </ListItemButton>
        )
      )}

      {/* Section: Planificacion */}
      {canSeePlanner && (
        <>
          {!collapsed && (
            <Box sx={{ pt: 1, pb: 0.5, px: 1 }}>
              <Typography
                sx={{
                  fontSize: '8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--fg-muted)',
                }}
              >
                {t("nav_planificacion", "Planificacion")}
              </Typography>
            </Box>
          )}
          <List disablePadding>
            {plannerNavItems.map((item) => renderNavItem(item))}
          </List>
        </>
      )}

      {/* Section: Transporte (TMS) */}
      {(isAdmin() || canSeePlanner) && (
        <>
          {!collapsed && (
            <Box sx={{ pt: 1, pb: 0.5, px: 1 }}>
              <Typography
                sx={{
                  fontSize: '8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--fg-muted)',
                }}
              >
                {t("nav_logistica", "Logistica")}
              </Typography>
            </Box>
          )}
          <List disablePadding>
            {tmsNavItems.map((item) => renderNavItem(item))}
            {fmsNavItems.map((item) => renderNavItem(item))}
          </List>
        </>
      )}

      {/* Section: Administracion */}
      {isAdmin() && (
        <>
          {!collapsed && (
            <Box sx={{ pt: 1, pb: 0.5, px: 1 }}>
              <Typography
                sx={{
                  fontSize: '8px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--fg-muted)',
                }}
              >
                {t("nav_admin", "Administracion")}
              </Typography>
            </Box>
          )}
          <List disablePadding>
            {adminNavHierarchy.map((item) => renderNavItem(item))}
          </List>
        </>
      )}
    </Box>
  );

  return (
    <>
      {/* Mobile hamburger button - visible only on small screens */}
      <IconButton
        onClick={() => setMobileOpen(!mobileOpen)}
        sx={{
          position: 'fixed',
          top: 52,
          left: 12,
          zIndex: 50,
          display: { xs: 'grid', md: 'none' },
          placeItems: 'center',
          height: 44,
          width: 44,
          minHeight: 44,
          minWidth: 44,
          borderRadius: 0,
          backgroundColor: 'var(--border)',
          boxShadow: 3,
          border: '1px solid var(--fg-muted)',
          color: 'var(--fg-strong)',
          '&:hover': { color: 'var(--primary)', backgroundColor: 'var(--bg-soft)' },
          transition: 'all 0.15s',
          '&:active': { transform: 'scale(0.95)' },
        }}
        aria-label={mobileOpen ? t("menu_close", "Cerrar menu") : t("menu_open", "Abrir menu")}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <X style={{ width: 20, height: 20, color: 'var(--fg-strong)' }} />
        ) : (
          <MenuIcon style={{ width: 20, height: 20, color: 'var(--fg-strong)' }} />
        )}
      </IconButton>

      {/* Mobile overlay */}
      {mobileOpen && (
        <Box
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: { xs: 'block', md: 'none' },
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        />
      )}

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: mobileDrawerWidth,
            top: 43,
            height: 'calc(100vh - 43px)',
            backgroundColor: 'var(--border)',
            borderRight: '1px solid var(--fg-muted)',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Desktop Sidebar */}
      <Box
        component="aside"
        sx={{
          position: 'fixed',
          left: 0,
          top: 43,
          height: 'calc(100vh - 43px)',
          zIndex: 40,
          backgroundColor: 'var(--border)',
          borderRight: '1px solid var(--fg-muted)',
          boxShadow: 6,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          width: drawerWidth,
        }}
      >
        {sidebarContent}
      </Box>
    </>
  );
}

// Memoizar para evitar re-renders innecesarios cuando cambian props no relacionadas
export default memo(Sidebar);
