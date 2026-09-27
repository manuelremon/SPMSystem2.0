import { useEffect, useState, useMemo, useCallback } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";
import PageLayout from "../../components/ui/PageLayout";
import { NewButton, ActiveStatus, RowActions, actionsColumn } from "../../components/admin/AdminCrudParts";

// MUI Components
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

// MUI Icons
import CloseIcon from "@mui/icons-material/Close";

// ============================================================================
// CONSTANTES
// ============================================================================
const SECTORES_OPTIONS = [
  { value: "Almacenes", label: "Almacenes" },
  { value: "Compras", label: "Compras" },
  { value: "Mantenimiento", label: "Mantenimiento" },
  { value: "Planificación", label: "Planificación" },
  { value: "Operaciones", label: "Operaciones" },
  { value: "Logística", label: "Logística" },
  { value: "Producción", label: "Producción" },
  { value: "Calidad", label: "Calidad" },
];

const DRAWER_WIDTH = 400;
const getSectorRowId = (params) => String(params.data.nombre);

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const initialForm = {
  nombre: "",
  activo: 1,
};

export default function AdminSectores() {
  const { t } = useI18n();

  // Estado de datos
  const [sectores, setSectores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Drawer y formulario
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Eliminación inline
  const [deletingId, setDeletingId] = useState(null);

  // Cargar datos
  const loadSectores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("sectores");
      const data = Array.isArray(res.data) ? res.data : [];
      setSectores(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSectores();
  }, [loadSectores]);

  // Handlers
  const handleEdit = useCallback((sector) => {
    setEditingId(sector.nombre);
    setForm({
      nombre: sector.nombre || "",
      activo: sector.activo ?? 1,
    });
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
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");

    if (!form.nombre) {
      setError(t("admin_required_fields", "Faltan campos obligatorios"));
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await admin.update("sectores", editingId, form);
        setSuccess(t("crud_record_updated", "Sector actualizado correctamente"));
      } else {
        await admin.create("sectores", form);
        setSuccess(t("crud_record_created", "Sector creado correctamente"));
      }

      setDrawerOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadSectores();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, editingId, loadSectores, t]);

  const handleDelete = useCallback(async (nombre) => {
    setSubmitting(true);
    try {
      await admin.remove("sectores", nombre);
      setSuccess(t("crud_record_deleted", "Sector eliminado correctamente"));
      setDeletingId(null);
      await loadSectores();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [loadSectores, t]);

  // Columnas AG Grid
  const columnDefs = useMemo(
    () => [
      {
        field: "nombre",
        headerName: t("common_nombre", "Nombre"),
        flex: 1,
        minWidth: 200,
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PageLayout
      title={t("admin_sectores", "Sectores")}
      subtitle={t("admin_sectores_subtitle", "Gestión de sectores del sistema")}
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
          {t("admin_sectores_confirm_delete", "¿Eliminar el sector")} <strong>{deletingId}</strong>?
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <SPMAgGrid
            searchable
          rowData={sectores}
          columnDefs={columnDefs}
          loading={loading}
          height={500}
          enableQuickFilter={true}
          exportFileName="sectores"
          getRowId={getSectorRowId}
          emptyMessage={t("admin_sectores_empty", "No hay sectores registrados")}
        />
      </Paper>

      {/* Drawer de edición/creación */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: "100%", maxWidth: DRAWER_WIDTH },
        }}
      >
        {/* Header del Drawer */}
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
              {editingId ? t("admin_sectores_editar", "Editar sector") : t("admin_sectores_nuevo", "Nuevo sector")}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                {editingId}
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(false)}
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Contenido del Drawer */}
        <Box
          component="form"
          id="sector-form"
          onSubmit={handleSubmit}
          sx={{ p: 3, flex: 1, overflowY: "auto" }}
        >
          {error && (
            <Alert severity="error" onClose={() => setError("")} sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Datos del sector */}
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ display: "block", mb: 2, fontWeight: 600 }}
            >
              {t('admin_datos_sector', 'Datos del sector')}
            </Typography>
            <Stack spacing={3}>
              <FormControl size="small" fullWidth required disabled={!!editingId}>
                <InputLabel id="nombre-label">{t('common_nombre', 'Nombre')}</InputLabel>
                <Select
                  labelId="nombre-label"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  label={t('common_nombre', 'Nombre')}
                >
                  <MenuItem value="">
                    <em>{t("admin_sectores_select_ph", "Selecciona un sector...")}</em>
                  </MenuItem>
                  {SECTORES_OPTIONS.map((opt) => (
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
                    {t('admin_sector_activo', 'Sector activo')}
                  </Typography>
                }
              />
            </Stack>
          </Box>
        </Box>

        {/* Footer del Drawer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "flex-end",
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            onClick={() => setDrawerOpen(false)}
            disabled={submitting}
            sx={{ textTransform: "none" }}
          >
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            form="sector-form"
            variant="contained"
            disabled={submitting}
            startIcon={
              submitting ? <CircularProgress size={16} color="inherit" /> : null
            }
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {submitting ? t('common_guardando', 'Guardando...') : t('common_guardar', 'Guardar')}
          </Button>
        </Box>
      </Drawer>
    </PageLayout>
  );
}
