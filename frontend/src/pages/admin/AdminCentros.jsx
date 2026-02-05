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
  Alert,
  Skeleton,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Chip,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningIcon from "@mui/icons-material/Warning";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

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
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ width: 100, px: 1.5, py: 2 }}>
            <Skeleton variant="rectangular" height={16} />
          </Box>
          <Box sx={{ flex: 1, px: 1.5, py: 2 }}>
            <Skeleton variant="rectangular" height={16} sx={{ width: "75%" }} />
          </Box>
          <Box sx={{ width: 100, px: 1.5, py: 2 }}>
            <Skeleton variant="rectangular" height={16} sx={{ width: "50%", mx: "auto" }} />
          </Box>
          <Box sx={{ width: 150, px: 1.5, py: 2 }}>
            <Skeleton variant="rectangular" height={16} sx={{ width: "66%", mx: "auto" }} />
          </Box>
          <Box sx={{ width: 50, px: 1.5, py: 2 }}>
            <Skeleton variant="rectangular" height={16} />
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
      <BusinessIcon sx={{ width: 48, height: 48, mb: 1.5, color: "action.disabled" }} />
      <Typography variant="body2" fontWeight={500}>
        No se encontraron centros
      </Typography>
      {hasFilters && (
        <Button
          onClick={onClear}
          size="small"
          sx={{ mt: 1, textTransform: "none" }}
        >
          Limpiar búsqueda
        </Button>
      )}
    </Box>
  );
}

/** Fila de centro */
function CentroRow({ centro, onEdit, onDelete, isDeleting, onCancelDelete, onConfirmDelete }) {
  const isActivo = centro.activo === 1 || centro.activo === true;

  if (isDeleting) {
    return (
      <TableRow
        sx={{
          bgcolor: "error.lighter",
          borderLeft: "4px solid",
          borderLeftColor: "error.main",
        }}
      >
        <TableCell colSpan={5} sx={{ px: 2, py: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.dark" }}>
              <WarningIcon sx={{ width: 20, height: 20 }} />
              <Typography variant="body2" fontWeight={500}>
                ¿Eliminar el centro <strong>{centro.codigo}</strong>?
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
        "&:hover": {
          bgcolor: "action.hover",
          "& .delete-btn": {
            opacity: 1,
          },
        },
      }}
    >
      <TableCell
        sx={{
          px: 1.5,
          py: 1.25,
          borderRight: "1px solid",
          borderRightColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontSize: "13px",
            fontFamily: "monospace",
            color: "text.secondary",
          }}
        >
          {centro.codigo}
        </Typography>
      </TableCell>
      <TableCell
        sx={{
          px: 1.5,
          py: 1.25,
          borderRight: "1px solid",
          borderRightColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontSize: "13px", fontWeight: 500, color: "text.primary" }}
        >
          {centro.nombre || "—"}
        </Typography>
      </TableCell>
      <TableCell
        align="center"
        sx={{
          px: 1.5,
          py: 1.25,
          borderRight: "1px solid",
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
                ml: 1,
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
          borderRight: "1px solid",
          borderRightColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {centro.created_at || "—"}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ px: 1, py: 1.25 }}>
        <IconButton
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          size="small"
          sx={{
            opacity: 0,
            color: "action.disabled",
            transition: "all 0.15s",
            "&:hover": {
              color: "error.main",
              bgcolor: "error.lighter",
            },
          }}
          aria-label="Eliminar centro"
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

const initialForm = {
  codigo: "",
  nombre: "",
  activo: 1,
};

export default function AdminCentros() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Estado de datos
  const [centros, setCentros] = useState([]);
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

  // Filtrado
  const filteredCentros = useMemo(() => {
    if (!search) return centros;
    const term = search.toLowerCase();
    return centros.filter(c =>
      c.codigo?.toLowerCase().includes(term) ||
      c.nombre?.toLowerCase().includes(term)
    );
  }, [centros, search]);

  // Handlers
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
  }, [form, editingId, loadCentros, t]);

  const handleDelete = useCallback(async (codigo) => {
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
  }, [loadCentros, t]);

  // ============================================================================
  // RENDER
  // ============================================================================

  
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredCentros,
        "centros",
        "Centros"
      );
      setSuccess("Centros exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar centros");
    } finally {
      setExporting(false);
    }
  };

return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 1600, mx: "auto", px: 2, py: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
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
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t("admin_centros", "Centros")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Gestión de centros del sistema
                </Typography>
              </Box>
            </Box>
            <Button
              onClick={handleNew}
              variant="contained"
              startIcon={<AddIcon sx={{ width: 16, height: 16 }} />}
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
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Búsqueda */}
              <TextField
                size="small"
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1, maxWidth: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ width: 16, height: 16, color: "action.disabled" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Contador */}
              <Chip
                size="small"
                label={`${filteredCentros.length} centros`}
                sx={{
                  height: 24,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  bgcolor: "action.selected",
                  color: "text.secondary",
                }}
                icon={
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      bgcolor: "action.disabled",
                      ml: 1,
                    }}
                  />
                }
              />
            </Box>
          </Box>

          {/* Tabla */}
          {loading ? (
            <LoadingSkeleton />
          ) : filteredCentros.length === 0 ? (
            <EmptyState onClear={() => setSearch("")} hasFilters={!!search} />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell
                      sx={{
                        px: 1.5,
                        py: 1.5,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        width: 100,
                        borderRight: "1px solid",
                        borderRightColor: "divider",
                        borderBottom: "2px solid",
                        borderBottomColor: "divider",
                      }}
                    >
                      Código
                    </TableCell>
                    <TableCell
                      sx={{
                        px: 1.5,
                        py: 1.5,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderRight: "1px solid",
                        borderRightColor: "divider",
                        borderBottom: "2px solid",
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
                        borderRight: "1px solid",
                        borderRightColor: "divider",
                        borderBottom: "2px solid",
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
                        borderRight: "1px solid",
                        borderRightColor: "divider",
                        borderBottom: "2px solid",
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
                        borderBottom: "2px solid",
                        borderBottomColor: "divider",
                      }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCentros.map((centro) => (
                    <CentroRow
                      key={centro.codigo}
                      centro={centro}
                      onEdit={() => handleEdit(centro)}
                      onDelete={() => setDeletingId(centro.codigo)}
                      isDeleting={deletingId === centro.codigo}
                      onCancelDelete={() => setDeletingId(null)}
                      onConfirmDelete={() => handleDelete(centro.codigo)}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Footer */}
          {!loading && filteredCentros.length > 0 && (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: "1px solid",
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Mostrando {filteredCentros.length} de {centros.length} centros
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
          sx: { width: { xs: "100%", sm: 400 } },
        }}
      >
        {/* Header del Drawer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {editingId ? "Editar Centro" : "Nuevo Centro"}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                Código: {editingId}
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon sx={{ width: 20, height: 20 }} />
          </IconButton>
        </Box>

        {/* Contenido del formulario */}
        <Box
          component="form"
          id="centro-form"
          onSubmit={handleSubmit}
          sx={{ p: 3, flex: 1, overflow: "auto" }}
        >
          {error && (
            <Alert severity="error" onClose={() => setError("")} sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Datos básicos */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "text.disabled",
                fontWeight: 600,
                letterSpacing: "0.1em",
                display: "block",
                mb: 2,
              }}
            >
              Datos del Centro
            </Typography>
            <Stack spacing={2.5}>
              <TextField
                label="Código"
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
                label="Nombre"
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
                  <Typography variant="body2" color="text.secondary">
                    Centro activo
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
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
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
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "divider",
              },
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="centro-form"
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
