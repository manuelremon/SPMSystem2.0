/**
 * CatalogoEquivalencias - Catalogo de Materiales Alternativos
 * Migrated to MUI components
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { equivalencias, materiales } from "../services/spm";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import { formatNumber } from "../utils/formatters";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  InputAdornment,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";

// MUI Icons
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 300;

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */
const tipoStyles = {
  E0_DUPLICADO: { bgcolor: "success.lighter", color: "success.dark", label: "Duplicado" },
  E1_ESTRICTA: { bgcolor: "info.lighter", color: "info.dark", label: "Estricta" },
  E2_SUPLIBLE: { bgcolor: "warning.lighter", color: "warning.dark", label: "Suplible" },
};

/* ---------------------------------------------------------------
   Material Search Field Component
--------------------------------------------------------------- */
function MaterialSearchField({ label, value, onChange, results, loading, onSelect, selected, onClear, disabled, color = "primary" }) {
  const { t } = useI18n();
  const textColor = color === "primary" ? "primary.main" : "secondary.main";

  if (disabled) {
    return (
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 600,
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          {label} *
        </Typography>
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            bgcolor: "grey.50",
            border: 1,
            borderColor: "grey.200",
          }}
        >
          <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: textColor }}>
            {value}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (selected) {
    return (
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 600,
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          {label} *
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 1,
            border: 1,
            borderColor: "grey.200",
            bgcolor: "background.paper",
          }}
        >
          <CheckIcon sx={{ fontSize: 20, color: "success.main" }} />
          <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: textColor }}>
            {selected.codigo}
          </Typography>
          <Typography
            sx={{
              flex: 1,
              fontSize: "0.875rem",
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected.descripcion}
          </Typography>
          <IconButton size="small" onClick={onClear} aria-label={t("common_limpiar", "Limpiar")} sx={{ color: "grey.400", "&:hover": { color: "grey.600" } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 600,
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {label} *
      </Typography>
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('materials_equivalencias_search_placeholder', 'Buscar material...')}
        InputProps={{
          endAdornment: loading ? (
            <InputAdornment position="end">
              <CircularProgress size={16} color="primary" />
            </InputAdornment>
          ) : null,
        }}
      />
      {results.length > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: "absolute",
            zIndex: 20,
            width: "100%",
            mt: 0.5,
            maxHeight: 192,
            overflow: "auto",
          }}
        >
          <List disablePadding>
            {results.map((mat) => (
              <ListItemButton
                key={mat.codigo}
                onClick={() => onSelect(mat)}
                sx={{
                  borderBottom: 1,
                  borderColor: "grey.100",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <ListItemText
                  primary={
                    <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: textColor }}>
                      {mat.codigo}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {mat.descripcion}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

/* ---------------------------------------------------------------
   Form Modal Component
--------------------------------------------------------------- */
function FormModal({
  open,
  onClose,
  editingId,
  formData,
  setFormData,
  formError,
  setFormError,
  formLoading,
  onSubmit,
  // Material search props
  searchOriginal,
  setSearchOriginal,
  originalResults,
  loadingOriginal,
  selectedOriginal,
  selectOriginal,
  clearOriginal,
  searchEquivalente,
  setSearchEquivalente,
  equivalenteResults,
  loadingEquivalente,
  selectedEquivalente,
  selectEquivalente,
  clearEquivalente,
  t,
}) {
  const isEditing = editingId !== null;

  const getCompatibilityColor = (value) => {
    if (value >= 80) return "success.main";
    if (value >= 50) return "warning.main";
    return "error.main";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "grey.200",
          py: 2,
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {isEditing
            ? t("equivalencias_editar_titulo", "Editar equivalencia")
            : t("equivalencias_crear_titulo", "Nueva equivalencia")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common_cerrar", "Cerrar")} sx={{ color: "grey.400" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={onSubmit}>
        <DialogContent sx={{ py: 3 }}>
          <Stack spacing={3}>
            {/* Form Error */}
            {formError && (
              <Alert severity="error" onClose={() => setFormError("")}>
                {formError}
              </Alert>
            )}

            {/* Materials Row */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
              }}
            >
              <MaterialSearchField
                label={t("equivalencias_material_original", "Material original")}
                value={isEditing ? formData.codigo_original : searchOriginal}
                onChange={setSearchOriginal}
                results={originalResults}
                loading={loadingOriginal}
                onSelect={selectOriginal}
                selected={selectedOriginal}
                onClear={clearOriginal}
                disabled={isEditing}
                color="primary"
              />
              <MaterialSearchField
                label={t("equivalencias_material_equivalente", "Material equivalente")}
                value={isEditing ? formData.codigo_equivalente : searchEquivalente}
                onChange={setSearchEquivalente}
                results={equivalenteResults}
                loading={loadingEquivalente}
                onSelect={selectEquivalente}
                selected={selectedEquivalente}
                onClear={clearEquivalente}
                disabled={isEditing}
                color="secondary"
              />
            </Box>

            {/* Compatibilidad Slider */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  color: "text.secondary",
                  mb: 1,
                }}
              >
                {t("equivalencias_compatibilidad", "Porcentaje de compatibilidad")} *
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Slider
                  value={formData.compatibilidad_pct}
                  onChange={(e, value) => setFormData((prev) => ({ ...prev, compatibilidad_pct: value }))}
                  min={0}
                  max={100}
                  sx={{ flex: 1, minWidth: 160 }}
                />
                <TextField
                  size="small"
                  type="number"
                  value={formData.compatibilidad_pct}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      compatibilidad_pct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                    }))
                  }
                  inputProps={{ min: 0, max: 100 }}
                  sx={{ width: 80 }}
                />
                <Typography sx={{ fontWeight: 700, color: getCompatibilityColor(formData.compatibilidad_pct), minWidth: 48 }}>
                  {formData.compatibilidad_pct}%
                </Typography>
              </Box>
            </Box>

            {/* Descripcion */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("equivalencias_descripcion", "Descripción")}
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={formData.descripcion}
                onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder={t("equivalencias_desc_placeholder", "Descripción de la equivalencia...")}
              />
            </Box>

            {/* Notas */}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("equivalencias_notas", "Notas")}
              </Typography>
              <TextField
                size="small"
                fullWidth
                multiline
                rows={2}
                value={formData.notas}
                onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
                placeholder={t("equivalencias_notas_placeholder", "Notas adicionales...")}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
          <Button onClick={onClose} disabled={formLoading} color="inherit" sx={{ textTransform: "none" }}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={formLoading || (!isEditing && (!formData.codigo_original || !formData.codigo_equivalente))}
            startIcon={formLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: "none" }}
          >
            {formLoading ? t("common_guardando", "Guardando...") : isEditing ? t('common_actualizar', 'Actualizar') : t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------
   Delete Modal Component
--------------------------------------------------------------- */
function DeleteModal({ open, item, onClose, onConfirm, loading }) {
  const { t } = useI18n();
  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "grey.200",
          color: "error.main",
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {t('equiv_eliminar_titulo', 'Eliminar equivalencia')}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common_cerrar", "Cerrar")} sx={{ color: "grey.400" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("equiv_eliminar_pregunta", "¿Eliminar la equivalencia entre")}{" "}
          <Box component="strong" sx={{ fontFamily: "monospace", color: "primary.main" }}>
            {item.codigo_original}
          </Box>{" "}
          {t("equiv_y", "y")}{" "}
          <Box component="strong" sx={{ fontFamily: "monospace", color: "secondary.main" }}>
            {item.codigo_equivalente}
          </Box>
          ?
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "grey.200", bgcolor: "grey.50" }}>
        <Button onClick={onClose} disabled={loading} color="inherit" sx={{ textTransform: "none" }}>
          {t('common_cancelar', 'Cancelar')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none" }}
        >
          {loading ? t("common_eliminando", "Eliminando...") : t('common_eliminar', 'Eliminar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------------------------------------------------------
   Main Component
--------------------------------------------------------------- */
export default function CatalogoEquivalencias() {
  const { t } = useI18n();
  const { user } = useAuthStore();

  const canManage =
    user?.rol?.toLowerCase().includes("admin") ||
    user?.rol?.toLowerCase().includes("planificador");

  // Search state
  const [searchCodigo, setSearchCodigo] = useState("");
  const [searchDesc, setSearchDesc] = useState("");
  const [searchTipo, setSearchTipo] = useState("");
  const [tiposOptions, setTiposOptions] = useState([]);

  const debouncedCodigo = useDebouncedValue(searchCodigo, DEBOUNCE_MS);
  const debouncedDesc = useDebouncedValue(searchDesc, DEBOUNCE_MS);

  // Results state
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [success, setSuccess] = useState("");
  const [pagination, setPagination] = useState({ total: 0, offset: 0, hasMore: false });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    codigo_original: "",
    codigo_equivalente: "",
    compatibilidad_pct: 80,
    descripcion: "",
    notas: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Material search for form
  const [searchOriginal, setSearchOriginal] = useState("");
  const [searchEquivalente, setSearchEquivalente] = useState("");
  const [originalResults, setOriginalResults] = useState([]);
  const [equivalenteResults, setEquivalenteResults] = useState([]);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingEquivalente, setLoadingEquivalente] = useState(false);
  const [selectedOriginal, setSelectedOriginal] = useState(null);
  const [selectedEquivalente, setSelectedEquivalente] = useState(null);

  const debouncedOriginal = useDebouncedValue(searchOriginal, DEBOUNCE_MS);
  const debouncedEquivalente = useDebouncedValue(searchEquivalente, DEBOUNCE_MS);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });

  // Load tipos de equivalencia
  useEffect(() => {
    equivalencias.tipos()
      .then((res) => setTiposOptions(res.data?.data || []))
      .catch(() => setTiposOptions([]));
  }, []);

  // Load equivalencias
  const loadEquivalencias = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setLoadError(false);

      try {
        const res = await equivalencias.listar({
          codigo: debouncedCodigo,
          descripcion: debouncedDesc,
          tipo: searchTipo || "",
          limit: PAGE_SIZE,
          offset,
        });
        const data = res.data;
        const rows = data?.data || data?.items || data;

        setResults(
          (Array.isArray(rows) ? rows : []).map((eq, idx) => ({
            ...eq,
            _id: eq.id ?? idx,
          }))
        );
        setPagination({
          total: data.pagination?.total || 0,
          offset: data.pagination?.offset || 0,
          hasMore: data.pagination?.has_more || false,
        });
      } catch {
        // Un único estado de error amigable en lugar de banner + "sin datos"
        setLoadError(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [debouncedCodigo, debouncedDesc, searchTipo]
  );

  useEffect(() => {
    loadEquivalencias(0);
  }, [loadEquivalencias]);

  // Search materials for form (original)
  useEffect(() => {
    if (!debouncedOriginal.trim()) {
      setOriginalResults([]);
      return;
    }

    setLoadingOriginal(true);
    materiales
      .buscar({ descripcion: debouncedOriginal, limit: 10 })
      .then((res) => setOriginalResults(res.data?.data || res.data || []))
      .catch(() => setOriginalResults([]))
      .finally(() => setLoadingOriginal(false));
  }, [debouncedOriginal]);

  // Search materials for form (equivalente)
  useEffect(() => {
    if (!debouncedEquivalente.trim()) {
      setEquivalenteResults([]);
      return;
    }

    setLoadingEquivalente(true);
    materiales
      .buscar({ descripcion: debouncedEquivalente, limit: 10 })
      .then((res) => setEquivalenteResults(res.data?.data || res.data || []))
      .catch(() => setEquivalenteResults([]))
      .finally(() => setLoadingEquivalente(false));
  }, [debouncedEquivalente]);

  // Auto-dismiss success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handlers - definidos antes de los cell renderers que los usan
  const resetForm = useCallback(() => {
    setFormData({
      codigo_original: "",
      codigo_equivalente: "",
      compatibilidad_pct: 80,
      descripcion: "",
      notas: "",
    });
    setSearchOriginal("");
    setSearchEquivalente("");
    setOriginalResults([]);
    setEquivalenteResults([]);
    setSelectedOriginal(null);
    setSelectedEquivalente(null);
    setFormError("");
  }, []);

  const openCreateModal = useCallback(() => {
    resetForm();
    setEditingId(null);
    setShowForm(true);
  }, [resetForm]);

  const openEditModal = useCallback((eq) => {
    setEditingId(eq.id);
    setFormData({
      codigo_original: eq.codigo_original,
      codigo_equivalente: eq.codigo_equivalente,
      compatibilidad_pct: eq.compatibilidad_pct,
      descripcion: eq.descripcion || "",
      notas: eq.notas || "",
    });
    setShowForm(true);
  }, []);

  // Columns - AG Grid format con cellRenderer inline para evitar problemas de orden
  const columnDefs = useMemo(
    () => [
      {
        field: "codigo_original",
        headerName: t('equiv_material_original', 'Material original'),
        flex: 1,
        minWidth: 220,
        cellRenderer: (params) => (
          <Box sx={{ py: 0.5 }}>
            <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: "primary.main", fontSize: "0.875rem" }}>
              {params.value}
            </Typography>
            {params.data.descripcion_original && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {params.data.descripcion_original}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: "arrow",
        headerName: "",
        width: 50,
        maxWidth: 50,
        sortable: false,
        filter: false,
        cellRenderer: () => <ArrowForwardIcon sx={{ fontSize: 16, color: "grey.400" }} />,
        cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" },
      },
      {
        field: "codigo_equivalente",
        headerName: t('equiv_material_equivalente', 'Material equivalente'),
        flex: 1,
        minWidth: 220,
        cellRenderer: (params) => (
          <Box sx={{ py: 0.5 }}>
            <Typography sx={{ fontFamily: "monospace", fontWeight: 600, color: "secondary.main", fontSize: "0.875rem" }}>
              {params.value}
            </Typography>
            {params.data.descripcion_equivalente && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {params.data.descripcion_equivalente}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: "tipo_equivalencia",
        headerName: t('common_tipo', 'Tipo'),
        width: 140,
        maxWidth: 140,
        cellRenderer: (params) => {
          const style = tipoStyles[params.value] || { bgcolor: "grey.100", color: "grey.600", label: params.value || "-" };
          return (
            <Chip
              label={tipoStyles[params.value] ? t(`equiv_tipo_${params.value.toLowerCase()}`, style.label) : style.label}
              size="small"
              sx={{
                bgcolor: style.bgcolor,
                color: style.color,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
          );
        },
        cellStyle: { display: "flex", alignItems: "center" },
      },
      ...(canManage
        ? [
            {
              field: "acciones",
              headerName: t('common_acciones', 'Acciones'),
              width: 110,
              maxWidth: 110,
              sortable: false,
              filter: false,
              cellRenderer: (params) => (
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title={t('common_editar', 'Editar')}>
                    <IconButton
                      size="small"
                      aria-label={t('common_editar', 'Editar')}
                      onClick={() => openEditModal(params.data)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common_eliminar', 'Eliminar')}>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={t('common_eliminar', 'Eliminar')}
                      onClick={() => setDeleteDialog({ open: true, item: params.data })}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ),
              cellStyle: { display: "flex", alignItems: "center" },
            },
          ]
        : []),
    ],
    [canManage, openEditModal, t]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setFormError("");
      setFormLoading(true);

      try {
        if (editingId !== null) {
          await equivalencias.actualizar(editingId, {
            compatibilidad_pct: formData.compatibilidad_pct,
            descripcion: formData.descripcion,
            notas: formData.notas,
          });
          setSuccess(t("equivalencias_actualizada", "Equivalencia actualizada correctamente"));
        } else {
          await equivalencias.crear({
            codigo_original: formData.codigo_original,
            codigo_equivalente: formData.codigo_equivalente,
            compatibilidad_pct: formData.compatibilidad_pct,
            descripcion: formData.descripcion,
            notas: formData.notas,
          });
          setSuccess(t("equivalencias_creada", "Equivalencia creada correctamente"));
        }

        setShowForm(false);
        resetForm();
        loadEquivalencias(0);
      } catch (err) {
        setFormError(err.response?.data?.error?.message || t("equivalencias_error_guardar", "No se pudo guardar la equivalencia. Intenta nuevamente."));
      } finally {
        setFormLoading(false);
      }
    },
    [formData, editingId, resetForm, loadEquivalencias, t]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteDialog.item) return;
    setFormLoading(true);

    try {
      await equivalencias.eliminar(deleteDialog.item.id);
      setSuccess(t("equivalencias_eliminada", "Equivalencia eliminada correctamente"));
      setDeleteDialog({ open: false, item: null });
      loadEquivalencias(0);
    } catch (err) {
      setError(err.response?.data?.error?.message || t("equivalencias_error_eliminar", "No se pudo eliminar la equivalencia. Intenta nuevamente."));
      setDeleteDialog({ open: false, item: null });
    } finally {
      setFormLoading(false);
    }
  }, [deleteDialog.item, loadEquivalencias, t]);

  const selectOriginal = useCallback((mat) => {
    setSelectedOriginal(mat);
    setFormData((prev) => ({ ...prev, codigo_original: mat.codigo }));
    setSearchOriginal("");
    setOriginalResults([]);
  }, []);

  const selectEquivalente = useCallback((mat) => {
    setSelectedEquivalente(mat);
    setFormData((prev) => ({ ...prev, codigo_equivalente: mat.codigo }));
    setSearchEquivalente("");
    setEquivalenteResults([]);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchCodigo("");
    setSearchDesc("");
    setSearchTipo("");
  }, []);

  const hasFilters = searchCodigo || searchDesc || searchTipo;

  return (
    <PageLayout
      title={t("equivalencias_titulo", "Catálogo de materiales alternativos")}
      subtitle={t("equivalencias_subtitulo", "Gestiona equivalencias y materiales sustitutos")}
      actions={canManage ? (
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateModal} sx={{ textTransform: "none" }}>
          {t('equiv_nueva', 'Nueva equivalencia')}
        </Button>
      ) : null}
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

        {/* Search Card */}
        <Paper elevation={0} sx={{ border: 1, borderColor: "grey.200", p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
            {/* Codigo SAP */}
            <Box sx={{ minWidth: 150, flex: { xs: 1, md: "0 0 auto" } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("equivalencias_codigo", "Código SAP")}
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={searchCodigo}
                onChange={(e) => setSearchCodigo(e.target.value)}
                placeholder={t('materials_catalogo_codigo_example', 'Ej: 100012345')}
                InputProps={{ sx: { fontFamily: "monospace" } }}
              />
            </Box>

            {/* Descripcion */}
            <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("equivalencias_descripcion", "Descripción")}
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={searchDesc}
                onChange={(e) => setSearchDesc(e.target.value)}
                placeholder={t("equivalencias_buscar_desc", "Buscar por descripción...")}
              />
            </Box>

            {/* Tipo Equivalencia */}
            <Box sx={{ minWidth: 180, flex: { xs: 1, md: "0 0 auto" } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("equivalencias_tipo", "Tipo de equivalencia")}
              </Typography>
              <FormControl size="small" fullWidth>
                <Select
                  value={searchTipo}
                  onChange={(e) => setSearchTipo(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">{t("equivalencias_todos_tipos", "Todos")}</MenuItem>
                  {tiposOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Results & Clear */}
            {!loading && hasFilters && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`${formatNumber(pagination.total)} ${t("common_resultados", "resultados")}`}
                  size="small"
                  sx={{
                    bgcolor: pagination.total > 0 ? "primary.lighter" : "grey.100",
                    color: pagination.total > 0 ? "primary.main" : "text.secondary",
                    fontWeight: 500,
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                  sx={{ textTransform: "none" }}
                >
                  {t("common_limpiar", "Limpiar")}
                </Button>
              </Stack>
            )}
          </Box>
        </Paper>

        {/* DataGrid Card */}
        <Paper elevation={0} sx={{ border: 1, borderColor: "grey.200", height: 550 }}>
          {loadError && !loading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <EmptyState
                icon={<ErrorOutlineIcon sx={{ fontSize: 32, color: "error.main" }} />}
                title={t("equivalencias_error_carga", "No pudimos cargar las equivalencias")}
                description={t("equivalencias_error_carga_desc", "Ocurrió un error al consultar la información. Intenta nuevamente en unos minutos.")}
                action={t("common_reintentar", "Reintentar")}
                onAction={() => loadEquivalencias(0)}
              />
            </Box>
          ) : results.length === 0 && !loading ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                py: 8,
              }}
            >
              <SwapHorizIcon sx={{ fontSize: 48, color: "grey.300", mb: 2 }} />
              <Typography variant="body1" sx={{ color: "text.secondary", textAlign: "center", mb: 2 }}>
                {hasFilters
                  ? t("equivalencias_sin_resultados", "No se encontraron equivalencias con los criterios de búsqueda")
                  : t("equivalencias_vacio", "No hay equivalencias registradas")}
              </Typography>
              {canManage && !hasFilters && (
                <Button variant="outlined" size="small" onClick={openCreateModal} sx={{ textTransform: "none" }}>
                  {t('equiv_crear_primera', 'Crear la primera equivalencia')}
                </Button>
              )}
            </Box>
          ) : (
            <SPMAgGrid
              rowData={results}
              columnDefs={columnDefs}
              loading={loading}
              height="100%"
              pagination={true}
              paginationPageSize={20}
              paginationPageSizeSelector={[20, 50, 100]}
              enableQuickFilter={true}
              exportFileName="equivalencias"
              emptyMessage={t("equivalencias_sin_resultados", "No se encontraron equivalencias")}
              gridOptions={{
                getRowId: (params) => String(params.data._id),
                rowHeight: 60,
                headerHeight: 48,
              }}
            />
          )}
        </Paper>

        {/* Form Modal */}
        <FormModal
          open={showForm}
          onClose={() => setShowForm(false)}
          editingId={editingId}
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          setFormError={setFormError}
          formLoading={formLoading}
          onSubmit={handleSubmit}
          searchOriginal={searchOriginal}
          setSearchOriginal={setSearchOriginal}
          originalResults={originalResults}
          loadingOriginal={loadingOriginal}
          selectedOriginal={selectedOriginal}
          selectOriginal={selectOriginal}
          clearOriginal={() => {
            setSelectedOriginal(null);
            setFormData((prev) => ({ ...prev, codigo_original: "" }));
          }}
          searchEquivalente={searchEquivalente}
          setSearchEquivalente={setSearchEquivalente}
          equivalenteResults={equivalenteResults}
          loadingEquivalente={loadingEquivalente}
          selectedEquivalente={selectedEquivalente}
          selectEquivalente={selectEquivalente}
          clearEquivalente={() => {
            setSelectedEquivalente(null);
            setFormData((prev) => ({ ...prev, codigo_equivalente: "" }));
          }}
          t={t}
        />

        {/* Delete Modal */}
        <DeleteModal
          open={deleteDialog.open}
          item={deleteDialog.item}
          onClose={() => setDeleteDialog({ open: false, item: null })}
          onConfirm={handleDelete}
          loading={formLoading}
        />
    </PageLayout>
  );
}
