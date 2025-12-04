import { useEffect, useMemo, useState, useCallback } from "react";
import { planner, solicitudes } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { DataTable } from "../components/ui/DataTable";
import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { TableSkeleton } from "../components/ui/Skeleton";
import TratarSolicitudModal from "../components/Planner/TratarSolicitudModal";
import { Modal } from "../components/ui/Modal";
import { useI18n } from "../context/i18n";
import {
  RefreshCcw,
  CheckCircle,
  Clock,
  XCircle,
  Edit3,
  AlertTriangle,
  Download,
  Eye,
  Play,
  Check
} from "lucide-react";
import { renderSector as renderSectorUtil } from "../constants/sectores";
import { formatDate, formatCurrency, exportToExcel, getSectorNombre } from "../utils/formatters";
import { useDebounced } from "../hooks/useDebounced";

const DEBOUNCE_MS = 300;
const ITEMS_PER_PAGE = 20;

// Configuración de estados con iconos y colores (consistente con MisSolicitudes)
function getEstadoConfig(estado) {
  const estadoLower = (estado || "").toLowerCase();

  if (estadoLower.includes("aprobad")) {
    return { icon: <CheckCircle className="w-4 h-4" />, color: "var(--success)", label: estado || "Aprobada" };
  }
  if (estadoLower.includes("progreso") || estadoLower.includes("proceso")) {
    return { icon: <Clock className="w-4 h-4" />, color: "var(--info)", label: estado || "En Progreso" };
  }
  if (estadoLower.includes("finaliz") || estadoLower.includes("complet") || estadoLower.includes("tratad")) {
    return { icon: <CheckCircle className="w-4 h-4" />, color: "var(--success)", label: estado || "Finalizada" };
  }
  if (estadoLower.includes("rechaz")) {
    return { icon: <XCircle className="w-4 h-4" />, color: "var(--danger)", label: estado || "Rechazada" };
  }
  if (estadoLower.includes("borrador")) {
    return { icon: <Edit3 className="w-4 h-4" />, color: "var(--warning)", label: estado || "Borrador" };
  }

  return { icon: <Clock className="w-4 h-4" />, color: "var(--fg-muted)", label: estado || "Pendiente" };
}

export default function Planner() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Búsqueda general
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);

  // Filtros
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCriticidad, setFiltroCriticidad] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Modales
  const [selectedParaTratar, setSelectedParaTratar] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, solicitud: null, motivo: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await planner.listar({
        planner_id: user?.rol?.toLowerCase() === "admin" ? undefined : user?.id,
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.rol, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Resetear paginación cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ, filtroCentro, filtroSector, filtroEstado, filtroCriticidad]);

  const aceptar = useCallback(async (id) => {
    setSuccess("");
    setError("");
    try {
      await planner.aceptar(id);
      setSuccess(t("planner_msg_aceptar", "Solicitud aceptada y marcada en progreso."));
      setTimeout(() => setSuccess(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [load, t]);

  const finalizar = useCallback(async (id) => {
    setSuccess("");
    setError("");
    try {
      await planner.finalizar(id);
      setSuccess(t("planner_msg_finalizar", "Solicitud tratada/finalizada."));
      setTimeout(() => setSuccess(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [load, t]);

  const rechazar = useCallback(async () => {
    if (!rejectModal.solicitud) return;
    const motivo = rejectModal.motivo.trim();
    if (!motivo) {
      setError(t("planner_rechazar_motivo_required", "Debes indicar el motivo del rechazo"));
      return;
    }
    setSuccess("");
    setError("");
    try {
      await solicitudes.rechazar(rejectModal.solicitud.id, motivo);
      setSuccess(t("planner_rechazar_success", "Solicitud rechazada correctamente."));
      setTimeout(() => setSuccess(""), 3000);
      setRejectModal({ open: false, solicitud: null, motivo: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [rejectModal.solicitud, rejectModal.motivo, load, t]);

  // Filtrado con búsqueda general
  const filtered = useMemo(() => {
    let result = [...items];

    // Búsqueda general
    if (debouncedQ) {
      const qLower = debouncedQ.toLowerCase();
      result = result.filter((s) => {
        const searchText = [
          s.id,
          s.justificacion,
          s.centro,
          getSectorNombre(s.sector),
          s.status,
          s.estado,
          s.solicitante_nombre,
          s.solicitante_apellido,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchText.includes(qLower);
      });
    }

    // Filtro por centro
    if (filtroCentro) {
      result = result.filter((s) =>
        (s.centro || "").toString().toLowerCase().includes(filtroCentro.toLowerCase())
      );
    }

    // Filtro por sector
    if (filtroSector) {
      result = result.filter((s) =>
        getSectorNombre(s.sector).toLowerCase().includes(filtroSector.toLowerCase())
      );
    }

    // Filtro por estado
    if (filtroEstado) {
      result = result.filter((s) => {
        const estado = (s.status || s.estado || "").toLowerCase();
        return estado.includes(filtroEstado.toLowerCase());
      });
    }

    // Filtro por criticidad
    if (filtroCriticidad) {
      result = result.filter((s) =>
        (s.criticidad || "Normal").toLowerCase() === filtroCriticidad.toLowerCase()
      );
    }

    return result;
  }, [items, debouncedQ, filtroCentro, filtroSector, filtroEstado, filtroCriticidad]);

  // Paginación
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Exportar
  const handleExport = useCallback(() => {
    const dataToExport = filtered.map((s) => ({
      ID: s.id,
      Justificacion: s.justificacion || "",
      Centro: s.centro || "",
      Sector: getSectorNombre(s.sector),
      Criticidad: s.criticidad || "Normal",
      "Monto Total": s.total_monto || 0,
      Estado: s.status || s.estado || "",
      "Fecha Necesidad": formatDate(s.fecha_necesidad),
      "Fecha Creación": formatDate(s.created_at),
      Solicitante: renderSolicitante(s),
    }));
    exportToExcel(dataToExport, `planificador-${new Date().toISOString().split("T")[0]}.xls`);
    setSuccess(t("planner_export_success", "Datos exportados correctamente"));
    setTimeout(() => setSuccess(""), 3000);
  }, [filtered, t]);

  // Columnas de la tabla
  const columns = [
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id || 0)
    },
    {
      key: "centro",
      header: t("planner_centro", "Centro"),
      sortAccessor: (row) => row.centro || ""
    },
    {
      key: "sector",
      header: t("planner_sector", "Sector"),
      render: (row) => getSectorNombre(row.sector),
      sortAccessor: (row) => getSectorNombre(row.sector),
    },
    {
      key: "solicitante",
      header: t("dash_table_solicitante", "Solicitante"),
      render: (row) => renderSolicitante(row),
      sortAccessor: (row) => renderSolicitante(row),
    },
    {
      key: "criticidad",
      header: t("planner_criticidad", "Criticidad"),
      render: (row) => {
        const crit = row.criticidad || "Normal";
        const isAlta = crit.toLowerCase() === "alta";
        return (
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: isAlta ? "var(--danger)" : "var(--fg-muted)" }}
          >
            {isAlta && <AlertTriangle className="w-4 h-4" />}
            {crit}
          </span>
        );
      },
      sortAccessor: (row) => row.criticidad || "Normal",
    },
    {
      key: "justificacion",
      header: t("planner_justificacion", "Asunto"),
      render: (row) => {
        const text = row.justificacion || "";
        const truncated = text.length > 50 ? text.substring(0, 50) + "..." : text;
        return <span title={text}>{truncated}</span>;
      },
      sortAccessor: (row) => (row.justificacion || "").toString(),
    },
    {
      key: "total_monto",
      header: t("planner_monto", "Monto"),
      render: (row) => formatCurrency(row.total_monto || 0),
      sortAccessor: (row) => Number(row.total_monto || 0),
    },
    {
      key: "fecha_necesidad",
      header: t("planner_fecha", "F. Necesidad"),
      render: (row) => formatDate(row.fecha_necesidad),
      sortAccessor: (row) => new Date(row.fecha_necesidad || 0).getTime() || 0,
    },
    {
      key: "created_at",
      header: t("planner_fecha_creacion", "F. Creación"),
      render: (row) => formatDate(row.created_at),
      sortAccessor: (row) => new Date(row.created_at || 0).getTime() || 0,
    },
    {
      key: "estado",
      header: t("planner_estado", "Estado"),
      render: (row) => {
        const estadoVal = row.status || row.estado || "Aprobada";
        const config = getEstadoConfig(estadoVal);
        return (
          <span className="inline-flex items-center gap-1.5" style={{ color: config.color }}>
            {config.icon}
            <span>{config.label}</span>
          </span>
        );
      },
      sortAccessor: (row) => (row.status || row.estado || "").toString(),
    },
    {
      key: "acciones",
      header: t("planner_acciones", "Acciones"),
      render: (row) => {
        const estadoVal = (row.status || row.estado || "").toLowerCase();
        const isAprobada = estadoVal.includes("aprobad");
        const isEnProgreso = estadoVal.includes("progreso") || estadoVal.includes("proceso");

        return (
          <div className="flex flex-wrap gap-2 items-center" role="group" aria-label={`${t("planner_acciones", "Acciones")} solicitud ${row.id}`}>
            {/* Botón Ver/Tratar */}
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 bg-[var(--info)]/10 text-[var(--info)] focus:outline-none focus:ring-2 focus:ring-[var(--info)]"
              onClick={() => setSelectedParaTratar(row)}
              type="button"
              title={t("planner_ver", "Ver detalles y tratar solicitud")}
              aria-label={`${t("planner_tratar", "Tratar")} solicitud ${row.id}`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              {t("planner_tratar", "Tratar")}
            </button>

            {/* Botón Aceptar (solo si está Aprobada) */}
            {isAprobada && (
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 bg-[var(--success)]/10 text-[var(--success)] focus:outline-none focus:ring-2 focus:ring-[var(--success)]"
                onClick={() => aceptar(row.id)}
                type="button"
                title={t("planner_aceptar", "Aceptar")}
                aria-label={`${t("planner_aceptar", "Aceptar")} solicitud ${row.id}`}
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                {t("planner_aceptar", "Aceptar")}
              </button>
            )}

            {/* Botón Finalizar (solo si está En Progreso) */}
            {isEnProgreso && (
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 bg-[var(--success)]/10 text-[var(--success)] focus:outline-none focus:ring-2 focus:ring-[var(--success)]"
                onClick={() => finalizar(row.id)}
                type="button"
                title={t("planner_finalizar", "Finalizar")}
                aria-label={`${t("planner_finalizar", "Finalizar")} solicitud ${row.id}`}
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                {t("planner_finalizar", "Finalizar")}
              </button>
            )}

            {/* Botón Rechazar (siempre disponible) */}
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 bg-[var(--danger)]/10 text-[var(--danger)] focus:outline-none focus:ring-2 focus:ring-[var(--danger)]"
              onClick={() => setRejectModal({ open: true, solicitud: row, motivo: "" })}
              type="button"
              title={t("planner_rechazar", "Rechazar")}
              aria-label={`${t("planner_rechazar", "Rechazar")} solicitud ${row.id}`}
            >
              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
              {t("planner_rechazar", "Rechazar")}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <PageHeader title="PLANIFICADOR" />

      {/* Mensajes de éxito/error */}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess("")} className="animate-in fade-in duration-200">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" onDismiss={() => setError("")} className="animate-in fade-in duration-200">
          {error}
        </Alert>
      )}

      {/* Contenido principal */}
      <div className="grid gap-5 xl:gap-7 lg:grid-cols-[320px,minmax(0,1fr)] items-start">
        {/* Card de filtros */}
        <Card className="sticky top-4">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle>{t("planner_filters", "Filtros")}</CardTitle>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-1 space-y-4">
            {/* Búsqueda general */}
            <div className="space-y-2">
              <label htmlFor="planner-search" className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">
                {t("planner_busqueda_general", "Búsqueda general")}
              </label>
              <Input
                id="planner-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("planner_buscar_placeholder", "Buscar por ID, asunto, solicitante...")}
                aria-label={t("planner_busqueda_general", "Búsqueda general")}
              />
            </div>

            {/* Filtro Centro */}
            <div className="space-y-2">
              <label htmlFor="planner-centro" className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">
                {t("planner_centro", "Centro")}
              </label>
              <Select
                id="planner-centro"
                value={filtroCentro}
                onChange={(e) => setFiltroCentro(e.target.value)}
                aria-label={t("planner_centro", "Centro")}
              >
                <option value="">{t("planner_todos_centros", "Todos los centros")}</option>
                <option value="1008">1008</option>
                <option value="1064">1064</option>
                <option value="1070">1070</option>
              </Select>
            </div>

            {/* Filtro Sector */}
            <div className="space-y-2">
              <label htmlFor="planner-sector" className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">
                {t("planner_sector", "Sector")}
              </label>
              <Select
                id="planner-sector"
                value={filtroSector}
                onChange={(e) => setFiltroSector(e.target.value)}
                aria-label={t("planner_sector", "Sector")}
              >
                <option value="">{t("planner_todos_sectores", "Todos los sectores")}</option>
                <option value="Almacenes">{t("planner_sector_almacenes", "Almacenes")}</option>
                <option value="Compras">{t("planner_sector_compras", "Compras")}</option>
                <option value="Mantenimiento">{t("planner_sector_mantenimiento", "Mantenimiento")}</option>
                <option value="Planificación">{t("planner_sector_planificacion", "Planificación")}</option>
                <option value="Operaciones">{t("planner_sector_operaciones", "Operaciones")}</option>
                <option value="Logística">{t("planner_sector_logistica", "Logística")}</option>
                <option value="Producción">{t("planner_sector_produccion", "Producción")}</option>
                <option value="Calidad">{t("planner_sector_calidad", "Calidad")}</option>
              </Select>
            </div>

            {/* Filtro Estado */}
            <div className="space-y-2">
              <label htmlFor="planner-estado" className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">
                {t("planner_estado", "Estado")}
              </label>
              <Select
                id="planner-estado"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                aria-label={t("planner_estado", "Estado")}
              >
                <option value="">{t("planner_todos_estados", "Todos los estados")}</option>
                <option value="aprobada">{t("planner_estado_aprobada", "Aprobada")}</option>
                <option value="progreso">{t("planner_estado_progreso", "En Progreso")}</option>
                <option value="finalizada">{t("planner_estado_finalizada", "Finalizada")}</option>
                <option value="rechazada">{t("planner_estado_rechazada", "Rechazada")}</option>
              </Select>
            </div>

            {/* Filtro Criticidad */}
            <div className="space-y-2">
              <label htmlFor="planner-criticidad" className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">
                {t("planner_criticidad", "Criticidad")}
              </label>
              <Select
                id="planner-criticidad"
                value={filtroCriticidad}
                onChange={(e) => setFiltroCriticidad(e.target.value)}
                aria-label={t("planner_criticidad", "Criticidad")}
              >
                <option value="">{t("planner_criticidad_todas", "Todas")}</option>
                <option value="normal">{t("planner_criticidad_normal", "Normal")}</option>
                <option value="alta">{t("planner_criticidad_alta", "Alta")}</option>
              </Select>
            </div>

            {/* Botón actualizar */}
            <Button
              className="w-full"
              onClick={load}
              disabled={loading}
              type="button"
              aria-label={loading ? t("planner_actualizando", "Actualizando...") : t("planner_actualizar", "Actualizar")}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              {loading ? t("planner_actualizando", "Actualizando...") : t("planner_actualizar", "Actualizar")}
            </Button>
          </CardContent>
        </Card>

        {/* Card de tabla */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("planner_solicitudes_asignadas", "Solicitudes Asignadas")}</CardTitle>
              <CardDescription>
                {filtered.length} {filtered.length === 1 ? t("planner_solicitud", "solicitud") : t("planner_solicitudes", "solicitudes")}
              </CardDescription>
            </div>

            {/* Botón exportar */}
            <Button
              variant="secondary"
              onClick={handleExport}
              type="button"
              disabled={filtered.length === 0}
              aria-label={t("planner_exportar_xls", "Exportar XLS")}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {t("planner_exportar_xls", "Exportar XLS")}
            </Button>
          </CardHeader>

          <CardContent className="px-0 pb-0 pt-0">
            {loading ? (
              <TableSkeleton rows={5} columns={10} />
            ) : (
              <DataTable
                columns={columns}
                rows={paginatedItems}
                emptyMessage={t("planner_empty_full", "Sin solicitudes asignadas")}
              />
            )}

            {/* Paginación */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              labels={{
                page: t("common_pagina", "Página"),
                of: t("common_de", "de"),
                showing: t("common_mostrando", "Mostrando"),
                prev: t("common_anterior", "Anterior"),
                next: t("common_siguiente", "Siguiente"),
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modal Tratar Solicitud */}
      <TratarSolicitudModal
        solicitud={selectedParaTratar}
        isOpen={!!selectedParaTratar}
        onClose={() => setSelectedParaTratar(null)}
        onComplete={() => {
          setSelectedParaTratar(null);
          load();
        }}
      />

      {/* Modal Rechazar */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, solicitud: null, motivo: "" })}
        title={`${t("planner_rechazar_solicitud", "Rechazar Solicitud")} #${rejectModal.solicitud?.id}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRejectModal({ open: false, solicitud: null, motivo: "" })}
              type="button"
            >
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button variant="danger" onClick={rechazar} type="button">
              {t("planner_confirmar_rechazo", "Confirmar Rechazo")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-[var(--fg-muted)]">
            {t("planner_rechazar_motivo_label", "Motivo del rechazo")} <span className="text-[var(--danger)]">*</span>
          </p>
          <textarea
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
            placeholder={t("planner_rechazar_placeholder", "Explica brevemente el motivo del rechazo...")}
          />
        </div>
      </Modal>
    </div>
  );
}

function renderSolicitante(row) {
  const nombre = row.solicitante_nombre || row.nombre || "";
  const apellido = row.solicitante_apellido || row.apellido || "";
  const full = `${nombre} ${apellido}`.trim();
  return full || row.id_usuario || "N/D";
}
