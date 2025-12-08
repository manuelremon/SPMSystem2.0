import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { planner, solicitudes } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardDescription, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { withSpmAlignments } from "../utils/tableAlignments";
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
  Download,
  Eye,
  Play,
  Check,
  Info
} from "lucide-react";
import { renderSector as renderSectorUtil } from "../constants/sectores";
import { formatDate, formatCurrency, exportToExcel, getSectorNombre } from "../utils/formatters";
import { getCriticidadConfig } from "../utils/styleConfig";
import { useDebounced } from "../hooks/useDebounced";

const DEBOUNCE_MS = 300;
const ITEMS_PER_PAGE = 20;

// Configuración de estados con iconos y colores (consistente con MisSolicitudes)
function getEstadoConfig(estado) {
  const estadoLower = (estado || "").toLowerCase();

  if (estadoLower.includes("aprobad")) {
    return { icon: <CheckCircle className="w-4 h-4" />, color: "#10b981", label: estado || "Aprobada" };
  }
  if (estadoLower.includes("progreso") || estadoLower.includes("proceso")) {
    return { icon: <Clock className="w-4 h-4" />, color: "#3b82f6", label: estado || "En Progreso" };
  }
  if (estadoLower.includes("finaliz") || estadoLower.includes("complet") || estadoLower.includes("tratad")) {
    return { icon: <CheckCircle className="w-4 h-4" />, color: "#10b981", label: estado || "Finalizada" };
  }
  if (estadoLower.includes("rechaz")) {
    return { icon: <XCircle className="w-4 h-4" />, color: "#ef4444", label: estado || "Rechazada" };
  }
  if (estadoLower.includes("borrador")) {
    return { icon: <Edit3 className="w-4 h-4" />, color: "#64748b", label: estado || "Borrador" };
  }

  return { icon: <Clock className="w-4 h-4" />, color: "#64748b", label: estado || "Pendiente" };
}

export default function Planner() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
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

  // Tab activo para filtrar por estado de tratamiento
  const [activeTab, setActiveTab] = useState("pendientes");

  // Modales
  const [selectedParaTratar, setSelectedParaTratar] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, solicitud: null, motivo: "" });
  const [historialModal, setHistorialModal] = useState({ open: false, solicitud: null });

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

  // Resetear paginación cuando cambian los filtros o el tab
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ, filtroCentro, filtroSector, filtroEstado, filtroCriticidad, activeTab]);

  // Helper para clasificar estado
  const getEstadoCategoria = useCallback((item) => {
    const estado = (item.status || item.estado || "").toLowerCase();
    if (estado.includes("finaliz") || estado.includes("complet") || estado.includes("tratad")) {
      return "finalizadas";
    }
    if (estado.includes("progreso") || estado.includes("proceso")) {
      return "en_progreso";
    }
    // Aprobada o cualquier otro estado = pendientes
    return "pendientes";
  }, []);

  // Contadores por estado (para mostrar en los tabs)
  const tabCounts = useMemo(() => {
    const counts = { pendientes: 0, en_progreso: 0, finalizadas: 0 };
    items.forEach((item) => {
      const cat = getEstadoCategoria(item);
      counts[cat]++;
    });
    return counts;
  }, [items, getEstadoCategoria]);

  // Tratar: si está Aprobada, primero la acepta y luego abre el modal
  const handleTratar = useCallback(async (row) => {
    const estadoVal = (row.status || row.estado || "").toLowerCase();
    const isAprobada = estadoVal.includes("aprobad");

    if (isAprobada) {
      // Primero aceptar (cambiar a "En Progreso")
      setSuccess("");
      setError("");
      try {
        await planner.aceptar(row.id);
        // Actualizar el item localmente para reflejar el cambio
        setItems(prev => prev.map(item =>
          item.id === row.id ? { ...item, status: "En Progreso", estado: "En Progreso" } : item
        ));
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
        return; // No abrir modal si falla
      }
    }

    // Abrir modal de tratamiento
    setSelectedParaTratar(row);
  }, []);

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

    // Filtro por tab (estado de tratamiento)
    result = result.filter((s) => getEstadoCategoria(s) === activeTab);

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
  }, [items, activeTab, getEstadoCategoria, debouncedQ, filtroCentro, filtroSector, filtroEstado, filtroCriticidad]);

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

  // Columnas de la tabla (con alineación SPM automática)
  const columns = withSpmAlignments([
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id || 0)
    },
    {
      key: "acciones",
      header: t("planner_accion", "ACCIÓN"),
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            className="p-1.5 rounded-md hover:bg-blue-500/10 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/solicitudes/${row.id}`);
            }}
            type="button"
            title={t("planner_ver_tooltip", "Ver detalles")}
          >
            <Eye className="w-4 h-4 text-blue-500" />
          </button>
          <button
            className="px-2 py-1 rounded-md hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              handleTratar(row);
            }}
            type="button"
            title={t("planner_tratar_tooltip", "Tratar solicitud")}
          >
            <Play className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">{t("planner_tratar", "Tratar")}</span>
          </button>
        </div>
      ),
    },
    {
      key: "created_at",
      header: t("planner_fecha_creacion", "F. Creación"),
      render: (row) => formatDate(row.created_at),
      sortAccessor: (row) => new Date(row.created_at || 0).getTime() || 0,
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
        const criticidad = row.criticidad || "Normal";
        const config = getCriticidadConfig(criticidad);
        const Icon = config.icon;
        return (
          <div className="inline-flex items-center gap-1.5">
            {Icon && (
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: config.color }}
              />
            )}
            <span
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
          </div>
        );
      },
      sortAccessor: (row) => row.criticidad || "Normal",
    },
    {
      key: "justificacion",
      header: t("planner_justificacion", "Asunto"),
      render: (row) => {
        const text = row.justificacion || "";
        const isTruncated = text.length > 10;
        const truncated = isTruncated ? text.substring(0, 10) + "..." : text;
        return isTruncated ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alert(text);
            }}
            className="text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            title={t("planner_ver_completo", "Click para ver completo")}
          >
            {truncated}
          </button>
        ) : (
          <span>{text}</span>
        );
      },
      sortAccessor: (row) => (row.justificacion || "").toString(),
    },
    {
      key: "total_monto",
      header: t("planner_monto", "Monto"),
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-sm text-slate-800">
          {formatCurrency(row.total_monto || 0)}
        </span>
      ),
      sortAccessor: (row) => Number(row.total_monto || 0),
    },
    {
      key: "fecha_necesidad",
      header: t("planner_fecha", "F. Necesidad"),
      render: (row) => formatDate(row.fecha_necesidad),
      sortAccessor: (row) => new Date(row.fecha_necesidad || 0).getTime() || 0,
    },
    {
      key: "estado",
      header: t("planner_estado", "Estado"),
      render: (row) => {
        const estadoVal = row.status || row.estado || "Aprobada";
        const config = getEstadoConfig(estadoVal);
        return (
          <button
            onClick={() => setHistorialModal({ open: true, solicitud: row })}
            className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: config.color }}
            title={t("planner_ver_historial", "Ver historial de estados")}
            type="button"
          >
            {config.icon}
            <span className="text-xs font-semibold tracking-wide uppercase">{config.label}</span>
            <Info className="w-3 h-3 opacity-50" />
          </button>
        );
      },
      sortAccessor: (row) => (row.status || row.estado || "").toString(),
    },
  ]);

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

      {/* Barra de filtros horizontal */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Búsqueda general */}
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <label htmlFor="planner-search" className="block text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-1.5">
              {t("planner_busqueda_general", "Buscar")}
            </label>
            <Input
              id="planner-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("planner_buscar_placeholder", "ID, asunto, solicitante...")}
              aria-label={t("planner_busqueda_general", "Búsqueda general")}
            />
          </div>

          {/* Filtro Centro */}
          <div className="w-[130px]">
            <label htmlFor="planner-centro" className="block text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-1.5">
              {t("planner_centro", "Centro")}
            </label>
            <Select
              id="planner-centro"
              value={filtroCentro}
              onChange={(e) => setFiltroCentro(e.target.value)}
              aria-label={t("planner_centro", "Centro")}
            >
              <option value="">{t("planner_todos", "Todos")}</option>
              <option value="1008">1008</option>
              <option value="1064">1064</option>
              <option value="1070">1070</option>
            </Select>
          </div>

          {/* Filtro Sector */}
          <div className="w-[160px]">
            <label htmlFor="planner-sector" className="block text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-1.5">
              {t("planner_sector", "Sector")}
            </label>
            <Select
              id="planner-sector"
              value={filtroSector}
              onChange={(e) => setFiltroSector(e.target.value)}
              aria-label={t("planner_sector", "Sector")}
            >
              <option value="">{t("planner_todos", "Todos")}</option>
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
          <div className="w-[140px]">
            <label htmlFor="planner-estado" className="block text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-1.5">
              {t("planner_estado", "Estado")}
            </label>
            <Select
              id="planner-estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              aria-label={t("planner_estado", "Estado")}
            >
              <option value="">{t("planner_todos", "Todos")}</option>
              <option value="aprobada">{t("planner_estado_aprobada", "Aprobada")}</option>
              <option value="progreso">{t("planner_estado_progreso", "En Progreso")}</option>
              <option value="finalizada">{t("planner_estado_finalizada", "Finalizada")}</option>
              <option value="rechazada">{t("planner_estado_rechazada", "Rechazada")}</option>
            </Select>
          </div>

          {/* Filtro Criticidad */}
          <div className="w-[120px]">
            <label htmlFor="planner-criticidad" className="block text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-1.5">
              {t("planner_criticidad", "Criticidad")}
            </label>
            <Select
              id="planner-criticidad"
              value={filtroCriticidad}
              onChange={(e) => setFiltroCriticidad(e.target.value)}
              aria-label={t("planner_criticidad", "Criticidad")}
            >
              <option value="">{t("planner_todas", "Todas")}</option>
              <option value="normal">{t("planner_criticidad_normal", "Normal")}</option>
              <option value="alta">{t("planner_criticidad_alta", "Alta")}</option>
            </Select>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              onClick={load}
              disabled={loading}
              type="button"
              aria-label={loading ? t("planner_actualizando", "Actualizando...") : t("planner_actualizar", "Actualizar")}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              {t("planner_actualizar", "Actualizar")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExport}
              type="button"
              disabled={filtered.length === 0}
              aria-label={t("planner_exportar_xls", "Exportar XLS")}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {t("planner_exportar_xls", "Exportar")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla de solicitudes */}
      <Card>
        {/* Tabs de estado de tratamiento */}
        <div className="px-6 pt-4">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("pendientes")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === "pendientes"
                  ? "text-amber-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("planner_tab_pendientes", "Pendientes")}
                {tabCounts.pendientes > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-amber-500 rounded-full">
                    {tabCounts.pendientes}
                  </span>
                )}
              </span>
              {activeTab === "pendientes" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("en_progreso")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === "en_progreso"
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                {t("planner_tab_en_progreso", "En Progreso")}
                {tabCounts.en_progreso > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-blue-500 rounded-full">
                    {tabCounts.en_progreso}
                  </span>
                )}
              </span>
              {activeTab === "en_progreso" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("finalizadas")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === "finalizadas"
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {t("planner_tab_finalizadas", "Finalizadas")}
                {tabCounts.finalizadas > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-medium text-slate-500 bg-slate-100 rounded-full">
                    {tabCounts.finalizadas}
                  </span>
                )}
              </span>
              {activeTab === "finalizadas" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
              )}
            </button>
          </div>
        </div>

        <CardHeader className="px-6 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>
              {filtered.length} {filtered.length === 1 ? t("planner_solicitud", "solicitud") : t("planner_solicitudes", "solicitudes")}
            </CardDescription>
          </div>
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
            <Button onClick={rechazar} type="button">
              {t("planner_confirmar_rechazo", "Confirmar Rechazo")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            {t("planner_rechazar_motivo_label", "Motivo del rechazo")} <span className="text-red-600">*</span>
          </p>
          <textarea
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-blue-300 ring-1 ring-blue-100 bg-white/50 text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all"
            placeholder={t("planner_rechazar_placeholder", "Explica brevemente el motivo del rechazo...")}
          />
        </div>
      </Modal>

      {/* Modal Historial de Estados */}
      <Modal
        isOpen={historialModal.open}
        onClose={() => setHistorialModal({ open: false, solicitud: null })}
        title={`${t("planner_historial_titulo", "Historial de Estados")} - Solicitud #${historialModal.solicitud?.id}`}
        size="md"
      >
        {historialModal.solicitud && (
          <div className="space-y-4">
            {/* Estado Actual */}
            <div className="p-4 rounded-lg bg-slate-50/70 border border-white/30">
              <h4 className="text-xs uppercase font-bold tracking-[0.08em] text-slate-500 mb-2">
                {t("planner_historial_estado_actual", "Estado Actual")}
              </h4>
              {(() => {
                const estadoVal = historialModal.solicitud.status || historialModal.solicitud.estado || "Pendiente";
                const config = getEstadoConfig(estadoVal);
                return (
                  <div className="flex items-center gap-2" style={{ color: config.color }}>
                    {config.icon}
                    <span className="text-lg font-semibold">{config.label}</span>
                  </div>
                );
              })()}
            </div>

            {/* Timeline de estados */}
            <div className="space-y-3">
              {/* Creación */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-white/30">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {t("planner_historial_creada", "Solicitud Creada")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(historialModal.solicitud.created_at)}
                    {historialModal.solicitud.solicitante_nombre && (
                      <> • {historialModal.solicitud.solicitante_nombre} {historialModal.solicitud.solicitante_apellido || ""}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Aprobación (si fue aprobada) */}
              {(historialModal.solicitud.status || historialModal.solicitud.estado || "").toLowerCase().includes("aprobad") && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-white/30">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {t("planner_historial_aprobada", "Aprobada por Coordinador")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {historialModal.solicitud.aprobado_at ? formatDate(historialModal.solicitud.aprobado_at) : t("planner_historial_fecha_no_disponible", "Fecha no disponible")}
                      {historialModal.solicitud.aprobador_nombre && (
                        <> • {historialModal.solicitud.aprobador_nombre} {historialModal.solicitud.aprobador_apellido || ""}</>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Asignación a Planificador */}
              {historialModal.solicitud.planner_nombre && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-white/30">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <Play className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {t("planner_historial_asignada", "Asignada a Planificador")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {historialModal.solicitud.planner_nombre} {historialModal.solicitud.planner_apellido || ""}
                    </p>
                  </div>
                </div>
              )}

              {/* En Progreso */}
              {(historialModal.solicitud.status || historialModal.solicitud.estado || "").toLowerCase().includes("progreso") && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-white/30">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {t("planner_historial_en_progreso", "En Progreso")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("planner_historial_tratamiento", "En tratamiento por el planificador")}
                    </p>
                  </div>
                </div>
              )}

              {/* Rechazada */}
              {(historialModal.solicitud.status || historialModal.solicitud.estado || "").toLowerCase().includes("rechaz") && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 border border-white/30">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {t("planner_historial_rechazada", "Rechazada")}
                    </p>
                    {historialModal.solicitud.motivo_rechazo && (
                      <p className="text-xs text-slate-500 mt-1">
                        {t("planner_historial_motivo", "Motivo")}: {historialModal.solicitud.motivo_rechazo}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
