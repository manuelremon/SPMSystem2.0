import { useEffect, useMemo, useState, useCallback } from "react";
import { admin } from "../services/spm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { SearchInput } from "./ui/SearchInput";
import { DataTable } from "./ui/DataTable";
import { Alert } from "./ui/Alert";
import { PageHeader } from "./ui/PageHeader";
import { ConfirmModal } from "./ui/ConfirmModal";
import { TableSkeleton } from "./ui/Skeleton";
import { Plus, Edit3, Trash2, X, Save, Settings } from "lucide-react";
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
      setError(e.response?.data?.error || e.message);
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
      setError(e.response?.data?.error || e.message);
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
      setError(e.response?.data?.error || e.message);
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

  // Paginación
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Reset página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ]);

  // Columnas de la tabla con acciones
  const tableColumns = useMemo(() => [
    ...columns.map((col) => ({
      key: col.key,
      header: col.label,
      render: col.render,
      sortAccessor: (row) => row[col.key],
    })),
    {
      key: "acciones",
      header: t("common_acciones", "Acciones"),
      render: (row) => (
        <div className="flex gap-1.5" role="group" aria-label={`${t("common_acciones", "Acciones")} ${row[idKey]}`}>
          <Button
            variant="secondary"
            className="px-2.5 py-1.5 text-xs"
            onClick={() => handleEdit(row)}
            aria-label={`${t("crud_edit", "Editar")} ${title} ${row[idKey]}`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="danger"
            className="px-2.5 py-1.5 text-xs"
            onClick={() => handleDelete(row)}
            aria-label={`${t("common_eliminar", "Eliminar")} ${title} ${row[idKey]}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ], [columns, t, idKey, title, handleEdit, handleDelete]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={title}
        description={`${t("crud_manage_catalog", "Gestiona el catálogo de")} ${title.toLowerCase()} ${t("common_del_sistema", "del sistema")}`}
        icon={Settings}
      >
        <Button onClick={handleNew} aria-label={`${t("crud_new", "Nuevo")} ${title}`}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="ml-2">{t("crud_new", "Nuevo")} {title}</span>
        </Button>
      </PageHeader>

      {/* Mensajes */}
      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>}

      {/* Card principal */}
      <Card>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {t("crud_total_records", "Total de registros:")} {filtered.length}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-1 space-y-4">
          {/* Búsqueda */}
          <div className="flex gap-3">
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${t("crud_search", "Buscar")} ${title.toLowerCase()}...`}
              className="flex-1"
            />
          </div>

          {/* Tabla o loading skeleton */}
          {loading && items.length === 0 ? (
            <TableSkeleton rows={5} columns={columns.length + 1} />
          ) : (
            <>
              <DataTable
                columns={tableColumns}
                rows={paginatedItems}
                emptyMessage={
                  filtered.length === 0 && items.length > 0
                    ? t("crud_no_results_search", "No hay resultados para la búsqueda")
                    : `${t("crud_no_hay", "No hay")} ${title.toLowerCase()} ${t("crud_no_items_created", "creados")}`
                }
              />

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  <div className="text-sm text-[var(--fg-muted)]">
                    {t("common_pagina", "Página")} {currentPage} {t("common_de", "de")} {totalPages}
                    <span className="ml-2">
                      ({t("common_mostrando", "Mostrando")} {paginatedItems.length} {t("common_de", "de")} {filtered.length})
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {t("common_anterior", "Anterior")}
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t("common_siguiente", "Siguiente")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="presentation">
          <div
            className="relative w-full max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-strong max-h-[90vh] overflow-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crud-modal-title"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between p-6 border-b border-[var(--border)] bg-[var(--card)]">
              <div className="flex-1">
                <h2 id="crud-modal-title" className="text-xl font-semibold text-[var(--fg-strong)]">
                  {editingId ? `${t("crud_edit", "Editar")} ${title}` : `${t("crud_new", "Nuevo")} ${title}`}
                </h2>
                {!editingId && (
                  <p className="text-sm text-[var(--fg-muted)] mt-1">
                    {t("crud_complete_required", "Completa los campos obligatorios")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-shrink-0 ml-4 p-2 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[var(--bg-elevated)] transition-all"
                disabled={loading}
                aria-label={t("common_cerrar", "Cerrar")}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <Alert variant="danger" onDismiss={() => setError("")}>
                  {error}
                </Alert>
              )}

              {/* Formulario con soporte para secciones/dividers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((f) =>
                  f.type === "section" ? (
                    <div key={f.name} className="md:col-span-2 pt-4 first:pt-0">
                      <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                        {f.icon && <f.icon className="w-5 h-5 text-[var(--primary)]" />}
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--fg-strong)] uppercase tracking-wide">
                            {f.label}
                          </h3>
                          {f.description && (
                            <p className="text-xs text-[var(--fg-muted)] mt-0.5">{f.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                    key={f.name}
                    className={f.type === "textarea" || f.fullWidth ? "md:col-span-2" : ""}
                  >
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--fg)]">
                        {f.label}
                        {f.required && <span className="text-[var(--danger)] ml-1">*</span>}
                      </span>
                      {f.type === "textarea" ? (
                        <textarea
                          className="mt-2 w-full px-4 py-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)] focus:outline-none transition-all duration-200 resize-none"
                          value={form[f.name] ?? ""}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          required={f.required}
                          placeholder={f.placeholder}
                          rows={3}
                          disabled={loading}
                        />
                      ) : f.type === "checkbox" ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-offset-0"
                            checked={Boolean(form[f.name])}
                            onChange={(e) => setForm({ ...form, [f.name]: e.target.checked ? 1 : 0 })}
                            disabled={loading}
                          />
                          <span className="text-sm text-[var(--fg-muted)]">{f.placeholder || f.label}</span>
                        </div>
                      ) : f.type === "checkbox-group" && f.options ? (
                        <div className="mt-2 space-y-2 p-3 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)]">
                          {f.options.map((opt) => {
                            const currentValues = Array.isArray(form[f.name])
                              ? form[f.name]
                              : (typeof form[f.name] === 'string' && form[f.name])
                                ? JSON.parse(form[f.name])
                                : [];
                            const isChecked = currentValues.includes(opt.value);

                            return (
                              <div key={opt.value} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-offset-0"
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
                                />
                                <label className="text-sm text-[var(--fg)] cursor-pointer select-none">
                                  {opt.label}
                                  {opt.description && (
                                    <span className="block text-xs text-[var(--fg-muted)] mt-0.5">
                                      {opt.description}
                                    </span>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                          {f.placeholder && (
                            <p className="text-xs text-[var(--fg-subtle)] mt-2 pt-2 border-t border-[var(--border)]">
                              {f.placeholder}
                            </p>
                          )}
                        </div>
                      ) : f.type === "select" && f.options ? (
                        <Select
                          className="mt-2"
                          value={form[f.name] ?? ""}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          required={f.required}
                          disabled={loading}
                        >
                          <option value="">{f.placeholder || `${t("crud_select", "Selecciona")} ${f.label.toLowerCase()}`}</option>
                          {f.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={f.type || "text"}
                          className="mt-2"
                          value={form[f.name] ?? ""}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          required={f.required}
                          placeholder={f.placeholder}
                          disabled={loading}
                        />
                      )}
                    </label>
                  </div>
                )
              )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                  aria-label={t("common_cancelar", "Cancelar")}
                >
                  {t("common_cancelar", "Cancelar")}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  aria-label={editingId ? t("crud_update", "Actualizar") : t("crud_create", "Crear")}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--on-primary)]" aria-hidden="true" />
                      <span className="ml-2">{t("crud_saving", "Guardando...")}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span className="ml-2">{editingId ? t("crud_update", "Actualizar") : t("crud_create", "Crear")}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, row: null })}
        onConfirm={confirmDelete}
        title={t("common_eliminar", "Eliminar")}
        description={t("crud_confirm_delete_record", "¿Estás seguro de eliminar este registro?")}
        confirmText={t("common_eliminar", "Eliminar")}
        cancelText={t("common_cancelar", "Cancelar")}
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
