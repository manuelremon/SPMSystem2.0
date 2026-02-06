import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Divider
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import CancelIcon from "@mui/icons-material/Cancel";
import MessageIcon from "@mui/icons-material/Message";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SendIcon from "@mui/icons-material/Send";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";

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

// Componente para mostrar comparación de valores
function ValueComparison({ label, current, requested, icon: Icon }) {
  if (!requested && requested !== 0) return null;

  const currentDisplay = Array.isArray(current) ? current.join(", ") : current || "—";
  const requestedDisplay = Array.isArray(requested) ? requested.join(", ") : requested || "—";

  const hasChange = currentDisplay !== requestedDisplay;

  if (!hasChange) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        bgcolor: "grey.50",
        borderRadius: 2
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {Icon && <Icon sx={{ fontSize: 18, color: "text.primary" }} />}
        <Typography variant="subtitle2" fontWeight={500}>
          {label}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", textDecoration: "line-through" }}
        >
          {currentDisplay}
        </Typography>
        <ArrowForwardIcon sx={{ fontSize: 16, color: "text.disabled" }} />
        <Typography variant="body2" sx={{ color: "success.main", fontWeight: 500 }}>
          {requestedDisplay}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function ProfileRequestActionModal({ notif, onClose, onAction }) {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestData, setRequestData] = useState(null);

  const [activeView, setActiveView] = useState("detail"); // detail, approve, reject, message
  const [comentario, setComentario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  // Extraer request_id de múltiples fuentes
  const extractRequestId = () => {
    // 1. Buscar en solicitud_id directo
    if (notif.solicitud_id) return notif.solicitud_id;

    // 2. Buscar en el mensaje con patrón #N
    const msgMatch = notif.mensaje?.match(/#(\d+)/);
    if (msgMatch) return parseInt(msgMatch[1]);

    // 3. Buscar en el asunto
    const asuntoMatch = notif.asunto?.match(/#(\d+)/);
    if (asuntoMatch) return parseInt(asuntoMatch[1]);

    // 4. Buscar patrón "perfil #N" o "perfil N"
    const perfilMatch = (notif.mensaje || notif.asunto || "").match(/perfil\s*#?(\d+)/i);
    if (perfilMatch) return parseInt(perfilMatch[1]);

    return null;
  };

  const [requestId, setRequestId] = useState(extractRequestId());
  const [pendingRequests, setPendingRequests] = useState([]);

  // Si no hay requestId, cargar solicitudes pendientes para seleccionar
  useEffect(() => {
    if (requestId) {
      loadRequestData();
    } else {
      loadPendingRequests();
    }
  }, [requestId]);

  const loadPendingRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mi-cuenta/admin/profile-requests?estado=pendiente");
      if (res.data?.ok && res.data.requests?.length > 0) {
        setPendingRequests(res.data.requests);
        // Si solo hay una, seleccionarla automáticamente
        if (res.data.requests.length === 1) {
          setRequestId(res.data.requests[0].id);
        }
      } else {
        setError("No hay solicitudes de perfil pendientes");
      }
    } catch (err) {
      setError("Error al cargar solicitudes pendientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId && !requestData) {
      loadRequestData();
    }
  }, [requestId]);

  const loadRequestData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/mi-cuenta/admin/profile-requests/${requestId}`);
      if (res.data?.ok) {
        setRequestData(res.data.request);
      } else {
        setError(res.data?.error?.message || "Error al cargar datos");
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setError("Esta solicitud ya no existe o fue eliminada.");
      } else {
        setError("Error de conexión");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/mi-cuenta/admin/profile-requests/${requestId}/aprobar`, {
        comentario: comentario.trim() || undefined,
      });
      if (res.data?.ok) {
        setSuccess("Solicitud aprobada y cambios aplicados");
        setTimeout(() => {
          onAction?.();
          onClose();
        }, 1500);
      } else {
        setError(res.data?.error?.message || "Error al aprobar");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!motivo.trim()) {
      setError("Debe indicar un motivo de rechazo");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/mi-cuenta/admin/profile-requests/${requestId}/rechazar`, {
        motivo: motivo.trim(),
      });
      if (res.data?.ok) {
        setSuccess("Solicitud rechazada");
        setTimeout(() => {
          onAction?.();
          onClose();
        }, 1500);
      } else {
        setError(res.data?.error?.message || "Error al rechazar");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnviarMensaje = async () => {
    if (!mensaje.trim()) {
      setError("Debe escribir un mensaje");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/mi-cuenta/admin/profile-requests/${requestId}/mensaje`, {
        mensaje: mensaje.trim(),
      });
      if (res.data?.ok) {
        setSuccess("Mensaje enviado al solicitante");
        setMensaje("");
        setTimeout(() => {
          setSuccess(null);
          setActiveView("detail");
        }, 1500);
      } else {
        setError(res.data?.error?.message || "Error al enviar mensaje");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = requestData?.estado === "pendiente";

  const getStatusChipProps = (estado) => {
    switch (estado) {
      case "pendiente":
        return { label: estado, color: "warning" };
      case "aprobado":
        return { label: estado, color: "success" };
      default:
        return { label: estado, color: "error" };
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "90vh"
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          pb: 2
        }}
      >
        <Box>
          <Typography variant="h6" component="div" fontWeight={600}>
            {t("profile_req_action_title", "Solicitud de Cambio de Perfil")}
            {requestId ? ` #${requestId}` : ""}
          </Typography>
          {requestData && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatDateTime(requestData.created_at)}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      {/* Content */}
      <DialogContent sx={{ py: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : !requestId && pendingRequests.length > 0 ? (
          /* Selector de solicitudes pendientes */
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Selecciona la solicitud de cambio de perfil que deseas gestionar:
            </Typography>
            <Stack spacing={1}>
              {pendingRequests.map((req) => (
                <Paper
                  key={req.id}
                  elevation={0}
                  onClick={() => setRequestId(req.id)}
                  sx={{
                    p: 2,
                    bgcolor: "grey.50",
                    borderRadius: 2,
                    border: 1,
                    borderColor: "divider",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": {
                      bgcolor: "primary.lighter",
                      borderColor: "primary.main"
                    }
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle2" fontWeight={500}>
                        {req.solicitante?.nombre || `Usuario ${req.usuario_id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Solicitud #{req.id} - {formatDateTime(req.created_at)}
                      </Typography>
                    </Box>
                    <Chip label="Pendiente" color="warning" size="small" />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        ) : error && !requestData ? (
          <Alert severity="error">{error}</Alert>
        ) : success ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                bgcolor: "success.lighter",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2
              }}
            >
              <CheckIcon sx={{ fontSize: 32, color: "success.main" }} />
            </Box>
            <Typography variant="h6" color="success.main" fontWeight={500}>
              {success}
            </Typography>
          </Box>
        ) : requestData ? (
          <>
            {/* Vista de detalle */}
            {activeView === "detail" && (
              <Stack spacing={3}>
                {/* Solicitante */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "primary.lighter",
                    borderRadius: 3
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={2}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: "primary.light",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <PersonIcon sx={{ color: "primary.main" }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {requestData.solicitante?.nombre || "Usuario"}
                      </Typography>
                      <Typography variant="body2" color="text.primary">
                        {requestData.solicitante?.mail}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {requestData.solicitante?.posicion} - {requestData.solicitante?.sector}
                      </Typography>
                    </Box>
                    <Chip {...getStatusChipProps(requestData.estado)} size="small" />
                  </Stack>
                </Paper>

                {/* Cambios solicitados */}
                <Box>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ letterSpacing: 1, mb: 1.5, display: "block" }}
                  >
                    {t("profile_req_cambios", "Cambios Solicitados")}
                  </Typography>
                  <Stack spacing={1}>
                    <ValueComparison
                      label="Sector"
                      current={requestData.current_values?.sector}
                      requested={requestData.requested_values?.sector}
                      icon={BusinessIcon}
                    />
                    <ValueComparison
                      label="Centros"
                      current={requestData.current_values?.centros}
                      requested={requestData.requested_values?.centros}
                      icon={LocationOnIcon}
                    />
                    <ValueComparison
                      label="Almacenes"
                      current={requestData.current_values?.almacenes}
                      requested={requestData.requested_values?.almacenes}
                      icon={LocationOnIcon}
                    />
                    <ValueComparison
                      label="Jefe"
                      current={requestData.current_values?.jefe}
                      requested={requestData.requested_values?.jefe}
                      icon={PersonIcon}
                    />
                  </Stack>
                </Box>

                {/* Error inline */}
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                {/* Advertencia si ya fue procesada */}
                {!isPending && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: "grey.100",
                      borderRadius: 2,
                      border: 1,
                      borderColor: "divider"
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Esta solicitud ya fue <strong>{requestData.estado}</strong> y no puede modificarse.
                    </Typography>
                  </Paper>
                )}
              </Stack>
            )}

            {/* Vista de aprobar */}
            {activeView === "approve" && (
              <Stack spacing={2}>
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  Los cambios se aplicarán automáticamente al perfil del usuario.
                </Alert>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t("profile_req_comentario", "Comentario (opcional)")}
                  </Typography>
                  <TextField
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Agregar un comentario..."
                    multiline
                    rows={3}
                    fullWidth
                    variant="outlined"
                  />
                </Box>
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
              </Stack>
            )}

            {/* Vista de rechazar */}
            {activeView === "reject" && (
              <Stack spacing={2}>
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  El solicitante será notificado del rechazo con el motivo indicado.
                </Alert>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t("profile_req_motivo", "Motivo del rechazo")}{" "}
                    <Typography component="span" color="error">*</Typography>
                  </Typography>
                  <TextField
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Indicar el motivo del rechazo..."
                    multiline
                    rows={3}
                    fullWidth
                    variant="outlined"
                    required
                  />
                </Box>
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
              </Stack>
            )}

            {/* Vista de mensaje */}
            {activeView === "message" && (
              <Stack spacing={2}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  El mensaje será enviado a la bandeja de entrada del solicitante.
                </Alert>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t("profile_req_mensaje_label", "Mensaje")}
                  </Typography>
                  <TextField
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Escribir mensaje..."
                    multiline
                    rows={4}
                    fullWidth
                    variant="outlined"
                  />
                </Box>
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
              </Stack>
            )}
          </>
        ) : null}
      </DialogContent>

      {/* Footer con acciones */}
      {requestData && !success && (
        <>
          <Divider />
          <DialogActions sx={{ p: 2, bgcolor: "grey.50" }}>
            {activeView === "detail" && isPending && (
              <Stack direction="row" spacing={1.5} sx={{ width: "100%" }} flexWrap="wrap">
                <Button
                  onClick={() => setActiveView("approve")}
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                >
                  {t("profile_req_aprobar", "Aprobar")}
                </Button>
                <Button
                  onClick={() => setActiveView("reject")}
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                >
                  {t("profile_req_rechazar", "Rechazar")}
                </Button>
                <Button
                  onClick={() => setActiveView("message")}
                  variant="outlined"
                  startIcon={<MessageIcon />}
                >
                  {t("profile_req_mensaje", "Enviar mensaje")}
                </Button>
              </Stack>
            )}

            {activeView === "detail" && !isPending && (
              <Stack direction="row" spacing={1.5}>
                <Button
                  onClick={() => setActiveView("message")}
                  variant="outlined"
                  startIcon={<MessageIcon />}
                >
                  {t("profile_req_mensaje", "Enviar mensaje")}
                </Button>
                <Button
                  onClick={() => navigate("/admin/solicitudes-perfil")}
                  variant="outlined"
                >
                  {t("profile_req_ver_todas", "Ver todas las solicitudes")}
                </Button>
              </Stack>
            )}

            {activeView === "approve" && (
              <Stack direction="row" spacing={1.5}>
                <Button
                  onClick={() => setActiveView("detail")}
                  variant="outlined"
                  disabled={submitting}
                >
                  {t("common_cancel", "Cancelar")}
                </Button>
                <Button
                  onClick={handleAprobar}
                  disabled={submitting}
                  variant="contained"
                  color="success"
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />}
                >
                  {t("profile_req_confirmar_aprobar", "Confirmar Aprobación")}
                </Button>
              </Stack>
            )}

            {activeView === "reject" && (
              <Stack direction="row" spacing={1.5}>
                <Button
                  onClick={() => setActiveView("detail")}
                  variant="outlined"
                  disabled={submitting}
                >
                  {t("common_cancel", "Cancelar")}
                </Button>
                <Button
                  onClick={handleRechazar}
                  disabled={submitting}
                  variant="contained"
                  color="error"
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CancelIcon />}
                >
                  {t("profile_req_confirmar_rechazar", "Confirmar Rechazo")}
                </Button>
              </Stack>
            )}

            {activeView === "message" && (
              <Stack direction="row" spacing={1.5}>
                <Button
                  onClick={() => setActiveView("detail")}
                  variant="outlined"
                  disabled={submitting}
                >
                  {t("common_cancel", "Cancelar")}
                </Button>
                <Button
                  onClick={handleEnviarMensaje}
                  disabled={submitting || !mensaje.trim()}
                  variant="contained"
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                >
                  {t("profile_req_enviar", "Enviar")}
                </Button>
              </Stack>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
