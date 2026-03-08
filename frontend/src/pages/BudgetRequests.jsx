/**
 * BudgetRequests - Gestion de Presupuestos
 * Vista de historial de movimientos y solicitudes de incorporacion (BUR)
 *
 * SAP/Enterprise UI - Sprint 23+
 * Migrado a Material-UI
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { budget } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { formatCurrency, formatDate } from "../utils/formatters";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Chip,
  TextField,
  Alert,
  Drawer,
  Stack,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

// Shared components
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { nivelLabels } from "../utils/statusStyles";

const DEBOUNCE_MS = 300;

/* ─────────────────────────────────────────────────────────────
   Export CSV Helper
───────────────────────────────────────────────────────────── */
const exportToCSV = (data, columns, filename) => {
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      let val = c.exportValue ? c.exportValue(row) : (row[c.key] || '');
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  ).join('\n');

  const csv = `${headers}\n${rows}`;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const estadoToBadge = {
  pendiente: "Pendiente",
  aprobado_l1: "Aprobado L1",
  aprobado_l2: "Aprobado L2",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
};

const getEstadoColor = (estado) => {
  switch (estado) {
    case "pendiente":
    case "aprobado_l1":
    case "aprobado_l2":
      return "warning";
    case "aprobado":
      return "success";
    case "rechazado":
      return "error";
    default:
      return "default";
  }
};

const getTipoColor = (tipo) => {
  if (tipo.includes("incorporacion") || tipo.includes("ajuste_positivo")) {
    return "success";
  }
  if (tipo.includes("consumo") || tipo.includes("ajuste_negativo")) {
    return "error";
  }
  return "default";
};

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function BudgetRequests() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();

  // Data states
  const [items, setItems] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);

  // UI states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


  // Tabs
  const [mainTab, setMainTab] = useState(0);

  // Modals
  const [approveDrawer, setApproveDrawer] = useState({ open: false, id: null, comentario: "" });
  const [rejectDrawer, setRejectDrawer] = useState({ open: false, id: null, motivo: "" });
  const [actionLoading, setActionLoading] = useState(false);

  // Auto-clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load BUR requests
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await budget.listar({});
      const data = res.data.requests || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Ledger entries
  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setError("");
    try {
      const res = await budget.getLedger({ limit: 500 });
      setLedgerEntries(res.data.entries || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  // Load on tab change
  useEffect(() => {
    if (mainTab === 1) {
      load();
    } else {
      loadLedger();
    }
  }, [load, loadLedger, mainTab]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (mainTab === 1) {
      await load();
    } else {
      await loadLedger();
    }
    setRefreshing(false);
  }, [load, loadLedger, mainTab]);

  // Filtered BUR items (for sub-tabs)
  const filteredBur = useMemo(() => {
    return items;
  }, [items]);

  // Approve action
  const confirmAprobar = useCallback(async () => {
    if (!approveDrawer.id) return;
    setActionLoading(true);
    setError("");
    try {
      await budget.aprobar(approveDrawer.id, approveDrawer.comentario);
      setSuccess(t("bur_aprobada_msg", "Solicitud de presupuesto aprobada correctamente"));
      await Promise.all([load(), loadLedger()]);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setActionLoading(false);
      setApproveDrawer({ open: false, id: null, comentario: "" });
    }
  }, [approveDrawer.id, approveDrawer.comentario, load, loadLedger, t]);

  // Reject action
  const confirmRechazar = useCallback(async () => {
    if (!rejectDrawer.id) return;
    const motivo = rejectDrawer.motivo.trim();
    if (motivo.length < 5) {
      setError(t("bur_motivo_required", "Debe proporcionar un motivo (minimo 5 caracteres)"));
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await budget.rechazar(rejectDrawer.id, motivo);
      setSuccess(t("bur_rechazada_msg", "Solicitud de presupuesto rechazada"));
      await Promise.all([load(), loadLedger()]);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setActionLoading(false);
      setRejectDrawer({ open: false, id: null, motivo: "" });
    }
  }, [rejectDrawer.id, rejectDrawer.motivo, load, loadLedger, t]);

  // Export columns
  const burExportColumns = useMemo(() => [
    { key: "id", header: "ID", exportValue: (row) => row.id },
    { key: "centro", header: "Centro", exportValue: (row) => row.centro || "" },
    { key: "sector", header: "Sector", exportValue: (row) => row.sector || "" },
    { key: "monto_solicitado_usd", header: "Monto (USD)", exportValue: (row) => row.monto_solicitado_usd || 0 },
    { key: "nivel_aprobacion_requerido", header: "Nivel", exportValue: (row) => nivelLabels[row.nivel_aprobacion_requerido] || row.nivel_aprobacion_requerido },
    { key: "estado", header: "Estado", exportValue: (row) => estadoToBadge[row.estado] || row.estado },
  ], []);

  const ledgerExportColumns = useMemo(() => [
    { key: "id", header: "ID", exportValue: (row) => row.id },
    { key: "created_at", header: "Fecha", exportValue: (row) => row.created_at || "" },
    { key: "tipo_movimiento", header: "Tipo", exportValue: (row) => row.tipo_movimiento || "" },
    { key: "centro", header: "Centro", exportValue: (row) => row.centro || "" },
    { key: "sector", header: "Sector", exportValue: (row) => row.sector || "" },
    { key: "monto_usd", header: "Monto (USD)", exportValue: (row) => (row.monto_cents || 0) / 100 },
    { key: "saldo_usd", header: "Saldo (USD)", exportValue: (row) => (row.saldo_posterior_cents || 0) / 100 },
  ], []);

  const handleExport = useCallback(() => {
    if (mainTab === 0) {
      exportToCSV(ledgerEntries, ledgerExportColumns, "historial_presupuesto");
    } else {
      exportToCSV(filteredBur, burExportColumns, "incorporaciones_presupuesto");
    }
  }, [mainTab, ledgerEntries, filteredBur, ledgerExportColumns, burExportColumns]);

  // AG Grid Column Definitions - Ledger (Historial)
  const ledgerColumnDefs = useMemo(() => [
    {
      field: "created_at",
      headerName: t('common_fecha', 'Fecha'),
      flex: 0.7,
      minWidth: 100,
      cellRenderer: (params) => (
        <Typography variant="body2" color="text.secondary">
          {formatDate(params.value)}
        </Typography>
      ),
    },
    {
      field: "tipo_movimiento",
      headerName: t('common_tipo', 'Tipo'),
      flex: 0.8,
      minWidth: 120,
      cellRenderer: (params) => {
        const tipo = params.value || "";
        return (
          <Chip
            label={tipo.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            size="small"
            color={getTipoColor(tipo)}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        );
      },
    },
    {
      field: "centro",
      headerName: t('common_centro', 'Centro'),
      flex: 0.5,
      minWidth: 80,
      valueGetter: (params) => params.data.centro || "-",
    },
    {
      field: "sector",
      headerName: t('common_sector', 'Sector'),
      flex: 0.5,
      minWidth: 80,
      valueGetter: (params) => params.data.sector || "-",
    },
    {
      field: "monto_cents",
      headerName: t('common_monto', 'Monto'),
      flex: 0.7,
      minWidth: 110,
      cellRenderer: (params) => {
        const montoCents = params.value || 0;
        const monto = montoCents / 100;
        const isNegative = montoCents < 0;
        return (
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: isNegative ? 'error.main' : 'success.main',
              textAlign: 'right',
            }}
          >
            {isNegative ? "" : "+"}{formatCurrency(monto)}
          </Typography>
        );
      },
    },
    {
      field: "saldo_posterior_cents",
      headerName: t('common_saldo', 'Saldo'),
      flex: 0.7,
      minWidth: 110,
      cellRenderer: (params) => (
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', fontWeight: 600, textAlign: 'right' }}
        >
          {formatCurrency((params.value || 0) / 100)}
        </Typography>
      ),
    },
    {
      field: "referencia_id",
      headerName: t('common_referencia', 'Referencia'),
      flex: 0.6,
      minWidth: 100,
      cellRenderer: (params) => {
        if (!params.value) return <Typography color="text.disabled">-</Typography>;
        return (
          <Chip
            label={`${params.data.referencia_tipo} #${params.value}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: 11 }}
          />
        );
      },
    },
    {
      field: "motivo",
      headerName: t('common_motivo', 'Motivo'),
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => params.data.motivo || "-",
    },
  ], [t]);

  // AG Grid Column Definitions - BUR (Incorporaciones)
  const burColumnDefs = useMemo(() => [
    {
      field: "id",
      headerName: t('common_id', 'ID'),
      flex: 0.4,
      minWidth: 60,
      cellRenderer: (params) => (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: 'grey.100',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: "centro",
      headerName: t('common_centro', 'Centro'),
      flex: 0.5,
      minWidth: 80,
      valueGetter: (params) => params.data.centro || "-",
    },
    {
      field: "sector",
      headerName: t('common_sector', 'Sector'),
      flex: 0.5,
      minWidth: 80,
      valueGetter: (params) => params.data.sector || "-",
    },
    {
      field: "monto_solicitado_usd",
      headerName: t('common_monto', 'Monto'),
      flex: 0.7,
      minWidth: 110,
      cellRenderer: (params) => (
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: 'success.main',
            textAlign: 'right',
          }}
        >
          +{formatCurrency(params.value || 0)}
        </Typography>
      ),
    },
    {
      field: "nivel_aprobacion_requerido",
      headerName: t('common_nivel', 'Nivel'),
      flex: 0.5,
      minWidth: 80,
      cellRenderer: (params) => (
        <Chip
          label={nivelLabels[params.value] || params.value}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: 11 }}
        />
      ),
    },
    {
      field: "estado",
      headerName: t('common_estado', 'Estado'),
      flex: 0.6,
      minWidth: 100,
      cellRenderer: (params) => (
        <Chip
          label={estadoToBadge[params.value] || params.value}
          size="small"
          color={getEstadoColor(params.value)}
          sx={{ fontWeight: 600, fontSize: 11 }}
        />
      ),
    },
    {
      field: "created_at",
      headerName: t('common_fecha', 'Fecha'),
      flex: 0.6,
      minWidth: 100,
      cellRenderer: (params) => (
        <Typography variant="body2" color="text.secondary">
          {formatDate(params.value)}
        </Typography>
      ),
    },
    {
      field: "acciones",
      headerName: t('common_acciones', 'Acciones'),
      flex: 0.9,
      minWidth: 180,
      sortable: false,
      filter: false,
      cellRenderer: (params) => {
        const canAct = ["pendiente", "aprobado_l1", "aprobado_l2"].includes(params.data.estado);
        return (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
              onClick={() => navigate(`/presupuestos/${params.data.id}`)}
              sx={{ fontSize: 11, py: 0.5, textTransform: 'none' }}
            >
              {t('common_ver', 'Ver')}
            </Button>
            {canAct && (
              <>
                <IconButton
                  size="small"
                  onClick={() => setApproveDrawer({ open: true, id: params.data.id, comentario: "" })}
                  sx={{ color: 'success.main', '&:hover': { bgcolor: 'success.lighter' } }}
                  title="Aprobar"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setRejectDrawer({ open: true, id: params.data.id, motivo: "" })}
                  sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.lighter' } }}
                  title="Rechazar"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Stack>
        );
      },
    },
  ], [navigate, t]);

  // Get selected BUR for approve drawer
  const selectedBur = useMemo(() => {
    return items.find(b => b.id === approveDrawer.id);
  }, [items, approveDrawer.id]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: 'text.disabled',
              '&:hover': {
                color: 'text.secondary',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
              },
            }}
          >
            <ArrowBackIcon />
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
              {t("bur_title", "Gestión de Presupuestos")}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate("/presupuestos/nueva")}
          sx={{ textTransform: 'none' }}
        >
          {t("bur_crear", "Incorporar Saldo")}
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Main Card with Tabs */}
      <Paper
        variant="outlined"
        sx={{
          overflow: 'hidden',
        }}
      >
        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Tabs
              value={mainTab}
              onChange={(_, v) => setMainTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 48,
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                },
              }}
            >
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {t("bur_main_historial", "Historial")}
                    <Chip
                      label={ledgerEntries.length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        bgcolor: mainTab === 0 ? 'primary.light' : 'grey.200',
                        color: mainTab === 0 ? 'primary.dark' : 'text.secondary',
                      }}
                    />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {t("bur_main_solicitudes", "Incorporaciones")}
                    <Chip
                      label={items.length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        bgcolor: mainTab === 1 ? 'primary.light' : 'grey.200',
                        color: mainTab === 1 ? 'primary.dark' : 'text.secondary',
                      }}
                    />
                  </Box>
                }
              />
            </Tabs>
          </Box>

          {/* Historial Tab Content */}
          {mainTab === 0 && (
            <SPMAgGrid
              rowData={ledgerEntries}
              columnDefs={ledgerColumnDefs}
              loading={ledgerLoading}
              height={600}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              enableQuickFilter={true}
              exportFileName="historial_presupuesto"
              emptyMessage={t("ledger_empty", "No hay movimientos de presupuesto")}
              gridOptions={{
                getRowId: (params) => String(params.data.id),
              }}
            />
          )}

          {/* Incorporaciones Tab Content */}
          {mainTab === 1 && (
            <SPMAgGrid
              rowData={filteredBur}
              columnDefs={burColumnDefs}
              loading={loading}
              height={600}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              enableQuickFilter={true}
              exportFileName="incorporaciones_presupuesto"
              emptyMessage={t("bur_empty", "No hay solicitudes de presupuesto")}
              gridOptions={{
                getRowId: (params) => String(params.data.id),
              }}
            />
          )}
        </Paper>

        {/* Approve Drawer */}
        <Drawer
          anchor="right"
          open={approveDrawer.open}
          onClose={() => setApproveDrawer({ open: false, id: null, comentario: "" })}
          PaperProps={{
            sx: { width: 420, maxWidth: '100%' },
          }}
        >
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('bur_aprobar_incorporacion', 'Aprobar Incorporación')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Solicitud #{approveDrawer.id}
            </Typography>
          </Box>

          {selectedBur && (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Impact Preview */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  bgcolor: 'grey.50',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                  {t('bur_resumen_operacion', 'Resumen de la operación')}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 2 }}>
                  <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', fontSize: 10 }}>Centro</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedBur.centro}</Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', fontSize: 10 }}>Sector</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedBur.sector}</Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', fontSize: 10 }}>{t('bur_monto_incorporar', 'Monto a incorporar')}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>+{formatCurrency(selectedBur.monto_solicitado_usd || 0)}</Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', fontSize: 10 }}>{t('bur_saldo_actual', 'Saldo actual')}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(selectedBur.saldo_actual_usd || 0)}</Typography>
                  </Paper>
                </Box>
                <Box
                  sx={{
                    mt: 2,
                    pt: 2,
                    mx: -2.5,
                    mb: -2.5,
                    px: 2.5,
                    py: 2,
                    borderTop: 1,
                    borderColor: 'divider',
                    bgcolor: 'success.50',
                    borderRadius: '0 0 8px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('bur_nuevo_saldo', 'Nuevo saldo estimado:')}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatCurrency((selectedBur.saldo_actual_usd || 0) + (selectedBur.monto_solicitado_usd || 0))}
                  </Typography>
                </Box>
              </Paper>

              {/* Comment Field */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 1, display: 'block' }}>
                  {t('bur_comentario_opcional', 'Comentario (opcional)')}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={3}
                  value={approveDrawer.comentario}
                  onChange={(e) => setApproveDrawer(prev => ({ ...prev, comentario: e.target.value }))}
                  placeholder="Anadir un comentario opcional..."
                />
              </Box>

              {/* Actions */}
              <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setApproveDrawer({ open: false, id: null, comentario: "" })}
                >
                  {t('common_cancelar', 'Cancelar')}
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  onClick={confirmAprobar}
                  disabled={actionLoading}
                  startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {actionLoading ? "Procesando..." : t('bur_confirmar_aprobacion', 'Confirmar Aprobación')}
                </Button>
              </Stack>
            </Box>
          )}
        </Drawer>

        {/* Reject Drawer */}
        <Drawer
          anchor="right"
          open={rejectDrawer.open}
          onClose={() => setRejectDrawer({ open: false, id: null, motivo: "" })}
          PaperProps={{
            sx: { width: 420, maxWidth: '100%' },
          }}
        >
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('bur_rechazar_incorporacion', 'Rechazar Incorporación')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Solicitud #{rejectDrawer.id}
            </Typography>
          </Box>

          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Warning */}
            <Alert
              severity="error"
              icon={<WarningAmberIcon />}
              sx={{ '& .MuiAlert-message': { flex: 1 } }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('bur_accion_irreversible', 'Acción irreversible')}</Typography>
              <Typography variant="body2">Una vez rechazada, la solicitud no podra ser aprobada posteriormente.</Typography>
            </Alert>

            {/* Reason Field */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 1, display: 'block' }}>
                {t('bur_motivo_rechazo', 'Motivo de rechazo')} <Typography component="span" color="error.main">*</Typography>
              </Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={4}
                value={rejectDrawer.motivo}
                onChange={(e) => setRejectDrawer(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Explica el motivo del rechazo..."
                error={rejectDrawer.motivo.length > 0 && rejectDrawer.motivo.length < 5}
                helperText={
                  rejectDrawer.motivo.length > 0 && rejectDrawer.motivo.length < 5
                    ? t('bur_minimo_caracteres', 'Mínimo 5 caracteres requeridos')
                    : "El solicitante sera notificado con este motivo"
                }
              />
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'right',
                  mt: 0.5,
                  color: rejectDrawer.motivo.length < 5 ? 'error.main' : 'text.secondary',
                }}
              >
                {rejectDrawer.motivo.length}/5 min.
              </Typography>
            </Box>

            {/* Actions */}
            <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setRejectDrawer({ open: false, id: null, motivo: "" })}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={confirmRechazar}
                disabled={actionLoading || rejectDrawer.motivo.trim().length < 5}
                startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {actionLoading ? "Procesando..." : t('bur_confirmar_rechazo', 'Confirmar Rechazo')}
              </Button>
            </Stack>
          </Box>
      </Drawer>
      </Box>
    </Box>
  );
}
