import { useEffect, useMemo, useState, useCallback } from "react";
import { solicitudes } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/SearchInput";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { DataTable } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatCurrency, formatAlmacen } from "../utils/formatters";
import { useDebounced } from "../hooks/useDebounced";
import { Modal } from "../components/ui/Modal";
import { XCircle, CheckCircle, RefreshCw, Eye, Package } from "lucide-react";
import { getCriticidadConfig } from "../utils/styleConfig";

const DEBOUNCE_MS = 300;

export default function Aprobaciones() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);
  const [msg, setMsg] = useState("");
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, motivo: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, solicitud: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await solicitudes.listar({ estado: "Enviada" });
      const data = res.data.solicitudes || res.data.results || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) => {
      return (
        String(s.id).includes(term) ||
        (s.justificacion || "").toLowerCase().includes(term) ||
        (s.centro || "").toLowerCase().includes(term) ||
        (s.sector || "").toLowerCase().includes(term) ||
        (s.estado || "").toLowerCase().includes(term)
      );
    });
  }, [items, debouncedQ]);

  const aprobar = useCallback(async (id) => {
    setMsg("");
    setError("");
    try {
      await solicitudes.aprobar(id);
      setMsg(t("aprov_aprobada_msg", "Solicitud aprobada y asignada a planificador."));
      setTimeout(() => setMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [load, t]);

  const openRejectModal = useCallback((id) => {
    setRejectModal({ open: true, id, motivo: "" });
  }, []);

  const confirmRechazar = useCallback(async () => {
    if (!rejectModal.id) return;
    setMsg("");
    setError("");
    const motivo = rejectModal.motivo.trim() || "Rechazada";
    try {
      await solicitudes.rechazar(rejectModal.id, motivo);
      setMsg(t("aprov_rechazada_msg", "Solicitud rechazada."));
      setTimeout(() => setMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setRejectModal({ open: false, id: null, motivo: "" });
    }
  }, [rejectModal.id, rejectModal.motivo, load, t]);

  // Abrir modal de detalle
  const openDetailModal = useCallback((solicitud) => {
    setDetailModal({ open: true, solicitud });
  }, []);

  // Definición de columnas para DataTable (memoizadas)
  const columns = useMemo(() => [
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => <span className="font-semibold text-[var(--fg)]">#{row.id}</span>,
    },
    {
      key: "solicitante",
      header: t("aprov_solicitante", "Solicitante"),
      sortAccessor: (row) => `${row.solicitante_nombre || ""} ${row.solicitante_apellido || ""}`.toLowerCase(),
      render: (row) => {
        const nombre = `${row.solicitante_nombre || ""} ${row.solicitante_apellido || ""}`.trim();
        return (
          <span className="text-[var(--fg)]" title={nombre}>
            {nombre || "-"}
          </span>
        );
      },
    },
    {
      key: "centro",
      header: t("aprov_centro", "CENTRO"),
      sortAccessor: (row) => row.centro || "",
      render: (row) => (
        <span className="font-mono text-sm">{row.centro || "-"}</span>
      ),
    },
    {
      key: "almacen",
      header: t("aprov_almacen", "ALMACEN"),
      sortAccessor: (row) => row.almacen_virtual || row.almacen || "",
      render: (row) => (
        <span className="font-mono text-sm">{formatAlmacen(row.almacen_virtual || row.almacen)}</span>
      ),
    },
    {
      key: "sector",
      header: t("aprov_sector", "SECTOR"),
      sortAccessor: (row) => row.sector || "",
      render: (row) => (
        <span className="text-sm">{row.sector || "-"}</span>
      ),
    },
    {
      key: "fecha_creacion",
      header: t("aprov_fecha_creacion", "F. CREACIÓN"),
      sortAccessor: (row) => row.created_at || "",
      render: (row) => {
        const fecha = row.created_at;
        if (!fecha) return <span className="text-sm text-[var(--fg-muted)]">-</span>;
        const d = new Date(fecha);
        return (
          <span className="text-sm text-[var(--fg)]">
            {d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        );
      },
    },
    {
      key: "fecha_necesidad",
      header: t("aprov_fecha_necesidad", "F. NECESIDAD"),
      sortAccessor: (row) => row.fecha_necesidad || "",
      render: (row) => {
        const fecha = row.fecha_necesidad;
        if (!fecha) return <span className="text-sm text-[var(--fg-muted)]">-</span>;
        const d = new Date(fecha);
        return (
          <span className="text-sm text-[var(--fg)]">
            {d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        );
      },
    },
    {
      key: "criticidad",
      header: t("aprov_criticidad", "Criticidad"),
      sortAccessor: (row) => {
        const order = { "Urgente": 0, "Alta": 1, "Normal": 2, "Baja": 3 };
        return order[row.criticidad] ?? 2;
      },
      render: (row) => {
        const config = getCriticidadConfig(row.criticidad);
        const Icon = config.icon;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Icon className="w-4 h-4" style={{ color: config.color }} />
            <span style={{ color: config.color }} className="text-xs font-semibold uppercase">
              {config.label}
            </span>
          </div>
        );
      },
    },
    {
      key: "total_monto",
      header: t("aprov_monto", "Monto"),
      sortAccessor: (row) => Number(row.total_monto || 0),
      render: (row) => (
        <span className="font-mono text-sm text-[var(--fg)]">
          {formatCurrency(row.total_monto)}
        </span>
      ),
    },
    {
      key: "items_count",
      header: t("aprov_items", "Items"),
      sortAccessor: (row) => (row.items?.length || 0),
      render: (row) => (
        <span className="text-sm font-semibold text-[var(--fg)]">
          {row.items?.length || 0}
        </span>
      ),
    },
    {
      key: "acciones",
      header: t("aprov_acciones", "Acciones"),
      render: (row) => (
        <div className="flex gap-2 flex-wrap justify-center" role="group" aria-label={`${t("aprov_acciones", "Acciones")} solicitud ${row.id}`}>
          <Button
            variant="ghost"
            className="px-3 py-2 text-xs"
            onClick={() => openDetailModal(row)}
            type="button"
            aria-label={`Ver detalle solicitud ${row.id}`}
          >
            <Eye className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            {t("aprov_ver", "Ver")}
          </Button>
          <Button
            className="px-3 py-2 text-xs"
            onClick={() => aprobar(row.id)}
            type="button"
            aria-label={`${t("aprov_aprobar", "Aprobar")} solicitud ${row.id}`}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            {t("aprov_aprobar", "Aprobar")}
          </Button>
          <Button
            variant="danger"
            className="px-3 py-2 text-xs"
            onClick={() => openRejectModal(row.id)}
            type="button"
            aria-label={`${t("aprov_rechazar", "Rechazar")} solicitud ${row.id}`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            {t("aprov_rechazar", "Rechazar")}
          </Button>
        </div>
      ),
    },
  ], [t, aprobar, openRejectModal, openDetailModal]);

  return (
    <div className="space-y-6">
      {/* Encabezado de página */}
      <ScrollReveal>
        <PageHeader
          title="APROBACIONES"
          actions={
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label={t("common_refresh", "Actualizar")}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {t("common_refresh", "Actualizar")}
            </Button>
          }
        />
      </ScrollReveal>

      {/* Mensajes de error y éxito unificados */}
      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      {/* Card principal */}
      <ScrollReveal delay={100}>
      <Card className="transition-all duration-200">
        <CardHeader>
          <div>
            <CardTitle>{t("aprov_title", "Aprobaciones")}</CardTitle>
            <CardDescription className="text-sm text-[var(--fg-muted)]">
              {t("aprov_subtitle", "Solicitudes pendientes")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-1 space-y-4">
          {/* Barra de búsqueda */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("aprov_search_placeholder", "Buscar por ID, centro, sector o justificacion")}
              className="md:max-w-md"
            />
            {loading && (
              <div className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--fg-muted)]">
                {t("aprov_loading", "Cargando...")}
              </div>
            )}
          </div>

          {/* Tabla con DataTable */}
          {loading ? (
            <TableSkeleton rows={5} columns={11} />
          ) : (
            <DataTable
              columns={columns}
              rows={filtered}
              emptyMessage={t("aprov_no_items", "No hay solicitudes pendientes")}
            />
          )}
        </CardContent>
      </Card>
      </ScrollReveal>

      {/* Modal de rechazo */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: null, motivo: "" })}
        title={`${t("aprov_rechazar", "Rechazar")} #${rejectModal.id}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRejectModal({ open: false, id: null, motivo: "" })}
              type="button"
            >
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button
              variant="danger"
              onClick={confirmRechazar}
              type="button"
              aria-label={`${t("aprov_rechazar", "Rechazar")} solicitud ${rejectModal.id}`}
            >
              {t("aprov_rechazar", "Rechazar")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor="reject-motivo" className="text-sm text-[var(--fg-muted)]">
            {t("aprov_motivo", "Motivo de rechazo")}
          </label>
          <textarea
            id="reject-motivo"
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
            placeholder={t("planner_rechazar_placeholder", "Explica brevemente el motivo del rechazo...")}
            aria-label={t("aprov_motivo", "Motivo de rechazo")}
          />
        </div>
      </Modal>

      {/* Modal de detalle de solicitud */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, solicitud: null })}
        title={`${t("aprov_detalle", "Detalle Solicitud")} #${detailModal.solicitud?.id || ""}`}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="ghost"
              onClick={() => setDetailModal({ open: false, solicitud: null })}
              type="button"
            >
              {t("common_cerrar", "Cerrar")}
            </Button>
            <Button
              onClick={() => {
                aprobar(detailModal.solicitud?.id);
                setDetailModal({ open: false, solicitud: null });
              }}
              type="button"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {t("aprov_aprobar", "Aprobar")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDetailModal({ open: false, solicitud: null });
                openRejectModal(detailModal.solicitud?.id);
              }}
              type="button"
            >
              <XCircle className="w-4 h-4 mr-1" />
              {t("aprov_rechazar", "Rechazar")}
            </Button>
          </div>
        }
      >
        {detailModal.solicitud && (
          <div className="space-y-6">
            {/* Información general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--bg-soft)] rounded-lg">
              <div>
                <p className="text-xs text-[var(--fg-muted)] uppercase font-semibold mb-1">Solicitante</p>
                <p className="text-sm text-[var(--fg)]">
                  {`${detailModal.solicitud.solicitante_nombre || ""} ${detailModal.solicitud.solicitante_apellido || ""}`.trim() || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)] uppercase font-semibold mb-1">Centro</p>
                <p className="text-sm text-[var(--fg)] font-mono">{detailModal.solicitud.centro || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)] uppercase font-semibold mb-1">Sector</p>
                <p className="text-sm text-[var(--fg)]">{detailModal.solicitud.sector || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--fg-muted)] uppercase font-semibold mb-1">Criticidad</p>
                <div className="flex items-center gap-1">
                  {(() => {
                    const config = getCriticidadConfig(detailModal.solicitud.criticidad);
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                        <span style={{ color: config.color }} className="text-sm font-semibold">
                          {config.label}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Justificación */}
            {detailModal.solicitud.justificacion && (
              <div>
                <p className="text-xs text-[var(--fg-muted)] uppercase font-semibold mb-2">Justificación</p>
                <p className="text-sm text-[var(--fg)] p-3 bg-[var(--bg-soft)] rounded-lg">
                  {detailModal.solicitud.justificacion}
                </p>
              </div>
            )}

            {/* Tabla de materiales */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-[var(--primary)]" />
                <p className="text-sm font-semibold text-[var(--fg)]">
                  {t("aprov_materiales_titulo", "Materiales Solicitados")} ({detailModal.solicitud.items?.length || 0})
                </p>
              </div>

              {detailModal.solicitud.items && detailModal.solicitud.items.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--bg-soft)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          Código SAP
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          Descripción
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          P. Unit.
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {detailModal.solicitud.items.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--card)]" : "bg-[var(--bg-soft)]"}>
                          <td className="px-4 py-3 font-mono text-sm text-[var(--fg)]">
                            {item.codigo_sap || item.material_id || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--fg)]">
                            {item.descripcion || item.nombre || "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-[var(--fg)]">
                            {item.cantidad || 0} {item.unidad_medida || item.uom || "UN"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[var(--fg)]">
                            {formatCurrency(item.precio_unitario || item.precio || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[var(--fg)]">
                            {formatCurrency((item.cantidad || 0) * (item.precio_unitario || item.precio || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--bg-soft)] border-t-2 border-[var(--border)]">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold uppercase text-[var(--fg)]">
                          Total:
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-base font-bold text-[var(--primary)]">
                          {formatCurrency(detailModal.solicitud.total_monto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[var(--fg-muted)] text-center py-6 bg-[var(--bg-soft)] rounded-lg">
                  {t("aprov_sin_materiales", "No hay materiales en esta solicitud")}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
