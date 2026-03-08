/**
 * Aprobaciones - Gestion de aprobaciones de solicitudes
 * MUI Components Version
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useDebouncedValue as useDebounced } from "../hooks/useDebouncedValue";
import { useI18n } from "../context/i18n";
import { formatDate, formatCurrency, getSectorNombre, formatAlmacen } from "../utils/formatters";
import { getCriticidadConfig } from "../utils/styleConfig";
import StatusBadge from "../components/ui/StatusBadge";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Tabs,
  Tab,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import TagIcon from "@mui/icons-material/Tag";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

const DEBOUNCE_MS = 300;

/* ─────────────────────────────────────────────────────────────
   Reject Modal
───────────────────────────────────────────────────────────── */
function RejectModal({ open, id, onClose, onConfirm, t }) {
  const [motivo, setMotivo] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(motivo.trim() || "Rechazada");
    setMotivo("");
  };

  const handleClose = () => {
    setMotivo("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 2 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: "50%",
            bgcolor: "error.lighter",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CancelIcon sx={{ color: "error.main", fontSize: 20 }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          {t("aprov_rechazar", "Rechazar")} #{id}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "text.secondary",
            mb: 1,
          }}
        >
          {t("aprov_motivo", "Motivo de rechazo")}
        </Typography>
        <TextField
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={t("planner_rechazar_placeholder", "Explica brevemente el motivo del rechazo...")}
          multiline
          rows={3}
          fullWidth
          size="small"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50", borderTop: 1, borderColor: "divider" }}>
        <Button onClick={handleClose} variant="outlined" color="inherit" size="small">
          {t("common_cancelar", "Cancelar")}
        </Button>
        <Button onClick={handleConfirm} variant="contained" color="error" size="small">
          {t("aprov_rechazar", "Rechazar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Budget Error Modal
───────────────────────────────────────────────────────────── */
function BudgetErrorModal({ open, message, onClose, onRequestBudget, t }) {
  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 2 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: "50%",
            bgcolor: "warning.lighter",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WarningAmberIcon sx={{ color: "warning.main", fontSize: 20 }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600} color="warning.dark">
          {t("aprov_presupuesto_insuficiente", "Presupuesto Insuficiente")}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {message}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {t("aprov_presupuesto_ayuda", "Para aprobar esta solicitud, solicita un aumento de presupuesto")}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50", borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose} variant="outlined" color="inherit" size="small">
          {t("common_cerrar", "Cerrar")}
        </Button>
        <Button onClick={onRequestBudget} variant="contained" color="primary" size="small">
          {t("aprov_solicitar_presupuesto", "Solicitar Presupuesto")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Detail Modal
───────────────────────────────────────────────────────────── */
function DetalleModal({ open, solicitud, sectores, showActions, onClose, onAprobar, onRechazar, t }) {
  if (!open || !solicitud) return null;

  const criticidadConfig = getCriticidadConfig(solicitud.criticidad || "Normal");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          pb: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          Solicitud #{solicitud.id}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Estado y Criticidad */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <StatusBadge
              estado={solicitud.estado || solicitud.status}
              tooltipInfo={{
                aprobador: [solicitud.aprobador_nombre, solicitud.aprobador_apellido].filter(Boolean).join(" ") || null,
                planificador: [solicitud.planner_nombre, solicitud.planner_apellido].filter(Boolean).join(" ") || null,
                fechaEnvio: solicitud.created_at,
              }}
            />
            {solicitud.criticidad && (
              <Chip
                label={criticidadConfig.label}
                size="small"
                sx={{
                  color: criticidadConfig.color,
                  bgcolor: criticidadConfig.bg,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
            )}
          </Box>

          {/* Info y Ubicacion */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  display: "block",
                  mb: 1.5,
                }}
              >
                {t('sol_info_general', 'Información General')}
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TagIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>ID:</strong> {solicitud.id}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarTodayIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Creacion:</strong> {formatDate(solicitud.created_at)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Necesidad:</strong> {formatDate(solicitud.fecha_necesidad)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  display: "block",
                  mb: 1.5,
                }}
              >
                {t('sol_ubicacion', 'Ubicación')}
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BusinessIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Centro:</strong> {solicitud.centro || "-"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LocationOnIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Sector:</strong> {getSectorNombre(solicitud.sector, sectores)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <WarehouseIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Almacen:</strong> {formatAlmacen(solicitud.almacen_virtual) || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>

          {/* Justificacion */}
          {solicitud.justificacion && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: "primary.lighter",
                borderColor: "primary.light",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  display: "block",
                  mb: 1,
                }}
              >
                {t('common_justificacion', 'Justificación')}
              </Typography>
              <Typography variant="body2" color="text.primary">
                {solicitud.justificacion}
              </Typography>
            </Paper>
          )}

          {/* Items */}
          {solicitud.items && solicitud.items.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  display: "block",
                  mb: 1.5,
                }}
              >
                {t('sol_materiales', 'Materiales')} ({solicitud.items.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>
                        {t('common_codigo', 'Código')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>
                        {t('common_descripcion', 'Descripción')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>
                        {t('sol_cant', 'Cant.')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>
                        {t('common_precio', 'Precio')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase" }}>
                        {t('sol_subtotal', 'Subtotal')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {solicitud.items.map((item, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                          {item.codigo || item.codigo_sap}
                        </TableCell>
                        <TableCell sx={{ color: "text.primary" }}>{item.descripcion}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: "text.primary" }}>
                          {item.cantidad}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          {formatCurrency(item.precio_unitario || 0)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: "text.primary" }}>
                          {formatCurrency((item.cantidad || 0) * (item.precio_unitario || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>
                        {t('common_total', 'Total')}:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>
                        {formatCurrency(solicitud.total_monto || 0)}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50", borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose} variant="outlined" color="inherit" size="small">
          {t('common_cerrar', 'Cerrar')}
        </Button>
        {showActions && (
          <>
            <Button
              onClick={() => onAprobar(solicitud.id)}
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckCircleIcon />}
            >
              {t("aprov_aprobar", "Aprobar")}
            </Button>
            <Button
              onClick={() => onRechazar(solicitud.id)}
              variant="contained"
              color="error"
              size="small"
              startIcon={<CancelIcon />}
            >
              {t("aprov_rechazar", "Rechazar")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function Aprobaciones() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);

  const [activeTab, setActiveTab] = useState(0);
  const [detalleModal, setDetalleModal] = useState({ open: false, solicitud: null });
  const [rejectModal, setRejectModal] = useState({ open: false, id: null });
  const [budgetErrorModal, setBudgetErrorModal] = useState({ open: false, message: "" });

  // Check if user is admin
  const isAdmin = useMemo(() => {
    const rol = (user?.rol || "").toLowerCase();
    return rol.includes("admin") || rol.includes("administrador");
  }, [user?.rol]);

  // Auto-clear success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Cargar sectores
  useEffect(() => {
    const fetchSectores = async () => {
      try {
        const res = await api.get("/catalogos/sectores");
        const data = Array.isArray(res.data) ? res.data : [];
        setSectores(data);
      } catch (err) {
      }
    };
    fetchSectores();
  }, []);

  // Load pending approvals
  const loadPendientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { estado: "submitted" };
      if (!isAdmin) {
        params.aprobador_id = user?.id;
      }
      const res = await solicitudes.listar(params);
      const data = res.data.solicitudes || res.data.results || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin]);

  // Load approval history
  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const [resAprobadas, resRechazadas] = await Promise.all([
        solicitudes.listar({ estado: "approved" }),
        solicitudes.listar({ estado: "rejected" }),
      ]);
      const aprobadas = resAprobadas.data.solicitudes || resAprobadas.data.results || [];
      const rechazadas = resRechazadas.data.solicitudes || resRechazadas.data.results || [];
      const all = [...aprobadas, ...rechazadas].sort(
        (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );
      setHistorial(all);
    } catch (err) {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  useEffect(() => {
    loadPendientes();
    loadHistorial();
  }, [loadPendientes, loadHistorial]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!loading) {
        await loadPendientes();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadPendientes, loading]);


  // Filtrado pendientes
  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) => {
      return (
        String(s.id).includes(term) ||
        (s.justificacion || "").toLowerCase().includes(term) ||
        (s.centro || "").toLowerCase().includes(term) ||
        (s.sector || "").toLowerCase().includes(term) ||
        `${s.solicitante_nombre || ""} ${s.solicitante_apellido || ""}`.toLowerCase().includes(term)
      );
    });
  }, [items, debouncedQ]);

  // Filtrado historial
  const filteredHistorial = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return historial;
    return historial.filter((s) => {
      return (
        String(s.id).includes(term) ||
        (s.justificacion || "").toLowerCase().includes(term) ||
        (s.centro || "").toLowerCase().includes(term) ||
        (s.sector || "").toLowerCase().includes(term)
      );
    });
  }, [historial, debouncedQ]);

  const aprobar = useCallback(
    async (id) => {
      setError("");
      try {
        await solicitudes.aprobar(id);
        setSuccess(t("aprov_aprobada_msg", "Solicitud aprobada y asignada a planificador"));
        loadPendientes();
        loadHistorial();
        setDetalleModal({ open: false, solicitud: null });
      } catch (err) {
        const errorCode = err.response?.data?.error?.code;
        const errorMessage = err.response?.data?.error?.message || err.message;
        if (errorCode === "saldo_insuficiente" || errorMessage.toLowerCase().includes("saldo insuficiente")) {
          setBudgetErrorModal({ open: true, message: errorMessage });
        } else {
          setError(errorMessage);
        }
      }
    },
    [loadPendientes, loadHistorial, t]
  );

  const handleRechazar = useCallback((id) => {
    setDetalleModal({ open: false, solicitud: null });
    setRejectModal({ open: true, id });
  }, []);

  const confirmRechazar = useCallback(
    async (motivo) => {
      if (!rejectModal.id) return;
      setError("");
      try {
        await solicitudes.rechazar(rejectModal.id, motivo);
        setSuccess(t("aprov_rechazada_msg", "Solicitud rechazada."));
        loadPendientes();
        loadHistorial();
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setRejectModal({ open: false, id: null });
      }
    },
    [rejectModal.id, loadPendientes, loadHistorial, t]
  );

  // Columnas del DataGrid para pendientes - AG Grid format
  const columnDefs = useMemo(
    () => [
      { field: "id", headerName: t('common_id', 'ID'), flex: 0.4, minWidth: 60 },
      {
        field: "fecha_creacion",
        headerName: t('common_fecha', 'Fecha'),
        flex: 0.6,
        minWidth: 90,
        valueGetter: (params) => params.data.fecha_creacion || params.data.created_at,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "solicitante",
        headerName: t('common_solicitante', 'Solicitante'),
        flex: 0.9,
        minWidth: 120,
        valueGetter: (params) => `${params.data.solicitante_nombre || ""} ${params.data.solicitante_apellido || ""}`.trim() || "-",
      },
      {
        field: "centro",
        headerName: t('common_centro', 'Centro'),
        flex: 0.5,
        minWidth: 70,
        valueGetter: (params) => params.data.centro || "-",
      },
      {
        field: "almacen_virtual",
        headerName: t('common_almacen', 'Almacén'),
        flex: 0.5,
        minWidth: 70,
        cellRenderer: (params) => formatAlmacen(params.value || params.data.almacen) || "-",
      },
      {
        field: "sector",
        headerName: t('common_sector', 'Sector'),
        flex: 0.8,
        minWidth: 100,
        valueGetter: (params) => getSectorNombre(params.data.sector || params.data.sector_id, sectores),
      },
      {
        field: "fecha_necesidad",
        headerName: t('sol_f_necesidad', 'F. Necesidad'),
        flex: 0.6,
        minWidth: 90,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "criticidad",
        headerName: t('common_criticidad', 'Criticidad'),
        flex: 0.5,
        minWidth: 80,
        cellRenderer: (params) => {
          const config = getCriticidadConfig(params.value || "Normal");
          return (
            <Typography variant="body2" fontWeight={600} sx={{ color: config.color }}>
              {config.label}
            </Typography>
          );
        },
      },
      {
        field: "total_monto",
        headerName: t('common_monto', 'Monto'),
        flex: 0.7,
        minWidth: 100,
        cellStyle: { textAlign: 'right', paddingRight: '16px' },
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.primary" }}>
            {formatCurrency(params.value || 0)}
          </Typography>
        ),
      },
      {
        field: "items_count",
        headerName: t('common_items', 'Items'),
        flex: 0.4,
        minWidth: 50,
        valueGetter: (params) => params.data.items?.length || 0,
      },
      {
        field: "acciones",
        headerName: t('common_acciones', 'Acciones'),
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Stack direction="row" spacing={0.5}>
            <Button
              onClick={() => setDetalleModal({ open: true, solicitud: params.data })}
              size="small"
              variant="text"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "primary.main",
                fontSize: "0.75rem",
                minWidth: "auto",
                px: 1,
                "&:hover": { bgcolor: "primary.lighter" },
              }}
            >
              {t('common_ver', 'Ver')}
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <Button
              onClick={() => aprobar(params.data.id)}
              size="small"
              variant="text"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "success.main",
                fontSize: "0.75rem",
                minWidth: "auto",
                px: 1,
                "&:hover": { bgcolor: "success.lighter" },
              }}
            >
              {t('common_aprobar', 'Aprobar')}
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <Button
              onClick={() => setRejectModal({ open: true, id: params.data.id })}
              size="small"
              variant="text"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "error.main",
                fontSize: "0.75rem",
                minWidth: "auto",
                px: 1,
                "&:hover": { bgcolor: "error.lighter" },
              }}
            >
              {t('common_rechazar', 'Rechazar')}
            </Button>
          </Stack>
        ),
      },
    ],
    [sectores, aprobar, t]
  );

  // Columnas para historial - AG Grid format
  const columnDefsHistorial = useMemo(
    () => [
      { field: "id", headerName: t('common_id', 'ID'), flex: 0.4, minWidth: 60 },
      {
        field: "fecha_creacion",
        headerName: t('common_fecha', 'Fecha'),
        flex: 0.6,
        minWidth: 90,
        valueGetter: (params) => params.data.fecha_creacion || params.data.created_at,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "solicitante",
        headerName: t('common_solicitante', 'Solicitante'),
        flex: 0.9,
        minWidth: 120,
        valueGetter: (params) => `${params.data.solicitante_nombre || ""} ${params.data.solicitante_apellido || ""}`.trim() || "-",
      },
      {
        field: "centro",
        headerName: t('common_centro', 'Centro'),
        flex: 0.5,
        minWidth: 70,
      },
      {
        field: "sector",
        headerName: t('common_sector', 'Sector'),
        flex: 0.8,
        minWidth: 100,
        valueGetter: (params) => getSectorNombre(params.data.sector || params.data.sector_id, sectores),
      },
      {
        field: "criticidad",
        headerName: t('common_criticidad', 'Criticidad'),
        flex: 0.5,
        minWidth: 80,
        cellRenderer: (params) => {
          const config = getCriticidadConfig(params.value || "Normal");
          return (
            <Typography variant="body2" fontWeight={600} sx={{ color: config.color }}>
              {config.label}
            </Typography>
          );
        },
      },
      {
        field: "total_monto",
        headerName: t('common_monto', 'Monto'),
        flex: 0.7,
        minWidth: 100,
        cellStyle: { textAlign: 'right', paddingRight: '16px' },
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.primary" }}>
            {formatCurrency(params.value || 0)}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: t('common_estado', 'Estado'),
        flex: 0.7,
        minWidth: 100,
        valueGetter: (params) => params.data.estado || params.data.status || "pendiente",
        cellRenderer: (params) => {
          const data = params.data;
          const aprobador = [data.aprobador_nombre, data.aprobador_apellido].filter(Boolean).join(" ") || null;
          const planner = [data.planner_nombre, data.planner_apellido].filter(Boolean).join(" ") || null;
          return (
            <StatusBadge
              estado={params.value}
              showIcon={false}
              tooltipInfo={{ aprobador, planificador: planner, fechaEnvio: data.created_at }}
            />
          );
        },
      },
      {
        field: "acciones",
        headerName: t('common_acciones', 'Acciones'),
        flex: 0.4,
        minWidth: 60,
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Button
            onClick={() => setDetalleModal({ open: true, solicitud: params.data })}
            size="small"
            variant="text"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              color: "primary.main",
              fontSize: "0.75rem",
              minWidth: "auto",
              px: 1,
              "&:hover": { bgcolor: "primary.lighter" },
            }}
          >
            {t('common_ver', 'Ver')}
          </Button>
        ),
      },
    ],
    [sectores, t]
  );

  const rows = useMemo(() => filtered.map((item) => ({ ...item, id: item.id })), [filtered]);
  const rowsHistorial = useMemo(() => filteredHistorial.map((item) => ({ ...item, id: item.id })), [filteredHistorial]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton
              onClick={() => navigate(-1)}
              size="small"
              sx={{
                color: "text.secondary",
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "grey.100", borderColor: "grey.400" },
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box>
              <Typography
                variant="h5"
                component="h1"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing="0.05em"
                color="text.primary"
              >
                {t("aprov_page_title", "Aprobaciones")}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Alertas */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError("")}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            onClose={() => setSuccess("")}
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>
        )}

        {/* Main Card */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", px: 1 }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  minHeight: 48,
                  fontSize: "0.875rem",
                },
                "& .MuiTabs-indicator": {
                  height: 3,
                  borderRadius: "3px 3px 0 0",
                },
              }}
            >
              <Tab
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {t("aprov_pendientes", "Pendientes")}
                    <Chip
                      label={items.length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        bgcolor: activeTab === 0 ? "primary.light" : "grey.200",
                        color: activeTab === 0 ? "primary.dark" : "text.secondary",
                      }}
                    />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {t("aprov_historial", "Historial")}
                    <Chip
                      label={historial.length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        bgcolor: activeTab === 1 ? "primary.light" : "grey.200",
                        color: activeTab === 1 ? "primary.dark" : "text.secondary",
                      }}
                    />
                  </Box>
                }
              />
            </Tabs>
          </Box>

          {/* AG Grid */}
          {activeTab === 0 ? (
            <SPMAgGrid
              rowData={rows}
              columnDefs={columnDefs}
              loading={loading}
              height={600}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              enableQuickFilter={true}
              onRowDoubleClick={(data) => setDetalleModal({ open: true, solicitud: data })}
              exportFileName="aprobaciones_pendientes"
              emptyMessage={t("aprov_no_items", "No hay solicitudes pendientes de aprobacion")}
            />
          ) : (
            <SPMAgGrid
              rowData={rowsHistorial}
              columnDefs={columnDefsHistorial}
              loading={loadingHistorial}
              height={600}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              enableQuickFilter={true}
              onRowDoubleClick={(data) => setDetalleModal({ open: true, solicitud: data })}
              exportFileName="historial_aprobaciones"
              emptyMessage={t("aprov_no_historial", "No hay registros en el historial")}
            />
          )}
        </Paper>

        {/* Modals */}
        <RejectModal
          open={rejectModal.open}
          id={rejectModal.id}
          onClose={() => setRejectModal({ open: false, id: null })}
          onConfirm={confirmRechazar}
          t={t}
        />

        <BudgetErrorModal
          open={budgetErrorModal.open}
          message={budgetErrorModal.message}
          onClose={() => setBudgetErrorModal({ open: false, message: "" })}
          onRequestBudget={() => {
            setBudgetErrorModal({ open: false, message: "" });
            navigate("/presupuestos/nueva");
          }}
          t={t}
        />

        <DetalleModal
          open={detalleModal.open}
          solicitud={detalleModal.solicitud}
          sectores={sectores}
          showActions={activeTab === 0}
          onClose={() => setDetalleModal({ open: false, solicitud: null })}
          onAprobar={aprobar}
          onRechazar={handleRechazar}
          t={t}
        />
      </Box>
    </Box>
  );
}
