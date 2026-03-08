/**
 * BudgetRequestDetail - Detalle de Solicitud de Presupuesto
 * Vista de detalle individual de una solicitud de incorporacion (BUR)
 *
 * SAP/Enterprise UI - Sprint 23+
 * Migrado a Material-UI
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { budget } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Chip,
  Stack,
  Divider,
  Modal,
  TextField,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PersonIcon from "@mui/icons-material/Person";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DescriptionIcon from "@mui/icons-material/Description";
import SecurityIcon from "@mui/icons-material/Security";

const estadoToBadge = {
  pendiente: "Pendiente",
  aprobado_l1: "Aprobado L1",
  aprobado_l2: "Aprobado L2",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
};

const nivelLabels = {
  L1: "Nivel 1 (hasta $200K)",
  L2: "Nivel 2 (hasta $1M)",
  ADMIN: "Admin (mas de $1M)",
};

const getEstadoColor = (estado) => {
  switch (estado) {
    case "aprobado":
      return "success";
    case "rechazado":
      return "error";
    case "aprobado_l1":
    case "aprobado_l2":
      return "info";
    default:
      return "warning";
  }
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "90%", sm: 500 },
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

export default function BudgetRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const [bur, setBur] = useState(null);
  const [presupuestoInfo, setPresupuestoInfo] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [approveModal, setApproveModal] = useState({ open: false, comentario: "" });
  const [rejectModal, setRejectModal] = useState({ open: false, motivo: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await budget.obtener(id);
      const data = res.data.request;
      setBur(data);

      // Load budget info
      if (data?.centro && data?.sector) {
        try {
          const presRes = await budget.getInfo(data.centro, data.sector);
          setPresupuestoInfo(presRes.data.presupuesto || null);
        } catch {
          setPresupuestoInfo(null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAprobar = useCallback(async () => {
    setError("");
    setMsg("");
    try {
      await budget.aprobar(id, approveModal.comentario);
      setMsg(t("bur_aprobada_msg", "Solicitud de presupuesto aprobada"));
      setApproveModal({ open: false, comentario: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [id, approveModal.comentario, load, t]);

  const handleRechazar = useCallback(async () => {
    setError("");
    setMsg("");
    const motivo = rejectModal.motivo.trim();
    if (motivo.length < 5) {
      setError(t("bur_motivo_required", "Debe proporcionar un motivo"));
      return;
    }
    try {
      await budget.rechazar(id, motivo);
      setMsg(t("bur_rechazada_msg", "Solicitud de presupuesto rechazada"));
      setRejectModal({ open: false, motivo: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [id, rejectModal.motivo, load, t]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // SPRINT 2.4: Permitir aprobar estados intermedios (aprobado_l1, aprobado_l2)
  const canApprove = ["pendiente", "aprobado_l1", "aprobado_l2"].includes(bur?.estado);
  const nuevoSaldo = presupuestoInfo && bur
    ? (presupuestoInfo.saldo_usd || 0) + (bur.monto_solicitado_usd || 0)
    : null;

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!bur) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary" }}>
            {t("bur_detail_title", "DETALLE DE SOLICITUD").toUpperCase()}
          </Typography>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/presupuestos")}
          >
            {t("common_volver", "Volver")}
          </Button>
        </Box>
        <Alert severity="error">{t("common_no_encontrado", "Solicitud no encontrada")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary" }}>
          {`${t("bur_detail_title", "SOLICITUD")} #${id}`.toUpperCase()}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/presupuestos")}
          >
            {t("common_volver", "Volver")}
          </Button>
          {canApprove && (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CheckCircleIcon />}
                onClick={() => setApproveModal({ open: true, comentario: "" })}
              >
                {t("bur_aprobar", "Aprobar")}
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setRejectModal({ open: true, motivo: "" })}
              >
                {t("bur_rechazar", "Rechazar")}
              </Button>
            </>
          )}
        </Stack>
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

      {/* Main Content Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        {/* Main info */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, gridColumn: { lg: "span 1" } }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t("bur_detail_title", "Detalle de Solicitud")}
              </Typography>
              <Chip
                label={estadoToBadge[bur.estado] || bur.estado}
                color={getEstadoColor(bur.estado)}
                size="small"
              />
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 3,
              }}
            >
              {/* Centro */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <BusinessIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_campo_centro", "Centro")}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
                  {bur.centro || "-"}
                </Typography>
              </Box>

              {/* Sector */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_campo_sector", "Sector")}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
                  {bur.sector || "-"}
                </Typography>
              </Box>

              {/* Monto */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <AttachMoneyIcon sx={{ fontSize: 18, color: "warning.main" }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_col_monto", "Monto Solicitado")}
                  </Typography>
                </Stack>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, fontFamily: "monospace", color: "primary.main" }}
                >
                  {formatCurrency(bur.monto_solicitado_usd)}
                </Typography>
              </Box>

              {/* Nivel */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <SecurityIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_col_nivel", "Nivel de Aprobacion")}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
                  {nivelLabels[bur.nivel_aprobacion_requerido] || bur.nivel_aprobacion_requerido}
                </Typography>
              </Box>

              {/* Solicitante */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 18, color: "info.main" }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_solicitante", "Solicitante")}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
                    {bur.solicitante_id || "-"}
                  </Typography>
                  {bur.solicitante_rol && (
                    <Chip
                      label={bur.solicitante_rol}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.75rem" }}
                    />
                  )}
                </Stack>
              </Box>

              {/* Fecha */}
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 18, color: "info.light" }} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_fecha_creacion", "Fecha de creacion")}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
                  {formatDate(bur.created_at)}
                </Typography>
              </Box>
            </Box>

            {/* Justificacion */}
            <Divider sx={{ my: 3 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <DescriptionIcon sx={{ fontSize: 18, color: "primary.main" }} />
                <Typography variant="body2" color="text.secondary">
                  {t("bur_campo_justificacion", "Justificacion")}
                </Typography>
              </Stack>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: "grey.50",
                  color: "text.primary",
                }}
              >
                <Typography variant="body1">{bur.justificacion || "-"}</Typography>
              </Paper>
            </Box>

            {/* Rejection reason if rejected */}
            {bur.estado === "rechazado" && bur.motivo_rechazo && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <CancelIcon sx={{ fontSize: 18, color: "error.main" }} />
                    <Typography variant="body2" color="error.main">
                      {t("bur_motivo_rechazo", "Motivo de rechazo")}
                    </Typography>
                  </Stack>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: "error.50",
                      borderColor: "error.200",
                      color: "text.primary",
                    }}
                  >
                    <Typography variant="body1">{bur.motivo_rechazo}</Typography>
                  </Paper>
                </Box>
              </>
            )}

            {/* Approval info */}
            {bur.aprobador_id && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                    <Typography variant="body2" color="success.main">
                      {t("common_aprobado_por", "Aprobado por")}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body1" sx={{ color: "text.primary" }}>
                      {bur.aprobador_id}
                    </Typography>
                    {bur.aprobador_rol && (
                      <Chip
                        label={bur.aprobador_rol}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.75rem" }}
                      />
                    )}
                    {bur.aprobado_at && (
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(bur.aprobado_at)}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Paper>
        </Box>

        {/* Side panel */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Budget impact */}
          {presupuestoInfo && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                {t("common_presupuesto", "Presupuesto")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {bur.centro}/{bur.sector}
              </Typography>

              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_saldo_actual", "Saldo actual")}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.primary" }}
                  >
                    {formatCurrency(presupuestoInfo.saldo_usd)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_col_monto", "Aumento")}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: "monospace", fontWeight: 600, color: "success.main" }}
                  >
                    +{formatCurrency(bur.monto_solicitado_usd)}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("bur_saldo_nuevo", "Nuevo saldo")}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.main" }}
                  >
                    {formatCurrency(nuevoSaldo)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}

          {/* Timeline / History */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              {t("common_historial", "Historial")}
            </Typography>

            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    mt: 0.75,
                    flexShrink: 0,
                  }}
                />
                <Box>
                  <Typography variant="body2" sx={{ color: "text.primary" }}>
                    {t("bur_estado_pendiente", "Creada")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(bur.created_at)}
                  </Typography>
                </Box>
              </Stack>
              {bur.aprobado_at && (
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "success.main",
                      mt: 0.75,
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      {t("bur_estado_aprobado", "Aprobada")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(bur.aprobado_at)}
                    </Typography>
                  </Box>
                </Stack>
              )}
              {bur.estado === "rechazado" && (
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "error.main",
                      mt: 0.75,
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      {t("bur_estado_rechazado", "Rechazada")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(bur.updated_at)}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Box>
      </Box>

      {/* Approve Modal */}
      <Modal
        open={approveModal.open}
        onClose={() => setApproveModal({ open: false, comentario: "" })}
      >
        <Box sx={modalStyle}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {`${t("bur_aprobar", "Aprobar")} #${id}`}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("bur_confirm_aprobar", "Esta accion aumentara el presupuesto de")} {bur.centro}/{bur.sector}{" "}
            {t("common_en", "en")} {formatCurrency(bur.monto_solicitado_usd)}.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label={t("bur_comentario_aprobacion", "Comentario (opcional)")}
            value={approveModal.comentario}
            onChange={(e) => setApproveModal((prev) => ({ ...prev, comentario: e.target.value }))}
            sx={{ mb: 3 }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="text"
              onClick={() => setApproveModal({ open: false, comentario: "" })}
            >
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CheckCircleIcon />}
              onClick={handleAprobar}
            >
              {t("bur_aprobar", "Aprobar")}
            </Button>
          </Stack>
        </Box>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, motivo: "" })}
      >
        <Box sx={modalStyle}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {`${t("bur_rechazar", "Rechazar")} #${id}`}
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label={`${t("bur_motivo_rechazo", "Motivo de rechazo")} *`}
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            placeholder={t("bur_motivo_placeholder", "Indica el motivo del rechazo...")}
            sx={{ mb: 3 }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="text"
              onClick={() => setRejectModal({ open: false, motivo: "" })}
            >
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleRechazar}
            >
              {t("bur_rechazar", "Rechazar")}
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}
