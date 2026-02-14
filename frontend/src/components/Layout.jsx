/**
 * Layout Component - Header-based navigation
 * Navegacion horizontal en el header (reemplaza sidebar)
 *
 * Inicializa conexion de tiempo real (SSE) para notificaciones
 */

import React, { useEffect, useState, useCallback } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Badge,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { MessageSquare, Wifi, User, Settings, LogOut, ChevronDown, Bell, Home } from "./ui/Icons";
import { useRealtimeStore } from "../store/realtimeStore";
import { useAuthStore } from "../store/authStore";
import { useVertexStore } from "../store/vertexStore";
import { useRealtime } from "../hooks/useRealtime";
import ChatAssistant from "./ChatAssistant";
import HeaderNav from "./HeaderNav";
import ToastContainer from "./ui/ToastContainer";
import SkipLink from "./ui/SkipLink";
import { useI18n } from "../context/i18n";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const { t } = useI18n();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const { toggleChat, getUnshownAlertsCount } = useVertexStore();
  const unshownAlertsCount = getUnshownAlertsCount();
  const unreadCount = useRealtimeStore((state) => state.unreadCount);

  // Inicializar conexion de tiempo real (SSE)
  // Solo se conecta si hay usuario autenticado
  const { isConnected, connectionError } = useRealtime({
    enabled: !!user
  });

  // Global keyboard shortcuts
  useKeyboardShortcuts(
    {
      "g+d": () => navigate("/dashboard"),
      "g+n": () => navigate("/solicitudes/nueva"),
      "g+m": () => navigate("/mis-solicitudes"),
      "g+p": () => navigate("/planificador"),
      "ctrl+k": () => {
        const searchInput = document.querySelector('[data-tour="search-input"]');
        if (searchInput) searchInput.focus();
      },
    },
    { enabled: !!user }
  );

  // Close user menu on route change
  useEffect(() => {
    setUserMenuAnchor(null);
  }, [location.pathname]);

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const isPathActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

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
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        color: 'var(--text-primary)',
        transition: 'color 0.2s, background-color 0.2s',
      }}
    >
      {/* Skip Navigation Link - Accesibilidad WCAG 2.1 AA */}
      <SkipLink targetId="main-content" />

      {/* Header Menu - 43px alto, ancho completo */}
      <AppBar
        position="fixed"
        sx={{
          height: 43,
          backgroundColor: 'var(--header-bg, #212121)',
          borderBottom: '1px solid var(--header-border, #424242)',
          boxShadow: 'none',
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            minHeight: '43px !important',
            height: 43,
          }}
        >
          {/* Izquierda: Logo SPM */}
          <Box sx={{ flexShrink: 0 }}>
            <Box
              sx={{
                width: 86,
                height: 43,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--primary-dark)',
                borderRight: '1px solid var(--header-border, #424242)',
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
                {t("app_name", "SPM")}
              </Typography>
            </Box>
          </Box>

          {/* Centro: Dashboard + Navegacion (centrado) */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 43,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* Home icon */}
              <Box
                component={NavLink}
                to="/dashboard"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 43,
                  height: 43,
                  borderLeft: '1px solid var(--header-border, #424242)',
                  borderRight: '1px solid var(--header-border, #424242)',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  backgroundColor: isPathActive("/dashboard") ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isPathActive("/dashboard") ? 'var(--primary)' : 'var(--header-border, #424242)',
                  },
                }}
                title={t("nav_dashboard", "Dashboard")}
              >
                <Home style={{ width: 20, height: 20 }} />
              </Box>
              {/* Header Navigation */}
              <HeaderNav />
            </Box>
          </Box>

          {/* Derecha: User Menu + Notificaciones */}
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: 43 }}>
            {/* User Menu - primero, con mismo estilo que botones del menu */}
            <Box sx={{ height: 43, borderLeft: '1px solid var(--header-border, #424242)' }}>
              <Box
                component="button"
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  height: 43,
                  px: 2,
                  transition: 'all 0.2s',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: userMenuAnchor || isPathActive("/mi-cuenta") || isPathActive("/mi-cuenta")
                    ? 'var(--primary)'
                    : 'transparent',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: userMenuAnchor || isPathActive("/mi-cuenta") || isPathActive("/mi-cuenta")
                      ? 'var(--primary)'
                      : 'var(--header-border, #424242)',
                  },
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    maxWidth: 100,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    textTransform: 'inherit',
                    letterSpacing: 'inherit',
                  }}
                >
                  {user?.nombre || t("user_default", "Usuario")}
                </Typography>
                <ChevronDown
                  style={{
                    width: 12,
                    height: 12,
                    transition: 'transform 0.2s',
                    transform: userMenuAnchor ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </Box>

              {/* Dropdown Menu - MUI Menu */}
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
                disableScrollLock={true}
                MenuListProps={{ sx: { py: 0 } }}
                PaperProps={{
                  sx: {
                    minWidth: 150,
                    backgroundColor: 'var(--header-bg, #212121)',
                    border: '1px solid var(--header-border, #424242)',
                  }
                }}
              >
                <MenuItem
                  component={NavLink}
                  to="/mi-cuenta"
                  onClick={() => setUserMenuAnchor(null)}
                  sx={{
                    ...menuItemSx,
                    backgroundColor: isPathActive("/mi-cuenta") ? 'var(--primary)' : 'transparent',
                    '&:hover': {
                      backgroundColor: isPathActive("/mi-cuenta") ? 'var(--primary-dark)' : 'var(--header-border, #424242)',
                    },
                  }}
                >
                  {t("user_mi_cuenta", "Mi Cuenta")}
                </MenuItem>
                <MenuItem
                  component={NavLink}
                  to="/mi-cuenta"
                  onClick={() => setUserMenuAnchor(null)}
                  sx={{
                    ...menuItemSx,
                    backgroundColor: isPathActive("/mi-cuenta") ? 'var(--primary)' : 'transparent',
                    '&:hover': {
                      backgroundColor: isPathActive("/mi-cuenta") ? 'var(--primary-dark)' : 'var(--header-border, #424242)',
                    },
                  }}
                >
                  {t("user_ajustes", "Ajustes")}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setUserMenuAnchor(null);
                    handleLogout();
                  }}
                  sx={{
                    ...menuItemSx,
                    color: 'var(--danger)',
                    borderBottom: 'none',
                  }}
                >
                  {t("user_logout", "Cerrar Sesion")}
                </MenuItem>
              </Menu>
            </Box>

            {/* Boton Notificaciones */}
            <Box
              component={NavLink}
              to="/centro-interaccion"
              data-tour="notifications-bell"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 43,
                height: 43,
                borderLeft: '1px solid var(--header-border, #424242)',
                transition: 'all 0.2s',
                textDecoration: 'none',
                backgroundColor: isPathActive("/centro-interaccion") ? 'var(--primary)' : 'transparent',
                color: 'white',
                '&:hover': {
                  backgroundColor: isPathActive("/centro-interaccion") ? 'var(--primary)' : 'var(--header-border, #424242)',
                },
              }}
              title={t("nav_notificaciones", "Notificaciones")}
            >
              <Badge
                badgeContent={unreadCount}
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.6rem',
                    minWidth: '16px',
                    height: '16px',
                  }
                }}
              >
                <Bell
                  style={{ width: 16, height: 16 }}
                  className={unreadCount > 0 ? "animate-notification-blink" : ""}
                />
              </Badge>
            </Box>

            {/* Foro Icon */}
            <Box
              component={NavLink}
              to="/foro"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 43,
                height: 43,
                borderLeft: '1px solid var(--header-border, #424242)',
                transition: 'all 0.2s',
                textDecoration: 'none',
                backgroundColor: isPathActive("/foro") ? 'var(--primary)' : 'transparent',
                color: 'white',
                '&:hover': {
                  backgroundColor: isPathActive("/foro") ? 'var(--primary)' : 'var(--header-border, #424242)',
                },
              }}
              title={t("nav_foro", "Foro")}
            >
              <MessageSquare style={{ width: 16, height: 16 }} />
            </Box>

            {/* Connection Status Indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 43,
                height: 43,
                borderLeft: '1px solid var(--header-border, #424242)',
              }}
              title={isConnected ? "Real Time" : "Offline"}
            >
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                <Wifi style={{ width: 16, height: 16, color: 'var(--fg-muted)', position: 'absolute' }} />
                {isConnected && (
                  <Wifi
                    style={{ width: 16, height: 16, color: 'var(--success)', position: 'absolute' }}
                    className="animate-wifi-fill"
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content area - sin sidebar */}
      <Box
        sx={{
          minHeight: '100vh',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pt: '43px',
        }}
      >
        {/* Page content - Responsive padding */}
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            p: { xs: 1.5, sm: 2, lg: 3 },
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Floating Chat Button - Vertex IA */}
      <IconButton
        onClick={toggleChat}
        data-tour="vertex-chat"
        sx={{
          position: 'fixed',
          zIndex: 50,
          bottom: isMobile ? 16 : 24,
          right: isMobile ? 16 : 24,
          height: isMobile ? 48 : 56,
          width: isMobile ? 48 : 56,
          minHeight: 44,
          minWidth: 44,
          borderRadius: '50%',
          backgroundColor: 'var(--primary-dark)',
          color: 'white',
          boxShadow: 3,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: 6,
            transform: 'scale(1.05)',
            backgroundColor: 'var(--primary-dark)',
          },
        }}
        aria-label="Abrir Vertex IA"
        title={t("tooltip_chat", "Vertex IA - Asistente")}
      >
        {/* Avatar V */}
        <Typography
          component="span"
          sx={{
            fontWeight: 'bold',
            fontSize: isMobile ? '1rem' : '1.125rem',
          }}
        >
          V
        </Typography>
        {/* Badge de alertas */}
        {unshownAlertsCount > 0 && (
          <Box
            component="span"
            sx={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              backgroundColor: 'var(--warning)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 2,
            }}
          >
            {unshownAlertsCount > 9 ? '9+' : unshownAlertsCount}
          </Box>
        )}
      </IconButton>

      {/* Chat Assistant */}
      <ChatAssistant />

      {/* Toast Container for notifications */}
      <ToastContainer />
    </Box>
  );
}
