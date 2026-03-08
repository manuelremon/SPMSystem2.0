import { useEffect, useState, useCallback, useMemo } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useNavigate } from "react-router-dom";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";

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
  Chip,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";

const ROLES_OPTIONS = [
  { value: "solicitante", label: "Solicitante" },
  { value: "aprobador_solicitudes", label: "Aprobador de Solicitudes" },
  { value: "aprobador_presupuestos", label: "Aprobador de Presupuestos" },
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
  const navigate = useNavigate();
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
        headerName: t('common_descripcion', 'Descripción'),
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => getRoleLabel(params.data.nombre),
      },
      {
        field: "activo",
        headerName: t('common_estado', 'Estado'),
        flex: 0.4,
        minWidth: 100,
        cellRenderer: (params) => (
          <Chip
            label={
              params.value === 1 || params.value === true
                ? t('common_activo', 'Activo')
                : t('common_inactivo', 'Inactivo')
            }
            size="small"
            color={
              params.value === 1 || params.value === true
                ? "success"
                : "default"
            }
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              height: 20,
            }}
          />
        ),
      },
      {
        headerName: t('common_acciones', 'Acciones'),
        flex: 0.4,
        minWidth: 100,
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <IconButton
              size="small"
              onClick={() => handleEdit(params.data)}
              title={t('common_editar', 'Editar')}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  color: "primary.main",
                  bgcolor: "primary.lighter",
                },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setDeletingId(params.data.nombre)}
              title={t('common_eliminar', 'Eliminar')}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  color: "error.main",
                  bgcolor: "error.lighter",
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [t]
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={() => navigate("/admin")}
            sx={{
              color: "text.disabled",
              "&:hover": {
                color: "text.secondary",
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 700,
              color: "text.primary",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {t("admin_roles", "Roles")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleNew}
          sx={{ textTransform: "none" }}
        >
          {t("crud_new", "Nuevo")}
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
          Eliminar rol <strong>{getRoleLabel(deletingId)}</strong>?
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
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "text.primary",
            }}
          >
            {editingId ? `${t('common_editar', 'Editar')} Rol` : `${t('common_nuevo', 'Nuevo')} Rol`}
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
              <InputLabel
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t('common_rol', 'Rol')}
              </InputLabel>
              <Select
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                label={t('common_rol', 'Rol')}
              >
                <MenuItem value="">
                  <em>Seleccionar...</em>
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
      </Box>
    </Box>
  );
}
