import { useEffect, useState, useMemo, useCallback } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import WorkIcon from "@mui/icons-material/Work";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

// ============================================================================
// CONSTANTES
// ============================================================================
const PUESTOS_OPTIONS = [
  { value: "Planificador", label: "Planificador" },
  { value: "Jefe", label: "Jefe" },
  { value: "Gerente1", label: "Gerente Nivel 1" },
  { value: "Gerente2", label: "Gerente Nivel 2" },
  { value: "Director", label: "Director" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Analista", label: "Analista" },
  { value: "Coordinador", label: "Coordinador" },
];

const DRAWER_WIDTH = 400;

// ============================================================================
// COMPONENTES UI
// ============================================================================

function LoadingSkeleton() {
  return (
    <Box>
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box sx={{ flex: 1, px: 1.5, py: 2 }}>
            <Skeleton variant="text" width="50%" height={20} />
          </Box>
          <Box sx={{ width: 100, px: 1.5, py: 2 }}>
            <Skeleton variant="text" width="50%" height={20} sx={{ mx: "auto" }} />
          </Box>
          <Box sx={{ width: 150, px: 1.5, py: 2 }}>
            <Skeleton variant="text" width="66%" height={20} sx={{ mx: "auto" }} />
          </Box>
          <Box sx={{ width: 50, px: 1.5, py: 2 }}>
            <Skeleton variant="text" height={20} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function EmptyState({ onClear, hasFilters }) {
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
      <WorkIcon sx={{ width: 48, height: 48, mb: 1.5, color: "action.disabled" }} />
      <Typography variant="body2" fontWeight={500}>
        No se encontraron puestos
      </Typography>
      {hasFilters && (
        <Button
          onClick={onClear}
          size="small"
          sx={{ mt: 1, textTransform: "none" }}
        >
          Limpiar busqueda
        </Button>
      )}
    </Box>
  );
}

function PuestoRow({ puesto, onEdit, onDelete, isDeleting, onCancelDelete, onConfirmDelete }) {
  const isActivo = puesto.activo === 1 || puesto.activo === true;

  if (isDeleting) {
    return (
      <TableRow
        sx={{
          bgcolor: "error.lighter",
          borderLeft: 4,
          borderLeftColor: "error.main",
        }}
      >
        <TableCell colSpan={4} sx={{ px: 2, py: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.dark" }}>
              <WarningAmberIcon sx={{ width: 20, height: 20 }} />
              <Typography variant="body2" fontWeight={500}>
                ¿Eliminar el puesto <strong>{puesto.nombre}</strong>?
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={onCancelDelete}
                size="small"
                variant="outlined"
                sx={{
                  textTransform: "none",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  borderColor: "divider",
                  "&:hover": {
                    bgcolor: "action.hover",
                    borderColor: "divider",
                  },
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={onConfirmDelete}
                size="small"
                variant="contained"
                color="error"
                sx={{
                  textTransform: "none",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                Eliminar
              </Button>
            </Stack>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      onClick={onEdit}
      sx={{
        cursor: "pointer",
        transition: "background-color 75ms",
        "&:hover": {
          bgcolor: "action.hover",
          "& .delete-button": {
            opacity: 1,
          },
        },
      }}
    >
      <TableCell
        sx={{
          px: 1.5,
          py: 1.25,
          borderRight: 1,
          borderRightColor: "divider",
        }}
      >
        <Typography variant="body2" fontWeight={500} color="text.primary" fontSize="13px">
          {puesto.nombre}
        </Typography>
      </TableCell>
      <TableCell
        align="center"
        sx={{
          px: 1.5,
          py: 1.25,
          borderRight: 1,
          borderRightColor: "divider",
        }}
      >
        <Chip
          size="small"
          label={isActivo ? "Activo" : "Inactivo"}
          sx={{
            height: 20,
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            bgcolor: isActivo ? "success.lighter" : "action.disabledBackground",
            color: isActivo ? "success.dark" : "text.secondary",
            "& .MuiChip-label": {
              px: 1,
            },
          }}
          icon={
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: isActivo ? "success.main" : "action.disabled",
                ml: 0.5,
              }}
            />
          }
        />
      </TableCell>
      <TableCell
        align="center"
        sx={{
          px: 1.5,
          py: 1.25,
          borderRight: 1,
          borderRightColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {puesto.created_at || "—"}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ px: 1, py: 1.25 }}>
        <IconButton
          className="delete-button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          size="small"
          aria-label={t("aria_delete_puesto", "Eliminar puesto")}
          sx={{
            opacity: 0,
            transition: "all 150ms",
            color: "action.disabled",
            "&:hover": {
              color: "error.main",
              bgcolor: "error.lighter",
            },
          }}
        >
          <DeleteIcon sx={{ width: 16, height: 16 }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const initialForm = { nombre: "", activo: 1 };

export default function AdminPuestos() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
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

  const filteredPuestos = useMemo(() => {
    if (!search) return puestos;
    const term = search.toLowerCase();
    return puestos.filter((p) => p.nombre?.toLowerCase().includes(term));
  }, [puestos, search]);

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

  
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredPuestos,
        "puestos",
        "Puestos"
      );
      setSuccess("Puestos exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar puestos");
    } finally {
      setExporting(false);
    }
  };

return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      {/* Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 1600, mx: "auto", px: 2, py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <IconButton
                onClick={() => navigate("/admin")}
                size="small"
                sx={{
                  color: "text.secondary",
                  "&:hover": {
                    color: "text.primary",
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ArrowBackIcon sx={{ width: 20, height: 20 }} />
              </IconButton>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  color="text.primary"
                  sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  Puestos
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Gestion de puestos del sistema
                </Typography>
              </Box>
            </Box>
            <Button
              onClick={handleNew}
              variant="contained"
              size="small"
              startIcon={<AddIcon sx={{ width: 16, height: 16 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                px: 2,
              }}
            >
              Nuevo
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Contenido */}
      <Box sx={{ maxWidth: 1600, mx: "auto", px: 2, py: 2 }}>
        {error && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          </Box>
        )}
        {success && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="success" onClose={() => setSuccess("")}>
              {success}
            </Alert>
          </Box>
        )}

        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {/* Filtros */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "grey.50",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <TextField
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                sx={{
                  flex: 1,
                  maxWidth: 400,
                  "& .MuiOutlinedInput-root": {
                    height: 36,
                    fontSize: "0.875rem",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ width: 16, height: 16, color: "action.disabled" }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Chip
                size="small"
                label={`${filteredPuestos.length} puestos`}
                sx={{
                  height: 24,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  bgcolor: "grey.200",
                  color: "text.secondary",
                }}
                icon={
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      bgcolor: "action.disabled",
                      ml: 0.5,
                    }}
                  />
                }
              />
            </Box>
          </Box>

          {/* Tabla */}
          {loading ? (
            <LoadingSkeleton />
          ) : filteredPuestos.length === 0 ? (
            <EmptyState onClear={() => setSearch("")} hasFilters={!!search} />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ borderCollapse: "collapse" }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell
                      sx={{
                        px: 1.5,
                        py: 1.5,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderRight: 1,
                        borderRightColor: "divider",
                        borderBottom: 2,
                        borderBottomColor: "divider",
                      }}
                    >
                      Nombre
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        px: 1.5,
                        py: 1.5,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        width: 100,
                        borderRight: 1,
                        borderRightColor: "divider",
                        borderBottom: 2,
                        borderBottomColor: "divider",
                      }}
                    >
                      Estado
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        px: 1.5,
                        py: 1.5,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        width: 150,
                        borderRight: 1,
                        borderRightColor: "divider",
                        borderBottom: 2,
                        borderBottomColor: "divider",
                      }}
                    >
                      Creado
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        px: 1,
                        py: 1.5,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        width: 50,
                        borderBottom: 2,
                        borderBottomColor: "divider",
                      }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPuestos.map((puesto) => (
                    <PuestoRow
                      key={puesto.nombre}
                      puesto={puesto}
                      onEdit={() => handleEdit(puesto)}
                      onDelete={() => setDeletingId(puesto.nombre)}
                      isDeleting={deletingId === puesto.nombre}
                      onCancelDelete={() => setDeletingId(null)}
                      onConfirmDelete={() => handleDelete(puesto.nombre)}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {!loading && filteredPuestos.length > 0 && (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: 1,
                borderColor: "divider",
                bgcolor: "grey.50",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Mostrando {filteredPuestos.length} de {puestos.length} puestos
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

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
              {editingId ? "Editar Puesto" : "Nuevo Puesto"}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                Puesto: {editingId}
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
            variant="overline"
            color="text.secondary"
            sx={{ display: "block", mb: 2, letterSpacing: "0.08em" }}
          >
            Datos del Puesto
          </Typography>

          <Stack spacing={3}>
            <FormControl fullWidth size="small" required disabled={!!editingId}>
              <InputLabel id="nombre-label">Nombre del Puesto</InputLabel>
              <Select
                labelId="nombre-label"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                label="Nombre del Puesto"
              >
                <MenuItem value="">
                  <em>Seleccionar puesto...</em>
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
                  Puesto activo
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
            Cancelar
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
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
