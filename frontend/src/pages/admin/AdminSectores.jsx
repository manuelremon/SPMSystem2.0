import { useEffect, useState, useMemo, useCallback } from "react";
import { admin } from "../../services/spm";
import { useI18n } from "../../context/i18n";
import { useNavigate } from "react-router-dom";

// MUI Components
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
  CircularProgress,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import CategoryIcon from "@mui/icons-material/Category";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

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
          <Box sx={{ width: 100, px: 1.5, py: 2, display: "flex", justifyContent: "center" }}>
            <Skeleton variant="text" width="50%" height={20} />
          </Box>
          <Box sx={{ width: 150, px: 1.5, py: 2, display: "flex", justifyContent: "center" }}>
            <Skeleton variant="text" width="66%" height={20} />
          </Box>
          <Box sx={{ width: 50, px: 1.5, py: 2 }}>
            <Skeleton variant="text" width="100%" height={20} />
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
      <CategoryIcon sx={{ width: 48, height: 48, mb: 1.5, color: "action.disabled" }} />
      <Typography variant="body2" fontWeight={500}>
        No se encontraron sectores
      </Typography>
      {hasFilters && (
        <Button
          size="small"
          onClick={onClear}
          sx={{ mt: 1, textTransform: "none" }}
        >
          Limpiar búsqueda
        </Button>
      )}
    </Box>
  );
}

/** Fila de sector */
function SectorRow({ sector, onEdit, onDelete, isDeleting, onCancelDelete, onConfirmDelete }) {
  const { t } = useI18n();
  const isActivo = sector.activo === 1 || sector.activo === true;

  if (isDeleting) {
    return (
      <TableRow
        sx={{
          bgcolor: "error.lighter",
          borderLeft: 4,
          borderLeftColor: "error.main",
        }}
      >
        <TableCell colSpan={4} sx={{ py: 1.5, px: 2 }}>
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
                ¿Eliminar el sector <strong>{sector.nombre}</strong>?
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={onCancelDelete}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Cancelar
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={onConfirmDelete}
                sx={{ textTransform: "none", fontWeight: 600 }}
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
      hover
      sx={{
        cursor: "pointer",
        "& .delete-btn": {
          opacity: 0,
          transition: "opacity 0.15s ease",
        },
        "&:hover .delete-btn": {
          opacity: 1,
        },
      }}
    >
      <TableCell sx={{ borderRight: 1, borderColor: "divider", px: 1.5, py: 1.25 }}>
        <Typography variant="body2" fontWeight={500} color="text.primary">
          {sector.nombre}
        </Typography>
      </TableCell>
      <TableCell
        align="center"
        sx={{ borderRight: 1, borderColor: "divider", px: 1.5, py: 1.25 }}
      >
        <Chip
          size="small"
          label={isActivo ? "Activo" : "Inactivo"}
          sx={{
            height: 20,
            fontSize: "0.625rem",
            fontWeight: 600,
            textTransform: "uppercase",
            bgcolor: isActivo ? "success.lighter" : "grey.200",
            color: isActivo ? "success.dark" : "text.secondary",
            "& .MuiChip-label": { px: 1 },
          }}
          icon={
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: isActivo ? "success.main" : "grey.400",
                ml: 0.5,
              }}
            />
          }
        />
      </TableCell>
      <TableCell
        align="center"
        sx={{ borderRight: 1, borderColor: "divider", px: 1.5, py: 1.25 }}
      >
        <Typography variant="caption" color="text.secondary">
          {sector.created_at || "—"}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ px: 1, py: 1.25 }}>
        <IconButton
          className="delete-btn"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{
            color: "action.disabled",
            "&:hover": {
              color: "error.main",
              bgcolor: "error.lighter",
            },
          }}
          aria-label={t("aria_delete_sector", "Eliminar sector")}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const initialForm = {
  nombre: "",
  activo: 1,
};

export default function AdminSectores() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Estado de datos
  const [sectores, setSectores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros
  const [search, setSearch] = useState("");

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

  // Filtrado
  const filteredSectores = useMemo(() => {
    if (!search) return sectores;
    const term = search.toLowerCase();
    return sectores.filter(s => s.nombre?.toLowerCase().includes(term));
  }, [sectores, search]);

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

  // ============================================================================
  // RENDER
  // ============================================================================

  
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredSectores,
        "sectores",
        "Sectores"
      );
      setSuccess("Sectores exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar sectores");
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
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  color="text.primary"
                  sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  Sectores
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Gestión de sectores del sistema
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNew}
              sx={{
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Nuevo
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Contenido */}
      <Box sx={{ maxWidth: 1600, mx: "auto", px: 2, py: 2 }}>
        {/* Alertas */}
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

        {/* Panel principal */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {/* Barra de filtros */}
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
              {/* Búsqueda */}
              <TextField
                size="small"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ maxWidth: 400, flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "action.disabled", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Contador */}
              <Chip
                size="small"
                label={`${filteredSectores.length} sectores`}
                sx={{
                  bgcolor: "grey.200",
                  color: "text.secondary",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
                icon={
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      bgcolor: "grey.500",
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
          ) : filteredSectores.length === 0 ? (
            <EmptyState onClear={() => setSearch("")} hasFilters={!!search} />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell
                      sx={{
                        borderRight: 1,
                        borderBottom: 2,
                        borderColor: "divider",
                        py: 1.5,
                        px: 1.5,
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Nombre
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        borderRight: 1,
                        borderBottom: 2,
                        borderColor: "divider",
                        py: 1.5,
                        px: 1.5,
                        width: 100,
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Estado
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        borderRight: 1,
                        borderBottom: 2,
                        borderColor: "divider",
                        py: 1.5,
                        px: 1.5,
                        width: 150,
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Creado
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        borderBottom: 2,
                        borderColor: "divider",
                        py: 1.5,
                        px: 1,
                        width: 50,
                      }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSectores.map((sector) => (
                    <SectorRow
                      key={sector.nombre}
                      sector={sector}
                      onEdit={() => handleEdit(sector)}
                      onDelete={() => setDeletingId(sector.nombre)}
                      isDeleting={deletingId === sector.nombre}
                      onCancelDelete={() => setDeletingId(null)}
                      onConfirmDelete={() => handleDelete(sector.nombre)}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Footer */}
          {!loading && filteredSectores.length > 0 && (
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
                Mostrando {filteredSectores.length} de {sectores.length} sectores
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Drawer de edición/creación */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: DRAWER_WIDTH },
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
              {editingId ? "Editar Sector" : "Nuevo Sector"}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                Sector: {editingId}
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
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", mb: 2 }}
            >
              Datos del Sector
            </Typography>
            <Stack spacing={3}>
              <FormControl size="small" fullWidth required disabled={!!editingId}>
                <InputLabel id="nombre-label">Nombre</InputLabel>
                <Select
                  labelId="nombre-label"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  label="Nombre"
                >
                  <MenuItem value="">
                    <em>Seleccionar sector...</em>
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
                    Sector activo
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
            Cancelar
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
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
