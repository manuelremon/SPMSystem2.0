/**
 * CentroInteraccion - Hub de comunicaciones y notificaciones
 * SAP/Enterprise UI - Material UI
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import ConsultasStockList from "../components/Planner/ConsultasStockList";
import NotificacionesInline from "../components/Centro/NotificacionesInline";
import MensajesInline from "../components/Centro/MensajesInline";
import TimelineDetailModal from "../components/Centro/TimelineDetailModal";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Chip,
  Skeleton,
  Alert as MuiAlert,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChatIcon from "@mui/icons-material/Chat";
import NotificationsIcon from "@mui/icons-material/Notifications";
import InventoryIcon from "@mui/icons-material/Inventory";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningIcon from "@mui/icons-material/Warning";
import InboxIcon from "@mui/icons-material/Inbox";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DescriptionIcon from "@mui/icons-material/Description";


/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

const timelineIcons = {
  notificacion: NotificationsIcon,
  mensaje: ChatIcon,
  stock_consulta: InventoryIcon,
  solicitud_approved: CheckCircleIcon,
  solicitud_rejected: CancelIcon,
  solicitud_planned: AccessTimeIcon,
  warning: WarningIcon,
  info: DescriptionIcon,
};

/* ─────────────────────────────────────────────────────────────
   UI Components
───────────────────────────────────────────────────────────── */

/** Empty state */
function EmptyState({ title, description }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        textAlign: "center",
      }}
    >
      <Box sx={{ color: "grey.300", mb: 2 }}>
        <InboxIcon sx={{ fontSize: 48 }} />
      </Box>
      <Typography variant="subtitle2" sx={{ color: "grey.700", mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "grey.500" }}>
        {description}
      </Typography>
    </Box>
  );
}

/** Loading skeleton */
function LoadingSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        {[...Array(5)].map((_, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Skeleton variant="rectangular" width={32} height={32} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="75%" height={20} />
              <Skeleton variant="text" width="25%" height={16} />
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function CentroInteraccion() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTimelineItem, setSelectedTimelineItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notificaciones/centro-interaccion");
      if (res.data?.ok) {
        setData(res.data.data);
      } else {
        setError("Error al cargar datos");
      }
    } catch (err) {
      console.error("Error loading centro-interaccion:", err);
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabs = [
    {
      label: t("centro_notificaciones", "Notificaciones"),
      icon: <NotificationsIcon sx={{ fontSize: 16 }} />,
      count: data?.notificaciones_count || 0,
    },
    {
      label: t("centro_consultas", "Consultas Stock"),
      icon: <InventoryIcon sx={{ fontSize: 16 }} />,
      count: data?.consultas_count || 0,
    },
    {
      label: t("centro_mensajes", "Mensajes"),
      icon: <ChatIcon sx={{ fontSize: 16 }} />,
      count: data?.mensajes_count || 0,
    },
  ];

  const getTimelineIcon = (item) => {
    const subtipo = item.subtipo || item.tipo;
    const IconComponent = timelineIcons[subtipo] || timelineIcons[item.tipo] || DescriptionIcon;
    return <IconComponent sx={{ fontSize: 16 }} />;
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "grey.200",
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 1400, mx: "auto", px: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ height: 56 }}
          >
            {/* Left */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  ml: -1,
                  color: "grey.400",
                  "&:hover": {
                    color: "grey.600",
                    bgcolor: "grey.100",
                  },
                }}
                aria-label="Volver"
              >
                <ArrowBackIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "primary.main",
                    color: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChatIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "grey.900",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("centro_titulo", "Centro de Interaccion")}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "grey.500" }}>
                    {t("centro_subtitulo", "Gestiona notificaciones, mensajes y consultas")}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Right */}
            <Button
              onClick={loadData}
              disabled={loading}
              variant="outlined"
              size="small"
              startIcon={
                loading ? (
                  <RefreshIcon sx={{ fontSize: 16, animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }} />
                ) : (
                  <RefreshIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{
                height: 36,
                textTransform: "uppercase",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "grey.600",
                borderColor: "grey.200",
                bgcolor: "common.white",
                "&:hover": {
                  bgcolor: "grey.50",
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Actualizar
              </Box>
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Main */}
      <Box component="main" sx={{ maxWidth: 1400, mx: "auto", px: 3, py: 3 }}>
        {error && (
          <Box sx={{ mb: 3 }}>
            <MuiAlert
              severity="error"
              onClose={() => setError("")}
              sx={{ borderRadius: 0 }}
            >
              {error}
            </MuiAlert>
          </Box>
        )}

        {/* Tabs Card */}
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: "grey.200",
            boxShadow: 1,
            mb: 3,
            borderRadius: 0,
          }}
        >
          {/* Tab Navigation */}
          <Box sx={{ borderBottom: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                minHeight: 48,
                "& .MuiTab-root": {
                  minHeight: 48,
                  textTransform: "uppercase",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  color: "grey.500",
                  "&.Mui-selected": {
                    color: "primary.dark",
                    bgcolor: "common.white",
                  },
                  "&:hover": {
                    color: "grey.700",
                    bgcolor: "grey.100",
                  },
                },
                "& .MuiTabs-indicator": {
                  backgroundColor: "primary.main",
                },
              }}
            >
              {tabs.map((tab, index) => (
                <Tab
                  key={index}
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          color: activeTab === index ? "primary.main" : "grey.400",
                        }}
                      >
                        {tab.icon}
                      </Box>
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <Chip
                          label={tab.count}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 0,
                            bgcolor: activeTab === index ? "primary.50" : "grey.100",
                            color: activeTab === index ? "primary.dark" : "grey.600",
                            "& .MuiChip-label": {
                              px: 0.75,
                              py: 0.25,
                            },
                          }}
                        />
                      )}
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          </Box>

          {/* Tab Content */}
          <Box sx={{ minHeight: 300 }}>
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <>
                {activeTab === 0 && (
                  <Box sx={{ p: 2 }}>
                    <NotificacionesInline onUpdate={loadData} />
                  </Box>
                )}
                {activeTab === 1 && (
                  <Box>
                    <Box
                      sx={{
                        px: 2.5,
                        py: 2,
                        borderBottom: 1,
                        borderColor: "grey.200",
                        bgcolor: "grey.50",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "grey.500",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {t("consulta_pendientes", "Consultas de Stock Pendientes")}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <ConsultasStockList onRespond={loadData} />
                    </Box>
                  </Box>
                )}
                {activeTab === 2 && (
                  <Box sx={{ p: 2 }}>
                    <MensajesInline onUpdate={loadData} />
                  </Box>
                )}
              </>
            )}
          </Box>
        </Paper>

        {/* Timeline Card */}
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: "grey.200",
            boxShadow: 1,
            borderRadius: 0,
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderBottom: 1,
              borderColor: "grey.200",
              bgcolor: "grey.50",
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: "grey.500",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {t("centro_timeline", "Timeline de Actividad")}
            </Typography>
          </Box>
          <Box>
            {loading ? (
              <LoadingSkeleton />
            ) : data?.timeline?.length > 0 ? (
              <Box>
                {data.timeline.map((item, idx) => {
                  const icon = getTimelineIcon(item);
                  return (
                    <Box
                      key={idx}
                      onClick={() => setSelectedTimelineItem(item)}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        p: 2,
                        cursor: "pointer",
                        borderBottom: idx < data.timeline.length - 1 ? 1 : 0,
                        borderColor: "grey.100",
                        "&:hover": {
                          bgcolor: "grey.50",
                        },
                        transition: "background-color 0.2s",
                      }}
                    >
                      {/* Icon */}
                      <Box
                        sx={{
                          p: 1,
                          bgcolor: "grey.100",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Box sx={{ color: "grey.500" }}>{icon}</Box>
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "grey.700",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.descripcion}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: "grey.400" }}>
                            {formatTimeAgo(item.created_at)}
                          </Typography>
                          {item.solicitud_id && (
                            <Chip
                              label={`#${item.solicitud_id}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 600,
                                borderRadius: 0,
                                borderColor: "info.200",
                                bgcolor: "info.50",
                                color: "info.dark",
                                "& .MuiChip-label": {
                                  px: 0.75,
                                  py: 0.25,
                                },
                              }}
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* Arrow */}
                      <Box sx={{ color: "grey.300" }}>
                        <ChevronRightIcon sx={{ fontSize: 16 }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <EmptyState
                title={t("centro_sin_actividad", "No hay actividad reciente")}
                description="La actividad de tu cuenta aparecera aqui"
              />
            )}
          </Box>
        </Paper>

        {/* Timeline Detail Modal */}
        {selectedTimelineItem && (
          <TimelineDetailModal
            item={selectedTimelineItem}
            onClose={() => setSelectedTimelineItem(null)}
          />
        )}
      </Box>
    </Box>
  );
}
