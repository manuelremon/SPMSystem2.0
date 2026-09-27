import React, { useState, useEffect } from "react";
import useToast from "../hooks/useToast";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";

// MUI Icons
import SendIcon from "@mui/icons-material/Send";
import InboxIcon from "@mui/icons-material/Inbox";
import ChatIcon from "@mui/icons-material/Chat";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DescriptionIcon from "@mui/icons-material/Description";
import ReplyIcon from "@mui/icons-material/Reply";
import DeleteIcon from "@mui/icons-material/Delete";
import CircleIcon from "@mui/icons-material/Circle";

import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import MensajeThreadModal from "../components/MensajeThreadModal";
import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import { formatDateTime } from "../utils/formatters";

export default function Mensajes() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(0); // 0 = inbox, 1 = outbox
  const [inboxMessages, setInboxMessages] = useState([]);
  const [outboxMessages, setOutboxMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
  }, [activeTab]);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = activeTab === 0 ? "/mensajes/inbox" : "/mensajes/outbox";
      const response = await api.get(endpoint);
      const data = response.data;

      if (data.ok) {
        if (activeTab === 0) {
          setInboxMessages(data.messages || []);
        } else {
          setOutboxMessages(data.messages || []);
        }
      } else {
        setError(t("mensajes_error_carga", "No se pudieron cargar los mensajes. Intenta nuevamente."));
      }
    } catch (err) {
      setError(t("mensajes_error_carga", "No se pudieron cargar los mensajes. Intenta nuevamente."));
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/mensajes/unread-count");
      const data = response.data;
      if (data.ok) {
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // El contador de no leidos es informativo: se ignora el error
    }
  };

  const handleOpenThread = async (message) => {
    setSelectedMessage(message);
    setShowThreadModal(true);

    // Marcar como leido si es un mensaje recibido no leido
    if (activeTab === 0 && message.leido === 0) {
      try {
        await api.post(`/mensajes/${message.id}/mark-read`);
        // Actualizar mensaje local
        setInboxMessages(prev =>
          prev.map(m => m.id === message.id ? { ...m, leido: 1 } : m)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {
        // Si falla el marcado como leido, la conversacion se abre igual
      }
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm(t("mensajes_confirmar_eliminar", "¿Seguro que deseas eliminar este mensaje?"))) {
      return;
    }

    try {
      const response = await api.delete(`/mensajes/${messageId}`);
      const data = response.data;

      if (data.ok) {
        // Actualizar lista local
        if (activeTab === 0) {
          setInboxMessages(prev => prev.filter(m => m.id !== messageId));
        } else {
          setOutboxMessages(prev => prev.filter(m => m.id !== messageId));
        }

        // Refrescar contador
        fetchUnreadCount();
      } else {
        toast.error(t("mensajes_error_eliminar", "No se pudo eliminar el mensaje"));
      }
    } catch (err) {
      toast.error(t("mensajes_error_eliminar", "No se pudo eliminar el mensaje"));
    }
  };

  const messages = activeTab === 0 ? inboxMessages : outboxMessages;

  return (
    <PageLayout
      title={t("mensajes_title", "Mensajes")}
      actions={unreadCount > 0 ? (
          <Chip
            icon={<CircleIcon sx={{ fontSize: 8, animation: "pulse 2s infinite" }} />}
            label={`${unreadCount} ${unreadCount === 1 ? t("mensajes_nuevo", "mensaje nuevo") : t("mensajes_nuevos", "mensajes nuevos")}`}
            color="primary"
            variant="outlined"
            sx={{
              "& .MuiChip-icon": {
                color: "primary.main",
              },
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }}
          />
        ) : null}
    >

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        {/* Tabs */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 40,
              "& .MuiTab-root": { minHeight: 40, py: 1, textTransform: "none" },
            }}
          >
            <Tab
              icon={<InboxIcon sx={{ fontSize: 18, color: "primary.main" }} />}
              iconPosition="start"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{t("mensajes_recibidos", "Recibidos")}</span>
                  {unreadCount > 0 && (
                    <Chip
                      label={unreadCount}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: "0.75rem" }}
                    />
                  )}
                </Stack>
              }
            />
            <Tab
              icon={<SendIcon sx={{ fontSize: 18, color: "primary.main" }} />}
              iconPosition="start"
              label={t("mensajes_enviados", "Enviados")}
            />
          </Tabs>
        </Box>

        {/* Messages List */}
        <Box sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                {t("mensajes_cargando", "Cargando mensajes...")}
              </Typography>
            </Box>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={activeTab === 0
                ? <InboxIcon sx={{ fontSize: 32, color: "text.disabled" }} />
                : <SendIcon sx={{ fontSize: 32, color: "text.disabled" }} />}
              title={activeTab === 0
                ? t("mensajes_vacio_recibidos", "No tienes mensajes recibidos")
                : t("mensajes_vacio_enviados", "No has enviado mensajes")}
            />
          ) : (
            <List disablePadding>
              {messages.map((message, index) => (
                <React.Fragment key={message.id}>
                  {index > 0 && <Divider component="li" />}
                  <MessageRow
                    message={message}
                    isInbox={activeTab === 0}
                    onOpen={() => handleOpenThread(message)}
                    onDelete={() => handleDeleteMessage(message.id)}
                  />
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      {/* Thread Modal */}
      {showThreadModal && selectedMessage && (
        <MensajeThreadModal
          message={selectedMessage}
          isOpen={showThreadModal}
          onClose={() => {
            setShowThreadModal(false);
            setSelectedMessage(null);
            fetchMessages(); // Refresh messages after closing
            fetchUnreadCount(); // Refresh unread count
          }}
        />
      )}
    </PageLayout>
  );
}

function MessageRow({ message, isInbox, onOpen, onDelete }) {
  const { t } = useI18n();
  const isUnread = isInbox && message.leido === 0;

  const displayName = isInbox
    ? `${message.remitente_nombre || ""} ${message.remitente_apellido || ""}`.trim() || t("mensajes_usuario", "Usuario")
    : `${message.destinatario_nombre || ""} ${message.destinatario_apellido || ""}`.trim() || t("mensajes_usuario", "Usuario");

  const displayRole = isInbox ? message.remitente_rol : message.destinatario_rol;

  // Get initials for avatar
  const getInitials = (name) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <ListItem
      sx={{
        py: 2,
        px: 2,
        cursor: "pointer",
        bgcolor: isUnread ? "primary.lighter" : "transparent",
        borderLeft: isUnread ? 3 : 0,
        borderColor: "primary.main",
        "&:hover": { bgcolor: "action.hover" },
        alignItems: "flex-start",
      }}
      onClick={onOpen}
    >
      {/* Avatar/Icon */}
      <ListItemIcon sx={{ minWidth: 56, mt: 0.5 }}>
        {isUnread ? (
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <CircleIcon sx={{ fontSize: 16 }} />
          </Avatar>
        ) : (
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: "action.hover",
              color: "secondary.main",
            }}
          >
            <ChatIcon sx={{ fontSize: 20 }} />
          </Avatar>
        )}
      </ListItemIcon>

      {/* Content */}
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.5, flexWrap: "wrap" }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: isUnread ? 600 : 400,
                color: isUnread ? "text.primary" : "text.secondary",
              }}
            >
              {displayName}
            </Typography>
            {displayRole && (
              <Typography
                variant="caption"
                sx={{ color: "text.disabled" }}
              >
                {displayRole}
              </Typography>
            )}
          </Stack>
        }
        secondary={
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: isUnread ? 500 : 400,
                color: isUnread ? "text.primary" : "text.secondary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                mb: 0.5,
              }}
            >
              {message.asunto}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {message.mensaje}
            </Typography>
            {message.solicitud_id && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                <DescriptionIcon sx={{ fontSize: 14, color: "primary.main" }} />
                <Typography variant="caption" color="info.main">
                  {t("mensajes_solicitud", "Solicitud")} #{message.solicitud_id}
                </Typography>
              </Stack>
            )}
          </Box>
        }
      />

      {/* Metadata and Actions */}
      <Stack sx={{ ml: { xs: 1, sm: 2 }, flexShrink: 0, alignItems: "flex-end" }} spacing={1}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <AccessTimeIcon sx={{ fontSize: 14, color: "info.main" }} />
          <Typography variant="caption" color="text.disabled">
            {formatDateTime(message.created_at)}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            title={t("mensajes_ver_conversacion", "Ver conversación")}
          >
            <ReplyIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t("common_eliminar", "Eliminar")}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* Unread indicator */}
      {isUnread && (
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "primary.main",
            ml: 1,
            mt: 1,
            flexShrink: 0,
          }}
        />
      )}
    </ListItem>
  );
}
