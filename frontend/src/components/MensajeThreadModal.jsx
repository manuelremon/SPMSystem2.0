import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Stack,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import {
  Send as SendIcon,
  AccessTime as ClockIcon,
  Description as FileTextIcon,
  Forum as MessageSquareIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

export default function MensajeThreadModal({ message, isOpen, onClose }) {
  const { user } = useAuthStore();
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && message) {
      fetchThread();
    }
  }, [isOpen, message]);

  useEffect(() => {
    // Scroll to bottom when thread updates
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const fetchThread = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/mensajes/${message.id}/thread`);
      const data = response.data;

      if (data.ok) {
        setThread(data.thread || []);
      } else {
        setError(data.error || "Error al cargar conversación");
      }
    } catch (err) {
      setError("Error de conexión al cargar conversación");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      return;
    }

    setSending(true);
    try {
      const response = await api.post(`/mensajes/${message.id}/reply`, {
        mensaje: replyText.trim()
      });

      const data = response.data;

      if (data.ok) {
        setReplyText("");
        fetchThread();
      } else {
        setError(data.error || "Error al enviar respuesta");
      }
    } catch (err) {
      setError("Error de conexión al enviar respuesta");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  if (!message) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: "85vh",
        }
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h6" component="span">
            {message.asunto}
          </Typography>
          {message.solicitud_id && (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                mt: 0.5,
                color: "primary.main",
                fontSize: "0.875rem",
              }}
            >
              <FileTextIcon sx={{ width: 16, height: 16 }} />
              <Typography variant="body2" color="primary">
                Solicitud #{message.solicitud_id}
              </Typography>
              {message.solicitud_justificacion && (
                <Typography variant="body2" color="text.secondary">
                  - {message.solicitud_justificacion}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", height: "60vh", p: 2 }}>
        {/* Error */}
        {error && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}

        {/* Messages Thread */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            mb: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : thread.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <MessageSquareIcon sx={{ width: 48, height: 48, color: "text.disabled", mb: 1.5 }} />
              <Typography color="text.secondary">
                No se encontraron mensajes
              </Typography>
            </Box>
          ) : (
            <>
              {thread.map((msg) => {
                const isMe = msg.remitente_id === user?.id_spm;
                const senderName = isMe
                  ? "Tú"
                  : `${msg.remitente_nombre || ""} ${msg.remitente_apellido || ""}`.trim() || "Usuario";

                return (
                  <Box
                    key={msg.id}
                    sx={{
                      display: "flex",
                      justifyContent: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "75%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMe ? "flex-end" : "flex-start",
                        gap: 0.5,
                      }}
                    >
                      {/* Sender info */}
                      <Stack
                        direction={isMe ? "row-reverse" : "row"}
                        spacing={1}
                        alignItems="center"
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            ...(isMe
                              ? {
                                  background: "linear-gradient(135deg, var(--primary), var(--primary-strong))",
                                  color: "var(--on-primary)",
                                }
                              : {
                                  bgcolor: "action.hover",
                                  color: "text.secondary",
                                }),
                          }}
                        >
                          {senderName[0]?.toUpperCase()}
                        </Avatar>
                        <Stack
                          direction={isMe ? "row-reverse" : "row"}
                          spacing={1}
                          alignItems="center"
                        >
                          <Typography variant="body2" fontWeight="medium">
                            {senderName}
                          </Typography>
                          {msg.remitente_rol && !isMe && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontFamily: "monospace",
                              }}
                            >
                              {msg.remitente_rol}
                            </Typography>
                          )}
                        </Stack>
                      </Stack>

                      {/* Message bubble */}
                      <Paper
                        elevation={0}
                        sx={{
                          px: 2,
                          py: 1.5,
                          ...(isMe
                            ? {
                                background: "linear-gradient(90deg, var(--primary), var(--primary-strong))",
                                color: "var(--on-primary)",
                                borderRadius: "var(--radius-lg) var(--radius-lg) 0 var(--radius-lg)",
                              }
                            : {
                                bgcolor: "action.hover",
                                color: "text.primary",
                                border: 1,
                                borderColor: "divider",
                                borderRadius: "var(--radius-lg) var(--radius-lg) var(--radius-lg) 0",
                              }),
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        >
                          {msg.mensaje}
                        </Typography>
                      </Paper>

                      {/* Timestamp */}
                      <Stack
                        direction={isMe ? "row-reverse" : "row"}
                        spacing={0.5}
                        alignItems="center"
                        sx={{ color: "text.secondary" }}
                      >
                        <ClockIcon sx={{ width: 12, height: 12 }} />
                        <Typography variant="caption">
                          {new Date(msg.created_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>

        {/* Reply Input */}
        <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta... (Ctrl+Enter para enviar)"
              multiline
              minRows={3}
              maxRows={5}
              fullWidth
              disabled={sending}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "0.875rem",
                },
              }}
            />

            <Button
              variant="contained"
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              title="Enviar respuesta (Ctrl+Enter)"
              sx={{
                alignSelf: "flex-end",
                minWidth: "auto",
                px: 2,
              }}
            >
              {sending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <SendIcon sx={{ width: 18, height: 18 }} />
              )}
              <Box
                component="span"
                sx={{ ml: 1, display: { xs: "none", sm: "inline" } }}
              >
                Enviar
              </Box>
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Presiona{" "}
            <Box
              component="kbd"
              sx={{
                px: 0.75,
                py: 0.25,
                bgcolor: "action.hover",
                border: 1,
                borderColor: "divider",
                borderRadius: 0.5,
                fontFamily: "monospace",
              }}
            >
              Ctrl
            </Box>
            {" + "}
            <Box
              component="kbd"
              sx={{
                px: 0.75,
                py: 0.25,
                bgcolor: "action.hover",
                border: 1,
                borderColor: "divider",
                borderRadius: 0.5,
                fontFamily: "monospace",
              }}
            >
              Enter
            </Box>
            {" "}para enviar
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
