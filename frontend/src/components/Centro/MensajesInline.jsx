import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  RefreshCw,
  FileText,
} from "../ui/Icons";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Avatar,
} from "@mui/material";
import { useI18n } from "../../context/i18n";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import MensajeThreadModal from "../MensajeThreadModal";
import ProfileRequestActionModal from "./ProfileRequestActionModal";

function isProfileRequestMessage(mensaje) {
  const asunto = (mensaje.asunto || "").toLowerCase();
  const contenido = (mensaje.mensaje || mensaje.contenido || "").toLowerCase();
  return (
    asunto.includes("cambio de perfil") ||
    asunto.includes("solicitud de perfil") ||
    contenido.includes("solicitud de cambio de perfil")
  );
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

function truncateText(text, maxLength = 80) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

function getInitials(nombre, apellido) {
  const n = nombre?.[0] || "";
  const a = apellido?.[0] || "";
  return (n + a).toUpperCase() || "?";
}

export default function MensajesInline({ onUpdate }) {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMensaje, setSelectedMensaje] = useState(null);

  const loadMensajes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/mensajes/inbox?limit=20");
      if (res.data?.ok) {
        setMensajes(res.data.messages || []);
      } else {
        setError("Error al cargar mensajes");
      }
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMensajes();
  }, [loadMensajes]);

  const handleMensajeClick = async (mensaje) => {
    if (!mensaje.leido) {
      try {
        await api.post(`/mensajes/${mensaje.id}/mark-read`);
        setMensajes((prev) =>
          prev.map((m) => (m.id === mensaje.id ? { ...m, leido: true } : m))
        );
        if (onUpdate) onUpdate();
      } catch (err) {
      }
    }
    setSelectedMensaje(mensaje);
  };

  const handleModalClose = () => {
    setSelectedMensaje(null);
    loadMensajes();
    if (onUpdate) onUpdate();
  };

  const unreadCount = mensajes.filter((m) => !m.leido).length;

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
            {t("centro_mensajes_recientes", "Mensajes Recientes")}
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} sin leer`}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 600,
                bgcolor: "rgba(239, 68, 68, 0.12)",
                color: "var(--danger)",
              }}
            />
          )}
        </Box>
        <IconButton
          onClick={loadMensajes}
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
        ) : mensajes.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <MessageSquare style={{ width: 48, height: 48, color: "var(--border)", margin: "0 auto 12px" }} />
            <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
              {t("centro_sin_mensajes", "No tienes mensajes")}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 400, overflowY: "auto" }}>
            {mensajes.map((mensaje) => {
              const initials = getInitials(
                mensaje.remitente_nombre,
                mensaje.remitente_apellido
              );
              const nombreCompleto = `${mensaje.remitente_nombre || ""} ${
                mensaje.remitente_apellido || ""
              }`.trim();

              return (
                <Paper
                  key={mensaje.id}
                  elevation={0}
                  onClick={() => handleMensajeClick(mensaje)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    cursor: "pointer",
                    border: "1px solid transparent",
                    bgcolor: mensaje.leido ? "transparent" : "rgba(168, 85, 247, 0.05)",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      bgcolor: "var(--bg-soft)",
                      borderColor: "var(--border)",
                    },
                  }}
                >
                  {/* Avatar */}
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      bgcolor: mensaje.leido ? "var(--bg-soft)" : "rgba(168, 85, 247, 0.15)",
                      color: mensaje.leido ? "var(--fg-muted)" : "#a855f7",
                    }}
                  >
                    {initials}
                  </Avatar>

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "var(--fg-strong)",
                            fontWeight: mensaje.leido ? 400 : 600,
                          }}
                        >
                          {nombreCompleto || "Usuario"}
                        </Typography>
                        {mensaje.remitente_rol && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "var(--fg-muted)",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              fontSize: "0.6rem",
                            }}
                          >
                            {mensaje.remitente_rol}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                        <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
                          {formatTimeAgo(mensaje.created_at)}
                        </Typography>
                        {!mensaje.leido && (
                          <Box sx={{ width: 8, height: 8, bgcolor: "#a855f7", borderRadius: "50%" }} />
                        )}
                      </Box>
                    </Box>

                    {/* Asunto */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: mensaje.leido ? "var(--fg-muted)" : "var(--fg-strong)",
                        fontWeight: mensaje.leido ? 400 : 500,
                        mt: 0.5,
                      }}
                    >
                      {mensaje.asunto}
                    </Typography>

                    {/* Preview */}
                    <Typography
                      variant="caption"
                      sx={{
                        color: "var(--fg-muted)",
                        mt: 0.5,
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {truncateText(mensaje.mensaje || mensaje.contenido, 80)}
                    </Typography>

                    {/* Tags */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
                      {mensaje.solicitud_id && (
                        <Chip
                          icon={<FileText style={{ width: 12, height: 12 }} />}
                          label={`Solicitud #${mensaje.solicitud_id}`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            bgcolor: "rgba(86, 126, 187, 0.1)",
                            color: "var(--primary)",
                            "& .MuiChip-icon": { color: "var(--primary)" },
                          }}
                        />
                      )}
                      {isProfileRequestMessage(mensaje) && (
                        <Chip
                          label="Requiere accion"
                          size="small"
                          sx={{
                            height: 20,
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
      {selectedMensaje && isProfileRequestMessage(selectedMensaje) ? (
        <ProfileRequestActionModal
          notif={{ mensaje: selectedMensaje.asunto, ...selectedMensaje }}
          onClose={handleModalClose}
          onAction={() => {
            loadMensajes();
            if (onUpdate) onUpdate();
          }}
        />
      ) : selectedMensaje ? (
        <MensajeThreadModal
          message={selectedMensaje}
          isOpen={!!selectedMensaje}
          onClose={handleModalClose}
        />
      ) : null}
    </Paper>
  );
}
