/**
 * AdminCrudTemplate - Template CRUD generico para paginas de administracion
 * Migrado a Material UI
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import { admin } from "../services/spm";
import { SPMAgGrid } from "./ui/SPMAgGrid";
import { ConfirmModal } from "./ui/ConfirmModal";
import { useI18n } from "../context/i18n";
import { useDebounced } from "../hooks/useDebounced";

const PAGE_SIZE = 20;

export default function AdminCrudTemplate({
  title,
  resource,
  columns,
  fields,
  idKey = "id",
  parseList,
  transformSubmit,
  customUpdate,
  hideCardTitle = true,
  hideDescription = false,
  exportFileName,
}) {
  const { t } = useI18n();
  const initialForm = useMemo(() => {
    const base = {};
    fields.forEach((f) => {
      base[f.name] = f.defaultValue ?? "";
    });
    return base;
  }, [fields]);

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState({ open: false, row: null });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await admin.list(resource);
      const data = parseList ? parseList(res.data) : res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message));
    } finally {
      setLoading(false);
    }
  }, [resource, parseList]);

  const validateRequired = useCallback(() => {
    const missing = fields.filter(
      (f) => f.required && (form[f.name] === "" || form[f.name] === undefined || form[f.name] === null)
    );
    if (missing.length > 0) {
      setError(`${t("admin_required_fields", "Faltan campos obligatorios")}: ${missing.map((m) => m.label).join(", ")}`);
      return false;
    }
    return true;
  }, [fields, form, t]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateRequired()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload = transformSubmit ? transformSubmit(form) : form;
      if (editingId) {
        if (customUpdate) {
          await customUpdate(editingId, payload);
        } else {
          await admin.update(resource, editingId, payload);
        }
        setSuccess(t("crud_record_updated", "Registro actualizado correctamente"));
      } else {
        await admin.create(resource, payload);
        setSuccess(t("crud_record_created", "Registro creado correctamente"));
      }
      setShowForm(false);
      setForm(initialForm);
      setEditingId(null);
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message));
    } finally {
      setLoading(false);
    }
  }, [validateRequired, form, editingId, customUpdate, resource, transformSubmit, initialForm, loadData, t]);

  const handleEdit = useCallback((row) => {
    setEditingId(row[idKey]);
    const base = { ...initialForm };
    Object.keys(base).forEach((k) => {
      let value = row[k] ?? "";

      // Si el valor es un string JSON, intentar parsearlo
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value);
        } catch {
          // Si falla el parse, mantener el valor original
        }
      }

      base[k] = value;
    });
    setForm(base);
    setShowForm(true);
    setError("");
    setSuccess("");
  }, [idKey, initialForm]);

  const handleDelete = useCallback((row) => {
    setDeleteModal({ open: true, row });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteModal.row) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await admin.remove(resource, deleteModal.row[idKey]);
      setSuccess(t("crud_record_deleted", "Registro eliminado correctamente"));
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      const err = e.response?.data?.error;
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message));
    } finally {
      setLoading(false);
      setDeleteModal({ open: false, row: null });
    }
  }, [deleteModal.row, resource, idKey, loadData, t]);

  const handleNew = useCallback(() => {
    setShowForm(true);
    setForm(initialForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  }, [initialForm]);

  // Filtrado
  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      return columns.some((col) => {
        const value = item[col.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [items, debouncedQ, columns]);

  // Paginacion
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Reset pagina cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ]);

  // Columnas de la tabla con acciones (formato AG Grid)
  const columnDefs = useMemo(() => [
    ...columns.map((col) => ({
      field: col.key,
      headerName: col.label,
      cellRenderer: col.render ? (params) => col.render(params.data) : undefined,
    })),
    {
      field: "acciones",
      headerName: t("common_acciones", "Acciones"),
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <Stack direction="row" spacing={0.5} justifyContent="center" role="group" aria-label={`${t("common_acciones", "Acciones")} ${params.data[idKey]}`}>
          <Button
            size="small"
            variant="text"
            onClick={() => handleEdit(params.data)}
            aria-label={`${t("crud_edit", "Editar")} ${title} ${params.data[idKey]}`}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              color: "info.main",
              fontSize: "0.75rem",
              minWidth: "auto",
              px: 1,
              "&:hover": { bgcolor: "info.lighter" },
            }}
          >
            {t("crud_edit", "Editar")}
          </Button>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <Button
            size="small"
            variant="text"
            onClick={() => handleDelete(params.data)}
            aria-label={`${t("common_eliminar", "Eliminar")} ${title} ${params.data[idKey]}`}
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
            {t("common_eliminar", "Eliminar")}
          </Button>
        </Stack>
      ),
    },
  ], [columns, t, idKey, title, handleEdit, handleDelete]);

  return (
    <Box sx={{ maxWidth: 1600, mx: "auto", px: 2, py: 1 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ md: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <SettingsIcon sx={{ color: "grey.500" }} />
              <Typography variant="h5" component="h1" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                {title}
              </Typography>
            </Stack>
            {!hideDescription && (
              <Typography variant="body2" color="text.secondary">
                {`${t("crud_manage_catalog", "Gestiona el catalogo de")} ${title.toLowerCase()} ${t("common_del_sistema", "del sistema")}`}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            onClick={handleNew}
            startIcon={<AddIcon />}
            aria-label={`${t("crud_new", "Nuevo")} ${title}`}
          >
            {t("crud_new", "Nuevo")} {title}
          </Button>
        </Stack>
      </Box>

      {/* Mensajes */}
      <Stack spacing={2} sx={{ mb: 2 }}>
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
      </Stack>

      {/* Card principal */}
      <Paper sx={{ overflow: "hidden" }}>
        {!hideCardTitle && (
          <Box sx={{ px: 3, pt: 3, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
          </Box>
        )}

        <Box sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Busqueda */}
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${t("crud_search", "Buscar")} ${title.toLowerCase()}...`}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: "grey.400", mr: 1 }} />,
              }}
            />

            {/* Tabla o loading skeleton */}
            {loading && items.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <SPMAgGrid
                  columnDefs={columnDefs}
                  rowData={paginatedItems}
                  emptyMessage={
                    filtered.length === 0 && items.length > 0
                      ? t("crud_no_results_search", "No hay resultados para la busqueda")
                      : `${t("crud_no_hay", "No hay")} ${title.toLowerCase()} ${t("crud_no_items_created", "creados")}`
                  }
                  pagination={false}
                  enableQuickFilter={true}
                  exportFileName={exportFileName || resource}
                  height={400}
                />

                {/* Paginacion */}
                {totalPages > 1 && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ sm: "center" }}
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t("common_pagina", "Pagina")} {currentPage} {t("common_de", "de")} {totalPages}
                      <Box component="span" sx={{ ml: 1 }}>
                        ({t("common_mostrando", "Mostrando")} {paginatedItems.length} {t("common_de", "de")} {filtered.length})
                      </Box>
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        {t("common_anterior", "Anterior")}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {t("common_siguiente", "Siguiente")}
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* Modal de formulario */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6" component="span">
              {editingId ? `${t("crud_edit", "Editar")} ${title}` : `${t("crud_new", "Nuevo")} ${title}`}
            </Typography>
            {!editingId && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("crud_complete_required", "Completa los campos obligatorios")}
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={() => setShowForm(false)}
            disabled={loading}
            aria-label={t("common_cerrar", "Cerrar")}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box component="form" id="crud-form" onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Formulario con soporte para secciones/dividers */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
              }}
            >
              {fields.map((f) =>
                f.type === "section" ? (
                  <Box key={f.name} sx={{ gridColumn: { md: "span 2" }, pt: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      {f.icon && <f.icon sx={{ color: "primary.main" }} />}
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {f.label}
                        </Typography>
                        {f.description && (
                          <Typography variant="caption" color="text.secondary">
                            {f.description}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                ) : (
                  <Box
                    key={f.name}
                    sx={{
                      gridColumn: f.type === "textarea" || f.fullWidth ? { md: "span 2" } : undefined,
                    }}
                  >
                    {f.type === "textarea" ? (
                      <TextField
                        label={
                          <Box component="span">
                            {f.label}
                            {f.required && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                          </Box>
                        }
                        value={form[f.name] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                        required={f.required}
                        placeholder={f.placeholder}
                        multiline
                        rows={3}
                        disabled={loading}
                        fullWidth
                        size="small"
                      />
                    ) : f.type === "checkbox" ? (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(form[f.name])}
                            onChange={(e) => setForm({ ...form, [f.name]: e.target.checked ? 1 : 0 })}
                            disabled={loading}
                          />
                        }
                        label={
                          <Box component="span">
                            {f.label}
                            {f.required && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                          </Box>
                        }
                      />
                    ) : f.type === "checkbox-group" && f.options ? (
                      <Box>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                          {f.label}
                          {f.required && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={1}>
                            {f.options.map((opt) => {
                              const currentValues = Array.isArray(form[f.name])
                                ? form[f.name]
                                : (typeof form[f.name] === 'string' && form[f.name])
                                  ? JSON.parse(form[f.name])
                                  : [];
                              const isChecked = currentValues.includes(opt.value);

                              return (
                                <FormControlLabel
                                  key={opt.value}
                                  control={
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={(e) => {
                                        let newValues = [...currentValues];
                                        if (e.target.checked) {
                                          if (!newValues.includes(opt.value)) {
                                            newValues.push(opt.value);
                                          }
                                        } else {
                                          newValues = newValues.filter(v => v !== opt.value);
                                        }
                                        setForm({ ...form, [f.name]: newValues });
                                      }}
                                      disabled={loading}
                                      size="small"
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography variant="body2">{opt.label}</Typography>
                                      {opt.description && (
                                        <Typography variant="caption" color="text.secondary">
                                          {opt.description}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                />
                              );
                            })}
                          </Stack>
                          {f.placeholder && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                              {f.placeholder}
                            </Typography>
                          )}
                        </Paper>
                      </Box>
                    ) : f.type === "select" && f.options ? (
                      <FormControl fullWidth size="small">
                        <InputLabel>
                          {f.label}
                          {f.required && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                        </InputLabel>
                        <Select
                          value={form[f.name] ?? ""}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          label={f.label}
                          required={f.required}
                          disabled={loading}
                        >
                          <MenuItem value="">
                            <em>{f.placeholder || `${t("crud_select", "Selecciona")} ${f.label.toLowerCase()}`}</em>
                          </MenuItem>
                          {f.options.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        type={f.type || "text"}
                        label={
                          <Box component="span">
                            {f.label}
                            {f.required && <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>*</Typography>}
                          </Box>
                        }
                        value={form[f.name] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                        required={f.required}
                        placeholder={f.placeholder}
                        disabled={loading}
                        fullWidth
                        size="small"
                      />
                    )}
                  </Box>
                )
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setShowForm(false)}
            disabled={loading}
          >
            {t("common_cancelar", "Cancelar")}
          </Button>
          <Button
            type="submit"
            form="crud-form"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          >
            {loading
              ? t("crud_saving", "Guardando...")
              : editingId
                ? t("crud_update", "Actualizar")
                : t("crud_create", "Crear")
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmacion para eliminar */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, row: null })}
        onConfirm={confirmDelete}
        title={t("common_eliminar", "Eliminar")}
        message={t("crud_confirm_delete_record", "Estas seguro de eliminar este registro?")}
        confirmText={t("common_eliminar", "Eliminar")}
        cancelText={t("common_cancelar", "Cancelar")}
        variant="danger"
        loading={loading}
      />
    </Box>
  );
}
