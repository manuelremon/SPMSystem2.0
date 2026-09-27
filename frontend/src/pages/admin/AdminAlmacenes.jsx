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
  TextField,
  Button,
  IconButton,
  FormControlLabel,
  Checkbox,
  Alert,
  Stack,
  Drawer,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import CloseIcon from "@mui/icons-material/Close";

const getAlmacenRowId = (params) => String(params.data.codigo);

// ============================================================================
// COMPONENTES UI
// ============================================================================

function FormInput({ label, name, value, onChange, required = false, disabled = false, placeholder = "" }) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

function FormCheckbox({ label, checked, onChange }) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={onChange}
          size="small"
          sx={{ color: 'primary.main' }}
        />
      }
      label={<Typography variant="body2" sx={{ color: 'text.primary' }}>{label}</Typography>}
    />
  );
}

function AlertMessage({ type = "error", children, onClose }) {
  return (
    <Alert
      severity={type}
      onClose={onClose}
      sx={{
        '& .MuiAlert-message': {
          fontSize: '0.875rem',
        },
      }}
    >
      {children}
    </Alert>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const initialForm = { codigo: "", nombre: "", activo: 1 };

export default function AdminAlmacenes() {
  const { t } = useI18n();

  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadAlmacenes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("almacenes");
      setAlmacenes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAlmacenes(); }, [loadAlmacenes]);

  const handleEdit = useCallback((almacen) => {
    setEditingId(almacen.codigo);
    setForm({ codigo: almacen.codigo || "", nombre: almacen.nombre || "", activo: almacen.activo ?? 1 });
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
    if (!form.codigo) { setError(t("admin_required_fields", "Faltan campos obligatorios")); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await admin.update("almacenes", editingId, form);
        setSuccess(t("crud_record_updated", "Almacén actualizado correctamente"));
      } else {
        await admin.create("almacenes", form);
        setSuccess(t("crud_record_created", "Almacén creado correctamente"));
      }
      setDrawerOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadAlmacenes();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, editingId, loadAlmacenes, t]);

  const handleDelete = useCallback(async (codigo) => {
    setSubmitting(true);
    try {
      await admin.remove("almacenes", codigo);
      setSuccess(t("crud_record_deleted", "Almacén eliminado correctamente"));
      setDeletingId(null);
      await loadAlmacenes();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [loadAlmacenes, t]);

  const columnDefs = useMemo(
    () => [
      {
        field: "codigo",
        headerName: t("common_codigo", "Código"),
        flex: 0.5,
        minWidth: 110,
        cellRenderer: (params) => (
          <Typography
            variant="body2"
            sx={{ fontFamily: "monospace", fontSize: "0.875rem", color: "text.primary" }}
          >
            {params.value}
          </Typography>
        ),
      },
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
          onDelete={() => setDeletingId(params.data.codigo)}
        />
      )),
    ],
    [t, handleEdit]
  );

  return (
    <PageLayout
      title={t("admin_almacenes", "Almacenes")}
      subtitle={t("admin_almacenes_subtitle", "Gestión de almacenes del sistema")}
      backTo="/admin"
      actions={<NewButton onClick={handleNew} />}
    >
      {error && !drawerOpen && (
        <AlertMessage type="error" onClose={() => setError("")}>{error}</AlertMessage>
      )}
      {success && (
        <AlertMessage type="success" onClose={() => setSuccess("")}>{success}</AlertMessage>
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
          {t("admin_almacenes_confirm_delete", "¿Eliminar el almacén")} <strong>{deletingId}</strong>?
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <SPMAgGrid
            searchable
          rowData={almacenes}
          columnDefs={columnDefs}
          loading={loading}
          height={500}
          enableQuickFilter={true}
          exportFileName="almacenes"
          getRowId={getAlmacenRowId}
          emptyMessage={t("admin_almacenes_empty", "No hay almacenes registrados")}
        />
      </Paper>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
          },
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {editingId ? t("admin_almacenes_editar", "Editar almacén") : t("admin_almacenes_nuevo", "Nuevo almacén")}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                {t("common_codigo", "Código")}: {editingId}
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Drawer Content */}
        <Box
          component="form"
          id="almacen-form"
          onSubmit={handleSubmit}
          sx={{ p: 3, flex: 1, overflowY: 'auto' }}
        >
          {error && (
            <Box sx={{ mb: 3 }}>
              <AlertMessage type="error" onClose={() => setError("")}>{error}</AlertMessage>
            </Box>
          )}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                display: 'block',
                mb: 2,
                color: 'text.secondary',
                fontWeight: 600,
              }}
            >
              {t('admin_datos_almacen', 'Datos del almacén')}
            </Typography>
            <Stack spacing={2.5}>
              <FormInput
                label={t('common_codigo', 'Código')}
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                required
                disabled={!!editingId}
                placeholder={t("admin_almacenes_codigo_ph", "Ej.: ALM001")}
              />
              <FormInput
                label={t('common_nombre', 'Nombre')}
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder={t("admin_almacenes_nombre_ph", "Nombre del almacén")}
              />
              <FormCheckbox
                label={t('admin_almacen_activo', 'Almacén activo')}
                checked={form.activo === 1 || form.activo === true}
                onChange={(e) => setForm(prev => ({ ...prev, activo: e.target.checked ? 1 : 0 }))}
              />
            </Stack>
          </Box>
        </Box>

        {/* Drawer Footer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            onClick={() => setDrawerOpen(false)}
            disabled={submitting}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
            }}
          >
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            form="almacen-form"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
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
