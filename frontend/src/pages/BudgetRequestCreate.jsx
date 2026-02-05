/**
 * BudgetRequestCreate - Crear nueva solicitud de presupuesto
 * SAP/Enterprise UI - MUI Components
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { budget } from "../services/spm";
import api from "../services/api";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const UMBRAL_L1 = 200000;
const UMBRAL_L2 = 1000000;

/* ─────────────────────────────────────────────────────────────
   Confirmation Modal
───────────────────────────────────────────────────────────── */
function UrgentModal({ open, onClose, onConfirm, t }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          py: 2,
        }}
      >
        <WarningAmberIcon sx={{ color: "warning.main", fontSize: 24 }} />
        <Typography
          variant="subtitle1"
          component="span"
          sx={{ fontWeight: 700, textTransform: "uppercase", color: "text.primary" }}
        >
          {t("bur_urgente_title", "Solicitud urgente")}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t(
              "bur_urgente_warning",
              "Al marcar esta solicitud como URGENTE, se enviará una notificación y correo electrónico al aprobador cada 2 horas hasta que sea procesada."
            )}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
            {t("bur_urgente_confirm", "¿Estás seguro de continuar?")}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: "divider", px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit" size="small">
          {t("common_cancelar", "Cancelar")}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          size="small"
          sx={{
            bgcolor: "warning.main",
            "&:hover": { bgcolor: "warning.dark" },
          }}
        >
          {t("bur_urgente_enviar", "Enviar como urgente")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function BudgetRequestCreate() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    centro: "",
    sector: "",
    monto_solicitado: "",
    justificacion: "",
    importancia: "normal",
  });
  const [showUrgentWarning, setShowUrgentWarning] = useState(false);

  // Catalogs
  const [centros, setCentros] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [presupuestoInfo, setPresupuestoInfo] = useState(null);

  // Load catalogs
  useEffect(() => {
    const loadCatalogos = async () => {
      setLoading(true);
      try {
        const [centrosRes, sectoresRes] = await Promise.all([
          api.get("/catalogos/centros"),
          api.get("/catalogos/sectores"),
        ]);
        setCentros(centrosRes.data || []);
        setSectores(sectoresRes.data || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    loadCatalogos();
  }, []);

  // Load budget info when centro/sector changes
  useEffect(() => {
    const loadPresupuesto = async () => {
      if (!form.centro || !form.sector) {
        setPresupuestoInfo(null);
        return;
      }
      try {
        const res = await budget.getInfo(form.centro, form.sector);
        setPresupuestoInfo(res.data.presupuesto || null);
      } catch {
        setPresupuestoInfo(null);
      }
    };
    loadPresupuesto();
  }, [form.centro, form.sector]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const getNivelAprobacion = useCallback((monto) => {
    const m = parseFloat(monto) || 0;
    if (m > UMBRAL_L2) return { label: "Admin", desc: "más de $1M", color: "error.main" };
    if (m > UMBRAL_L1) return { label: "Nivel 2", desc: "hasta $1M", color: "secondary.main" };
    return { label: "Nivel 1", desc: "hasta $200K", color: "primary.main" };
  }, []);

  const validateForm = useCallback(() => {
    setError("");
    setMsg("");

    if (!form.centro || !form.sector) {
      setError(t("admin_required_fields", "Faltan campos obligatorios"));
      return false;
    }
    const monto = parseFloat(form.monto_solicitado);
    if (!monto || monto <= 0) {
      setError(t("bur_create_error", "Monto debe ser mayor a 0"));
      return false;
    }
    if ((form.justificacion || "").trim().length < 10) {
      setError(t("bur_campo_justificacion", "Justificación debe tener al menos 10 caracteres"));
      return false;
    }
    return true;
  }, [form, t]);

  const submitRequest = useCallback(async () => {
    setSubmitting(true);
    try {
      const monto = parseFloat(form.monto_solicitado);
      await budget.crear({
        centro: form.centro,
        sector: form.sector,
        monto_solicitado: monto,
        justificacion: form.justificacion.trim(),
        importancia: form.importancia,
      });
      setMsg(t("bur_create_success", "Solicitud creada exitosamente"));
      setTimeout(() => navigate("/presupuestos"), 1500);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate, t]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      if (form.importancia === "urgente") {
        setShowUrgentWarning(true);
      } else {
        submitRequest();
      }
    },
    [form.importancia, validateForm, submitRequest]
  );

  const handleConfirmUrgent = useCallback(() => {
    setShowUrgentWarning(false);
    submitRequest();
  }, [submitRequest]);

  const montoNum = parseFloat(form.monto_solicitado) || 0;
  const nuevoSaldo = presupuestoInfo ? (presupuestoInfo.saldo_usd || 0) + montoNum : null;
  const nivelAprobacion = getNivelAprobacion(form.monto_solicitado);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 768, mx: "auto", px: 3, py: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <IconButton
            onClick={() => navigate("/presupuestos")}
            sx={{
              color: "text.secondary",
              border: 1,
              borderColor: "transparent",
              "&:hover": {
                color: "text.primary",
                bgcolor: "background.paper",
                borderColor: "divider",
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
              {t("bur_create_title", "Nueva solicitud de presupuesto")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("bur_create_subtitle", "Solicitar incorporación de saldo al presupuesto")}
            </Typography>
          </Box>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {msg && (
          <Alert severity="success" onClose={() => setMsg("")} sx={{ mb: 2 }}>
            {msg}
          </Alert>
        )}

        {/* Form Card */}
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <form onSubmit={handleSubmit}>
            {/* Section: Location */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "text.secondary",
                  display: "block",
                  mb: 2,
                }}
              >
                Ubicación
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <FormControl size="small" fullWidth required disabled={loading}>
                  <InputLabel>{t("bur_campo_centro", "Centro")}</InputLabel>
                  <Select
                    name="centro"
                    value={form.centro}
                    onChange={handleChange}
                    label={t("bur_campo_centro", "Centro")}
                  >
                    <MenuItem value="">
                      <em>{t("crud_select", "Selecciona")}...</em>
                    </MenuItem>
                    {centros.map((c) => (
                      <MenuItem key={c.codigo || c.id} value={c.codigo || c.id}>
                        {c.codigo || c.id} - {c.nombre || c.descripcion || ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth required disabled={loading}>
                  <InputLabel>{t("bur_campo_sector", "Sector")}</InputLabel>
                  <Select
                    name="sector"
                    value={form.sector}
                    onChange={handleChange}
                    label={t("bur_campo_sector", "Sector")}
                  >
                    <MenuItem value="">
                      <em>{t("crud_select", "Selecciona")}...</em>
                    </MenuItem>
                    {sectores.map((s) => (
                      <MenuItem key={s.nombre} value={s.nombre}>
                        {s.nombre || s.descripcion || ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Budget Info Panel */}
            {presupuestoInfo && (
              <Box sx={{ px: 3, py: 2.5, bgcolor: "grey.50", borderBottom: 1, borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: "text.secondary",
                    }}
                  >
                    Presupuesto actual
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                    gap: 2,
                  }}
                >
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "text.disabled",
                        display: "block",
                        mb: 0.5,
                      }}
                    >
                      Presupuesto
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.primary" }}>
                      {formatCurrency(presupuestoInfo.monto_usd)}
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "text.disabled",
                        display: "block",
                        mb: 0.5,
                      }}
                    >
                      Saldo actual
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600, color: "success.main" }}>
                      {formatCurrency(presupuestoInfo.saldo_usd)}
                    </Typography>
                  </Paper>

                  {montoNum > 0 && (
                    <>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            color: "text.disabled",
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          Incorporación
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600, color: "primary.main" }}>
                          +{formatCurrency(montoNum)}
                        </Typography>
                      </Paper>

                      <Paper
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: "success.50",
                          border: 1,
                          borderColor: "success.200",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            color: "success.main",
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          Nuevo saldo
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700, color: "success.dark" }}>
                          {formatCurrency(nuevoSaldo)}
                        </Typography>
                      </Paper>
                    </>
                  )}
                </Box>
              </Box>
            )}

            {/* Section: Amount */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "text.secondary",
                  display: "block",
                  mb: 2,
                }}
              >
                Monto e Importancia
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  size="small"
                  label={t("bur_campo_monto", "Monto solicitado (USD)")}
                  type="number"
                  name="monto_solicitado"
                  value={form.monto_solicitado}
                  onChange={handleChange}
                  required
                  placeholder="0.00"
                  InputProps={{
                    sx: { fontFamily: "monospace" },
                  }}
                />

                <FormControl size="small" fullWidth>
                  <InputLabel>{t("bur_campo_importancia", "Importancia")}</InputLabel>
                  <Select
                    name="importancia"
                    value={form.importancia}
                    onChange={handleChange}
                    label={t("bur_campo_importancia", "Importancia")}
                  >
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="urgente">Urgente</MenuItem>
                  </Select>
                </FormControl>

                {montoNum > 0 && (
                  <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "text.disabled",
                        mb: 0.5,
                      }}
                    >
                      Nivel de aprobación
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: nivelAprobacion.color }}>
                      {nivelAprobacion.label}
                      <Typography component="span" variant="caption" sx={{ fontWeight: 400, color: "text.secondary", ml: 0.5 }}>
                        ({nivelAprobacion.desc})
                      </Typography>
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Section: Justification */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "text.secondary",
                  display: "block",
                  mb: 2,
                }}
              >
                Justificación
              </Typography>
              <Box>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  rows={4}
                  label={
                    <>
                      {t("bur_campo_justificacion", "Justificación")}
                      <Typography component="span" sx={{ color: "error.main", ml: 0.5 }}>
                        *
                      </Typography>
                    </>
                  }
                  name="justificacion"
                  value={form.justificacion}
                  onChange={handleChange}
                  required
                  placeholder={t(
                    "bur_campo_justificacion_placeholder",
                    "Explica el motivo del aumento de presupuesto..."
                  )}
                />
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.5,
                    display: "block",
                    color: form.justificacion.length < 10 ? "warning.main" : "text.disabled",
                  }}
                >
                  {form.justificacion.length}/10 mínimo
                </Typography>
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ px: 3, py: 2, bgcolor: "grey.50", display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={() => navigate("/presupuestos")}
                disabled={submitting}
              >
                {t("bur_btn_cancelar", "Cancelar")}
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={submitting || loading}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              >
                {submitting ? t("common_cargando", "Enviando...") : t("bur_btn_enviar", "Enviar solicitud")}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>

      {/* Urgent Warning Modal */}
      <UrgentModal
        open={showUrgentWarning}
        onClose={() => setShowUrgentWarning(false)}
        onConfirm={handleConfirmUrgent}
        t={t}
      />
    </Box>
  );
}
