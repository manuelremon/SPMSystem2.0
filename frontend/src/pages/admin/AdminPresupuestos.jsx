import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { admin } from "../../services/spm";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useI18n } from "../../context/i18n";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  Skeleton,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
  Tabs,
  Tab,
  Chip,
  Divider,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

const initialForm = {
  centro: "",
  sector: "",
  monto_usd: "",
  saldo_usd: "",
};

/* ─────────────────────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────────────────────── */
function TableSkeleton({ rows = 5 }) {
  return (
    <Box sx={{ p: 2 }}>
      {[...Array(rows)].map((_, i) => (
        <Stack
          key={i}
          direction="row"
          spacing={2}
          sx={{
            py: 1.5,
            px: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="text" width={80} height={24} />
          <Skeleton variant="text" sx={{ flex: 1 }} height={24} />
          <Skeleton variant="text" width={96} height={24} />
          <Skeleton variant="text" width={96} height={24} />
          <Skeleton variant="text" width={80} height={24} />
        </Stack>
      ))}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Empty State
───────────────────────────────────────────────────────────── */
function EmptyState({ message, onAction, actionLabel }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        color: "text.secondary",
      }}
    >
      <AccountBalanceWalletIcon sx={{ fontSize: 48, mb: 1.5, opacity: 0.5 }} />
      <Typography variant="body2" sx={{ mb: 2 }}>
        {message}
      </Typography>
      {onAction && (
        <Button
          onClick={onAction}
          size="small"
          sx={{
            textTransform: "uppercase",
            fontSize: "0.75rem",
            letterSpacing: "0.05em",
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminPresupuestos() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [tab, setTab] = useState(0);
  const [presupuestos, setPresupuestos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ─── Load Data ────────────────────────────────────────────
  const loadPresupuestos = useCallback(async () => {
    setLoadingPresupuestos(true);
    try {
      const res = await admin.list("presupuestos");
      const rawData = res.data?.data || res.data || [];
      const data = (Array.isArray(rawData) ? rawData : []).map((r) => ({
        ...r,
        _id: `${r.centro}|${r.sector}`,
      }));
      setPresupuestos(data);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === "object" ? err.message || JSON.stringify(err) : err || e.message);
    } finally {
      setLoadingPresupuestos(false);
    }
  }, []);

  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const res = await admin.historialPresupuestos({ limit: 100 });
      const data = (res.data || []).map((r, idx) => ({
        ...r,
        _id: r.id || idx,
      }));
      setHistorial(data);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === "object" ? err.message || JSON.stringify(err) : err || e.message);
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  useEffect(() => {
    loadPresupuestos();
    loadHistorial();
  }, [loadPresupuestos, loadHistorial]);

  // ─── Filtered Data ────────────────────────────────────────
  const filteredPresupuestos = presupuestos.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.centro?.toLowerCase().includes(term) ||
      r.sector?.toLowerCase().includes(term)
    );
  });

  const filteredHistorial = historial.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.centro?.toLowerCase().includes(term) ||
      r.sector?.toLowerCase().includes(term) ||
      r.tipo_cambio?.toLowerCase().includes(term)
    );
  });

  // ─── Handlers ─────────────────────────────────────────────
  const handleNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    setForm({
      centro: row.centro || "",
      sector: row.sector || "",
      monto_usd: row.monto_usd || "",
      saldo_usd: row.saldo_usd || "",
    });
    setDrawerOpen(true);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.centro || !form.sector) {
      setError(t('admin_centro_sector_required', 'Centro y Sector son requeridos'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        centro: form.centro,
        sector: form.sector,
        monto_usd: Number(form.monto_usd || 0),
        saldo_usd: Number(form.saldo_usd || form.monto_usd || 0),
      };

      if (editingId) {
        const [centro, sector] = editingId.split("|");
        await admin.updatePresupuesto(centro, sector, payload);
        setSuccess(t("crud_record_updated", "Presupuesto actualizado correctamente"));
      } else {
        await admin.create("presupuestos", payload);
        setSuccess(t("crud_record_created", "Presupuesto creado correctamente"));
      }

      setDrawerOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadPresupuestos();
      await loadHistorial();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === "object" ? err.message || JSON.stringify(err) : err || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setSubmitting(true);
    try {
      
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredPresupuestos,
        "presupuestos",
        "Presupuestos"
      );
      setSuccess("Presupuestos exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar presupuestos");
    } finally {
      setExporting(false);
    }
  };

const [centro, sector] = id.split("|");
      await admin.deletePresupuesto(centro, sector);
      setSuccess(t("crud_record_deleted", "Presupuesto eliminado correctamente"));
      setDeletingId(null);
      await loadPresupuestos();
      await loadHistorial();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === "object" ? err.message || JSON.stringify(err) : err || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSaldoColor = (saldo, monto) => {
    const porcentaje = monto > 0 ? (saldo / monto) * 100 : 0;
    if (porcentaje < 20) return "error.dark";
    if (porcentaje < 50) return "warning.dark";
    return "success.dark";
  };

  const getTipoChipColor = (tipo) => {
    const colors = {
      creacion: "info",
      aumento: "success",
      reduccion: "warning",
      ajuste: "default",
      eliminacion: "error",
    };
    return colors[tipo] || "default";
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>

        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton
              onClick={() => navigate("/admin")}
              size="small"
              sx={{
                color: "text.secondary",
                "&:hover": { bgcolor: "grey.200" },
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "text.primary",
              }}
            >
              {t("admin_presupuestos", "Presupuestos")}
            </Typography>
          </Stack>
          {tab === 0 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleNew}
              sx={{
                textTransform: "uppercase",
                fontSize: "0.75rem",
                letterSpacing: "0.05em",
              }}
            >
              {t("crud_new", "Nuevo")}
            </Button>
          )}
        </Stack>

        {/* Alerts */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <IconButton
                size="small"
                color="inherit"
                onClick={() => setError("")}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            action={
              <IconButton
                size="small"
                color="inherit"
                onClick={() => setSuccess("")}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {success}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, newValue) => setTab(newValue)}
          sx={{
            mb: 2,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              textTransform: "uppercase",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              minHeight: 40,
            },
          }}
        >
          <Tab label={t('admin_presupuestos_tab', 'Presupuestos')} />
          <Tab label={t('admin_historial_tab', 'Historial de Cambios')} />
        </Tabs>

        {/* Search */}
        <Box sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder={t('admin_presupuestos_search_placeholder', 'Buscar por centro o sector...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            sx={{ width: 320 }}
          />
        </Box>

        {/* Tab 0: Presupuestos */}
        {tab === 0 && (
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {loadingPresupuestos ? (
              <TableSkeleton rows={5} />
            ) : filteredPresupuestos.length === 0 ? (
              <EmptyState
                message={searchTerm ? t('admin_no_results', 'No se encontraron presupuestos') : t('admin_no_presupuestos', 'No hay presupuestos registrados')}
                onAction={!searchTerm ? handleNew : undefined}
                actionLabel={t('admin_crear_primer_presupuesto', 'Crear primer presupuesto')}
              />
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell
                        align="center"
                        sx={{
                          width: 100,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_centro', 'Centro')}
                      </TableCell>
                      <TableCell
                        sx={{
                          width: 180,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_sector', 'Sector')}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          width: 140,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_monto_usd', 'Monto USD')}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          width: 140,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_saldo_usd', 'Saldo USD')}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          width: 100,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                        }}
                      >
                        {t('common_acciones', 'Acciones')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPresupuestos.map((row) =>
                      deletingId === row._id ? (
                        <TableRow key={row._id} sx={{ bgcolor: "error.lighter" }}>
                          <TableCell colSpan={5} sx={{ py: 1.5 }}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography variant="body2" sx={{ color: "error.dark" }}>
                                Eliminar presupuesto <strong>{row.centro}</strong> - <strong>{row.sector}</strong>?
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => setDeletingId(null)}
                                  disabled={submitting}
                                  sx={{
                                    textTransform: "uppercase",
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  {t('common_cancelar', 'Cancelar')}
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  onClick={() => handleDelete(row._id)}
                                  disabled={submitting}
                                  sx={{
                                    textTransform: "uppercase",
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  {submitting ? "..." : t('common_eliminar', 'Eliminar')}
                                </Button>
                              </Stack>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow
                          key={row._id}
                          hover
                          sx={{ "&:hover": { bgcolor: "grey.50" } }}
                        >
                          <TableCell
                            align="center"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                              color: "text.primary",
                              borderRight: 1,
                              borderColor: "grey.100",
                            }}
                          >
                            {row.centro}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontSize: "0.875rem",
                              color: "text.primary",
                              borderRight: 1,
                              borderColor: "grey.100",
                            }}
                          >
                            {row.sector}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                              color: "text.primary",
                              borderRight: 1,
                              borderColor: "grey.100",
                            }}
                          >
                            {formatCurrency(row.monto_usd)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: getSaldoColor(row.saldo_usd, row.monto_usd),
                              borderRight: 1,
                              borderColor: "grey.100",
                            }}
                          >
                            {formatCurrency(row.saldo_usd)}
                          </TableCell>
                          <TableCell align="center">
                            <Stack
                              direction="row"
                              spacing={0.5}
                              justifyContent="center"
                            >
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => handleEdit(row)}
                                sx={{
                                  textTransform: "none",
                                  fontWeight: 600,
                                  color: "primary.main",
                                  fontSize: "0.75rem",
                                  minWidth: "auto",
                                  px: 1,
                                  "&:hover": {
                                    bgcolor: "primary.lighter",
                                  },
                                }}
                              >
                                {t('common_editar', 'Editar')}
                              </Button>
                              <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => setDeletingId(row._id)}
                                sx={{
                                  textTransform: "none",
                                  fontWeight: 600,
                                  color: "error.main",
                                  fontSize: "0.75rem",
                                  minWidth: "auto",
                                  px: 1,
                                  "&:hover": {
                                    bgcolor: "error.lighter",
                                  },
                                }}
                              >
                                {t('common_eliminar', 'Eliminar')}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
        )}

        {/* Tab 1: Historial */}
        {tab === 1 && (
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {loadingHistorial ? (
              <TableSkeleton rows={5} />
            ) : filteredHistorial.length === 0 ? (
              <EmptyState message={t('admin_no_historial', 'No hay historial de cambios')} />
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell
                        align="center"
                        sx={{
                          width: 100,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_tipo', 'Tipo')}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          width: 80,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_centro', 'Centro')}
                      </TableCell>
                      <TableCell
                        sx={{
                          width: 150,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_sector', 'Sector')}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          width: 120,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_cambio', 'Cambio')}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          width: 120,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_monto_final', 'Monto Final')}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        {t('admin_usuario', 'Usuario')}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          width: 140,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "text.secondary",
                        }}
                      >
                        {t('admin_fecha', 'Fecha')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredHistorial.map((row) => (
                      <TableRow
                        key={row._id}
                        hover
                        sx={{ "&:hover": { bgcolor: "grey.50" } }}
                      >
                        <TableCell
                          align="center"
                          sx={{
                            borderRight: 1,
                            borderColor: "grey.100",
                          }}
                        >
                          <Chip
                            label={row.tipo_cambio || "-"}
                            color={getTipoChipColor(row.tipo_cambio)}
                            size="small"
                            sx={{
                              fontSize: "0.625rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              height: 20,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                            color: "text.primary",
                            borderRight: 1,
                            borderColor: "grey.100",
                          }}
                        >
                          {row.centro}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: "0.875rem",
                            color: "text.primary",
                            borderRight: 1,
                            borderColor: "grey.100",
                          }}
                        >
                          {row.sector}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color:
                              row.diferencia_usd > 0
                                ? "success.dark"
                                : row.diferencia_usd < 0
                                ? "error.dark"
                                : "text.secondary",
                            borderRight: 1,
                            borderColor: "grey.100",
                          }}
                        >
                          {row.diferencia_usd > 0 ? "+" : ""}
                          {formatCurrency(row.diferencia_usd || 0)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                            color: "text.primary",
                            borderRight: 1,
                            borderColor: "grey.100",
                          }}
                        >
                          {formatCurrency(row.monto_nuevo_usd)}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: "0.875rem",
                            color: "text.primary",
                            borderRight: 1,
                            borderColor: "grey.100",
                          }}
                        >
                          {row.solicitante_nombre || "-"}
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            fontSize: "0.75rem",
                            color: "text.secondary",
                          }}
                        >
                          {formatDate(row.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
        )}

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 2, color: "text.disabled" }}
        >
          {tab === 0
            ? `${filteredPresupuestos.length} de ${presupuestos.length} presupuestos`
            : `${filteredHistorial.length} de ${historial.length} registros`}
        </Typography>
      </Box>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: "100%",
            maxWidth: 400,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "grey.50",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              color: "text.primary",
            }}
          >
            {editingId ? `${t('common_editar', 'Editar')} Presupuesto` : `${t('common_nuevo', 'Nuevo')} Presupuesto`}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(false)}
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ flex: 1, overflowY: "auto", p: 2.5 }}
        >
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" sx={{ fontSize: "0.875rem" }}>
                {error}
              </Alert>
            )}

            <TextField
              label={t('admin_centro', 'Centro')}
              name="centro"
              size="small"
              value={form.centro}
              onChange={(e) => setForm((prev) => ({ ...prev, centro: e.target.value }))}
              required
              disabled={!!editingId}
              fullWidth
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
            />

            <TextField
              label={t('admin_sector', 'Sector')}
              name="sector"
              size="small"
              value={form.sector}
              onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}
              required
              disabled={!!editingId}
              fullWidth
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
            />

            <TextField
              label={t('admin_monto_usd', 'Monto USD')}
              name="monto_usd"
              type="number"
              size="small"
              value={form.monto_usd}
              onChange={(e) => setForm((prev) => ({ ...prev, monto_usd: e.target.value }))}
              required
              fullWidth
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
            />

            <TextField
              label={t('admin_saldo_usd', 'Saldo USD')}
              name="saldo_usd"
              type="number"
              size="small"
              value={form.saldo_usd}
              onChange={(e) => setForm((prev) => ({ ...prev, saldo_usd: e.target.value }))}
              required
              fullWidth
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
            />

            <Stack
              direction="row"
              spacing={1.5}
              sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}
            >
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setDrawerOpen(false)}
                disabled={submitting}
                sx={{
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                }}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                }}
              >
                {submitting ? t('common_guardando', 'Guardando...') : editingId ? t('common_actualizar', 'Actualizar') : t('common_crear', 'Crear')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
