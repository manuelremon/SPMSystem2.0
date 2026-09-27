import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, IconButton, Stack, Chip, List, ListItem,
  ListItemIcon, ListItemText, Divider, TextField, InputAdornment, MenuItem,
  Select, FormControl, Alert, CircularProgress, Tabs, Tab, Grid,
} from "@mui/material";
import {
  Check as CheckIcon, DoneAll as DoneAllIcon, Delete as DeleteIcon,
  AccessTime as AccessTimeIcon, Person as PersonIcon, Description as DescriptionIcon,
  Warning as WarningIcon, Info as InfoIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, Refresh as RefreshIcon, Inbox as InboxIcon,
  Wifi as WifiIcon, WifiOff as WifiOffIcon, Search as SearchIcon,
  FilterList as FilterListIcon, Inventory as InventoryIcon, Chat as ChatIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";

import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import { formatDate } from "../utils/formatters";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { useRealtime } from "../hooks/useRealtime";
import { PushNotificationToggle } from "../components/ui/PushNotificationToggle";

const filterOptions = [
  { value: "all", key: "notif_filtro_todos", label: "Todos" },
  { value: "solicitud", key: "notif_filtro_solicitudes", label: "Solicitudes" },
  { value: "aprobacion", key: "notif_filtro_aprobaciones", label: "Aprobaciones" },
  { value: "stock", key: "notif_filtro_stock", label: "Consultas de stock" },
  { value: "mensaje", key: "notif_filtro_mensajes", label: "Mensajes" },
  { value: "profile", key: "notif_filtro_perfil", label: "Perfil" },
  { value: "info", key: "notif_filtro_info", label: "Información" },
];

const notificationConfig = {
  info: { icon: InfoIcon, color: "info.main", bgcolor: "info.lighter" },
  success: { icon: CheckCircleIcon, color: "success.main", bgcolor: "success.lighter" },
  warning: { icon: WarningIcon, color: "warning.main", bgcolor: "warning.lighter" },
  error: { icon: CancelIcon, color: "error.main", bgcolor: "error.lighter" },
  profile_request: { icon: PersonIcon, color: "secondary.main", bgcolor: "secondary.lighter" },
  profile_approved: { icon: CheckCircleIcon, color: "success.main", bgcolor: "success.lighter" },
  profile_rejected: { icon: CancelIcon, color: "error.main", bgcolor: "error.lighter" },
  solicitud_created: { icon: DescriptionIcon, color: "info.main", bgcolor: "info.lighter" },
  solicitud_approved: { icon: CheckCircleIcon, color: "success.main", bgcolor: "success.lighter" },
  solicitud_rejected: { icon: CancelIcon, color: "error.main", bgcolor: "error.lighter" },
  solicitud_planned: { icon: AccessTimeIcon, color: "warning.main", bgcolor: "warning.lighter" },
  solicitud_to_plan: { icon: AccessTimeIcon, color: "warning.dark", bgcolor: "warning.lighter" },
  mensaje_nuevo: { icon: ChatIcon, color: "primary.main", bgcolor: "primary.lighter" },
  stock_consulta: { icon: InventoryIcon, color: "warning.main", bgcolor: "warning.lighter" },
  stock_consulta_respuesta: { icon: CheckCircleIcon, color: "success.main", bgcolor: "success.lighter" },
};

function formatTimeAgo(dateStr, t) {
  if (!dateStr) return "";
  const diff = new Date() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  const hace = t("notif_hace", "Hace");
  if (mins < 1) return t("notif_ahora", "Ahora");
  if (mins < 60) return `${hace} ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hace} ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${hace} ${days} d`;
  return formatDate(dateStr);
}

export default function Notificaciones() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const {
    notifications, unreadCount, isLoading, isConnected, connectionError,
    markAsRead, markAllAsRead, deleteNotification, refresh
  } = useRealtime({ enabled: !!user });

  const getTypeCategory = useCallback((tipo) => {
    if (!tipo) return "info";
    if (tipo.includes("solicitud_created") || tipo.includes("solicitud_planned") || tipo.includes("solicitud_to_plan")) return "solicitud";
    if (tipo.includes("solicitud_approved") || tipo.includes("solicitud_rejected")) return "aprobacion";
    if (tipo.includes("stock_consulta")) return "stock";
    if (tipo.includes("mensaje")) return "mensaje";
    if (tipo.includes("profile")) return "profile";
    return "info";
  }, []);

  const filteredNotifications = useMemo(() => {
    let result = activeTab === 0 ? notifications.filter(n => !n.leido) : notifications.filter(n => n.leido);
    if (filterType !== "all") {
      result = result.filter(n => getTypeCategory(n.tipo) === filterType);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(n =>
        `${n.mensaje} ${n.tipo} ${n.solicitud_id}`.toLowerCase().includes(term)
      );
    }
    return result;
  }, [notifications, activeTab, filterType, searchTerm, getTypeCategory]);

  const readCount = useMemo(() => notifications.filter(n => n.leido).length, [notifications]);

  const handleMarkAsRead = useCallback(async (id) => {
    if (await markAsRead(id)) {
      setMsg(t("notif_marcada_leida", "Notificación marcada como leída"));
      setTimeout(() => setMsg(""), 2000);
    }
  }, [markAsRead, t]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (await markAllAsRead()) {
      setMsg(t("notif_todas_leidas", "Todas las notificaciones se marcaron como leídas"));
      setTimeout(() => setMsg(""), 2000);
    }
  }, [markAllAsRead, t]);

  const handleDelete = useCallback(async (id) => {
    if (confirm(t("notif_confirmar_eliminar", "¿Eliminar esta notificación?")) && (await deleteNotification(id))) {
      setMsg(t("notif_eliminada", "Notificación eliminada"));
      setTimeout(() => setMsg(""), 2000);
    }
  }, [deleteNotification, t]);

  const handleNotificationClick = useCallback((notif) => {
    if (!notif.leido) markAsRead(notif.id);
    // Navigation logic...
  }, [markAsRead, navigate]);

  const renderNotificationList = (notifs) => {
    if (notifs.length === 0) {
      return (
        <EmptyState
          icon={<InboxIcon sx={{ fontSize: 32, color: "text.disabled" }} />}
          title={activeTab === 0
            ? t("notif_vacio_no_leidas", "No tienes notificaciones sin leer")
            : t("notif_vacio_leidas", "No tienes notificaciones leídas")}
        />
      );
    }
    return (
      <List disablePadding>
        {notifs.map((notif, index) => {
          const config = notificationConfig[notif.tipo] || notificationConfig.info;
          return (
            <React.Fragment key={notif.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                sx={{ py: 2, px: 2, cursor: "pointer", bgcolor: !notif.leido ? "action.hover" : "transparent", "&:hover": { bgcolor: "action.selected" }, alignItems: "flex-start" }}
                onClick={() => handleNotificationClick(notif)}
              >
                <ListItemIcon sx={{ minWidth: 48, mt: 0.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: config.bgcolor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <config.icon sx={{ fontSize: 20, color: config.color }} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={!notif.leido ? 600 : 400}>{notif.mensaje}</Typography>}
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: "info.main" }} />
                      <Typography variant="caption" color="text.disabled">{formatTimeAgo(notif.created_at, t)}</Typography>
                      {notif.solicitud_id && <Typography variant="caption" color="primary.main">#{notif.solicitud_id}</Typography>}
                    </Stack>
                  }
                />
                <Stack direction="row" spacing={0.5} ml={1} flexShrink={0} onClick={e => e.stopPropagation()}>
                  {!notif.leido && <IconButton size="small" color="success" onClick={() => handleMarkAsRead(notif.id)} title={t("notif_marcar_leida", "Marcar como leída")}><CheckIcon fontSize="small" /></IconButton>}
                  <IconButton size="small" color="error" onClick={() => handleDelete(notif.id)} title={t("common_eliminar", "Eliminar")}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>
    );
  };

  return (
    <PageLayout title={t("notif_title", "Notificaciones")}>
      {connectionError && <Alert severity="error">{connectionError}</Alert>}
      {msg && <Alert severity="success" onClose={() => setMsg("")}>{msg}</Alert>}

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        <Box p={2} borderBottom={1} borderColor="divider">
          <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid sx={{ maxWidth: "100%" }}>
              <Tabs
                value={activeTab}
                onChange={(e, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 1, textTransform: "none" } }}
              >
                <Tab label={<Stack direction="row" spacing={1} alignItems="center"><span>{t("notif_tab_no_leidas", "Sin leer")}</span>{unreadCount > 0 && <Chip label={unreadCount} size="small" color="primary" />}</Stack>} />
                <Tab label={<Stack direction="row" spacing={1} alignItems="center"><span>{t("notif_tab_leidas", "Leídas")}</span>{readCount > 0 && <Chip label={readCount} size="small" />}</Stack>} />
              </Tabs>
            </Grid>
            <Grid sx={{ width: { xs: "100%", sm: "auto" } }}>
              <Stack direction="row" spacing={0} sx={{ gap: 2, flexWrap: "wrap" }}>
                <FormControl size="small" sx={{ minWidth: 140, flex: { xs: 1, sm: "none" } }}>
                  <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} startAdornment={<InputAdornment position="start"><FilterListIcon fontSize="small" /></InputAdornment>}>
                    {filterOptions.map(opt => <MenuItem key={opt.value} value={opt.value}>{t(opt.key, opt.label)}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  placeholder={t("common_buscar_placeholder", "Buscar...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  sx={{ width: { xs: "100%", sm: 200 } }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    endAdornment: searchTerm && <InputAdornment position="end"><IconButton size="small" onClick={() => setSearchTerm("")}><ClearIcon fontSize="small" /></IconButton></InputAdornment>,
                  }}
                />
              </Stack>
            </Grid>
          </Grid>
        </Box>

        <Box>
          {isLoading && notifications.length === 0 ? (
            <Box textAlign="center" py={6}>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography color="text.secondary">{t("common_cargando", "Cargando...")}</Typography>
            </Box>
          ) : (
            renderNotificationList(filteredNotifications)
          )}
        </Box>
      </Paper>
    </PageLayout>
  );
}
