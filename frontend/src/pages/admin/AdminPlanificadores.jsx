import { useEffect, useState, useCallback, useMemo } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";
import PageLayout from "../../components/ui/PageLayout";
import EmptyState from "../../components/ui/EmptyState";
import { NewButton, ActiveStatus, RowActions, actionsColumn } from "../../components/admin/AdminCrudParts";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";

// MUI Icons
import CloseIcon from "@mui/icons-material/Close";
import GroupIcon from "@mui/icons-material/Group";

const parseAsignaciones = (text) => {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [centro, sector, almacen_virtual] = line.split(",").map((v) => v?.trim());
      return { centro, sector, almacen_virtual };
    });
};

/** Convierte el texto de asignaciones en etiquetas legibles ("AA101, Mantenimiento"), sin partes vacías. */
const asignacionesToLabels = (text) =>
  (text || "")
    .split("\n")
    .map((line) =>
      line
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean);

const initialForm = {
  usuario_id: "",
  nombre: "",
  activo: 1,
  asignaciones_text: "",
};

/**
 * Tabla de planificadores (SPMAgGrid)
 */
function PlanificadoresTable({ data, loading, onEdit, onDelete, deletingId }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({ ...item, id: item.usuario_id }));
  }, [data]);

  const columnDefs = useMemo(
    () => [
      {
        field: "usuario_id",
        headerName: t("admin_planif_usuario_id", "ID de usuario"),
        flex: 0.25,
        minWidth: 120,
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "nombre",
        headerName: t("common_nombre", "Nombre"),
        flex: 0.4,
        minWidth: 150,
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "activo",
        headerName: t("common_estado", "Estado"),
        flex: 0.25,
        minWidth: 110,
        cellRenderer: (params) => <ActiveStatus activo={params.value} />,
      },
      {
        field: "asignaciones_text",
        headerName: t("common_asignaciones", "Asignaciones"),
        flex: 0.8,
        minWidth: 220,
        autoHeight: true,
        valueFormatter: (params) => asignacionesToLabels(params.value).join(" | "),
        cellRenderer: (params) => {
          const labels = asignacionesToLabels(params.data?.asignaciones_text);
          if (labels.length === 0) {
            return (
              <Typography variant="caption" sx={{ color: "text.disabled" }}>
                {t("admin_planif_sin_asignaciones", "Sin asignaciones")}
              </Typography>
            );
          }
          return (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, py: 1 }}>
              {labels.map((label, idx) => (
                <Chip key={`${label}-${idx}`} label={label} size="small" variant="outlined" />
              ))}
            </Box>
          );
        },
      },
      actionsColumn(t("common_acciones", "Acciones"), (params) => (
        <RowActions
          onEdit={() => onEdit && onEdit(params.data)}
          onDelete={() => onDelete && onDelete(params.data.usuario_id)}
          disabled={!!deletingId}
        />
      )),
    ],
    [onEdit, onDelete, deletingId, t]
  );

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      loading={loading}
      height={520}
      pagination={true}
      paginationPageSize={25}
      enableQuickFilter={true}
      exportFileName="planificadores"
      emptyMessage={t("admin_planif_vacio", "Sin planificadores")}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminPlanificadores() {
  const { t } = useI18n();

  const [planificadores, setPlanificadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ─── Load Data ────────────────────────────────────────────
  const loadPlanificadores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.list("planificadores");
      const data = res.data;
      const planners = data?.planificadores || [];
      const asign = data?.asignaciones || [];

      const parsed = planners.map((p) => {
        const rows = asign.filter((a) => a.planificador_id === p.usuario_id);
        return {
          ...p,
          asignaciones_text: rows
            .map((r) => `${r.centro || ""}, ${r.sector || ""}, ${r.almacen_virtual || ""}`)
            .join("\n"),
        };
      });

      setPlanificadores(parsed);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlanificadores();
  }, [loadPlanificadores]);

  // ─── Filtered Data ────────────────────────────────────────
  const filteredPlanificadores = planificadores.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.usuario_id?.toString().toLowerCase().includes(term) ||
      r.nombre?.toLowerCase().includes(term)
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
    setEditingId(row.usuario_id);
    setForm({
      usuario_id: row.usuario_id || "",
      nombre: row.nombre || "",
      activo: row.activo ?? 1,
      asignaciones_text: row.asignaciones_text || "",
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

    if (!form.usuario_id) {
      setError(t("admin_required_fields", "Faltan campos obligatorios"));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        usuario_id: form.usuario_id,
        nombre: form.nombre,
        activo: form.activo,
        asignaciones: parseAsignaciones(form.asignaciones_text),
      };

      if (editingId) {
        await admin.update("planificadores", editingId, payload);
        setSuccess(t("crud_record_updated", "Planificador actualizado correctamente"));
      } else {
        await admin.create("planificadores", payload);
        setSuccess(t("crud_record_created", "Planificador creado correctamente"));
      }

      setDrawerOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadPlanificadores();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setSubmitting(true);
    try {
      await admin.remove("planificadores", id);
      setSuccess(t("crud_record_deleted", "Planificador eliminado correctamente"));
      setDeletingId(null);
      await loadPlanificadores();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deletingNombre =
    planificadores.find((r) => r.usuario_id === deletingId)?.nombre || deletingId;

  // ─── Render ───────────────────────────────────────────────
  return (
    <PageLayout
      title={t("admin_planificadores", "Planificadores")}
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
          {t("admin_planif_confirm_delete", "¿Eliminar al planificador")} <strong>{deletingNombre}</strong>?
        </Alert>
      )}

      {/* Search */}
      <TextField
        size="small"
        placeholder={t("admin_planificadores_search_placeholder", "Buscar por ID o nombre...")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoComplete="off"
        sx={{
          width: { xs: "100%", sm: 300 },
          "& .MuiOutlinedInput-root": { bgcolor: "background.paper" },
        }}
      />

      {/* Table */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {!loading && filteredPlanificadores.length === 0 ? (
          <EmptyState
            icon={<GroupIcon sx={{ fontSize: 32, color: "text.disabled" }} />}
            title={
              searchTerm
                ? t("admin_planif_sin_resultados", "No se encontraron planificadores")
                : t("admin_planif_sin_registros", "No hay planificadores registrados")
            }
            action={!searchTerm ? t("admin_planif_crear_primero", "Crear el primer planificador") : undefined}
            onAction={!searchTerm ? handleNew : undefined}
          />
        ) : (
          <PlanificadoresTable
            data={filteredPlanificadores}
            loading={loading}
            onEdit={handleEdit}
            onDelete={(id) => setDeletingId(id)}
            deletingId={deletingId}
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
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
            {editingId
              ? t("admin_planif_editar", "Editar planificador")
              : t("admin_planif_nuevo", "Nuevo planificador")}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(false)}
            aria-label={t("common_cerrar", "Cerrar")}
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
              label={t("admin_planif_usuario_id", "ID de usuario")}
              name="usuario_id"
              value={form.usuario_id}
              onChange={handleChange}
              required
              disabled={!!editingId}
              size="small"
              fullWidth
              autoComplete="off"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label={t("common_nombre", "Nombre")}
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              size="small"
              fullWidth
              autoComplete="off"
              InputLabelProps={{ shrink: true }}
            />

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
                <Typography variant="body2" sx={{ color: "text.primary" }}>
                  {t("common_activo", "Activo")}
                </Typography>
              }
            />

            <TextField
              label={t("common_asignaciones", "Asignaciones")}
              name="asignaciones_text"
              value={form.asignaciones_text}
              onChange={handleChange}
              size="small"
              fullWidth
              multiline
              rows={5}
              placeholder={t("admin_planif_asignaciones_ph", "AA101, Mantenimiento, 0001")}
              helperText={t("admin_planif_asignaciones_help", "Una por línea: centro, sector, almacén")}
              autoComplete="off"
              InputLabelProps={{ shrink: true }}
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
                {t("common_cancelar", "Cancelar")}
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                fullWidth
                sx={{ textTransform: "none" }}
              >
                {submitting
                  ? t("common_guardando", "Guardando...")
                  : editingId
                  ? t("common_actualizar", "Actualizar")
                  : t("common_crear", "Crear")}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </PageLayout>
  );
}
