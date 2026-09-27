import { useState, useEffect, useCallback, useMemo } from "react";
import { admin } from "../../services/spm";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useI18n } from "../../context/i18n";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";
import PageLayout from "../../components/ui/PageLayout";
import { NewButton, RowActions, actionsColumn } from "../../components/admin/AdminCrudParts";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  Stack,
  Drawer,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";

// MUI Icons
import CloseIcon from "@mui/icons-material/Close";

const initialForm = {
  centro: "",
  sector: "",
  monto_usd: "",
  saldo_usd: "",
};

const TIPO_CAMBIO_LABELS = {
  creacion: ["admin_tipo_creacion", "Creación"],
  aumento: ["admin_tipo_aumento", "Aumento"],
  reduccion: ["admin_tipo_reduccion", "Reducción"],
  ajuste: ["admin_tipo_ajuste", "Ajuste"],
  eliminacion: ["admin_tipo_eliminacion", "Eliminación"],
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

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminPresupuestos() {
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
      // El backend puede envolver en { items: [...] }; normalizar a array
      const rawData = res.data?.items || res.data;
      const data = (Array.isArray(rawData) ? rawData : []).map((r, idx) => ({
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

  // ─── Handlers ─────────────────────────────────────────────
  const handleNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
  };

  const handleEdit = useCallback((row) => {
    setEditingId(row._id);
    setForm({
      centro: row.centro || "",
      sector: row.sector || "",
      monto_usd: row.monto_usd || "",
      saldo_usd: row.saldo_usd || "",
    });
    setDrawerOpen(true);
    setError("");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.centro || !form.sector) {
      setError(t('admin_centro_sector_required', 'Centro y sector son obligatorios'));
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

  const presupuestosColumns = useMemo(
    () => [
      {
        field: "centro",
        headerName: t("admin_centro", "Centro"),
        flex: 0.5,
        minWidth: 110,
      },
      {
        field: "sector",
        headerName: t("admin_sector", "Sector"),
        flex: 1,
        minWidth: 160,
      },
      {
        field: "monto_usd",
        headerName: t("admin_monto_usd", "Monto USD"),
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        flex: 0.8,
        minWidth: 140,
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        field: "saldo_usd",
        headerName: t("admin_saldo_usd", "Saldo USD"),
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        flex: 0.8,
        minWidth: 140,
        valueFormatter: (params) => formatCurrency(params.value),
        cellRenderer: (params) => (
          <Box
            component="span"
            sx={{ fontWeight: 600, color: getSaldoColor(params.data?.saldo_usd, params.data?.monto_usd) }}
          >
            {formatCurrency(params.value)}
          </Box>
        ),
      },
      actionsColumn(t("common_acciones", "Acciones"), (params) => (
        <RowActions
          onEdit={() => handleEdit(params.data)}
          onDelete={() => setDeletingId(params.data._id)}
        />
      )),
    ],
    [t, handleEdit]
  );

  const tipoLabel = useCallback(
    (tipo) => {
      const entry = TIPO_CAMBIO_LABELS[tipo];
      return entry ? t(entry[0], entry[1]) : tipo || "—";
    },
    [t]
  );

  const historialColumns = useMemo(
    () => [
      {
        field: "tipo_cambio",
        headerName: t("admin_tipo", "Tipo"),
        flex: 0.6,
        minWidth: 120,
        valueFormatter: (params) => tipoLabel(params.value),
        cellRenderer: (params) => (
          <Chip
            label={tipoLabel(params.value)}
            color={getTipoChipColor(params.value)}
            size="small"
            sx={{ fontSize: "0.75rem", fontWeight: 600, height: 22 }}
          />
        ),
      },
      {
        field: "centro",
        headerName: t("admin_centro", "Centro"),
        flex: 0.5,
        minWidth: 100,
      },
      {
        field: "sector",
        headerName: t("admin_sector", "Sector"),
        flex: 0.8,
        minWidth: 140,
      },
      {
        field: "diferencia_usd",
        headerName: t("admin_cambio", "Cambio"),
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        flex: 0.7,
        minWidth: 130,
        valueFormatter: (params) =>
          `${params.value > 0 ? "+" : ""}${formatCurrency(params.value || 0)}`,
        cellStyle: (params) => ({
          fontWeight: 600,
          color:
            params.value > 0
              ? "var(--success)"
              : params.value < 0
              ? "var(--danger)"
              : "var(--fg-muted)",
        }),
      },
      {
        field: "monto_nuevo_usd",
        headerName: t("admin_monto_final", "Monto final"),
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        flex: 0.7,
        minWidth: 130,
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        field: "solicitante_nombre",
        headerName: t("admin_usuario", "Usuario"),
        flex: 0.8,
        minWidth: 140,
        valueFormatter: (params) => params.value || "—",
      },
      {
        field: "created_at",
        headerName: t("admin_fecha", "Fecha"),
        flex: 0.6,
        minWidth: 120,
        valueFormatter: (params) => formatDate(params.value),
      },
    ],
    [t, tipoLabel]
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <PageLayout
      title={t("admin_presupuestos", "Presupuestos")}
      backTo="/admin"
      actions={tab === 0 ? <NewButton onClick={handleNew} /> : null}
    >
      {/* Alerts */}
      {error && !drawerOpen && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {deletingId && (
        <Alert
          severity="warning"
          action={
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => setDeletingId(null)}
                disabled={submitting}
                sx={{ textTransform: "none" }}
              >
                {t("common_cancelar", "Cancelar")}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => handleDelete(deletingId)}
                disabled={submitting}
                sx={{ textTransform: "none" }}
              >
                {submitting ? "..." : t("common_eliminar", "Eliminar")}
              </Button>
            </Stack>
          }
        >
          {t("admin_presupuestos_confirm_delete", "¿Eliminar el presupuesto")}{" "}
          <strong>{deletingId.split("|")[0]}</strong> - <strong>{deletingId.split("|")[1]}</strong>?
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, newValue) => setTab(newValue)}
          sx={{
            px: 1,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 44 },
          }}
        >
          <Tab label={t("admin_presupuestos_tab", "Presupuestos")} />
          <Tab label={t("admin_historial_tab", "Historial de cambios")} />
        </Tabs>

        {tab === 0 && (
          <SPMAgGrid
            searchable
            rowData={presupuestos}
            columnDefs={presupuestosColumns}
            loading={loadingPresupuestos}
            height={600}
            getRowId={(params) => String(params.data._id)}
            exportFileName="presupuestos"
            emptyMessage={t("admin_no_presupuestos", "No hay presupuestos registrados")}
          />
        )}

        {tab === 1 && (
          <SPMAgGrid
            searchable
            rowData={historial}
            columnDefs={historialColumns}
            loading={loadingHistorial}
            height={600}
            getRowId={(params) => String(params.data._id)}
            exportFileName="historial_presupuestos"
            emptyMessage={t("admin_no_historial", "No hay historial de cambios")}
          />
        )}
      </Paper>

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
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
            {editingId
              ? t("admin_presupuestos_editar", "Editar presupuesto")
              : t("admin_presupuestos_nuevo", "Nuevo presupuesto")}
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
                sx={{ textTransform: "none" }}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{ textTransform: "none" }}
              >
                {submitting ? t('common_guardando', 'Guardando...') : editingId ? t('common_actualizar', 'Actualizar') : t('common_crear', 'Crear')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </PageLayout>
  );
}
