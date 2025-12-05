import React, { useEffect, useState, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import api from "../services/api";
import {
  FileText,
  FilePlus2,
  CheckCircle2,
  Workflow,
  User,
  LogOut,
  Settings,
  Building2,
  Boxes,
  Building,
  Users,
  ClipboardList,
  Activity,
  ChevronDown,
  ChevronRight,
  Bell,
  Menu,
  X,
  MessageSquare,
  Package,
  Briefcase,
  Shield,
  Database,
  MapPin,
  Server,
  BarChart3,
  Clock,
  HelpCircle,
  Wallet,
  Trophy,
  Truck,
} from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import ChatAssistant from "./ChatAssistant";
import logo from "../assets/spm-logo.png";
import { useI18n } from "../context/i18n";

const adminNavHierarchy = [
  {
    trKey: "admin_cat_registros",
    label: "Registros",
    icon: Database,
    items: [
      { trKey: "admin_usuarios", label: "Usuarios", to: "/admin/usuarios", icon: Users },
      { trKey: "admin_planificadores", label: "Planificadores", to: "/admin/planificadores", icon: Workflow },
      { trKey: "admin_roles", label: "Roles", to: "/admin/roles", icon: Shield },
      { trKey: "admin_puestos", label: "Puestos", to: "/admin/puestos", icon: Briefcase },
      { trKey: "admin_sectores", label: "Sectores", to: "/admin/sectores", icon: Building },
      { trKey: "admin_presupuestos", label: "Presupuestos", to: "/admin/presupuestos", icon: ClipboardList },
      { trKey: "nav_budget_requests", label: "Solicitudes Presupuesto", to: "/presupuestos", icon: FileText },
    ]
  },
  {
    trKey: "admin_cat_locaciones",
    label: "Locaciones",
    icon: MapPin,
    items: [
      { trKey: "admin_centros", label: "Centros", to: "/admin/centros", icon: Building2 },
      { trKey: "admin_almacenes", label: "Almacenes", to: "/admin/almacenes", icon: Boxes },
    ]
  },
  {
    trKey: "admin_cat_sistema",
    label: "Sistema",
    icon: Server,
    items: [
      { trKey: "admin_metricas", label: "Métricas", to: "/admin/metricas", icon: Settings },
      { trKey: "admin_estado", label: "Estado del Sistema", to: "/admin/estado", icon: Activity },
    ]
  },
  {
    trKey: "admin_cat_proveedores",
    label: "Proveedores",
    icon: Truck,
    items: [
      { trKey: "admin_proveedores_internos", label: "Internos", to: "/admin/proveedores?tab=internos", icon: Boxes },
      { trKey: "admin_proveedores_externos", label: "Externos", to: "/admin/proveedores?tab=externos", icon: Package },
    ]
  }
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { lang, setLang, t } = useI18n();
  const [adminOpen, setAdminOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [solicitudesOpen, setSolicitudesOpen] = useState(false);
  const [aprobacionesOpen, setAprobacionesOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminSubmenus, setAdminSubmenus] = useState({
    registros: false,
    locaciones: false,
    sistema: false,
    proveedores: false
  });
  const navRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const { toggleChat } = useChatStore();

  // Set dark theme permanently
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    handler();
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setAdminOpen(false);
    setUserOpen(false);
    setSolicitudesOpen(false);
    setAprobacionesOpen(false);
    setPlannerOpen(false);
    setMobileMenuOpen(false);
    // Reset admin submenus when route changes
    setAdminSubmenus({
      registros: false,
      locaciones: false,
      sistema: false,
      proveedores: false
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (ev) => {
      if (navRef.current && !navRef.current.contains(ev.target)) {
        setAdminOpen(false);
        setUserOpen(false);
        setSolicitudesOpen(false);
        setAprobacionesOpen(false);
        setPlannerOpen(false);
        // Reset admin submenus when clicking outside
        setAdminSubmenus({
          registros: false,
          locaciones: false,
          sistema: false,
          proveedores: false
        });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (e) {
      console.error(e);
    }
  };

  // Helper function to parse roles (handles both string and JSON array)
  const getUserRoles = () => {
    if (!user?.rol) return [];

    const rolStr = String(user.rol);

    // Try to parse as JSON array
    if (rolStr.startsWith('[')) {
      try {
        const parsed = JSON.parse(rolStr);
        return Array.isArray(parsed) ? parsed : [rolStr];
      } catch {
        return [rolStr];
      }
    }

    // Single role as string
    return [rolStr];
  };

  const hasRole = (targetRole) => {
    const roles = getUserRoles();
    const targetLower = targetRole.toLowerCase();
    return roles.some(r => String(r).toLowerCase().includes(targetLower));
  };

  const isAdmin = () => hasRole("admin");
  const isPlanner = () => hasRole("planificador");
  const isJefe = () => hasRole("jefe");
  const isCoordinador = () => hasRole("coordinador");
  const canSeePlanner = isPlanner() || isAdmin();
  const canSeeBudget = isAdmin() || isJefe() || isCoordinador();
  const hasNotifications = Array.isArray(user?.notificaciones) && user.notificaciones.length > 0;
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Hook de notificaciones del sistema (solicitudes de perfil, etc.)
  const { unreadCount: unreadNotificationsCount } = useNotifications({ enabled: !!user });

  // Total de notificaciones sin leer (mensajes + notificaciones del sistema)
  const totalUnreadCount = unreadMessagesCount + unreadNotificationsCount;

  // Fetch unread messages count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/mensajes/unread-count');
        setUnreadMessagesCount(response.data?.unread_count || 0);
      } catch (err) {
        // Silently fail - not critical
        console.debug('Error fetching unread count:', err);
      }
    };

    if (user) {
      fetchUnreadCount();
      // Poll every 30 seconds for new messages
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const secondaryNav = [
    { label: t("nav_mi_cuenta", "Mi cuenta"), to: "/mi-cuenta", icon: User },
    { label: t("nav_trivias", "Trivias"), to: "/trivias", icon: Trophy },
    { label: t("nav_ayuda", "Ayuda"), to: "/ayuda", icon: HelpCircle },
  ];

  const toggleAdminSubmenu = (key) => {
    setAdminSubmenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // TensorStax-inspired nav button style
  const navBtnClass = clsx(
    "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold",
    "text-white/90 hover:text-[var(--primary)]",
    "transition-all duration-200 ease-out",
    "hover:bg-white/10 rounded-lg"
  );

  const activeNavClass = "!text-[var(--primary)] bg-[var(--primary)]/15";

  // Dropdown wrapper - invisible bridge to prevent hover gap
  const dropdownWrapperClass = "absolute top-full left-0 pt-2 w-64 z-50";

  // Dropdown style - Panel reveal effect
  const dropdownClass = clsx(
    "bg-[var(--card)] border border-[var(--border)]",
    "rounded-xl shadow-strong overflow-hidden",
    "animate-menu-reveal origin-top-left"
  );

  const dropdownItemClass = clsx(
    "flex items-center gap-3 px-4 py-3",
    "text-sm font-semibold text-white/90",
    "hover:text-[var(--primary)] hover:bg-white/10",
    "transition-all duration-150"
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] transition-colors duration-300">
      {/* Subtle grid background */}
      <div className="grid-lines" />

      {/* Header / Navbar */}
      <header
        className={clsx(
          "sticky top-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)] shadow-[0_4px_24px_rgba(255,107,53,0.08)]"
            : "bg-transparent border-b border-[var(--border)] shadow-[0_4px_24px_rgba(255,107,53,0.08)]"
        )}
      >
        <div className="w-full px-4 lg:px-8">
          <nav ref={navRef} className="h-16 flex items-center justify-between">
            {/* Logo */}
            <NavLink
              to="/dashboard"
              className="flex items-center gap-3 group"
            >
              <div className="h-10 w-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center overflow-hidden transition-all duration-300 group-hover:border-[var(--primary)] group-hover:shadow-glow">
                <img src={logo} alt="SPM" className="h-8 w-8 object-contain" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-lg font-mono font-black uppercase tracking-[0.3em] text-[var(--primary)] drop-shadow-[0_0_10px_rgba(255,107,53,0.6)] [text-shadow:_1px_1px_0_rgba(255,107,53,0.3)]">
                  SPM
                </span>
                <span className="text-[11px] font-bold text-amber-400 tracking-wide">
                  v2.0
                </span>
              </div>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {/* Solicitudes Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setSolicitudesOpen(true);
                  setAdminOpen(false);
                  setAprobacionesOpen(false);
                  setPlannerOpen(false);
                }}
                onMouseLeave={() => setSolicitudesOpen(false)}
              >
                <button
                  type="button"
                  className={clsx(navBtnClass, solicitudesOpen && activeNavClass)}
                >
                  <FileText className="w-4 h-4 text-[var(--primary)]" />
                  <span>{t("nav_solicitudes", "Solicitudes")}</span>
                  <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", solicitudesOpen && "rotate-180")} />
                </button>
                {solicitudesOpen && (
                  <div className={dropdownWrapperClass}>
                    <div className={dropdownClass}>
                      <NavLink to="/solicitudes/nueva" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-1")}>
                        <FilePlus2 className="w-4 h-4 text-[var(--primary)]" />
                        <span>{t("nav_nueva", "Nueva Solicitud")}</span>
                      </NavLink>
                      <NavLink to="/mis-solicitudes" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-2")}>
                        <FileText className="w-4 h-4 text-[var(--primary)]" />
                        <span>{t("nav_mis", "Mis Solicitudes")}</span>
                      </NavLink>
                      <NavLink to="/dashboard" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-3")}>
                        <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
                        <span>{t("nav_todas", "Todas las Solicitudes")}</span>
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>

              {/* Aprobaciones Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setAprobacionesOpen(true);
                  setAdminOpen(false);
                  setSolicitudesOpen(false);
                  setPlannerOpen(false);
                }}
                onMouseLeave={() => setAprobacionesOpen(false)}
              >
                <button
                  type="button"
                  className={clsx(navBtnClass, aprobacionesOpen && activeNavClass)}
                >
                  <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
                  <span>{t("nav_aprobaciones", "Aprobaciones")}</span>
                  <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", aprobacionesOpen && "rotate-180")} />
                </button>
                {aprobacionesOpen && (
                  <div className={dropdownWrapperClass}>
                    <div className={dropdownClass}>
                      <NavLink to="/aprobaciones" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-1")}>
                        <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
                        <span>{t("nav_aprobaciones", "Aprobaciones")}</span>
                      </NavLink>
                      <NavLink to="/aprobaciones/historial" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-2")}>
                        <Clock className="w-4 h-4 text-[var(--primary)]" />
                        <span>{t("nav_historial_aprobaciones", "Historial de Aprobaciones")}</span>
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>

              {/* Planificador Dropdown */}
              {canSeePlanner && (
                <div
                  className="relative"
                  onMouseEnter={() => {
                    setPlannerOpen(true);
                    setAdminOpen(false);
                    setSolicitudesOpen(false);
                    setAprobacionesOpen(false);
                  }}
                  onMouseLeave={() => setPlannerOpen(false)}
                >
                  <button
                    type="button"
                    className={clsx(navBtnClass, plannerOpen && activeNavClass)}
                  >
                    <Workflow className="w-4 h-4 text-[var(--primary)]" />
                    <span>{t("nav_planificador", "Planificador")}</span>
                    <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", plannerOpen && "rotate-180")} />
                  </button>
                  {plannerOpen && (
                    <div className={dropdownWrapperClass}>
                      <div className={dropdownClass}>
                        <NavLink to="/planificador" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-1")}>
                          <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
                          <span>{t("nav_panel_tratamiento", "Panel de Tratamiento")}</span>
                        </NavLink>
                        <NavLink to="/planificador/asignadas" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-2")}>
                          <FileText className="w-4 h-4 text-[var(--primary)]" />
                          <span>{t("nav_asignadas", "Mis Asignadas")}</span>
                        </NavLink>
                        <NavLink to="/planificador/no-asignadas" className={clsx(dropdownItemClass, "animate-menu-item-reveal menu-item-stagger-3")}>
                          <FilePlus2 className="w-4 h-4 text-[var(--primary)]" />
                          <span>{t("nav_no_asignadas", "No Asignadas")}</span>
                        </NavLink>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Presupuesto */}
              {canSeeBudget && (
                <NavLink
                  to="/presupuestos"
                  className={({ isActive }) => clsx(navBtnClass, isActive && activeNavClass)}
                >
                  <Wallet className="w-4 h-4 text-[var(--primary)]" />
                  <span>{t("nav_presupuesto", "Presupuesto")}</span>
                </NavLink>
              )}

              {/* KPI */}
              <NavLink
                to="/kpi"
                className={({ isActive }) => clsx(navBtnClass, isActive && activeNavClass)}
              >
                <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
                <span>{t("nav_kpi", "KPI's")}</span>
              </NavLink>

              {/* Foro */}
              <NavLink
                to="/foro"
                className={({ isActive }) => clsx(navBtnClass, isActive && activeNavClass)}
              >
                <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
                <span>{t("nav_foro", "Foro")}</span>
              </NavLink>

              {/* Admin Dropdown */}
              {isAdmin() && (
                <div
                  className="relative"
                  onMouseEnter={() => {
                    setAdminOpen(true);
                    setSolicitudesOpen(false);
                    setAprobacionesOpen(false);
                    setPlannerOpen(false);
                  }}
                  onMouseLeave={() => {
                    setAdminOpen(false);
                    setAdminSubmenus({
                      registros: false,
                      locaciones: false,
                      sistema: false,
                      proveedores: false
                    });
                  }}
                >
                  <button
                    type="button"
                    className={clsx(navBtnClass, adminOpen && activeNavClass)}
                  >
                    <Settings className="w-4 h-4 text-[var(--primary)]" />
                    <span>{t("nav_admin", "Admin")}</span>
                    <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", adminOpen && "rotate-180")} />
                  </button>
                  {adminOpen && (
                    <div className={clsx(dropdownWrapperClass, "w-72")}>
                      <div className={dropdownClass}>
                        {adminNavHierarchy.map((category, catIdx) => {
                          const CategoryIcon = category.icon;
                          const categoryKey = category.label.toLowerCase();
                          const isExpanded = adminSubmenus[categoryKey];

                          return (
                            <div key={catIdx} className="border-b border-[var(--border)] last:border-0">
                              {/* Category Header */}
                              <button
                                type="button"
                                onMouseEnter={() => toggleAdminSubmenu(categoryKey)}
                                className={clsx(
                                  "w-full flex items-center gap-3 px-4 py-3",
                                  "text-sm font-semibold text-[var(--fg)]",
                                  "hover:bg-[var(--bg-soft)] transition-all duration-150",
                                  "animate-menu-item-reveal",
                                  `menu-item-stagger-${catIdx + 1}`
                                )}
                              >
                                <CategoryIcon className="w-4 h-4 text-[var(--primary)]" />
                                <span className="flex-1 text-left">{t(category.trKey, category.label)}</span>
                                <ChevronRight
                                  className={clsx(
                                    "w-3.5 h-3.5 transition-transform duration-200",
                                    isExpanded && "rotate-90"
                                  )}
                                />
                              </button>

                              {/* Submenu Items */}
                              {isExpanded && (
                                <div className="bg-[var(--bg-soft)]/50 animate-menu-reveal">
                                  {category.items.map((item, itemIdx) => {
                                    const ItemIcon = item.icon;
                                    const active = location.pathname === item.to;
                                    return (
                                      <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={clsx(
                                          "flex items-center gap-3 px-4 py-2.5 pl-11",
                                          "text-sm font-normal text-[var(--fg-muted)]",
                                          "hover:text-[var(--fg-strong)] hover:bg-[var(--bg-elevated)]",
                                          "transition-all duration-150 border-l-2 border-transparent",
                                          "animate-menu-item-reveal",
                                          `menu-item-stagger-${itemIdx + 1}`,
                                          active && "border-l-[var(--primary)] bg-[var(--primary-muted)]/30 text-[var(--primary)] font-medium"
                                        )}
                                      >
                                        <ItemIcon className="w-3.5 h-3.5 text-[var(--primary)]" />
                                        <span>{t(item.trKey, item.label)}</span>
                                      </NavLink>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <NavLink
                to="/notificaciones"
                className={clsx(
                  "relative h-10 w-10 grid place-items-center rounded-lg",
                  "text-[var(--fg-muted)] hover:text-[var(--primary)]",
                  "hover:bg-[var(--bg-elevated)] transition-all duration-200",
                  totalUnreadCount > 0 && "animate-pulse-glow"
                )}
                title={t("tooltip_notificaciones", "Notificaciones")}
              >
                <Bell className="w-5 h-5" />
                {totalUnreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--primary)] text-[var(--on-primary)] text-[10px] font-bold leading-none flex items-center justify-center">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </NavLink>

              {/* Chat Assistant */}
              <button
                type="button"
                onClick={toggleChat}
                className="h-10 w-10 rounded-full bg-transparent border-2 border-[var(--primary)]
                          shadow-[0_0_10px_rgba(255,107,53,0.3),0_0_20px_rgba(255,107,53,0.15)] flex items-center justify-center
                          hover:-translate-y-[2px] hover:shadow-[0_0_15px_rgba(255,107,53,0.5),0_0_30px_rgba(255,107,53,0.25)] active:translate-y-0
                          transition-all duration-150 cursor-pointer animate-chat-alive"
                aria-label="Abrir chat"
                title="Asistente SPM"
                style={{ color: 'var(--primary)' }}
              >
                <MessageSquare className="w-4 h-4" strokeWidth={2.25} />
              </button>

              {/* User Menu */}
              <div
                className="relative"
                onMouseEnter={() => setUserOpen(true)}
                onMouseLeave={() => setUserOpen(false)}
              >
                <button
                  type="button"
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg",
                    "hover:bg-[var(--bg-elevated)] transition-all duration-200",
                    userOpen && "bg-[var(--bg-elevated)]"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-strong)] text-[var(--on-primary)] grid place-items-center font-bold text-sm">
                    {user?.nombre?.[0]?.toUpperCase?.() || user?.username?.[0]?.toUpperCase?.() || "U"}
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-sm font-normal text-[var(--fg-strong)] truncate max-w-[120px]">
                      {user?.nombre || user?.username || "Usuario"}
                    </span>
                  </div>
                  <ChevronDown className={clsx("w-4 h-4 text-[var(--fg-muted)] transition-transform", userOpen && "rotate-180")} />
                </button>

                {userOpen && (
                  <div className={clsx(dropdownWrapperClass, "right-0 left-auto w-52")}>
                    <div className={dropdownClass}>
                      {secondaryNav.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={clsx(dropdownItemClass, "animate-menu-item-reveal", `menu-item-stagger-${idx + 1}`)}
                          >
                            <Icon className="w-4 h-4 text-[var(--primary)]" />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                      <div className="border-t border-[var(--border)] my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={clsx(
                          dropdownItemClass,
                          "w-full text-[var(--danger)] hover:bg-[var(--danger-bg)]",
                          "animate-menu-item-reveal menu-item-stagger-4"
                        )}
                      >
                        <LogOut className="w-4 h-4 text-[var(--danger)]" />
                        <span>{t("nav_cerrar", "Cerrar sesion")}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Language Toggle */}
              <button
                type="button"
                onClick={() => setLang((prev) => (prev === "es" ? "en" : "es"))}
                className={clsx(
                  "h-7 px-2 grid place-items-center rounded-lg",
                  "text-[var(--fg-muted)] hover:text-[var(--primary)]",
                  "bg-transparent border border-[var(--primary)]",
                  "hover:border-[var(--primary-strong)] transition-all duration-200",
                  "font-mono text-[10px] uppercase tracking-wider"
                )}
                title={t("tooltip_lang", "Cambiar idioma")}
                aria-label={t("tooltip_lang", "Cambiar idioma")}
              >
                {lang === "es" ? "ES" : "EN"}
              </button>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden h-10 w-10 grid place-items-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
                aria-label={mobileMenuOpen ? t("tooltip_cerrar_menu", "Cerrar menú") : t("tooltip_abrir_menu", "Abrir menú")}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </nav>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl animate-slideDown">
            <div className="px-4 py-4 space-y-2">
              <NavLink to="/solicitudes/nueva" className={clsx(dropdownItemClass, "rounded-lg")}>
                <FilePlus2 className="w-4 h-4" />
                <span>{t("nav_nueva", "Nueva Solicitud")}</span>
              </NavLink>
              <NavLink to="/mis-solicitudes" className={clsx(dropdownItemClass, "rounded-lg")}>
                <FileText className="w-4 h-4" />
                <span>{t("nav_mis", "Mis Solicitudes")}</span>
              </NavLink>
              <NavLink to="/aprobaciones" className={clsx(dropdownItemClass, "rounded-lg")}>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("nav_aprobaciones", "Aprobaciones")}</span>
              </NavLink>
              <NavLink to="/aprobaciones/historial" className={clsx(dropdownItemClass, "rounded-lg")}>
                <Clock className="w-4 h-4" />
                <span>{t("nav_historial_aprobaciones", "Historial de Aprobaciones")}</span>
              </NavLink>
              {canSeePlanner && (
                <NavLink to="/planificador" className={clsx(dropdownItemClass, "rounded-lg")}>
                  <Workflow className="w-4 h-4" />
                  <span>{t("nav_planificador", "Planificador")}</span>
                </NavLink>
              )}
              <NavLink to="/kpi" className={clsx(dropdownItemClass, "rounded-lg")}>
                <BarChart3 className="w-4 h-4" />
                <span>{t("nav_kpi", "KPI's")}</span>
              </NavLink>
              <NavLink to="/foro" className={clsx(dropdownItemClass, "rounded-lg")}>
                <MessageSquare className="w-4 h-4" />
                <span>{t("nav_foro", "Foro")}</span>
              </NavLink>
              {canSeeBudget && (
                <NavLink to="/presupuestos" className={clsx(dropdownItemClass, "rounded-lg")}>
                  <Wallet className="w-4 h-4" />
                  <span>{t("nav_presupuesto", "Presupuesto")}</span>
                </NavLink>
              )}
              {isAdmin() && (
                <>
                  <div className="border-t border-[var(--border)] my-2" />
                  <p className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-[var(--fg-subtle)]">
                    Admin
                  </p>
                  <NavLink to="/admin/usuarios" className={clsx(dropdownItemClass, "rounded-lg")}>
                    <Users className="w-4 h-4" />
                    <span>{t("admin_usuarios", "Usuarios")}</span>
                  </NavLink>
                  <NavLink to="/admin/centros" className={clsx(dropdownItemClass, "rounded-lg")}>
                    <Building2 className="w-4 h-4" />
                    <span>{t("admin_centros", "Centros")}</span>
                  </NavLink>
                  <NavLink to="/admin/almacenes" className={clsx(dropdownItemClass, "rounded-lg")}>
                    <Boxes className="w-4 h-4" />
                    <span>{t("admin_almacenes", "Almacenes")}</span>
                  </NavLink>
                  <NavLink to="/admin/metricas" className={clsx(dropdownItemClass, "rounded-lg")}>
                    <Settings className="w-4 h-4" />
                    <span>{t("admin_metricas", "Métricas")}</span>
                  </NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full">
        <div className="w-full px-4 lg:px-8 xl:px-12 py-8 lg:py-10">
          {children}
        </div>
      </main>

      {/* Chat Assistant */}
      <ChatAssistant />
    </div>
  );
}
