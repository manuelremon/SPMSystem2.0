/**
 * Sidebar Component - Glass Morphism Style
 * Translucent navigation with blur effect
 */

import React, { useState, memo, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  FileText,
  FilePlus2,
  CheckCircle2,
  Workflow,
  Package,
  Search,
  GitCompare,
  MessageSquare,
  Settings,
  Users,
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
  User,
  LogOut,
  Bell,
  Clock,
  Wifi,
  WifiOff,
  BarChart2,
  LineChart,
  ICON_DEFAULT_COLORS,
  ICON_COLORS,
} from "./ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useRealtimeStore } from "../store/realtimeStore";
import { Tooltip } from "./ui/Tooltip";

// Colores semánticos para iconos del sidebar - usa ICON_COLORS del sistema central
const SIDEBAR_ICON_COLORS = {
  // Navegación principal
  Home: ICON_COLORS.subtle,
  Bell: ICON_COLORS.notification,
  FileText: ICON_COLORS.info,
  FilePlus2: ICON_COLORS.primary,
  ClipboardList: ICON_COLORS.info,
  CheckCircle2: ICON_COLORS.success,

  // Materiales
  Package: ICON_COLORS.logistics,
  Search: ICON_COLORS.info,
  GitCompare: ICON_COLORS.info,

  // Planificador
  Workflow: ICON_COLORS.primary,
  Layers: ICON_COLORS.logistics,
  AlertTriangle: ICON_COLORS.warning,
  TrendingUp: ICON_COLORS.success,
  LineChart: ICON_COLORS.charts,
  BarChart2: ICON_COLORS.charts,
  Clock: ICON_COLORS.time,
  Activity: ICON_COLORS.charts,

  // Admin
  Database: ICON_COLORS.secondary,
  Users: ICON_COLORS.users,
  User: ICON_COLORS.users,
  Shield: ICON_COLORS.secondary,
  Briefcase: ICON_COLORS.money,
  Building: ICON_COLORS.secondary,
  Building2: ICON_COLORS.secondary,
  MapPin: ICON_COLORS.danger,
  Boxes: ICON_COLORS.logistics,
  Server: ICON_COLORS.secondary,
  Truck: ICON_COLORS.logistics,

  // Presupuesto
  Wallet: ICON_COLORS.money,

  // Comunicación
  MessageSquare: ICON_COLORS.communication,

  // Sistema
  Settings: ICON_COLORS.secondary,
  LogOut: ICON_COLORS.danger,
  Wifi: ICON_COLORS.success,
  WifiOff: ICON_COLORS.muted,
};

// Helper para obtener el color del icono
const getIconColor = (iconName, isActive) => {
  if (isActive) return ''; // Cuando está activo, hereda el color del item activo
  return SIDEBAR_ICON_COLORS[iconName] || 'text-slate-500';
};

// Navigation structure
// Base navigation items (without role-specific items)
const getMainNavItems = (canApprove) => [
  {
    key: "dashboard",
    trKey: "nav_dashboard",
    label: "Dashboard",
    to: "/dashboard",
    icon: Home,
    iconName: "Home",
  },
  {
    key: "bandeja-entrada",
    trKey: "nav_bandeja_entrada",
    label: "Bandeja de Entrada",
    to: "/centro-interaccion",
    icon: Bell,
    iconName: "Bell",
  },
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
      { trKey: "nav_catalogo_materiales", label: "Catálogo", to: "/materiales/catalogo", icon: Search, iconName: "Search" },
      { trKey: "nav_equivalencias", label: "Alternativos", to: "/materiales/equivalencias", icon: GitCompare, iconName: "GitCompare" },
    ],
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
        key: "mrp",
        trKey: "nav_mrp",
        label: "MRP",
        icon: Layers,
        iconName: "Layers",
        children: [
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
      { trKey: "nav_sla", label: "SLA", to: "/planificador/sla", icon: Clock, iconName: "Clock" },
      { trKey: "nav_ai", label: "IA Analytics", to: "/planificador/ai", icon: Activity, iconName: "Activity" },
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
      { trKey: "admin_solicitudes_perfil", label: "Solicitudes Perfil", to: "/admin/solicitudes-perfil", icon: User, iconName: "User" },
      { trKey: "admin_planificadores", label: "Planificadores", to: "/admin/planificadores", icon: Workflow, iconName: "Workflow" },
      { trKey: "admin_roles", label: "Roles", to: "/admin/roles", icon: Shield, iconName: "Shield" },
      { trKey: "admin_puestos", label: "Puestos", to: "/admin/puestos", icon: Briefcase, iconName: "Briefcase" },
      { trKey: "admin_sectores", label: "Sectores", to: "/admin/sectores", icon: Building, iconName: "Building" },
      { trKey: "admin_presupuestos", label: "Presupuestos", to: "/admin/presupuestos", icon: ClipboardList, iconName: "ClipboardList" },
    ],
  },
  {
    key: "locaciones",
    trKey: "admin_cat_locaciones",
    label: "Locaciones",
    icon: MapPin,
    iconName: "MapPin",
    children: [
      { trKey: "admin_centros", label: "Centros", to: "/admin/centros", icon: Building2, iconName: "Building2" },
      { trKey: "admin_almacenes", label: "Almacenes", to: "/admin/almacenes", icon: Boxes, iconName: "Boxes" },
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
    ],
  },
  {
    key: "proveedores",
    trKey: "admin_cat_proveedores",
    label: "Proveedores",
    icon: Truck,
    iconName: "Truck",
    children: [
      { trKey: "admin_proveedores_internos", label: "Internos", to: "/admin/proveedores?tab=internos", icon: Boxes, iconName: "Boxes" },
      { trKey: "admin_proveedores_externos", label: "Externos", to: "/admin/proveedores?tab=externos", icon: Package, iconName: "Package" },
    ],
  },
];

function Sidebar({ collapsed, onToggle, isConnected = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, logout } = useAuthStore();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Obtener unreadCount directamente del store (reactivo)
  const unreadCount = useRealtimeStore((state) => state.unreadCount);

  // Handle logout (memoizado para evitar re-renders)
  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

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
  const isBudgetApprover = () => hasRole("aprobador presupuestos") || hasRole("aprobador_presupuestos");
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

  // Render a single nav item
  const renderNavItem = (item, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.key];
    const isActive = item.to ? isPathActive(item.to) : false;
    const label = t(item.trKey, item.label);
    const isNotifications = item.key === "bandeja-entrada";
    const hasNotifications = isNotifications && unreadCount > 0;
    const iconColor = getIconColor(item.iconName, isActive);

    const baseClass = clsx(
      "flex items-center gap-3 w-full rounded-xl transition-all duration-200",
      "text-sm font-medium",
      depth === 0 ? "px-3 py-2.5" : "px-3 py-2 pl-10",
      isActive
        ? "bg-blue-500/10 text-blue-600 shadow-sm"
        : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
    );

    // Collapsed mode - show only icon with tooltip
    if (collapsed && depth === 0) {
      return (
        <Tooltip key={item.key || item.to} content={`${label}${hasNotifications ? ` (${unreadCount})` : ""}`} position="right" delay={0} className="w-full flex justify-center py-0.5">
          {item.to ? (
            <NavLink to={item.to} className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 hover:bg-white/50">
              <Icon className={clsx("w-5 h-5 flex-shrink-0", iconColor, hasNotifications && "animate-notification-blink")} />
              {hasNotifications && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[8px] font-bold text-blue-600 bg-white border-2 border-blue-500 rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={() => hasChildren && toggleMenu(item.key)}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 hover:bg-white/50"
            >
              <Icon className={clsx("w-5 h-5 flex-shrink-0", iconColor)} />
            </button>
          )}
        </Tooltip>
      );
    }

    // Expanded mode
    if (item.to && !hasChildren) {
      return (
        <NavLink key={item.to} to={item.to} className={baseClass}>
          <Icon className={clsx("w-4 h-4 flex-shrink-0", !isActive && iconColor, hasNotifications && "animate-notification-blink")} />
          <span className="truncate">{label}</span>
          {hasNotifications && (
            <span className="ml-auto min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-blue-600 bg-white border-2 border-blue-500 rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </NavLink>
      );
    }

    // Parent item with children
    return (
      <div key={item.key}>
        <button
          type="button"
          onClick={() => toggleMenu(item.key)}
          className={clsx(baseClass, "justify-between")}
        >
          <div className="flex items-center gap-3">
            <Icon className={clsx("w-4 h-4 flex-shrink-0", iconColor)} />
            <span className="truncate">{label}</span>
          </div>
          <ChevronDown
            className={clsx("w-4 h-4 transition-transform duration-200 text-slate-400", isExpanded && "rotate-180")}
          />
        </button>

        {/* Children */}
        {isExpanded && (
          <div className="mt-1 space-y-0.5 animate-fade-in">
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
                <NavLink
                  key={child.to}
                  to={child.to}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 pl-10 rounded-xl transition-all duration-200",
                    "text-sm font-medium",
                    childActive
                      ? "bg-blue-500/10 text-blue-600"
                      : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
                  )}
                >
                  <ChildIcon className={clsx("w-4 h-4 flex-shrink-0", !childActive && childIconColor)} />
                  <span className="truncate">{childLabel}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-screen z-40",
        // Glass effect
        "bg-white/70 backdrop-blur-xl",
        "border-r border-white/30",
        "shadow-glass",
        "flex flex-col transition-all duration-300 ease-spring",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Header / Logo - Glass style */}
      <div
        className={clsx(
          "h-16 flex items-center border-b border-white/30",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}images/spm-logo.svg`}
              alt="SPM Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
        )}
        <div className="flex items-center gap-1">
          {/* Collapse/Expand button */}
          <button
            type="button"
            onClick={onToggle}
            className={clsx(
              "h-8 w-8 rounded-lg grid place-items-center",
              "text-slate-500 hover:text-slate-700",
              "hover:bg-white/50 transition-all duration-150"
            )}
            title={collapsed ? t("tooltip_expandir", "Expandir") : t("tooltip_colapsar", "Colapsar")}
            aria-label={collapsed ? t("tooltip_expandir", "Expandir") : t("tooltip_colapsar", "Colapsar")}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* User Menu - Top - Accordion style like other nav items */}
      <div className="border-b border-white/30 px-2 py-2">
        {collapsed ? (
          // Collapsed: show only avatar with tooltip
          <Tooltip content={user?.nombre || t("user_default", "Usuario")} position="right" className="w-full flex justify-center">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 hover:bg-white/50"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm shadow-md">
                {user?.nombre?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
              </div>
            </button>
          </Tooltip>
        ) : (
          // Expanded: show full user menu with accordion behavior
          <div>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={clsx(
                "flex items-center gap-3 w-full rounded-xl transition-all duration-200",
                "text-sm font-medium px-3 py-2.5",
                "text-slate-600 hover:text-slate-800 hover:bg-white/50 justify-between"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-xs shadow-md">
                  {user?.nombre?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate max-w-[120px]">
                    {user?.nombre || t("user_default", "Usuario")}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={clsx(
                  "w-4 h-4 transition-transform duration-200",
                  userMenuOpen && "rotate-180"
                )}
              />
            </button>

            {/* Accordion children - same style as other nav items */}
            {userMenuOpen && (
              <div className="mt-1 space-y-0.5 animate-fade-in">
                <NavLink
                  to="/mi-cuenta"
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 pl-10 rounded-xl transition-all duration-200",
                    "text-sm font-medium",
                    isPathActive("/mi-cuenta")
                      ? "bg-blue-500/10 text-blue-600"
                      : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
                  )}
                >
                  <User className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{t("user_mi_cuenta", "Mi Cuenta")}</span>
                </NavLink>
                <NavLink
                  to="/ajustes"
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 pl-10 rounded-xl transition-all duration-200",
                    "text-sm font-medium",
                    isPathActive("/ajustes")
                      ? "bg-blue-500/10 text-blue-600"
                      : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
                  )}
                >
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{t("user_ajustes", "Ajustes")}</span>
                </NavLink>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {/* Main nav */}
        {mainNavItems.map((item) => renderNavItem(item))}

        {/* Planner section */}
        {canSeePlanner && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-2 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("nav_planificacion", "Planificación")}
                </span>
              </div>
            )}
            {plannerNavItems.map((item) => renderNavItem(item))}
          </>
        )}

        {/* Budget */}
        {canSeeBudget && (
          collapsed ? (
            <Tooltip content={t("nav_presupuesto", "Presupuesto")} position="right" delay={0} className="w-full flex justify-center py-0.5">
              <NavLink
                to="/presupuestos"
                className={clsx(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150",
                  isPathActive("/presupuestos")
                    ? "bg-blue-500/10 text-blue-600"
                    : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
                )}
              >
                <Wallet className="w-5 h-5 flex-shrink-0" />
              </NavLink>
            </Tooltip>
          ) : (
            <NavLink
              to="/presupuestos"
              className={clsx(
                "flex items-center gap-3 w-full rounded-xl transition-all duration-150",
                "text-sm font-medium px-3 py-2.5",
                isPathActive("/presupuestos")
                  ? "bg-blue-500/10 text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              )}
            >
              <Wallet className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t("nav_presupuesto", "Presupuesto")}</span>
            </NavLink>
          )
        )}

        {/* Admin section */}
        {isAdmin() && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-2 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("nav_admin", "Administración")}
                </span>
              </div>
            )}
            {adminNavHierarchy.map((item) => renderNavItem(item))}
          </>
        )}

      </nav>

      {/* Bottom fixed section: Connection indicator + Foro + Logout */}
      <div className="border-t border-white/30 px-2 py-2 space-y-1">
        {/* Connection indicator */}
        {collapsed ? (
          <Tooltip
            content={isConnected ? t("realtime_connected", "Conectado en tiempo real") : t("realtime_disconnected", "Sin conexion en tiempo real")}
            position="right"
            delay={0}
            className="w-full flex justify-center py-0.5"
          >
            <div className="flex items-center justify-center w-8 h-8">
              {isConnected ? (
                <Wifi className={`w-4 h-4 ${ICON_COLORS.success}`} />
              ) : (
                <WifiOff className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className={`w-4 h-4 ${ICON_COLORS.success}`} />
                <span className="text-emerald-600 text-xs">{t("realtime_live", "En vivo")}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 text-xs">{t("realtime_offline", "Sin conexion")}</span>
              </>
            )}
          </div>
        )}

        {/* Foro button */}
        {collapsed ? (
          <Tooltip content={t("nav_foro", "Foro")} position="right" delay={0} className="w-full flex justify-center py-0.5">
            <NavLink
              to="/foro"
              className={clsx(
                "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150",
                isPathActive("/foro")
                  ? "bg-blue-500/10 text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              )}
            >
              <MessageSquare className="w-5 h-5" />
            </NavLink>
          </Tooltip>
        ) : (
          <NavLink
            to="/foro"
            className={clsx(
              "flex items-center gap-3 w-full rounded-xl transition-all duration-150",
              "text-sm font-medium px-3 py-2.5",
              isPathActive("/foro")
                ? "bg-blue-500/10 text-blue-600"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t("nav_foro", "Foro")}</span>
          </NavLink>
        )}

        {/* Logout button */}
        {collapsed ? (
          <Tooltip content={t("user_logout", "Cerrar Sesión")} position="right" delay={0} className="w-full flex justify-center">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 text-red-500 hover:text-red-600 hover:bg-red-50/50"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className={clsx(
              "flex items-center gap-3 w-full rounded-xl transition-all duration-150",
              "text-sm font-medium px-3 py-2.5",
              "text-red-500 hover:text-red-600 hover:bg-red-50/50"
            )}
          >
            <LogOut className="w-4 h-4" />
            <span>{t("user_logout", "Cerrar Sesión")}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// Memoizar para evitar re-renders innecesarios cuando cambian props no relacionadas
export default memo(Sidebar);
