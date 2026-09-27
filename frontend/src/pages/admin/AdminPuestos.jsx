import { useEffect, useState, useMemo, useCallback } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Drawer,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";
import PageLayout from "../../components/ui/PageLayout";
import { NewButton, ActiveStatus, RowActions, actionsColumn } from "../../components/admin/AdminCrudParts";

// ============================================================================
// CONSTANTES
// ============================================================================
const PUESTOS_OPTIONS = [
  { value: "Planificador", label: "Planificador" },
  { value: "Jefe", label: "Jefe" },
  { value: "Gerente1", label: "Gerente nivel 1" },
  { value: "Gerente2", label: "Gerente nivel 2" },
  { value: "Director", label: "Director" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Analista", label: "Analista" },
  { value: "Coordinador", label: "Coordinador" },
];

const DRAWER_WIDTH = 400;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const initialForm = { nombre: "", activo: 1 };

export default function AdminPuestos() {
  const { t } = useI18n();

  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadPuestos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("puestos");
      setPuestos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPuestos();
  }, [loadPuestos]);

  const handleEdit = useCallback((puesto) => {
    setEditingId(puesto.nombre);
    setForm({ nombre: puesto.nombre || "", activo: puesto.activo ?? 1 });
    setDrawerOpen(true);
    setError("");
  }, []);

  const handleNew = useCallback(() => {
    setEditingId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      if (!form.nombre) {
        setError(t("admin_required_fields", "Faltan campos obligatorios"));
        return;
      }
      setSubmitting(true);
      try {
        if (editingId) {
          await admin.update("puestos", editingId, form);
          setSuccess(t("crud_record_updated", "Puesto actualizado correctamente"));
        } else {
          await admin.create("puestos", form);
          setSuccess(t("crud_record_created", "Puesto creado correctamente"));
        }
        setDrawerOpen(false);
        setForm(initialForm);
        setEditingId(null);
        await loadPuestos();
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingId, loadPuestos, t]
  );

  const handleDelete = useCallback(
    async (nombre) => {
      setSubmitting(true);
      try {
        await admin.remove("puestos", nombre);
        setSuccess(t("crud_record_deleted", "Puesto eliminado correctamente"));
        setDeletingId(null);
        await loadPuestos();
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [loadPuestos, t]
  );


  const columnDefs = useMemo(
    () => [
      {
        field: "nombre",
        headerName: t("common_nombre", "Nombre"),
        flex: 1,
        minWidth: 200,
        valueFormatter: (params) => params.value || "—",
      },
      {
        field: "activo",
        headerName: t("common_estado", "Estado"),
        flex: 0.4,
        minWidth: 120,
        valueFormatter: (params) =>
          params.value === 1 || params.value === true
            ? t("common_activo", "Activo")
            : t("common_inactivo", "Inactivo"),
        cellRenderer: (params) => <ActiveStatus activo={params.value} />,
      },
      actionsColumn(t("common_acciones", "Acciones"), (params) => (
        <RowActions
          onEdit={() => handleEdit(params.data)}
          onDelete={() => setDeletingId(params.data.nombre)}
        />
      )),
    ],
    [t, handleEdit]
  );

  return (
    <PageLayout
      title={t("admin_puestos", "Puestos")}
      subtitle={t("admin_puestos_subtitle", "Gestión de puestos del sistema")}
      backTo="/admin"
      actions={<NewButton onClick={handleNew} />}
    >
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
          {t("admin_puestos_confirm_delete", "¿Eliminar el puesto")} <strong>{deletingId}</strong>?
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <SPMAgGrid
            searchable
          rowData={puestos}
          columnDefs={columnDefs}
          loading={loading}
          height={500}
          enableQuickFilter={true}
          getRowId={(params) => String(params.data.nombre)}
          exportFileName="puestos"
          emptyMessage={t("admin_puestos_empty", "No hay puestos registrados")}
        />
      </Paper>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: DRAWER_WIDTH },
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {editingId ? t("admin_puestos_editar", "Editar puesto") : t("admin_puestos_nuevo", "Nuevo puesto")}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                {t("admin_puesto_label", "Puesto")}: {editingId}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} size="small">
            <CloseIcon sx={{ width: 20, height: 20 }} />
          </IconButton>
        </Box>

        {/* Drawer Content */}
        <Box
          component="form"
          id="puesto-form"
          onSubmit={handleSubmit}
          sx={{ p: 3, flexGrow: 1, overflowY: "auto" }}
        >
          {error && (
            <Alert severity="error" onClose={() => setError("")} sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ display: "block", mb: 2 }}
          >
            {t('admin_datos_puesto', 'Datos del puesto')}
          </Typography>

          <Stack spacing={3}>
            <FormControl fullWidth size="small" required disabled={!!editingId}>
              <InputLabel id="nombre-label">{t('admin_nombre_puesto', 'Nombre del puesto')}</InputLabel>
              <Select
                labelId="nombre-label"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                label={t('admin_nombre_puesto', 'Nombre del puesto')}
              >
                <MenuItem value="">
                  <em>{t("admin_puesto_seleccionar", "Selecciona un puesto...")}</em>
                </MenuItem>
                {PUESTOS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.activo === 1 || form.activo === true}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, activo: e.target.checked ? 1 : 0 }))
                  }
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.primary">
                  {t('admin_puesto_activo', 'Puesto activo')}
                </Typography>
              }
            />
          </Stack>
        </Box>

        {/* Drawer Footer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 1.5,
          }}
        >
          <Button
            onClick={() => setDrawerOpen(false)}
            disabled={submitting}
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 500,
              color: "text.secondary",
              borderColor: "divider",
            }}
          >
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            form="puesto-form"
            disabled={submitting}
            variant="contained"
            startIcon={
              submitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {submitting ? t('common_guardando', 'Guardando...') : t('common_guardar', 'Guardar')}
          </Button>
        </Box>
      </Drawer>
    </PageLayout>
  );
}
