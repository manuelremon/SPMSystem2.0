import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "@mui/material";

// MUI Icons
import CloseIcon from "@mui/icons-material/Close";

const ROLES_OPTIONS = [
  { value: "solicitante", label: "Solicitante" },
  { value: "aprobador_solicitudes", label: "Aprobador de solicitudes" },
  { value: "aprobador_presupuestos", label: "Aprobador de presupuestos" },
  { value: "planificador", label: "Planificador" },
  { value: "administrador", label: "Administrador" },
];

const initialForm = {
  nombre: "",
  activo: 1,
};

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminRoles() {
  const { t } = useI18n();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  // ─── Load Data ────────────────────────────────────────────
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("roles");
      const data = Array.isArray(res.data) ? res.data : [];
      setRoles(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // ─── Helpers ────────────────────────────────────────────
  const getRoleLabel = (value) => {
    const opt = ROLES_OPTIONS.find((o) => o.value === value);
    return opt ? opt.label : value;
  };

  // ─── Handlers ─────────────────────────────────────────────
  const handleNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
  };

  const handleEdit = (row) => {
    setEditingId(row.nombre);
    setForm({
      nombre: row.nombre || "",
      activo: row.activo ?? 1,
    });
    setDrawerOpen(true);
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.nombre) {
      setError(t("admin_required_fields", "Faltan campos obligatorios"));
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await admin.update("roles", editingId, form);
        setSuccess(t("crud_record_updated", "Rol actualizado correctamente"));
      } else {
        await admin.create("roles", form);
        setSuccess(t("crud_record_created", "Rol creado correctamente"));
      }
      setDrawerOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadRoles();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (nombre) => {
    setSubmitting(true);
    try {
      await admin.remove("roles", nombre);
      setSuccess(t("crud_record_deleted", "Rol eliminado correctamente"));
      setDeletingId(null);
      await loadRoles();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── AG Grid Column Defs ─────────────────────────────────
  const columnDefs = useMemo(
    () => [
      {
        field: "nombre",
        headerName: t('common_codigo', 'Código'),
        flex: 0.6,
        minWidth: 150,
        tooltipField: "nombre",
        cellStyle: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      },
      {
        colId: "descripcion",
        headerName: t('common_descripcion', 'Descripción'),
        flex: 1,
        minWidth: 200,
        wrapText: true,
        autoHeight: true,
        cellStyle: { lineHeight: "1.4", paddingTop: 10, paddingBottom: 10 },
        valueGetter: (params) => getRoleLabel(params.data.nombre),
      },
      {
        field: "activo",
        headerName: t('common_estado', 'Estado'),
        flex: 0.4,
        minWidth: 110,
        cellRenderer: (params) => <ActiveStatus activo={params.value} />,
      },
      actionsColumn(t('common_acciones', 'Acciones'), (params) => (
        <RowActions
          onEdit={() => handleEdit(params.data)}
          onDelete={() => setDeletingId(params.data.nombre)}
        />
      )),
    ],
    [t]
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <PageLayout
      title={t("admin_roles", "Roles")}
      backTo="/admin"
      actions={<NewButton onClick={handleNew} />}
    >
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

      {/* Delete Confirmation */}
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
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => handleDelete(deletingId)}
                disabled={submitting}
                sx={{ textTransform: "none" }}
              >
                {submitting ? "..." : t('common_eliminar', 'Eliminar')}
              </Button>
            </Stack>
          }
        >
          {t("admin_roles_confirm_delete", "¿Eliminar el rol")} <strong>{getRoleLabel(deletingId)}</strong>?
        </Alert>
      )}

      {/* Main Card */}
      <Paper
        variant="outlined"
        sx={{
          overflow: "hidden",
        }}
      >
        <SPMAgGrid
            searchable
          rowData={roles}
          columnDefs={columnDefs}
          loading={loading}
          height={500}
          enableQuickFilter={true}
          exportFileName="roles"
          emptyMessage={t('admin_no_results', 'No hay roles registrados')}
        />
      </Paper>

      {/* Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: "100%",
            maxWidth: 448,
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
            variant="subtitle1"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            {editingId ? t("admin_roles_editar", "Editar rol") : t("admin_roles_nuevo", "Nuevo rol")}
          </Typography>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            flex: 1,
            overflow: "auto",
            p: 2.5,
          }}
        >
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {error}
              </Alert>
            )}

            <FormControl size="small" fullWidth required disabled={!!editingId}>
              <InputLabel>
                {t('common_rol', 'Rol')}
              </InputLabel>
              <Select
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                label={t('common_rol', 'Rol')}
              >
                <MenuItem value="">
                  <em>{t("common_seleccionar", "Selecciona...")}</em>
                </MenuItem>
                {ROLES_OPTIONS.map((opt) => (
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
                    setForm((prev) => ({
                      ...prev,
                      activo: e.target.checked ? 1 : 0,
                    }))
                  }
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.primary">
                  {t('common_activo', 'Activo')}
                </Typography>
              }
            />

            <Box
              sx={{
                display: "flex",
                gap: 1,
                pt: 2,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setDrawerOpen(false)}
                disabled={submitting}
                fullWidth
                sx={{ textTransform: "none" }}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                fullWidth
                sx={{ textTransform: "none" }}
              >
                {submitting
                  ? t('common_guardando', 'Guardando...')
                  : editingId
                  ? t('common_actualizar', 'Actualizar')
                  : t('common_crear', 'Crear')}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </PageLayout>
  );
}
