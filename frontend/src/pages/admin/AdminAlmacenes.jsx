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
  FormControlLabel,
  Checkbox,
  Alert,
  Skeleton,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
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
import WarehouseIcon from "@mui/icons-material/Warehouse";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

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
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 0,
        },
      }}
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
        borderRadius: 0,
        '& .MuiAlert-message': {
          fontSize: '0.875rem',
        },
      }}
    >
      {children}
    </Alert>
  );
}

function LoadingSkeleton() {
  return (
    <Box>
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ width: 100, px: 1.5, py: 2 }}>
            <Skeleton variant="text" height={20} />
          </Box>
          <Box sx={{ flex: 1, px: 1.5, py: 2 }}>
            <Skeleton variant="text" height={20} width="75%" />
          </Box>
          <Box sx={{ width: 100, px: 1.5, py: 2 }}>
            <Skeleton variant="text" height={20} width="50%" sx={{ mx: 'auto' }} />
          </Box>
          <Box sx={{ width: 150, px: 1.5, py: 2 }}>
            <Skeleton variant="text" height={20} width="66%" sx={{ mx: 'auto' }} />
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
  const { t } = useI18n();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        color: 'text.secondary',
      }}
    >
      <WarehouseIcon sx={{ fontSize: 48, mb: 1.5, color: 'action.disabled' }} />
      <Typography variant="body2" fontWeight={500}>
        {t('admin_no_results', 'No se encontraron almacenes')}
      </Typography>
      {hasFilters && (
        <Button
          size="small"
          onClick={onClear}
          sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
        >
          {t('admin_clear_search', 'Limpiar busqueda')}
        </Button>
      )}
    </Box>
  );
}

function AlmacenRow({ almacen, onEdit, onDelete, isDeleting, onCancelDelete, onConfirmDelete }) {
  const { t } = useI18n();
  const isActivo = almacen.activo === 1 || almacen.activo === true;

  if (isDeleting) {
    return (
      <TableRow
        sx={{
          bgcolor: 'error.lighter',
          borderLeft: '4px solid',
          borderLeftColor: 'error.main',
        }}
      >
        <TableCell colSpan={5} sx={{ py: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.dark' }}>
              <WarningAmberIcon sx={{ fontSize: 20 }} />
              <Typography variant="body2" fontWeight={500}>
                Eliminar el almacen <strong>{almacen.codigo}</strong>?
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={onCancelDelete}
                sx={{
                  borderRadius: 0,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {t('common_cancelar', 'Cancelar')}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={onConfirmDelete}
                sx={{
                  borderRadius: 0,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {t('common_eliminar', 'Eliminar')}
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
        cursor: 'pointer',
        '&:hover': {
          bgcolor: 'action.hover',
        },
        '&:hover .delete-btn': {
          opacity: 1,
        },
      }}
    >
      <TableCell
        sx={{
          borderRight: '1px solid',
          borderColor: 'divider',
          py: 1.25,
          px: 1.5,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            color: 'text.secondary',
          }}
        >
          {almacen.codigo}
        </Typography>
      </TableCell>
      <TableCell
        sx={{
          borderRight: '1px solid',
          borderColor: 'divider',
          py: 1.25,
          px: 1.5,
        }}
      >
        <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8125rem' }}>
          {almacen.nombre || "—"}
        </Typography>
      </TableCell>
      <TableCell
        align="center"
        sx={{
          borderRight: '1px solid',
          borderColor: 'divider',
          py: 1.25,
          px: 1.5,
        }}
      >
        <Chip
          size="small"
          label={isActivo ? t('common_activo', 'Activo') : t('common_inactivo', 'Inactivo')}
          sx={{
            height: 20,
            fontSize: '0.625rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            bgcolor: isActivo ? 'success.lighter' : 'action.disabledBackground',
            color: isActivo ? 'success.dark' : 'text.disabled',
            '& .MuiChip-label': {
              px: 1,
            },
          }}
          icon={
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: isActivo ? 'success.main' : 'action.disabled',
                ml: 0.5,
              }}
            />
          }
        />
      </TableCell>
      <TableCell
        align="center"
        sx={{
          borderRight: '1px solid',
          borderColor: 'divider',
          py: 1.25,
          px: 1.5,
        }}
      >
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {almacen.created_at || "—"}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ py: 1.25, px: 1 }}>
        <IconButton
          size="small"
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{
            opacity: 0,
            transition: 'opacity 0.15s, color 0.15s',
            color: 'action.disabled',
            '&:hover': {
              color: 'error.main',
              bgcolor: 'error.lighter',
            },
          }}
          aria-label={t("aria_delete", "Eliminar")}
        >
          <DeleteIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const initialForm = { codigo: "", nombre: "", activo: 1 };

export default function AdminAlmacenes() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [almacenes, setAlmacenes] = useState([]);
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

  const filteredAlmacenes = useMemo(() => {
    if (!search) return almacenes;
    const term = search.toLowerCase();
    return almacenes.filter(a => a.codigo?.toLowerCase().includes(term) || a.nombre?.toLowerCase().includes(term));
  }, [almacenes, search]);

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
        setSuccess(t("crud_record_updated", "Almacen actualizado correctamente"));
      } else {
        await admin.create("almacenes", form);
        setSuccess(t("crud_record_created", "Almacen creado correctamente"));
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
      setSuccess(t("crud_record_deleted", "Almacen eliminado correctamente"));
      setDeletingId(null);
      await loadAlmacenes();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [loadAlmacenes, t]);

  
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(
        filteredAlmacenes,
        "almacenes",
        "Almacenes"
      );
      setSuccess("Almacenes exportados correctamente");
    } catch (err) {
      setError(err.message || "Error al exportar almacenes");
    } finally {
      setExporting(false);
    }
  };

return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper
        elevation={1}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderRadius: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ maxWidth: 1600, mx: 'auto', px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <IconButton
                onClick={() => navigate("/admin")}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'text.primary',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'text.primary',
                  }}
                >
                  {t("admin_almacenes", "Almacenes")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin_almacenes_subtitle', 'Gestion de almacenes del sistema')}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNew}
              sx={{
                borderRadius: 0,
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
              }}
            >
              {t('common_nuevo', 'Nuevo')}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Contenido */}
      <Box sx={{ maxWidth: 1600, mx: 'auto', px: 2, py: 2 }}>
        {error && (
          <Box sx={{ mb: 2 }}>
            <AlertMessage type="error" onClose={() => setError("")}>{error}</AlertMessage>
          </Box>
        )}
        {success && (
          <Box sx={{ mb: 2 }}>
            <AlertMessage type="success" onClose={() => setSuccess("")}>{success}</AlertMessage>
          </Box>
        )}

        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
          {/* Filtros */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                size="small"
                placeholder={t('admin_search_placeholder', 'Buscar por codigo o nombre...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{
                  flex: 1,
                  maxWidth: 400,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 0,
                    bgcolor: 'background.paper',
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'action.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Chip
                size="small"
                label={`${filteredAlmacenes.length} almacenes`}
                sx={{
                  borderRadius: 0,
                  height: 24,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  bgcolor: 'action.selected',
                  color: 'text.secondary',
                }}
                icon={
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      bgcolor: 'action.disabled',
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
          ) : filteredAlmacenes.length === 0 ? (
            <EmptyState onClear={() => setSearch("")} hasFilters={!!search} />
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell
                      sx={{
                        width: 100,
                        py: 1.5,
                        px: 1.5,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'text.secondary',
                        borderRight: '1px solid',
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {t('common_codigo', 'Código')}
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.5,
                        px: 1.5,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'text.secondary',
                        borderRight: '1px solid',
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {t('common_nombre', 'Nombre')}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        width: 100,
                        py: 1.5,
                        px: 1.5,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'text.secondary',
                        borderRight: '1px solid',
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {t('common_estado', 'Estado')}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        width: 150,
                        py: 1.5,
                        px: 1.5,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'text.secondary',
                        borderRight: '1px solid',
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {t('common_creado', 'Creado')}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        width: 50,
                        py: 1.5,
                        px: 1,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAlmacenes.map((almacen) => (
                    <AlmacenRow
                      key={almacen.codigo}
                      almacen={almacen}
                      onEdit={() => handleEdit(almacen)}
                      onDelete={() => setDeletingId(almacen.codigo)}
                      isDeleting={deletingId === almacen.codigo}
                      onCancelDelete={() => setDeletingId(null)}
                      onConfirmDelete={() => handleDelete(almacen.codigo)}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {!loading && filteredAlmacenes.length > 0 && (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Mostrando {filteredAlmacenes.length} de {almacenes.length} almacenes
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
          sx: {
            width: { xs: '100%', sm: 400 },
            borderRadius: 0,
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
            <Typography variant="subtitle1" fontWeight={700}>
              {editingId ? `${t('common_editar', 'Editar')} Almacen` : `${t('common_nuevo', 'Nuevo')} Almacen`}
            </Typography>
            {editingId && (
              <Typography variant="caption" color="text.secondary">
                Codigo: {editingId}
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
              variant="overline"
              sx={{
                display: 'block',
                mb: 2,
                color: 'text.disabled',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
            >
              {t('admin_datos_almacen', 'Datos del Almacen')}
            </Typography>
            <Stack spacing={2.5}>
              <FormInput
                label={t('common_codigo', 'Código')}
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                required
                disabled={!!editingId}
                placeholder="Ej: ALM001"
              />
              <FormInput
                label={t('common_nombre', 'Nombre')}
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Nombre del almacen"
              />
              <FormCheckbox
                label={t('admin_almacen_activo', 'Almacen activo')}
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
              borderRadius: 0,
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
              borderRadius: 0,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {submitting ? t('common_guardando', 'Guardando...') : t('common_guardar', 'Guardar')}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
