/**
 * HeaderNav Component - Navegación horizontal en el header
 * Reemplaza el sidebar con menús desplegables
 * Sin iconos en los botones del menú
 */

import React, { useState, useEffect, memo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { ChevronDown } from "./ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";

function HeaderNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();

  // Menu anchors
  const [solicitudesAnchor, setSolicitudesAnchor] = useState(null);
  const [materialesAnchor, setMaterialesAnchor] = useState(null);
  const [planificadorAnchor, setPlanificadorAnchor] = useState(null);
  const [mrpAnchor, setMrpAnchor] = useState(null);
  const [forecastAnchor, setForecastAnchor] = useState(null);
  const [adminAnchor, setAdminAnchor] = useState(null);
  const [qualityAnchor, setQualityAnchor] = useState(null);

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

  const isPathActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  // Close menus on route change
  useEffect(() => {
    setSolicitudesAnchor(null);
    setMaterialesAnchor(null);
    setPlanificadorAnchor(null);
    setMrpAnchor(null);
    setForecastAnchor(null);
    setAdminAnchor(null);
    setQualityAnchor(null);
  }, [location.pathname]);

  const menuItemSx = {
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1,
    px: 2,
    color: 'white',
    borderBottom: '1px solid var(--header-border, #424242)',
    '&:hover': {
      backgroundColor: 'var(--header-border, #424242)',
    },
    '&:last-child': {
      borderBottom: 'none',
    },
  };

  const activeMenuItemSx = {
    ...menuItemSx,
    backgroundColor: 'var(--primary)',
    color: 'white',
    '&:hover': {
      backgroundColor: 'var(--primary-dark)',
      color: 'white',
    },
  };

  const menuPaperSx = {
    backgroundColor: 'var(--header-bg, #212121)',
    border: '1px solid var(--header-border, #424242)',
  };

  return (
    <nav className="flex items-center h-[43px]" data-tour="main-navigation">
      {/* SOLICITUDES */}
      <div className="border-r border-[var(--header-border,#424242)]">
        <button
          type="button"
          data-tour="nav-solicitudes"
          onClick={(e) => setSolicitudesAnchor(e.currentTarget)}
          className={clsx(
            "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
            "text-[10px] font-semibold uppercase tracking-wide",
            solicitudesAnchor || isPathActive("/solicitudes") || isPathActive("/mis-solicitudes") || isPathActive("/aprobaciones")
              ? "bg-[var(--primary)] text-white"
              : "text-white hover:bg-[var(--header-border,#424242)]"
          )}
        >
          <span>{t("nav_solicitudes", "Solicitudes")}</span>
          <ChevronDown className={clsx("w-3 h-3 transition-transform", solicitudesAnchor && "rotate-180")} />
        </button>
        <Menu
          anchorEl={solicitudesAnchor}
          open={Boolean(solicitudesAnchor)}
          disableScrollLock={true}
          onClose={() => setSolicitudesAnchor(null)}
          MenuListProps={{ sx: { py: 0 } }}
          PaperProps={{ sx: { minWidth: 180, ...menuPaperSx } }}
        >
          <MenuItem
            component={NavLink}
            to="/solicitudes/nueva"
            onClick={() => setSolicitudesAnchor(null)}
            sx={isPathActive("/solicitudes/nueva") ? activeMenuItemSx : menuItemSx}
          >
            {t("nav_nueva", "Nueva Solicitud")}
          </MenuItem>
          <Divider />
          <MenuItem
            component={NavLink}
            to="/mis-solicitudes"
            onClick={() => setSolicitudesAnchor(null)}
            sx={isPathActive("/mis-solicitudes") ? activeMenuItemSx : menuItemSx}
          >
            {t("nav_mis", "Mis Solicitudes")}
          </MenuItem>
          <MenuItem
            component={NavLink}
            to="/solicitudes/todas"
            onClick={() => setSolicitudesAnchor(null)}
            sx={isPathActive("/solicitudes/todas") ? activeMenuItemSx : menuItemSx}
          >
            {t("nav_todas", "Todas las Solicitudes")}
          </MenuItem>
          {canApprove && (
            <MenuItem
              component={NavLink}
              to="/aprobaciones"
              onClick={() => setSolicitudesAnchor(null)}
              sx={isPathActive("/aprobaciones") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_aprobaciones", "Aprobaciones")}
            </MenuItem>
          )}
        </Menu>
      </div>

      {/* MATERIALES */}
      <div className="border-r border-[var(--header-border,#424242)]">
        <button
          type="button"
          onClick={(e) => setMaterialesAnchor(e.currentTarget)}
          className={clsx(
            "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
            "text-[10px] font-semibold uppercase tracking-wide",
            materialesAnchor || isPathActive("/materiales")
              ? "bg-[var(--primary)] text-white"
              : "text-white hover:bg-[var(--header-border,#424242)]"
          )}
        >
          <span>{t("nav_materiales", "Materiales")}</span>
          <ChevronDown className={clsx("w-3 h-3 transition-transform", materialesAnchor && "rotate-180")} />
        </button>
        <Menu
          anchorEl={materialesAnchor}
          open={Boolean(materialesAnchor)}
          disableScrollLock={true}
          onClose={() => setMaterialesAnchor(null)}
          MenuListProps={{ sx: { py: 0 } }}
          PaperProps={{ sx: { minWidth: 150, ...menuPaperSx } }}
        >
          <MenuItem
            component={NavLink}
            to="/materiales/catalogo"
            onClick={() => setMaterialesAnchor(null)}
            sx={isPathActive("/materiales/catalogo") ? activeMenuItemSx : menuItemSx}
          >
            {t("nav_catalogo_materiales", "Catálogo")}
          </MenuItem>
          <MenuItem
            component={NavLink}
            to="/materiales/equivalencias"
            onClick={() => setMaterialesAnchor(null)}
            sx={isPathActive("/materiales/equivalencias") ? activeMenuItemSx : menuItemSx}
          >
            {t("nav_equivalencias", "Alternativos")}
          </MenuItem>
          <MenuItem
            component={NavLink}
            to="/materiales/stock"
            onClick={() => setMaterialesAnchor(null)}
            sx={isPathActive("/materiales/stock") ? activeMenuItemSx : menuItemSx}
          >
            {t("nav_stock", "Stock")}
          </MenuItem>
        </Menu>
      </div>

      {/* PRESUPUESTO */}
      {canSeeBudget && (
        <NavLink
          to="/presupuestos"
          className={clsx(
            "flex items-center px-4 h-[43px] border-r border-[var(--header-border,#424242)] transition-all duration-200",
            "text-[10px] font-semibold uppercase tracking-wide",
            isPathActive("/presupuestos")
              ? "bg-[var(--primary)] text-white"
              : "text-white hover:bg-[var(--header-border,#424242)]"
          )}
        >
          {t("nav_presupuesto", "Presupuesto")}
        </NavLink>
      )}

      {/* PLANIFICADOR */}
      {canSeePlanner && (
        <div className="border-r border-[var(--header-border,#424242)]">
          <button
            type="button"
            data-tour="nav-planificador"
            onClick={(e) => setPlanificadorAnchor(e.currentTarget)}
            className={clsx(
              "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
              "text-[10px] font-semibold uppercase tracking-wide",
              planificadorAnchor || isPathActive("/planificador") || isPathActive("/procurement")
                ? "bg-[var(--primary)] text-white"
                : "text-white hover:bg-[var(--header-border,#424242)]"
            )}
          >
            <span>{t("nav_planificador", "Planificador")}</span>
            <ChevronDown className={clsx("w-3 h-3 transition-transform", planificadorAnchor && "rotate-180")} />
          </button>
          <Menu
            anchorEl={planificadorAnchor}
            open={Boolean(planificadorAnchor)}
          disableScrollLock={true}
            onClose={() => setPlanificadorAnchor(null)}
            MenuListProps={{ sx: { py: 0 } }}
            PaperProps={{ sx: { minWidth: 180, ...menuPaperSx } }}
          >
            <MenuItem
              component={NavLink}
              to="/planificador"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/planificador") && !isPathActive("/planificador/") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_panel_tratamiento", "Panel")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/planificador/asignadas"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/planificador/asignadas") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_asignadas", "Mis Asignadas")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/planificador/no-asignadas"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/planificador/no-asignadas") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_no_asignadas", "No Asignadas")}
            </MenuItem>
            <Divider />
            <MenuItem
              component={NavLink}
              to="/procurement"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/procurement") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_procurement_dashboard", "Compras SAP")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/procurement/scorecard"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/procurement/scorecard") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_scorecard", "Scorecard Proveedores")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/procurement/contracts"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/procurement/contracts") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_contracts", "Contratos")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/procurement/rfq"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/procurement/rfq") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_rfq", "Licitaciones (RFQ)")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/procurement/savings"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/procurement/savings") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_savings", "Cost Savings")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/planificador/ai"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/planificador/ai") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_ai", "IA Analytics")}
            </MenuItem>
            <Divider />
            <MenuItem
              component={NavLink}
              to="/analytics/abc"
              onClick={() => setPlanificadorAnchor(null)}
              sx={isPathActive("/analytics/abc") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_abc_analysis", "ABC Analysis")}
            </MenuItem>
          </Menu>
        </div>
      )}

      {/* MRP */}
      {canSeePlanner && (
        <div className="border-r border-[var(--header-border,#424242)]">
          <button
            type="button"
            onClick={(e) => setMrpAnchor(e.currentTarget)}
            className={clsx(
              "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
              "text-[10px] font-semibold uppercase tracking-wide",
              mrpAnchor || isPathActive("/mrp")
                ? "bg-[var(--primary)] text-white"
                : "text-white hover:bg-[var(--header-border,#424242)]"
            )}
          >
            <span>{t("nav_mrp", "MRP")}</span>
            <ChevronDown className={clsx("w-3 h-3 transition-transform", mrpAnchor && "rotate-180")} />
          </button>
          <Menu
            anchorEl={mrpAnchor}
            open={Boolean(mrpAnchor)}
            disableScrollLock={true}
            onClose={() => setMrpAnchor(null)}
            MenuListProps={{ sx: { py: 0 } }}
            PaperProps={{ sx: { minWidth: 150, ...menuPaperSx } }}
          >
            <MenuItem
              component={NavLink}
              to="/mrp/portfolio"
              onClick={() => setMrpAnchor(null)}
              sx={isPathActive("/mrp/portfolio") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_mrp_portfolio", "Portfolio MRP")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/mrp/parametrizar"
              onClick={() => setMrpAnchor(null)}
              sx={isPathActive("/mrp/parametrizar") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_mrp_parametrizar", "Parametrizar")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/mrp/alertas"
              onClick={() => setMrpAnchor(null)}
              sx={isPathActive("/mrp/alertas") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_mrp_alertas", "Alertas")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/mrp/kpis"
              onClick={() => setMrpAnchor(null)}
              sx={isPathActive("/mrp/kpis") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_mrp_kpis", "KPIs")}
            </MenuItem>
            <Divider />
            <MenuItem
              component={NavLink}
              to="/analytics/what-if"
              onClick={() => setMrpAnchor(null)}
              sx={isPathActive("/analytics/what-if") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_whatif", "What-If Inventario")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/operations/slob"
              onClick={() => setMrpAnchor(null)}
              sx={isPathActive("/operations/slob") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_slob", "Aging & SLOB")}
            </MenuItem>
          </Menu>
        </div>
      )}

      {/* FORECAST */}
      {canSeePlanner && (
        <div className="border-r border-[var(--header-border,#424242)]">
          <button
            type="button"
            onClick={(e) => setForecastAnchor(e.currentTarget)}
            className={clsx(
              "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
              "text-[10px] font-semibold uppercase tracking-wide",
              forecastAnchor || isPathActive("/forecast")
                ? "bg-[var(--primary)] text-white"
                : "text-white hover:bg-[var(--header-border,#424242)]"
            )}
          >
            <span>{t("nav_forecast", "Forecast")}</span>
            <ChevronDown className={clsx("w-3 h-3 transition-transform", forecastAnchor && "rotate-180")} />
          </button>
          <Menu
            anchorEl={forecastAnchor}
            open={Boolean(forecastAnchor)}
            disableScrollLock={true}
            onClose={() => setForecastAnchor(null)}
            MenuListProps={{ sx: { py: 0 } }}
            PaperProps={{ sx: { minWidth: 150, ...menuPaperSx } }}
          >
            <MenuItem
              component={NavLink}
              to="/forecast/individual"
              onClick={() => setForecastAnchor(null)}
              sx={isPathActive("/forecast/individual") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_forecast_individual", "Individual")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/forecast/masivo"
              onClick={() => setForecastAnchor(null)}
              sx={isPathActive("/forecast/masivo") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_forecast_masivo", "Masivo")}
            </MenuItem>
          </Menu>
        </div>
      )}

      {/* QUALITY */}
      {canSeePlanner && (
        <div className="border-r border-[var(--header-border,#424242)]">
          <button
            type="button"
            onClick={(e) => setQualityAnchor(e.currentTarget)}
            className={clsx(
              "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
              "text-[10px] font-semibold uppercase tracking-wide",
              qualityAnchor || isPathActive("/quality")
                ? "bg-[var(--primary)] text-white"
                : "text-white hover:bg-[var(--header-border,#424242)]"
            )}
          >
            <span>{t("nav_quality", "Calidad")}</span>
            <ChevronDown className={clsx("w-3 h-3 transition-transform", qualityAnchor && "rotate-180")} />
          </button>
          <Menu
            anchorEl={qualityAnchor}
            open={Boolean(qualityAnchor)}
            disableScrollLock={true}
            onClose={() => setQualityAnchor(null)}
            MenuListProps={{ sx: { py: 0 } }}
            PaperProps={{ sx: { minWidth: 160, ...menuPaperSx } }}
          >
            <MenuItem
              component={NavLink}
              to="/quality/inspections"
              onClick={() => setQualityAnchor(null)}
              sx={isPathActive("/quality/inspections") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_inspections", "Inspecciones")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/quality/ncr"
              onClick={() => setQualityAnchor(null)}
              sx={isPathActive("/quality/ncr") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_ncr", "NCR")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/quality/capa"
              onClick={() => setQualityAnchor(null)}
              sx={isPathActive("/quality/capa") ? activeMenuItemSx : menuItemSx}
            >
              {t("nav_capa", "CAPA")}
            </MenuItem>
          </Menu>
        </div>
      )}

      {/* ADMIN */}
      {isAdmin() && (
        <div className="border-r border-[var(--header-border,#424242)]">
          <button
            type="button"
            onClick={(e) => setAdminAnchor(e.currentTarget)}
            className={clsx(
              "flex items-center gap-1 px-4 h-[43px] transition-all duration-200",
              "text-[10px] font-semibold uppercase tracking-wide",
              adminAnchor || isPathActive("/admin")
                ? "bg-[var(--primary)] text-white"
                : "text-white hover:bg-[var(--header-border,#424242)]"
            )}
          >
            <span>{t("nav_admin", "Admin")}</span>
            <ChevronDown className={clsx("w-3 h-3 transition-transform", adminAnchor && "rotate-180")} />
          </button>
          <Menu
            anchorEl={adminAnchor}
            open={Boolean(adminAnchor)}
          disableScrollLock={true}
            onClose={() => setAdminAnchor(null)}
            MenuListProps={{ sx: { py: 0 } }}
            PaperProps={{ sx: { minWidth: 180, maxHeight: 400, ...menuPaperSx } }}
          >
            {/* Registros */}
            <MenuItem disabled sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--fg-subtle)', py: 0.5, px: 2 }}>
              REGISTROS
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/usuarios"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/usuarios") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_usuarios", "Usuarios")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/monitor-usuarios"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/monitor-usuarios") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_monitor_usuarios", "Monitor Usuarios")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/roles"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/roles") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_roles", "Roles")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/planificadores"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/planificadores") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_planificadores", "Planificadores")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/puestos"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/puestos") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_puestos", "Puestos")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/centros"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/centros") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_centros", "Centros")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/sectores"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/sectores") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_sectores", "Sectores")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/almacenes"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/almacenes") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_almacenes", "Almacenes")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/proveedores"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/proveedores") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_proveedores", "Proveedores")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/presupuestos"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/presupuestos") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_presupuestos", "Presupuestos")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/reportes/programados"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/reportes/programados") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_reportes_programados", "Reportes Programados")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/auto-aprobacion"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/auto-aprobacion") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_auto_aprobacion", "Auto-Aprobación")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/escalacion"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/escalacion") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_escalacion", "Escalado de Aprobaciones")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/webhooks"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/webhooks") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_webhooks", "Webhooks")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/audit-log"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/audit-log") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_audit_log", "Audit Log")}
            </MenuItem>
            <Divider />
            {/* Sistema */}
            <MenuItem disabled sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--fg-subtle)', py: 0.5, px: 2 }}>
              SISTEMA
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/bases-datos"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/bases-datos") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_bases_datos", "Bases de Datos")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/estado"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/estado") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_estado", "Estado del Sistema")}
            </MenuItem>
            <MenuItem
              component={NavLink}
              to="/admin/analisis-puntual"
              onClick={() => setAdminAnchor(null)}
              sx={isPathActive("/admin/analisis-puntual") ? activeMenuItemSx : menuItemSx}
            >
              {t("admin_ap_importar", "Análisis Puntual")}
            </MenuItem>
          </Menu>
        </div>
      )}

    </nav>
  );
}

export default memo(HeaderNav);
