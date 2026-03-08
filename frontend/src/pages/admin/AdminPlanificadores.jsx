import { useEffect, useState, useCallback, useMemo } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useNavigate } from "react-router-dom";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import GroupIcon from "@mui/icons-material/Group";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";

// Services
import { exportToXLSX } from "../../services/export";

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

const initialForm = {
  usuario_id: "",
  nombre: "",
  activo: 1,
  asignaciones_text: "",
};

/* ─────────────────────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────────────────────── */
function TableSkeleton({ rows = 5 }) {
  return (
    <Box>
      {[...Array(rows)].map((_, i) => (
        <Stack
          key={i}
          direction="row"
          spacing={2}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            py: 1.5,
            px: 2,
          }}
        >
          <Skeleton variant="text" width={64} height={24} />
          <Skeleton variant="text" sx={{ flex: 1 }} height={24} />
          <Skeleton variant="text" width={80} height={24} />
          <Skeleton variant="text" width={128} height={24} />
          <Skeleton variant="text" width={64} height={24} />
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
      <GroupIcon sx={{ fontSize: 48, mb: 1.5, opacity: 0.5 }} />
      <Typography variant="body2" sx={{ mb: 2 }}>
        {message}
      </Typography>
      {onAction && (
        <Button
          onClick={onAction}
          size="small"
          sx={{
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontSize: "0.75rem",
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

/**
 * Tabla de planificadores migrada a SPMAgGrid
 */
function PlanificadoresTable({
  data,
  onEdit,
  onDelete,
  deletingId,
  onCancelDelete,
  onConfirmDelete,
  submitting,
}) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({ ...item, id: item.usuario_id }));
  }, [data]);

  const columnDefs = useMemo(
    () => [
      {
        field: "usuario_id",
        headerName: t('admin_usuario_id', 'Usuario ID'),
        flex: 0.25,
        minWidth: 100,
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "nombre",
        headerName: t('common_nombre', 'Nombre'),
        flex: 0.4,
        minWidth: 150,
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "activo",
        headerName: t('common_estado', 'Estado'),
        flex: 0.25,
        minWidth: 100,
        cellRenderer: (params) => (
          <Chip
            label={
              params.data.activo === 1 || params.data.activo === true
                ? t('common_activo', 'Activo')
                : t('common_inactivo', 'Inactivo')
            }
            size="small"
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              height: 20,
              bgcolor:
                params.data.activo === 1 || params.data.activo === true
                  ? "success.lighter"
                  : "grey.200",
              color:
                params.data.activo === 1 || params.data.activo === true
                  ? "success.dark"
                  : "text.secondary",
            }}
          />
        ),
      },
      {
        field: "asignaciones_text",
        headerName: t('common_asignaciones', 'Asignaciones'),
        flex: 0.6,
        minWidth: 200,
        cellRenderer: (params) =>
          params.data?.asignaciones_text ? (
            <Box
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                m: 0,
                fontSize: "0.75rem",
              }}
            >
              {params.data.asignaciones_text}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              Sin asignaciones
            </Typography>
          ),
      },
      {
        field: "acciones",
        headerName: t('common_acciones', 'Acciones'),
        flex: 0.25,
        minWidth: 100,
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Button
              size="small"
              variant="text"
              onClick={() => onEdit && onEdit(params.data)}
              disabled={!!deletingId}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "primary.main",
                fontSize: "0.75rem",
                minWidth: "auto",
                px: 1,
                "&:hover": { bgcolor: "primary.lighter" },
              }}
            >
              {t('common_editar', 'Editar')}
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <Button
              size="small"
              variant="text"
              onClick={() => onDelete && onDelete(params.data.usuario_id)}
              disabled={!!deletingId}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "error.main",
                fontSize: "0.75rem",
                minWidth: "auto",
                px: 1,
                "&:hover": { bgcolor: "error.lighter" },
              }}
            >
              {t('common_eliminar', 'Eliminar')}
            </Button>
          </Stack>
        ),
      },
    ],
    [onEdit, onDelete, deletingId, t]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Si hay eliminación en progreso, mostrar confirmación encima */}
      {deletingId && (
        <Box
          sx={{
            p: 2,
            bgcolor: "error.lighter",
            border: "1px solid",
            borderColor: "error.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" sx={{ color: "error.dark" }}>
            Eliminar al planificador{" "}
            <strong>
              {data.find((r) => r.usuario_id === deletingId)?.nombre ||
                deletingId}
            </strong>
            ?
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={onCancelDelete}
              disabled={submitting}
              sx={{
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.75rem",
              }}
            >
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={() => onConfirmDelete && onConfirmDelete(deletingId)}
              disabled={submitting}
              sx={{
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.75rem",
              }}
            >
              {submitting ? "..." : t('common_eliminar', 'Eliminar')}
            </Button>
          </Stack>
        </Box>
      )}

      {/* Tabla SPMAgGrid */}
      <SPMAgGrid
        rowData={rows}
        columnDefs={columnDefs}
        height={500}
        pagination={true}
        paginationPageSize={10}
        enableQuickFilter={true}
        exportFileName="planificadores"
        emptyMessage={t("common_no_data", "Sin planificadores")}
      />
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function AdminPlanificadores() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [planificadores, setPlanificadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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

  // ─── Render ───────────────────────────────────────────────
  
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredPlanificadores,
        "planificadores",
        "Planificadores"
      );
      setSuccess("Planificadores exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar planificadores");
    } finally {
      setExporting(false);
    }
  };

return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 3 }}>
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
                "&:hover": {
                  bgcolor: "grey.200",
                  color: "text.primary",
                },
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "text.primary",
              }}
            >
              {t("admin_planificadores", "Planificadores")}
            </Typography>
          </Stack>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Tooltip title="Descargar XLSX">
              <span>
                <IconButton
                  onClick={handleExport}
                  disabled={loading || exporting || filteredPlanificadores.length === 0}
                  size="small"
                  sx={{
                    color: "var(--success)",
                    border: "1px solid var(--success)",
                    padding: "4px 8px",
                    "&:hover": {
                      backgroundColor: "var(--success)",
                      color: "var(--card)",
                    },
                    "&:disabled": {
                      opacity: 0.5,
                      cursor: "not-allowed",
                    },
                  }}
                >
                  {exporting ? (
                    <CircularProgress size={14} sx={{ color: "var(--success)" }} />
                  ) : (
                    <>
                      <FileDownloadIcon sx={{ fontSize: "1rem", mr: 0.5 }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>XLSX</span>
                    </>
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              onClick={handleNew}
              size="small"
              sx={{
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.75rem",
                px: 2,
              }}
            >
              {t("crud_new", "Nuevo")}
            </Button>
          </Box>
        </Stack>

        {/* Alerts */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError("")}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            onClose={() => setSuccess("")}
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>
        )}

        {/* Search */}
        <Box sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Buscar por ID o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            sx={{
              width: 300,
              "& .MuiOutlinedInput-root": {
                bgcolor: "background.paper",
              },
            }}
          />
        </Box>

        {/* Table */}
        <Paper variant="outlined">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : filteredPlanificadores.length === 0 ? (
            <EmptyState
              message={searchTerm ? t('admin_no_results', 'No se encontraron planificadores') : t('admin_no_planificadores', 'No hay planificadores registrados')}
              onAction={!searchTerm ? handleNew : undefined}
              actionLabel={t('admin_crear_primer_planificador', 'Crear primer planificador')}
            />
          ) : (
            <PlanificadoresTable
              data={filteredPlanificadores}
              onEdit={handleEdit}
              onDelete={(id) => setDeletingId(id)}
              deletingId={deletingId}
              onCancelDelete={() => setDeletingId(null)}
              onConfirmDelete={handleDelete}
              submitting={submitting}
            />
          )}
        </Paper>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 2, color: "text.disabled" }}
        >
          {filteredPlanificadores.length} de {planificadores.length} planificadores
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
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "text.primary",
            }}
          >
            {editingId ? `${t('common_editar', 'Editar')} Planificador` : `${t('common_nuevo', 'Nuevo')} Planificador`}
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
              label={t('admin_usuario_id', 'Usuario ID')}
              name="usuario_id"
              value={form.usuario_id}
              onChange={handleChange}
              required
              disabled={!!editingId}
              size="small"
              fullWidth
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
            />

            <TextField
              label={t('common_nombre', 'Nombre')}
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              size="small"
              fullWidth
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
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
                  {t('common_activo', 'Activo')}
                </Typography>
              }
            />

            <TextField
              label={t('common_asignaciones', 'Asignaciones')}
              name="asignaciones_text"
              value={form.asignaciones_text}
              onChange={handleChange}
              size="small"
              fullWidth
              multiline
              rows={5}
              placeholder="Una por linea: centro, sector, almacen"
              autoComplete="off"
              InputLabelProps={{
                sx: {
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              }}
            />

            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: "grey.50",
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Formato: centro, sector, almacen_virtual (una por linea)
              </Typography>
            </Paper>

            <Stack
              direction="row"
              spacing={1}
              sx={{
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
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "0.75rem",
                }}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                fullWidth
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "0.75rem",
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
