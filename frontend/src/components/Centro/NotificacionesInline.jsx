import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Clock,
  FileText,
  AlertTriangle,
  Package,
  MessageSquare,
  RefreshCw,
  User,
} from "../ui/Icons";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";
import ProfileRequestActionModal from "./ProfileRequestActionModal";

const tipoIcons = {
  solicitud_approved: Check,
  solicitud_rejected: X,
  solicitud_to_plan: Clock,
  stock_consulta: Package,
  mensaje_nuevo: MessageSquare,
  budget_approved: Check,
  budget_rejected: X,
  profile_request: User,
  profile_approved: Check,
  profile_rejected: X,
  default: Bell,
};

const tipoColors = {
  solicitud_approved: { bg: "rgba(34, 197, 94, 0.12)", color: "var(--success)" },
  solicitud_rejected: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" },
  solicitud_to_plan: { bg: "rgba(59, 130, 246, 0.12)", color: "var(--primary)" },
  stock_consulta: { bg: "rgba(249, 115, 22, 0.12)", color: "#f97316" },
  mensaje_nuevo: { bg: "rgba(168, 85, 247, 0.12)", color: "#a855f7" },
  budget_approved: { bg: "rgba(34, 197, 94, 0.12)", color: "var(--success)" },
  budget_rejected: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" },
  profile_request: { bg: "rgba(99, 102, 241, 0.12)", color: "#6366f1" },
  profile_approved: { bg: "rgba(34, 197, 94, 0.12)", color: "var(--success)" },
  profile_rejected: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" },
  default: { bg: "var(--bg-soft)", color: "var(--fg-muted)" },
};

const TIPOS_REQUIEREN_RESPUESTA = ["stock_consulta", "mensaje_nuevo", "profile_request"];
const TIPOS_PROFILE_ACTION = ["profile_request"];

function isProfileRequestNotif(notif) {
  if (TIPOS_PROFILE_ACTION.includes(notif.tipo)) return true;
  const msg = (notif.mensaje || "").toLowerCase();
  return msg.includes("cambio de perfil") || msg.includes("solicitud de perfil");
}

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

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificacionDetailModal({ notif, onClose, onMarcarLeida }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [marcando, setMarcando] = useState(false);

  const IconComponent = tipoIcons[notif.tipo] || tipoIcons.default;
  const colors = tipoColors[notif.tipo] || tipoColors.default;
  const requiereRespuesta = TIPOS_REQUIEREN_RESPUESTA.includes(notif.tipo);

  useEffect(() => {
    if (!notif.leido) {
      const timer = setTimeout(() => {
        handleMarcarLeida();
      }, 120000);
      return () => clearTimeout(timer);
    }
  }, [notif.id, notif.leido]);

  const handleMarcarLeida = async () => {
    if (notif.leido || marcando) return;
    setMarcando(true);
    try {
      await api.post(`/notificaciones/${notif.id}/marcar-leida`);
      onMarcarLeida(notif.id);
    } catch (err) {
      console.error("Error marcando como leida:", err);
    } finally {
      setMarcando(false);
    }
  };

  const handleVerSolicitud = () => {
    onClose();
    navigate(`/solicitudes/${notif.solicitud_id}`);
  };

  const handleResponder = () => {
    onClose();
    if (notif.tipo === "stock_consulta") {
      navigate("/centro-interaccion");
    } else if (notif.tipo === "mensaje_nuevo") {
      navigate("/mensajes");
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: colors.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconComponent style={{ width: 24, height: 24, color: colors.color }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                {t("centro_notificacion", "Notificacion")}
              </Typography>
              {!notif.leido && (
                <Box sx={{ width: 8, height: 8, bgcolor: "var(--primary)", borderRadius: "50%" }} />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
              {formatDateTime(notif.created_at)}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <X style={{ width: 20, height: 20, color: "var(--fg-muted)" }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {requiereRespuesta && (
          <Alert
            severity="warning"
            icon={<AlertTriangle style={{ width: 20, height: 20 }} />}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {t("centro_requiere_respuesta", "Esta notificacion requiere tu respuesta")}
            </Typography>
            <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
              {notif.tipo === "stock_consulta"
                ? t("centro_responder_consulta", "Hay una consulta de stock pendiente")
                : t("centro_responder_mensaje", "Tienes un mensaje sin responder")}
            </Typography>
          </Alert>
        )}

        <Typography variant="body1" sx={{ color: "var(--fg-strong)", lineHeight: 1.6 }}>
          {notif.mensaje}
        </Typography>

        {notif.solicitud_id && (
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              p: 2,
              bgcolor: "color-mix(in srgb, var(--primary) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: "var(--primary)", fontWeight: 500 }}>
              {t("centro_solicitud_relacionada", "Solicitud relacionada")}:{" "}
              <strong>#{notif.solicitud_id}</strong>
            </Typography>
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {!notif.leido && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleMarcarLeida}
            disabled={marcando}
            startIcon={<Check style={{ width: 16, height: 16 }} />}
            sx={{ color: "var(--fg-muted)", borderColor: "var(--border)" }}
          >
            {marcando ? t("common_loading", "...") : t("centro_marcar_leida", "Marcar como leida")}
          </Button>
        )}
        {requiereRespuesta && (
          <Button
            variant="contained"
            size="small"
            onClick={handleResponder}
            startIcon={<MessageSquare style={{ width: 16, height: 16 }} />}
            sx={{ bgcolor: "var(--primary)", "&:hover": { bgcolor: "var(--primary-dark)" } }}
          >
            {t("centro_responder", "Responder")}
          </Button>
        )}
        {notif.solicitud_id && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleVerSolicitud}
            startIcon={<FileText style={{ width: 16, height: 16 }} />}
            sx={{ color: "var(--primary)", borderColor: "var(--primary)" }}
          >
            {t("centro_ver_solicitud", "Ver Solicitud")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function NotificacionesInline({ onUpdate }) {
  const { t } = useI18n();
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const loadNotificaciones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notificaciones?limit=20");
      if (res.data?.ok) {
        setNotificaciones(res.data.notifications || []);
      } else {
        setError("Error al cargar notificaciones");
      }
    } catch (err) {
      console.error("Error loading notificaciones:", err);
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificaciones();
  }, [loadNotificaciones]);

  const handleMarcarLeida = (notifId) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, leido: true } : n))
    );
    if (onUpdate) onUpdate();
  };

  const handleMarcarTodasLeidas = async () => {
    setMarcandoTodas(true);
    try {
      await api.post("/notificaciones/marcar-todas-leidas");
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Error marcando todas como leidas:", err);
    } finally {
      setMarcandoTodas(false);
    }
  };

  const unreadCount = notificaciones.filter((n) => !n.leido).length;

  return (
    <Paper elevation={2}>
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: "uppercase" }}>
            {t("centro_notificaciones_recientes", "Notificaciones Recientes")}
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} sin leer`}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 600,
                bgcolor: "color-mix(in srgb, var(--danger) 12%, transparent)",
                color: "var(--danger)",
              }}
            />
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {unreadCount > 0 && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleMarcarTodasLeidas}
              disabled={marcandoTodas}
              startIcon={<CheckCheck style={{ width: 16, height: 16 }} />}
              sx={{ color: "var(--fg-muted)", borderColor: "var(--border)", textTransform: "none" }}
            >
              {marcandoTodas ? t("common_loading", "...") : t("centro_marcar_todas", "Marcar todas")}
            </Button>
          )}
          <IconButton
            onClick={loadNotificaciones}
            disabled={loading}
            size="small"
            sx={{ border: "1px solid var(--border)", borderRadius: 1 }}
          >
            <RefreshCw
              style={{
                width: 16,
                height: 16,
                color: "var(--fg-muted)",
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} sx={{ color: "var(--primary)" }} />
          </Box>
        ) : notificaciones.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Bell style={{ width: 48, height: 48, color: "var(--border)", margin: "0 auto 12px" }} />
            <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
              {t("centro_sin_notificaciones", "No tienes notificaciones")}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 400, overflowY: "auto" }}>
            {notificaciones.map((notif) => {
              const IconComponent = tipoIcons[notif.tipo] || tipoIcons.default;
              const colors = tipoColors[notif.tipo] || tipoColors.default;
              const requiereRespuesta = TIPOS_REQUIEREN_RESPUESTA.includes(notif.tipo);

              return (
                <Paper
                  key={notif.id}
                  elevation={0}
                  onClick={() => setSelectedNotif(notif)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    cursor: "pointer",
                    border: "1px solid transparent",
                    bgcolor: notif.leido ? "transparent" : "color-mix(in srgb, var(--primary) 5%, transparent)",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      bgcolor: "var(--bg-soft)",
                      borderColor: "var(--border)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: colors.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconComponent style={{ width: 16, height: 16, color: colors.color }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: notif.leido ? "var(--fg-muted)" : "var(--fg-strong)",
                          fontWeight: notif.leido ? 400 : 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {notif.mensaje}
                      </Typography>
                      {!notif.leido && (
                        <Box sx={{ width: 8, height: 8, bgcolor: "var(--primary)", borderRadius: "50%", flexShrink: 0, mt: 0.5 }} />
                      )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
                        {formatTimeAgo(notif.created_at)}
                      </Typography>
                      {notif.solicitud_id && (
                        <Chip
                          label={`#${notif.solicitud_id}`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            bgcolor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                            color: "var(--primary)",
                          }}
                        />
                      )}
                      {requiereRespuesta && (
                        <Chip
                          label={t("centro_requiere_accion", "Requiere accion")}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            bgcolor: "rgba(245, 158, 11, 0.12)",
                            color: "var(--warning)",
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Modals */}
      {selectedNotif && isProfileRequestNotif(selectedNotif) ? (
        <ProfileRequestActionModal
          notif={selectedNotif}
          onClose={() => setSelectedNotif(null)}
          onAction={() => {
            handleMarcarLeida(selectedNotif.id);
            loadNotificaciones();
          }}
        />
      ) : selectedNotif ? (
        <NotificacionDetailModal
          notif={selectedNotif}
          onClose={() => setSelectedNotif(null)}
          onMarcarLeida={handleMarcarLeida}
        />
      ) : null}
    </Paper>
  );
}
