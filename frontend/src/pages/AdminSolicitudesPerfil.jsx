import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Avatar,
  Divider,
  Stack
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import MessageIcon from "@mui/icons-material/Message";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SendIcon from "@mui/icons-material/Send";
import { useI18n } from "../context/i18n";
import api from "../services/api";

const estadoToBadge = {
  pendiente: { label: "Pendiente", color: "warning" },
  aprobado: { label: "Aprobada", color: "success" },
  rechazado: { label: "Rechazada", color: "error" }
};

const fieldLabels = {
  sector_nuevo: "Sector",
  centros_nuevos: "Centros",
  almacenes_nuevos: "Almacenes",
  jefe_nuevo: "Jefe",
  gerente1_nuevo: "Gerente 1",
  gerente2_nuevo: "Gerente 2",
  rol_solicitado: "Rol",
  justificacion: "Justificacion"
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
}

export default function AdminSolicitudesPerfil() {
  const { t } = useI18n();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState(0);

  // Modals
  const [detailModal, setDetailModal] = useState({ open: false, request: null, detail: null });
  const [approveModal, setApproveModal] = useState({ open: false, id: null, comentario: "" });
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, motivo: "" });
  const [messageModal, setMessageModal] = useState({ open: false, id: null, mensaje: "" });

  const tabKeys = ["pendiente", "aprobado", "rechazado", "todas"];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tabKey = tabKeys[tab];
      const params = tabKey !== "todas" ? { estado: tabKey } : {};
      const res = await api.get("/mi-cuenta/admin/profile-requests", { params });
      setRequests(res.data.requests || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (req) => {
    setDetailModal({ open: true, request: req, detail: null });
    try {
      const res = await api.get(`/mi-cuenta/admin/profile-requests/${req.id}`);
      setDetailModal(prev => ({ ...prev, detail: res.data.request }));
    } catch (err) {
      console.error("Error loading detail:", err);
    }
  }, []);

  const handleAprobar = useCallback(async () => {
    if (!approveModal.id) return;
    setError("");
    try {
      await api.post(`/mi-cuenta/admin/profile-requests/${approveModal.id}/aprobar`, {
        comentario: approveModal.comentario
      });
      setMsg(t("profile_req_aprobada", "Solicitud aprobada y cambios aplicados"));
      setApproveModal({ open: false, id: null, comentario: "" });
      setDetailModal({ open: false, request: null, detail: null });
      load();
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [approveModal, load, t]);

  const handleRechazar = useCallback(async () => {
    if (!rejectModal.id || !rejectModal.motivo.trim()) {
      setError(t("profile_req_motivo_required", "Debe indicar un motivo"));
      return;
    }
    setError("");
    try {
      await api.post(`/mi-cuenta/admin/profile-requests/${rejectModal.id}/rechazar`, {
        motivo: rejectModal.motivo
      });
      setMsg(t("profile_req_rechazada", "Solicitud rechazada"));
      setRejectModal({ open: false, id: null, motivo: "" });
      setDetailModal({ open: false, request: null, detail: null });
      load();
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [rejectModal, load, t]);

  const handleEnviarMensaje = useCallback(async () => {
    if (!messageModal.id || !messageModal.mensaje.trim()) {
      setError(t("profile_req_mensaje_required", "Debe escribir un mensaje"));
      return;
    }
    setError("");
    try {
      await api.post(`/mi-cuenta/admin/profile-requests/${messageModal.id}/mensaje`, {
        mensaje: messageModal.mensaje
      });
      setMsg(t("profile_req_mensaje_enviado", "Mensaje enviado al solicitante"));
      setMessageModal({ open: false, id: null, mensaje: "" });
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [messageModal, t]);

  const tabs = [
    { key: "pendiente", label: t("profile_req_tab_pendientes", "Pendientes") },
    { key: "aprobado", label: t("profile_req_tab_aprobadas", "Aprobadas") },
    { key: "rechazado", label: t("profile_req_tab_rechazadas", "Rechazadas") },
    { key: "todas", label: t("profile_req_tab_todas", "Todas") }
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t("profile_req_title", "Solicitudes de Cambio de Perfil")}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }} />}
          onClick={load}
          disabled={loading}
        >
          {t("common_refresh", "Actualizar")}
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {msg && (
        <Alert severity="success" onClose={() => setMsg("")}>
          {msg}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, newValue) => setTab(newValue)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          {tabs.map((tabItem, index) => (
            <Tab key={tabItem.key} label={tabItem.label} />
          ))}
        </Tabs>

        {/* Lista */}
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8 }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography color="text.secondary">
              {t("common_cargando", "Cargando...")}
            </Typography>
          </Box>
        ) : requests.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8 }}>
            <PersonIcon sx={{ fontSize: 48, opacity: 0.3, color: "text.secondary", mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              {t("profile_req_empty", "No hay solicitudes")}
            </Typography>
          </Box>
        ) : (
          <Box>
            {requests.map((req, index) => (
              <React.Fragment key={req.id}>
                {index > 0 && <Divider />}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                    transition: "background-color 0.2s"
                  }}
                  onClick={() => openDetail(req)}
                >
                  {/* Avatar */}
                  <Avatar sx={{ bgcolor: "primary.light" }}>
                    <PersonIcon sx={{ color: "primary.main" }} />
                  </Avatar>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Typography fontWeight={600}>
                        {req.solicitante?.nombre || req.usuario_id}
                      </Typography>
                      <Chip
                        label={estadoToBadge[req.estado]?.label || req.estado}
                        color={estadoToBadge[req.estado]?.color || "default"}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Solicita cambiar: {Object.keys(req.cambios_solicitados || {}).map(k => fieldLabels[k] || k).join(", ")}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                      <Typography variant="caption" color="text.disabled">
                        {formatDate(req.created_at)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Acciones rapidas */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} onClick={(e) => e.stopPropagation()}>
                    {req.estado === "pendiente" && (
                      <>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setApproveModal({ open: true, id: req.id, comentario: "" })}
                          title={t("profile_req_aprobar", "Aprobar")}
                        >
                          <CheckCircleIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setRejectModal({ open: true, id: req.id, motivo: "" })}
                          title={t("profile_req_rechazar", "Rechazar")}
                        >
                          <CancelIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setMessageModal({ open: true, id: req.id, mensaje: "" })}
                          title={t("profile_req_mensaje", "Enviar mensaje")}
                        >
                          <MessageIcon />
                        </IconButton>
                      </>
                    )}
                    <ChevronRightIcon sx={{ color: "text.disabled" }} />
                  </Box>
                </Box>
              </React.Fragment>
            ))}
          </Box>
        )}
      </Paper>

      {/* Modal de Detalle */}
      <Dialog
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, request: null, detail: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {`Solicitud #${detailModal.request?.id}`}
        </DialogTitle>
        <DialogContent dividers>
          {detailModal.detail ? (
            <Stack spacing={3}>
              {/* Solicitante */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Solicitante
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.light" }}>
                    <PersonIcon sx={{ color: "primary.main" }} />
                  </Avatar>
                  <Box>
                    <Typography fontWeight={600}>
                      {detailModal.detail.solicitante?.nombre}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {detailModal.detail.solicitante?.mail}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {detailModal.detail.solicitante?.posicion} - {detailModal.detail.solicitante?.sector}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Cambios solicitados */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Cambios Solicitados
                </Typography>
                <Stack spacing={2}>
                  {Object.entries(detailModal.detail.requested_values || {}).map(([field, newValue]) => {
                    const currentValue = detailModal.detail.current_values?.[field];
                    return (
                      <Paper key={field} variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", mb: 1.5, display: "block" }}>
                          {fieldLabels[`${field}_nuevo`] || field}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Box sx={{ flex: 1, p: 1.5, borderRadius: 1, bgcolor: "grey.100" }}>
                            <Typography variant="caption" color="text.disabled">
                              Actual:{" "}
                            </Typography>
                            <Typography variant="body2" component="span">
                              {Array.isArray(currentValue) ? currentValue.join(", ") : currentValue || "-"}
                            </Typography>
                          </Box>
                          <ArrowForwardIcon sx={{ color: "primary.main" }} />
                          <Box sx={{ flex: 1, p: 1.5, borderRadius: 1, bgcolor: "primary.50" }}>
                            <Typography variant="caption" color="text.disabled">
                              Nuevo:{" "}
                            </Typography>
                            <Typography variant="body2" component="span" fontWeight={600} color="primary.main">
                              {Array.isArray(newValue) ? newValue.join(", ") : newValue || "-"}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              {/* Fecha */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled">
                  Solicitado el {formatDate(detailModal.detail.created_at)}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </DialogContent>
        {detailModal.request?.estado === "pendiente" && (
          <DialogActions>
            <Button
              startIcon={<MessageIcon />}
              onClick={() => setMessageModal({ open: true, id: detailModal.request?.id, mensaje: "" })}
            >
              {t("profile_req_mensaje", "Mensaje")}
            </Button>
            <Button
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setRejectModal({ open: true, id: detailModal.request?.id, motivo: "" })}
            >
              {t("profile_req_rechazar", "Rechazar")}
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={() => setApproveModal({ open: true, id: detailModal.request?.id, comentario: "" })}
            >
              {t("profile_req_aprobar", "Aprobar")}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Modal Aprobar */}
      <Dialog
        open={approveModal.open}
        onClose={() => setApproveModal({ open: false, id: null, comentario: "" })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("profile_req_aprobar_title", "Aprobar Solicitud")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("profile_req_aprobar_desc", "Los cambios se aplicaran automaticamente al perfil del usuario.")}
            </Typography>
            <TextField
              label={t("profile_req_comentario", "Comentario (opcional)")}
              multiline
              rows={3}
              value={approveModal.comentario}
              onChange={(e) => setApproveModal(prev => ({ ...prev, comentario: e.target.value }))}
              placeholder="Mensaje opcional para el solicitante..."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveModal({ open: false, id: null, comentario: "" })}>
            {t("common_cancelar", "Cancelar")}
          </Button>
          <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={handleAprobar}>
            {t("profile_req_aprobar", "Aprobar")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Rechazar */}
      <Dialog
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: null, motivo: "" })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("profile_req_rechazar_title", "Rechazar Solicitud")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("profile_req_rechazar_desc", "El solicitante sera notificado del rechazo.")}
            </Typography>
            <TextField
              label={`${t("profile_req_motivo", "Motivo del rechazo")} *`}
              multiline
              rows={3}
              value={rejectModal.motivo}
              onChange={(e) => setRejectModal(prev => ({ ...prev, motivo: e.target.value }))}
              placeholder="Indica el motivo del rechazo..."
              fullWidth
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectModal({ open: false, id: null, motivo: "" })}>
            {t("common_cancelar", "Cancelar")}
          </Button>
          <Button variant="contained" color="error" startIcon={<CancelIcon />} onClick={handleRechazar}>
            {t("profile_req_rechazar", "Rechazar")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Mensaje */}
      <Dialog
        open={messageModal.open}
        onClose={() => setMessageModal({ open: false, id: null, mensaje: "" })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("profile_req_mensaje_title", "Enviar Mensaje")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("profile_req_mensaje_desc", "El mensaje sera enviado a la bandeja de entrada del solicitante.")}
            </Typography>
            <TextField
              label={`${t("profile_req_mensaje_contenido", "Mensaje")} *`}
              multiline
              rows={4}
              value={messageModal.mensaje}
              onChange={(e) => setMessageModal(prev => ({ ...prev, mensaje: e.target.value }))}
              placeholder="Escribe tu mensaje..."
              fullWidth
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessageModal({ open: false, id: null, mensaje: "" })}>
            {t("common_cancelar", "Cancelar")}
          </Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleEnviarMensaje}>
            {t("profile_req_enviar", "Enviar")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
