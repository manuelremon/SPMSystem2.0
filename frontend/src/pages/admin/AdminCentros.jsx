import { useEffect, useState, useMemo, useCallback } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useNavigate } from "react-router-dom";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";

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
  Checkbox,
  FormControlLabel,
  Chip,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";

const initialForm = {
  codigo: "",
  nombre: "",
  activo: 1,
};

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminCentros() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  // ─── Load Data ────────────────────────────────────────────
  const loadCentros = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("centros");
      const data = Array.isArray(res.data) ? res.data : [];
      setCentros(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCentros();
  }, [loadCentros]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setEditingId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
  }, []);

  const handleEdit = useCallback((centro) => {
    setEditingId(centro.codigo);
    setForm({
      codigo: centro.codigo || "",
      nombre: centro.nombre || "",
      activo: centro.activo ?? 1,
    });
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

      if (!form.codigo) {
        setError(t("admin_required_fields", "Faltan campos obligatorios"));
        return;
      }

      setSubmitting(true);
      try {
        if (editingId) {
          await admin.update("centros", editingId, form);
          setSuccess(t("crud_record_updated", "Centro actualizado correctamente"));
        } else {
          await admin.create("centros", form);
          setSuccess(t("crud_record_created", "Centro creado correctamente"));
        }
        setDrawerOpen(false);
        setForm(initialForm);
        setEditingId(null);
        await loadCentros();
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingId, loadCentros, t]
  );

  const handleDelete = useCallback(
    async (codigo) => {
      setSubmitting(true);
      try {
        await admin.remove("centros", codigo);
        setSuccess(t("crud_record_deleted", "Centro eliminado correctamente"));
        setDeletingId(null);
        await loadCentros();
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [loadCentros, t]
  );

  // ─── AG Grid Column Defs ─────────────────────────────────
  const columnDefs = useMemo(
    () => [
      {
        field: "codigo",
        headerName: t('common_codigo', 'Código'),
        flex: 0.5,
        minWidth: 100,
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
        headerName: t('common_nombre', 'Nombre'),
        flex: 1,
        minWidth: 200,
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "activo",
        headerName: t('common_estado', 'Estado'),
        flex: 0.4,
        minWidth: 100,
        cellRenderer: (params) => {
          const isActivo = params.value === 1 || params.value === true;
          return (
            <Chip
              label={isActivo ? t('common_activo', 'Activo') : t('common_inactivo', 'Inactivo')}
              size="small"
              color={isActivo ? "success" : "default"}
              sx={{
                fontSize: "0.625rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                height: 20,
              }}
            />
          );
        },
      },
      {
        field: "created_at",
        headerName: t('common_creado', 'Creado'),
        flex: 0.5,
        minWidth: 120,
        valueFormatter: (params) => params.value || "-",
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
                "&:hover": { color: "primary.main", bgcolor: "primary.lighter" },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setDeletingId(params.data.codigo)}
              title={t('common_eliminar', 'Eliminar')}
              sx={{
                color: "text.secondary",
                "&:hover": { color: "error.main", bgcolor: "error.lighter" },
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
            {t("admin_centros", "Centros")}
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
          Eliminar centro <strong>{deletingId}</strong>?
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
          rowData={centros}
          columnDefs={columnDefs}
          loading={loading}
          height={500}
          enableQuickFilter={true}
          exportFileName="centros"
          emptyMessage={t('admin_no_results', 'No hay centros registrados')}
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
            {editingId ? `${t('common_editar', 'Editar')} Centro` : `${t('common_nuevo', 'Nuevo')} Centro`}
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

            <TextField
              label={t('common_codigo', 'Código')}
              name="codigo"
              value={form.codigo}
              onChange={handleChange}
              required
              disabled={!!editingId}
              placeholder="Ej: C001"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('common_nombre', 'Nombre')}
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Nombre del centro"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
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
  );
}
