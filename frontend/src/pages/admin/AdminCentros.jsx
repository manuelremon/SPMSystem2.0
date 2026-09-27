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
  Alert,
  Stack,
  Drawer,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

// MUI Icons
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

  // ─── Render ───────────────────────────────────────────────
  return (
    <PageLayout
      title={t("admin_centros", "Centros")}
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
          {t("admin_centros_confirm_delete", "¿Eliminar el centro")} <strong>{deletingId}</strong>?
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
            variant="subtitle1"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            {editingId ? t("admin_centros_editar", "Editar centro") : t("admin_centros_nuevo", "Nuevo centro")}
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
              placeholder={t("admin_centros_codigo_ph", "Ej.: C001")}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('common_nombre', 'Nombre')}
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder={t("admin_centros_nombre_ph", "Nombre del centro")}
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
    </PageLayout>
  );
}
