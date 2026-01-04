import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useDebounced } from "../hooks/useDebounced";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SearchInput } from "../components/ui/SearchInput";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { withSpmAlignments } from "../utils/tableAlignments";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Modal } from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatDate, formatDateTime, formatCurrency, exportToExcel, getSectorNombre, formatAlmacen } from "../utils/formatters";
import { ExportButton } from "../components/export/ExportButton";
import exportService from "../services/export";
import { getCriticidadConfig } from "../utils/styleConfig";
import { InfoTooltip } from "../components/ui/Tooltip";
import {
  FileSpreadsheet,
  FilePlus2,
  Trash2,
  Edit3,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Inbox,
  HelpCircle,
  RefreshCw,
  Calendar,
  Building2,
  MapPin,
  Package,
  DollarSign,
  AlertTriangle,
  User,
  Hash,
  ICON_COLORS,
} from "../components/ui/Icons";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

// Componente helper para mostrar filas de detalle
function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-white/30 dark:border-slate-700/30 grid place-items-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm text-slate-800 dark:text-slate-200">{value || "-"}</p>
      </div>
    </div>
  );
}

export default function MisSolicitudes() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);

  // Filtros
  const [centroFilter, setCentroFilter] = useState("");
  const [activeTab, setActiveTab] = useState("todas");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de confirmación para eliminar
  const [deleteModal, setDeleteModal] = useState({ open: false, solicitudId: null });
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de detalle de solicitud
  const [detalleModal, setDetalleModal] = useState({ open: false, solicitud: null });

  // Auto-clear success messages with proper cleanup to prevent memory leaks
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Cargar sectores desde el backend (endpoint público)
  useEffect(() => {
    const fetchSectores = async () => {
      try {
        const res = await api.get('/catalogos/sectores');
        const data = Array.isArray(res.data) ? res.data : [];
        setSectores(data);
      } catch (err) {
        console.error('Error cargando sectores:', err);
      }
    };
    fetchSectores();
  }, []);

  // Función para cargar solicitudes (reutilizable)
  const fetchSolicitudes = useCallback(async (showLoading = true) => {
    if (!user?.id) return;
    if (showLoading) setLoading(true);
    try {
      const res = await solicitudes.listar({ user_id: user.id });
      const data = res.data.solicitudes || res.data.results || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  // Función de refresh manual
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await solicitudes.listar({ user_id: user.id });
      const data = res.data.solicitudes || res.data.results || [];
      setItems(data);
      setSuccess(t("mis_refresh_success", "Datos actualizados"));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setRefreshing(false);
    }
  }, [user, t]);

  // Filtrado avanzado
  const filtered = useMemo(() => {
    let result = items;

    // Filtro por tab activo
    if (activeTab !== "todas") {
      result = result.filter((s) => {
        const estado = (s.estado || s.status || "").toLowerCase();
        if (activeTab === "borradores") return estado === "borrador";
        if (activeTab === "enviadas") return estado === "enviada" || estado === "pendiente_de_aprobacion";
        if (activeTab === "aprobadas") return estado === "aprobada";
        if (activeTab === "rechazadas") return estado === "rechazada" || estado === "eliminada";
        return true;
      });
    }

    // Filtro de búsqueda
    const term = debouncedQ.trim().toLowerCase();
    if (term) {
      result = result.filter((s) => {
        return (
          String(s.id).includes(term) ||
          (s.asunto || "").toLowerCase().includes(term) ||
          (s.justificacion || "").toLowerCase().includes(term) ||
          (s.descripcion || "").toLowerCase().includes(term) ||
          (s.estado || s.status || "").toLowerCase().includes(term) ||
          (s.centro || "").toLowerCase().includes(term) ||
          (s.sector || "").toLowerCase().includes(term)
        );
      });
    }

    // Filtro por centro
    if (centroFilter) {
      result = result.filter((s) => (s.centro || s.centro_id || "") === centroFilter);
    }

    // Filtro por rango de fechas
    if (fechaDesde) {
      const desde = new Date(fechaDesde);
      desde.setHours(0, 0, 0, 0);
      result = result.filter((s) => {
        const fecha = new Date(s.fecha_creacion || s.created_at);
        return fecha >= desde;
      });
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      result = result.filter((s) => {
        const fecha = new Date(s.fecha_creacion || s.created_at);
        return fecha <= hasta;
      });
    }

    // Ordenar por fecha de creación descendente (más recientes primero)
    result.sort((a, b) => {
      const fechaA = new Date(a.fecha_creacion || a.created_at || 0).getTime();
      const fechaB = new Date(b.fecha_creacion || b.created_at || 0).getTime();
      return fechaB - fechaA;
    });

    return result;
  }, [items, debouncedQ, centroFilter, activeTab, fechaDesde, fechaHasta]);

  // Paginación
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Reset página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ, centroFilter, activeTab, fechaDesde, fechaHasta]);

  // Obtener centros únicos
  const centrosUnicos = useMemo(() => {
    const centros = new Set(items.map((s) => s.centro || s.centro_id).filter(Boolean));
    return Array.from(centros).sort();
  }, [items]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const total = items.length;
    const borradores = items.filter(s => (s.estado || s.status || "").toLowerCase() === "borrador").length;
    const enviadas = items.filter(s => {
      const estado = (s.estado || s.status || "").toLowerCase();
      return estado === "enviada" || estado === "pendiente_de_aprobacion";
    }).length;
    const aprobadas = items.filter(s => (s.estado || s.status || "").toLowerCase() === "aprobada").length;
    const rechazadas = items.filter(s => {
      const estado = (s.estado || s.status || "").toLowerCase();
      return estado === "rechazada" || estado === "eliminada";
    }).length;

    return { total, borradores, enviadas, aprobadas, rechazadas };
  }, [items]);

  // Abrir modal de confirmación para eliminar
  const openDeleteModal = useCallback((id) => {
    setDeleteModal({ open: true, solicitudId: id });
  }, []);

  // Eliminar solicitud (solo borradores)
  const handleEliminar = useCallback(async () => {
    const id = deleteModal.solicitudId;
    if (!id) return;

    setDeleting(true);
    try {
      await solicitudes.eliminar(id);
      setSuccess(t("mis_delete_success", "Solicitud eliminada correctamente"));
      setItems((prev) => prev.filter((s) => s.id !== id));
      setDeleteModal({ open: false, solicitudId: null });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setDeleting(false);
    }
  }, [deleteModal.solicitudId, t]);

  // Exportar
  const handleExport = useCallback(() => {
    const dataToExport = filtered.map((s) => ({
      ID: s.id,
      Justificacion: s.justificacion || s.asunto || "",
      Centro: s.centro || s.centro_id || "",
      Sector: getSectorNombre(s.sector || s.sector_id, sectores),
      Criticidad: s.criticidad || "Normal",
      Monto: s.total_monto || 0,
      Estado: s.estado || s.status || "",
      Planificador: `${s.planner_nombre || ""} ${s.planner_apellido || ""}`.trim() || "-",
      Fecha: formatDate(s.fecha_creacion || s.created_at),
    }));
    exportToExcel(dataToExport, `mis-solicitudes-${new Date().toISOString().split("T")[0]}.xls`);
    setSuccess(t("mis_export_success", "Datos exportados correctamente"));
  }, [filtered, sectores, t]);

  // Columnas de la tabla (memoizadas para evitar re-renders, con alineación SPM automática)
  const columns = useMemo(() => withSpmAlignments([
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => <span className="font-semibold text-slate-700">{row.id}</span>,
    },
    {
      key: "fecha_creacion",
      header: t("mis_col_fecha", "Fecha"),
      sortAccessor: (row) => new Date(row.fecha_creacion || row.created_at || 0).getTime(),
      render: (row) => (
        <span className="text-sm text-slate-500">
          {formatDate(row.fecha_creacion || row.created_at)}
        </span>
      ),
    },
    {
      key: "justificacion",
      header: t("mis_col_justificacion", "Justificación"),
      sortAccessor: (row) => (row.justificacion || row.asunto || "").toLowerCase(),
      render: (row) => {
        const texto = row.justificacion || row.asunto || "-";
        const MAX_CHARS = 15;
        const truncado = texto.length > MAX_CHARS;
        const textoVisible = truncado ? texto.slice(0, MAX_CHARS) + "..." : texto;

        if (truncado) {
          return (
            <button
              type="button"
              onClick={() => setDetalleModal({ open: true, solicitud: row })}
              className="text-left text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              title={t("mis_click_ver_completo", "Click para ver completo")}
            >
              {textoVisible}
            </button>
          );
        }

        return <span>{textoVisible}</span>;
      },
    },
    {
      key: "centro",
      header: t("mis_col_centro", "Centro"),
      sortAccessor: (row) => row.centro || row.centro_id || "",
      render: (row) => row.centro || row.centro_id || "-",
    },
    {
      key: "almacen",
      header: t("mis_col_almacen", "Almacén"),
      sortAccessor: (row) => row.almacen_virtual || row.almacen || "",
      render: (row) => formatAlmacen(row.almacen_virtual || row.almacen) || "-",
    },
    {
      key: "sector",
      header: t("mis_col_sector", "Sector"),
      sortAccessor: (row) => getSectorNombre(row.sector || row.sector_id, sectores),
      render: (row) => getSectorNombre(row.sector || row.sector_id, sectores),
    },
    {
      key: "criticidad",
      header: t("mis_col_criticidad", "Criticidad"),
      sortAccessor: (row) => (row.criticidad || "Normal").toLowerCase(),
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
    },
    {
      key: "total_monto",
      header: t("mis_col_monto", "Monto"),
      sortAccessor: (row) => Number(row.total_monto || 0),
      render: (row) => {
        const monto = Number(row.total_monto || 0);
        return (
          <span className="font-mono text-sm text-slate-700">
            {formatCurrency(monto)}
          </span>
        );
      },
    },
    {
      key: "estado",
      header: t("mis_estado", "Estado"),
      sortAccessor: (row) => (row.estado || row.status || "").toLowerCase(),
      render: (row) => {
        const estado = (row.estado || row.status || "pendiente").toLowerCase();
        const plannerNombre = row.planner_nombre ? `${row.planner_nombre} ${row.planner_apellido || ""}`.trim() : null;
        const aprobadorNombre = row.aprobador_nombre ? `${row.aprobador_nombre} ${row.aprobador_apellido || ""}`.trim() : null;

        // Generar información del tooltip según el estado
        const getTooltipInfo = () => {
          switch (estado) {
            case "borrador":
            case "draft":
              return {
                title: t("estado_borrador_title", "Borrador"),
                lines: [t("estado_borrador_desc", "Solicitud en borrador. Completa los datos y envíala para su aprobación.")]
              };
            case "enviada":
            case "pendiente_de_aprobacion":
            case "submitted":
              if (aprobadorNombre) {
                return {
                  title: t("estado_enviada_title", "Pendiente de aprobación"),
                  lines: [
                    t("estado_enviada_esperando", "Esperando aprobación de:"),
                    `→ ${aprobadorNombre}`
                  ]
                };
              }
              return {
                title: t("estado_enviada_title", "Pendiente de aprobación"),
                lines: [t("estado_enviada_desc", "Esperando aprobación del coordinador o jefe de área.")]
              };
            case "aprobada":
            case "approved":
              if (plannerNombre) {
                return {
                  title: t("estado_aprobada_title", "Aprobada"),
                  lines: [
                    aprobadorNombre ? `${t("estado_aprobada_por", "Aprobada por:")} ${aprobadorNombre}` : null,
                    t("estado_aprobada_asignada", "Asignada al planificador:"),
                    `→ ${plannerNombre}`
                  ].filter(Boolean)
                };
              }
              return {
                title: t("estado_aprobada_title", "Aprobada"),
                lines: [
                  aprobadorNombre ? `${t("estado_aprobada_por", "Aprobada por:")} ${aprobadorNombre}` : null,
                  t("estado_aprobada_desc", "Pendiente de asignación a planificador.")
                ].filter(Boolean)
              };
            case "rechazada":
            case "rejected":
              return {
                title: t("estado_rechazada_title", "Rechazada"),
                lines: [
                  aprobadorNombre ? `${t("estado_rechazada_por", "Rechazada por:")} ${aprobadorNombre}` : null,
                  t("estado_rechazada_desc", "Revisa los comentarios del aprobador.")
                ].filter(Boolean)
              };
            case "en_tratamiento":
            case "processing":
              return {
                title: t("estado_tratamiento_title", "En tratamiento"),
                lines: plannerNombre
                  ? [`${t("estado_tratamiento_por", "Siendo procesada por:")} ${plannerNombre}`]
                  : [t("estado_tratamiento_desc", "El planificador está procesando la solicitud.")]
              };
            case "despachada":
            case "dispatched":
              return {
                title: t("estado_despachada_title", "Despachada"),
                lines: [t("estado_despachada_desc", "Los materiales han sido despachados.")]
              };
            case "cerrada":
            case "closed":
              return {
                title: t("estado_cerrada_title", "Cerrada"),
                lines: [t("estado_cerrada_desc", "Solicitud completada y cerrada.")]
              };
            default:
              return { title: estado, lines: [] };
          }
        };

        const tooltipInfo = getTooltipInfo();

        return (
          <InfoTooltip title={tooltipInfo.title} lines={tooltipInfo.lines} position="bottom">
            <StatusBadge estado={estado} />
          </InfoTooltip>
        );
      },
    },
    {
      key: "planificador",
      header: t("mis_col_planificador", "Planificador"),
      sortAccessor: (row) => {
        const nombre = row.planner_nombre || "";
        const apellido = row.planner_apellido || "";
        return `${nombre} ${apellido}`.trim().toLowerCase();
      },
      render: (row) => {
        const nombre = row.planner_nombre || "";
        const apellido = row.planner_apellido || "";
        const nombreCompleto = `${nombre} ${apellido}`.trim();

        if (!nombreCompleto) {
          return <span className="text-slate-400">—</span>;
        }

        return (
          <span className="text-sm text-slate-700" title={nombreCompleto}>
            {nombreCompleto}
          </span>
        );
      },
    },
    {
      key: "acciones",
      header: (
        <div className="flex items-center gap-1.5">
          <span>{t("mis_col_accion", "Acciones")}</span>
          <div className="relative group">
            <HelpCircle
              className="w-4 h-4 text-slate-500 cursor-help hover:text-blue-600 transition-colors"
              aria-label={t("mis_help_title", "Acciones disponibles")}
              role="img"
            />
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-white/50 dark:border-slate-700/50 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none text-left z-50">
              <div className="absolute -top-1.5 right-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white/90 dark:border-b-slate-800/90"></div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">{t("mis_help_title", "Acciones disponibles:")}</p>
              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                <li className="flex items-start gap-2">
                  <Edit3 className={`w-3 h-3 mt-0.5 ${ICON_COLORS.warning} flex-shrink-0`} />
                  <span><strong>{t("mis_help_editar", "Editar")}:</strong> {t("mis_help_editar_desc", "Solo borradores propios")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trash2 className={`w-3 h-3 mt-0.5 ${ICON_COLORS.danger} flex-shrink-0`} />
                  <span><strong>{t("mis_help_eliminar", "Eliminar")}:</strong> {t("mis_help_eliminar_desc", "Solo borradores propios")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Eye className={`w-3 h-3 mt-0.5 ${ICON_COLORS.info} flex-shrink-0`} />
                  <span><strong>{t("mis_help_ver", "Ver")}:</strong> {t("mis_help_ver_desc", "Todas tus solicitudes")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
      render: (row) => {
        const estado = (row.estado || row.status || "").toLowerCase();

        // Acciones contextuales por estado
        if (estado === "borrador") {
          return (
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="icon-warning"
                size="icon-sm"
                onClick={() => navigate(`/solicitudes/${row.id}/materiales`)}
                title={t("mis_btn_editar", "Editar")}
                aria-label={`${t("mis_btn_editar", "Editar")} solicitud ${row.id}`}
              >
                <Edit3 className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="icon-danger"
                size="icon-sm"
                onClick={() => openDeleteModal(row.id)}
                title={t("mis_btn_eliminar", "Eliminar")}
                aria-label={`${t("mis_btn_eliminar", "Eliminar")} solicitud ${row.id}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-center">
            <Button
              variant="icon-primary"
              size="icon-sm"
              onClick={() => setDetalleModal({ open: true, solicitud: row })}
              title={t("mis_btn_ver", "Ver")}
              aria-label={`${t("mis_btn_ver", "Ver")} solicitud ${row.id}`}
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ]), [t, navigate, sectores, openDeleteModal, setDetalleModal]);

  return (
    <div className="space-y-6">
      {/* Encabezado de página */}
      <ScrollReveal>
        <PageHeader
          title={t("mis_page_title", "MIS SOLICITUDES")}
          actions={
            <div className="flex items-center gap-2">
              <ExportButton
                onExport={(formato) => exportService.exportSolicitudes({ formato })}
                label={t("common_export", "Exportar")}
              />
              <Button
                variant="ghost"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex items-center gap-2"
                title={t("mis_btn_refresh", "Actualizar")}
                aria-label={t("mis_btn_refresh", "Actualizar datos")}
              >
                <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={() => navigate("/solicitudes/nueva")}
                className="flex items-center gap-2"
              >
                <FilePlus2 className="w-4 h-4" />
                {t("nav_nueva", "Nueva Solicitud")}
              </Button>
            </div>
          }
        />
      </ScrollReveal>

      {/* Mensajes */}
      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>}

      {/* Tabs de filtro por estado */}
      <ScrollReveal delay={100}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-wrap gap-1">
            <TabsTrigger value="todas" className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${ICON_COLORS.info}`} />
              <span>{t("mis_stats_total", "Todas")}</span>
              <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-soft)] text-[var(--fg-muted)]">
                {stats.total}
              </span>
            </TabsTrigger>
            <TabsTrigger value="borradores" className="flex items-center gap-2">
              <Edit3 className={`w-4 h-4 ${ICON_COLORS.primary}`} />
              <span>{t("mis_stats_borradores", "Borradores")}</span>
              {stats.borradores > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-soft)] text-[var(--fg-muted)]">
                  {stats.borradores}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="enviadas" className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${ICON_COLORS.time}`} />
              <span>{t("mis_stats_enviadas", "Enviadas")}</span>
              {stats.enviadas > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-soft)] text-[var(--fg-muted)]">
                  {stats.enviadas}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="aprobadas" className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${ICON_COLORS.success}`} />
              <span>{t("mis_stats_aprobadas", "Aprobadas")}</span>
              {stats.aprobadas > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-soft)] text-[var(--fg-muted)]">
                  {stats.aprobadas}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rechazadas" className="flex items-center gap-2">
              <XCircle className={`w-4 h-4 ${ICON_COLORS.danger}`} />
              <span>{t("mis_stats_rechazadas", "Rechazadas")}</span>
              {stats.rechazadas > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-soft)] text-[var(--fg-muted)]">
                  {stats.rechazadas}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </ScrollReveal>


      {/* Card principal */}
      <ScrollReveal delay={200}>
      <Card className="transition-all duration-200">
        <CardHeader className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("mis_table_title", "Listado de Solicitudes")}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {filtered.length} {filtered.length === 1 ? t("mis_solicitud", "solicitud") : t("mis_solicitudes", "solicitudes")}
                {activeTab !== "todas" && ` - ${t(`mis_tab_${activeTab}`, activeTab)}`}
              </p>
            </div>
            <Button
              variant="secondary"
              className="flex items-center gap-2"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <FileSpreadsheet className={`w-4 h-4 ${ICON_COLORS.success}`} />
              {t("mis_btn_export", "Exportar XLS")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-1 space-y-4">
          {/* Filtros y búsqueda - Una sola fila */}
          <div className="flex flex-col md:flex-row gap-3 items-end">
            {/* Búsqueda */}
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("mis_search", "Buscar por ID, asunto, centro, sector...")}
              className="flex-1"
            />

            {/* Fecha Desde */}
            <div className="flex-shrink-0">
              <label htmlFor="fecha-desde" className="block text-xs font-medium text-slate-500 mb-1">
                {t("mis_filter_desde", "Desde")}
              </label>
              <Input
                id="fecha-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                aria-label={t("mis_filter_desde", "Desde")}
                className="w-36"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="flex-shrink-0">
              <label htmlFor="fecha-hasta" className="block text-xs font-medium text-slate-500 mb-1">
                {t("mis_filter_hasta", "Hasta")}
              </label>
              <Input
                id="fecha-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                aria-label={t("mis_filter_hasta", "Hasta")}
                className="w-36"
              />
            </div>

            {/* Limpiar fechas */}
            {(fechaDesde || fechaHasta) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-9 px-2"
                onClick={() => {
                  setFechaDesde("");
                  setFechaHasta("");
                }}
                title={t("mis_clear_dates", "Limpiar fechas")}
              >
                ✕
              </Button>
            )}

            {/* Centro */}
            <Select
              value={centroFilter}
              onChange={(e) => setCentroFilter(e.target.value)}
              className="w-44"
            >
              <option value="">{t("mis_filter_all_centros", "Todos los centros")}</option>
              {centrosUnicos.map((centro) => (
                <option key={centro} value={centro}>
                  {centro}
                </option>
              ))}
            </Select>
          </div>

          {/* Loading skeleton o tabla */}
          {loading ? (
            <TableSkeleton rows={5} columns={9} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={paginatedItems}
                emptyMessage={
                  filtered.length === 0 && items.length > 0 ? (
                    <EmptyState
                      icon={<Search className="w-8 h-8 text-blue-500" />}
                      title={t("mis_no_results_title", "Sin resultados")}
                      description={t("mis_no_results", "No hay solicitudes que coincidan con los filtros aplicados")}
                      action={
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setQ("");
                            setCentroFilter("");
                            setActiveTab("todas");
                            setFechaDesde("");
                            setFechaHasta("");
                          }}
                        >
                          {t("mis_clear_filters", "Limpiar filtros")}
                        </Button>
                      }
                    />
                  ) : items.length === 0 ? (
                    <EmptyState
                      icon={<Inbox className="w-8 h-8 text-slate-500" />}
                      title={t("mis_empty_title", "No tienes solicitudes")}
                      description={t("mis_empty_desc", "Crea tu primera solicitud de materiales para comenzar")}
                      action={
                        <Button onClick={() => navigate("/solicitudes/nueva")}>
                          <FilePlus2 className="w-4 h-4" />
                          {t("nav_nueva", "Nueva Solicitud")}
                        </Button>
                      }
                    />
                  ) : null
                }
              />

              {/* Paginación */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setCurrentPage}
                labels={{
                  page: t("mis_page", "Página"),
                  of: t("mis_of", "de"),
                  showing: t("mis_showing", "Mostrando"),
                  prev: t("mis_prev", "Anterior"),
                  next: t("mis_next", "Siguiente"),
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
      </ScrollReveal>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, solicitudId: null })}
        onConfirm={handleEliminar}
        title={t("mis_delete_title", "Eliminar solicitud")}
        description={t("mis_delete_desc", "¿Estás seguro de eliminar esta solicitud? Esta acción no se puede deshacer.")}
        confirmText={t("mis_delete_confirm", "Eliminar")}
        cancelText={t("common_cancel", "Cancelar")}
        variant="danger"
        loading={deleting}
      />

      {/* Modal de detalle de solicitud */}
      <Modal
        isOpen={detalleModal.open}
        onClose={() => setDetalleModal({ open: false, solicitud: null })}
        title={`${t("detalle_title", "Solicitud")} #${detalleModal.solicitud?.id || ""}`}
        size="xl"
      >
        {detalleModal.solicitud && (
          <div className="space-y-6">
            {/* Estado actual */}
            <div className="flex items-center justify-between">
              <StatusBadge estado={detalleModal.solicitud.estado || detalleModal.solicitud.status || "pendiente"} />
              {detalleModal.solicitud.criticidad && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                  detalleModal.solicitud.criticidad.toLowerCase().includes("alta")
                    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                }`}>
                  {detalleModal.solicitud.criticidad}
                </span>
              )}
            </div>

            {/* Información General y Ubicación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información General */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/30">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  {t("detalle_info_general", "Información General")}
                </h4>
                <DetailRow icon={Hash} label={t("detalle_id", "ID")} value={detalleModal.solicitud.id} />
                <DetailRow icon={Calendar} label={t("detalle_fecha_creacion", "Creación")} value={formatDate(detalleModal.solicitud.created_at)} />
                <DetailRow icon={Clock} label={t("detalle_fecha_necesidad", "Fecha Necesidad")} value={formatDate(detalleModal.solicitud.fecha_necesidad)} />
              </div>

              {/* Ubicación */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/30">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  {t("detalle_ubicacion", "Ubicación")}
                </h4>
                <DetailRow icon={Building2} label={t("detalle_centro", "Centro")} value={detalleModal.solicitud.centro} />
                <DetailRow icon={MapPin} label={t("detalle_sector", "Sector")} value={getSectorNombre(detalleModal.solicitud.sector, sectores)} />
                <DetailRow icon={Package} label={t("detalle_almacen", "Almacén")} value={formatAlmacen(detalleModal.solicitud.almacen_virtual)} />
              </div>
            </div>

            {/* Justificación */}
            {detalleModal.solicitud.justificacion && (
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t("detalle_justificacion", "Justificación")}
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300">{detalleModal.solicitud.justificacion}</p>
              </div>
            )}

            {/* Items */}
            {detalleModal.solicitud.items && detalleModal.solicitud.items.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                  {t("detalle_items", "Materiales")} ({detalleModal.solicitud.items.length})
                </h4>
                <div className="border border-white/30 dark:border-slate-700/30 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">{t("detalle_codigo", "Código")}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">{t("detalle_descripcion", "Descripción")}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">{t("detalle_cantidad", "Cant.")}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">{t("detalle_precio", "Precio")}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{t("detalle_subtotal", "Subtotal")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/30 dark:divide-slate-700/30">
                      {detalleModal.solicitud.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 border-r border-b border-slate-200 dark:border-slate-700">{item.codigo || item.codigo_sap}</td>
                          <td className="px-4 py-2 text-slate-800 dark:text-slate-200 border-r border-b border-slate-200 dark:border-slate-700">{item.descripcion}</td>
                          <td className="px-4 py-2 text-right font-semibold border-r border-b border-slate-200 dark:border-slate-700">{item.cantidad}</td>
                          <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400 border-r border-b border-slate-200 dark:border-slate-700">{formatCurrency(item.precio_unitario || 0)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                            {formatCurrency((item.cantidad || 0) * (item.precio_unitario || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/70 dark:bg-slate-800/70">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                          {t("detalle_total", "Total")}:
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(detalleModal.solicitud.total_monto || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Botón para ir a detalle completo */}
            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDetalleModal({ open: false, solicitud: null });
                  navigate(`/solicitudes/${detalleModal.solicitud.id}`);
                }}
              >
                {t("detalle_ver_completo", "Ver detalle completo")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
