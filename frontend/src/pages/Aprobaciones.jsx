import { useEffect, useMemo, useState, useCallback } from "react";
import { solicitudes } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/SearchInput";
import { Card, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { withSpmAlignments } from "../utils/tableAlignments";
import StatusBadge from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatCurrency, formatAlmacen } from "../utils/formatters";
import { useDebounced } from "../hooks/useDebounced";
import { Modal } from "../components/ui/Modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { XCircle, CheckCircle, RefreshCw, Eye, Package, Clock, ICON_COLORS } from "../components/ui/Icons";
import { getCriticidadConfig } from "../utils/styleConfig";

const DEBOUNCE_MS = 300;

export default function Aprobaciones() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("pendientes");
  const [items, setItems] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);
  const [msg, setMsg] = useState("");
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, motivo: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, solicitud: null });

  // Load pending approvals - filtered by current user as aprobador
  const loadPendientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Filtrar por estado "Enviada" y por aprobador_id = usuario actual
      // user.id viene de format_user_response (que usa id_spm internamente)
      const res = await solicitudes.listar({
        estado: "Enviada",
        aprobador_id: user?.id
      });
      const data = res.data.solicitudes || res.data.results || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load approval history
  const loadHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      // Cargar aprobadas y rechazadas
      const [resAprobadas, resRechazadas] = await Promise.all([
        solicitudes.listar({ estado: "Aprobada" }),
        solicitudes.listar({ estado: "Rechazada" }),
      ]);
      const aprobadas = resAprobadas.data.solicitudes || resAprobadas.data.results || [];
      const rechazadas = resRechazadas.data.solicitudes || resRechazadas.data.results || [];
      // Combinar y ordenar por fecha más reciente
      const all = [...aprobadas, ...rechazadas].sort((a, b) =>
        new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );
      setHistorial(all);
    } catch (err) {
      // Silently handle error for historial
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  useEffect(() => {
    loadPendientes();
    loadHistorial();
  }, [loadPendientes, loadHistorial]);

  // Alias for backward compatibility
  const load = loadPendientes;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPendientes(), loadHistorial()]);
    setRefreshing(false);
  }, [loadPendientes, loadHistorial]);

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

  // Filter for historial tab
  const filteredHistorial = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return historial;
    return historial.filter((s) => {
      return (
        String(s.id).includes(term) ||
        (s.justificacion || "").toLowerCase().includes(term) ||
        (s.centro || "").toLowerCase().includes(term) ||
        (s.sector || "").toLowerCase().includes(term) ||
        (s.estado || "").toLowerCase().includes(term)
      );
    });
  }, [historial, debouncedQ]);

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

  // Definición de columnas para DataTable (memoizadas, con alineación SPM automática)
  const columns = useMemo(() => withSpmAlignments([
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => <span className="font-semibold text-slate-700">{row.id}</span>,
    },
    {
      key: "fecha_creacion",
      header: t("aprov_fecha_creacion", "Fecha"),
      sortAccessor: (row) => row.created_at || "",
      render: (row) => {
        const fecha = row.created_at;
        if (!fecha) return <span className="text-sm text-slate-500">-</span>;
        const d = new Date(fecha);
        return (
          <span className="text-sm text-slate-700">
            {d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        );
      },
    },
    {
      key: "solicitante",
      header: t("aprov_solicitante", "Solicitante"),
      sortAccessor: (row) => `${row.solicitante_nombre || ""} ${row.solicitante_apellido || ""}`.toLowerCase(),
      render: (row) => {
        const nombre = `${row.solicitante_nombre || ""} ${row.solicitante_apellido || ""}`.trim();
        return (
          <span className="text-slate-700" title={nombre}>
            {nombre || "-"}
          </span>
        );
      },
    },
    {
      key: "centro",
      header: t("aprov_centro", "Centro"),
      sortAccessor: (row) => row.centro || "",
      render: (row) => (
        <span className="font-mono text-sm">{row.centro || "-"}</span>
      ),
    },
    {
      key: "almacen",
      header: t("aprov_almacen", "Almacén"),
      sortAccessor: (row) => row.almacen_virtual || row.almacen || "",
      render: (row) => (
        <span className="font-mono text-sm">{formatAlmacen(row.almacen_virtual || row.almacen)}</span>
      ),
    },
    {
      key: "sector",
      header: t("aprov_sector", "Sector"),
      sortAccessor: (row) => row.sector || "",
      render: (row) => (
        <span className="text-sm">{row.sector || "-"}</span>
      ),
    },
    {
      key: "fecha_necesidad",
      header: t("aprov_fecha_necesidad", "F. Necesidad"),
      sortAccessor: (row) => row.fecha_necesidad || "",
      render: (row) => {
        const fecha = row.fecha_necesidad;
        if (!fecha) return <span className="text-sm text-slate-500">-</span>;
        const d = new Date(fecha);
        return (
          <span className="text-sm text-slate-700">
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
        <span className="whitespace-nowrap font-mono text-sm text-slate-700">
          {formatCurrency(row.total_monto)}
        </span>
      ),
    },
    {
      key: "items_count",
      header: t("aprov_items", "Items"),
      sortAccessor: (row) => (row.items?.length || 0),
      render: (row) => (
        <span className="text-sm font-semibold text-slate-700">
          {row.items?.length || 0}
        </span>
      ),
    },
    {
      key: "acciones",
      header: t("aprov_acciones", "Acciones"),
      render: (row) => (
        <div className="flex items-center justify-center gap-1" role="group" aria-label={`${t("aprov_acciones", "Acciones")} solicitud ${row.id}`}>
          {/* Botón Ver */}
          <Button
            variant="icon-primary"
            size="icon-sm"
            onClick={() => openDetailModal(row)}
            title={t("aprov_ver_tooltip", "Ver detalle de la solicitud")}
            aria-label={`Ver detalle solicitud ${row.id}`}
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
          </Button>

          {/* Botón Aprobar */}
          <Button
            variant="icon-success"
            size="icon-sm"
            onClick={() => aprobar(row.id)}
            title={t("aprov_aprobar_tooltip", "Aprobar y asignar a planificador")}
            aria-label={`${t("aprov_aprobar", "Aprobar")} solicitud ${row.id}`}
          >
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
          </Button>

          {/* Botón Rechazar */}
          <Button
            variant="icon-danger"
            size="icon-sm"
            onClick={() => openRejectModal(row.id)}
            title={t("aprov_rechazar_tooltip", "Rechazar la solicitud")}
            aria-label={`${t("aprov_rechazar", "Rechazar")} solicitud ${row.id}`}
          >
            <XCircle className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]), [t, aprobar, openRejectModal, openDetailModal]);

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
              <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
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
        <CardContent className="pt-4 space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="pendientes">
                  <CheckCircle className={`w-4 h-4 ${ICON_COLORS.success}`} />
                  {t("aprov_tab_pendientes", "Pendientes")}
                  {items.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                      {items.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="historial">
                  <Clock className={`w-4 h-4 ${ICON_COLORS.time}`} />
                  {t("aprov_tab_historial", "Historial")}
                </TabsTrigger>
              </TabsList>
              {(loading || loadingHistorial) && (
                <div className="text-xs font-bold uppercase tracking-[0.05em] text-slate-500">
                  {t("aprov_loading", "Cargando...")}
                </div>
              )}
            </div>

            {/* Tab content - Pendientes */}
            <TabsContent value="pendientes">
              {/* Barra de búsqueda */}
              <div className="mb-4">
                <SearchInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("aprov_search_placeholder", "Buscar por ID, centro, sector o justificacion")}
                  className="md:max-w-md"
                />
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
            </TabsContent>

            {/* Tab content - Historial */}
            <TabsContent value="historial">
              {/* Barra de búsqueda */}
              <div className="mb-4">
                <SearchInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("aprov_search_historial", "Buscar en historial...")}
                  className="md:max-w-md"
                />
              </div>

              {/* Tabla de historial (sin botones de acción) */}
              {loadingHistorial ? (
                <TableSkeleton rows={5} columns={9} />
              ) : (
                <DataTable
                  columns={columns.filter(col => col.key !== "acciones")}
                  rows={filteredHistorial}
                  emptyMessage={t("aprov_no_historial", "No hay registros en el historial")}
                />
              )}
            </TabsContent>
          </Tabs>
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
              <XCircle className={`w-4 h-4 ${ICON_COLORS.danger} mr-1`} />
              {t("aprov_rechazar", "Rechazar")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor="reject-motivo" className="text-sm text-slate-500">
            {t("aprov_motivo", "Motivo de rechazo")}
          </label>
          <textarea
            id="reject-motivo"
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-white/50 bg-white/50 backdrop-blur-sm text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all"
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
              <CheckCircle className={`w-4 h-4 ${ICON_COLORS.success} mr-1`} />
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
              <XCircle className={`w-4 h-4 ${ICON_COLORS.danger} mr-1`} />
              {t("aprov_rechazar", "Rechazar")}
            </Button>
          </div>
        }
      >
        {detailModal.solicitud && (
          <div className="space-y-6">
            {/* Información general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200/50">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Solicitante</p>
                <p className="text-sm text-slate-700">
                  {`${detailModal.solicitud.solicitante_nombre || ""} ${detailModal.solicitud.solicitante_apellido || ""}`.trim() || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Centro</p>
                <p className="text-sm text-slate-700 font-mono">{detailModal.solicitud.centro || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Sector</p>
                <p className="text-sm text-slate-700">{detailModal.solicitud.sector || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Criticidad</p>
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
                <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Justificación</p>
                <p className="text-sm text-slate-700 p-3 bg-slate-50/50 rounded-xl border border-slate-200/50">
                  {detailModal.solicitud.justificacion}
                </p>
              </div>
            )}

            {/* Tabla de materiales */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className={`w-5 h-5 ${ICON_COLORS.logistics}`} />
                <p className="text-sm font-semibold text-slate-700">
                  {t("aprov_materiales_titulo", "Materiales Solicitados")} ({detailModal.solicitud.items?.length || 0})
                </p>
              </div>

              {detailModal.solicitud.items && detailModal.solicitud.items.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200/50">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                          Código SAP
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                          Descripción
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                          P. Unit.
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {detailModal.solicitud.items.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/30"}>
                          <td className="px-4 py-3 font-mono text-sm text-slate-700 border-r border-b border-slate-200">
                            {item.codigo_sap || item.material_id || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 border-r border-b border-slate-200">
                            {item.descripcion || item.nombre || "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-700 border-r border-b border-slate-200">
                            {item.cantidad || 0} {item.unidad_medida || item.uom || "UN"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 border-r border-b border-slate-200">
                            {formatCurrency(item.precio_unitario || item.precio || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-slate-700">
                            {formatCurrency((item.cantidad || 0) * (item.precio_unitario || item.precio || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100/70 border-t-2 border-slate-200/50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold uppercase text-slate-700">
                          Total:
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-base font-bold text-blue-600">
                          {formatCurrency(detailModal.solicitud.total_monto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-6 bg-slate-50/50 rounded-xl border border-slate-200/50">
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
