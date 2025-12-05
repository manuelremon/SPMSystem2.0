import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { solicitudes, admin } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { useDebounced } from "../hooks/useDebounced";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { SearchInput } from "../components/ui/SearchInput";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { DataTable } from "../components/ui/DataTable";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import StatusBadge from "../components/ui/StatusBadge";
import { TableSkeleton, StatCardSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatDate, formatDateTime, formatCurrency, exportToExcel, getSectorNombre } from "../utils/formatters";
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
} from "lucide-react";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

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

  // Cargar sectores desde el backend
  useEffect(() => {
    const fetchSectores = async () => {
      try {
        const res = await admin.list('sectores');
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
      setTimeout(() => setSuccess(""), 3000);
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
      setTimeout(() => setSuccess(""), 3000);
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
      Fecha: formatDate(s.fecha_creacion || s.created_at),
    }));
    exportToExcel(dataToExport, `mis-solicitudes-${new Date().toISOString().split("T")[0]}.xls`);
    setSuccess(t("mis_export_success", "Datos exportados correctamente"));
    setTimeout(() => setSuccess(""), 3000);
  }, [filtered, sectores, t]);

  // Columnas de la tabla (memoizadas para evitar re-renders)
  const columns = useMemo(() => [
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => <span className="font-semibold text-[var(--fg)]">{row.id}</span>,
    },
    {
      key: "justificacion",
      header: t("mis_col_asunto", "Asunto"),
      sortAccessor: (row) => (row.justificacion || row.asunto || "").toLowerCase(),
      render: (row) => (
        <div className="max-w-xs truncate" title={row.justificacion || row.asunto}>
          {row.justificacion || row.asunto || t("mis_col_asunto", "Solicitud")}
        </div>
      ),
    },
    {
      key: "centro",
      header: t("mis_col_centro", "Centro"),
      sortAccessor: (row) => row.centro || row.centro_id || "",
      render: (row) => row.centro || row.centro_id || "-",
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
        const isAlta = criticidad.toLowerCase().includes("alta");
        return (
          <Badge variant={isAlta ? "danger" : "default"} className="uppercase text-xs font-semibold">
            {criticidad}
          </Badge>
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
          <span className="font-mono text-sm text-[var(--fg)]">
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
        const estado = row.estado || row.status || "pendiente";
        return <StatusBadge estado={estado} />;
      },
    },
    {
      key: "fecha_creacion",
      header: t("mis_col_fecha", "Fecha"),
      sortAccessor: (row) => new Date(row.fecha_creacion || row.created_at || 0).getTime(),
      render: (row) => (
        <span className="text-sm text-[var(--fg-muted)]">
          {formatDate(row.fecha_creacion || row.created_at)}
        </span>
      ),
    },
    {
      key: "acciones",
      header: (
        <div className="flex items-center gap-1.5">
          <span>{t("mis_col_accion", "Acciones")}</span>
          <div className="relative group">
            <HelpCircle
              className="w-4 h-4 text-[var(--fg-muted)] cursor-help hover:text-[var(--primary)] transition-colors"
              aria-label={t("mis_help_title", "Acciones disponibles")}
              role="img"
            />
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.4)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none text-left z-50">
              <div className="absolute -top-1.5 right-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[var(--card)]"></div>
              <p className="text-xs font-semibold text-[var(--fg)] mb-2">{t("mis_help_title", "Acciones disponibles:")}</p>
              <ul className="text-xs text-[var(--fg-muted)] space-y-1.5">
                <li className="flex items-start gap-2">
                  <Edit3 className="w-3 h-3 mt-0.5 text-[var(--warning)] flex-shrink-0" />
                  <span><strong>{t("mis_help_editar", "Editar")}:</strong> {t("mis_help_editar_desc", "Solo borradores propios")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trash2 className="w-3 h-3 mt-0.5 text-[var(--danger)] flex-shrink-0" />
                  <span><strong>{t("mis_help_eliminar", "Eliminar")}:</strong> {t("mis_help_eliminar_desc", "Solo borradores propios")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Eye className="w-3 h-3 mt-0.5 text-[var(--info)] flex-shrink-0" />
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
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                className="px-2.5 py-1.5 text-xs"
                onClick={() => navigate(`/solicitudes/${row.id}/materiales`)}
                title={t("mis_btn_editar", "Editar")}
                aria-label={`${t("mis_btn_editar", "Editar")} solicitud ${row.id}`}
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="danger"
                className="px-2.5 py-1.5 text-xs"
                onClick={() => openDeleteModal(row.id)}
                title={t("mis_btn_eliminar", "Eliminar")}
                aria-label={`${t("mis_btn_eliminar", "Eliminar")} solicitud ${row.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          );
        }

        return (
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-xs flex items-center gap-1.5"
            onClick={() => navigate(`/solicitudes/${row.id}`)}
            aria-label={`${t("mis_btn_ver", "Ver")} solicitud ${row.id}`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            {t("mis_btn_ver", "Ver")}
          </Button>
        );
      },
    },
  ], [t, navigate, sectores, openDeleteModal]);

  return (
    <div className="space-y-6">
      {/* Encabezado de página */}
      <ScrollReveal>
        <PageHeader
          title={t("mis_page_title", "MIS SOLICITUDES")}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex items-center gap-2"
                title={t("mis_btn_refresh", "Actualizar")}
                aria-label={t("mis_btn_refresh", "Actualizar datos")}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
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

      {/* Stats Cards */}
      <ScrollReveal delay={100}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card
              className={clsx(
                "hover:border-[var(--primary)] transition-all duration-200 cursor-pointer",
                "hover:shadow-[0_4px_12px_rgba(255,107,53,0.15)]",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "todas" && "border-[var(--primary)] shadow-glow"
              )}
              onClick={() => setActiveTab("todas")}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">{t("mis_stats_total", "Total")}</p>
                    <p className="text-2xl font-bold text-[var(--fg)] mt-1">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[var(--primary-muted)]/20 grid place-items-center">
                    <FileText className="w-6 h-6 text-[var(--primary)]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={clsx(
                "hover:border-[var(--warning)] transition-all duration-200 cursor-pointer",
                "hover:shadow-[0_4px_12px_rgba(234,179,8,0.15)]",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "borradores" && "border-[var(--warning)] shadow-glow"
              )}
              onClick={() => setActiveTab("borradores")}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">{t("mis_stats_borradores", "Borradores")}</p>
                    <p className="text-2xl font-bold text-[var(--fg)] mt-1">{stats.borradores}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[var(--warning-muted)]/20 grid place-items-center">
                    <Edit3 className="w-6 h-6 text-[var(--warning)]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={clsx(
                "hover:border-[var(--info)] transition-all duration-200 cursor-pointer",
                "hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)]",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "enviadas" && "border-[var(--info)] shadow-glow"
              )}
              onClick={() => setActiveTab("enviadas")}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">{t("mis_stats_enviadas", "Enviadas")}</p>
                    <p className="text-2xl font-bold text-[var(--fg)] mt-1">{stats.enviadas}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[var(--info-muted)]/20 grid place-items-center">
                    <Clock className="w-6 h-6 text-[var(--info)]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={clsx(
                "hover:border-[var(--success)] transition-all duration-200 cursor-pointer",
                "hover:shadow-[0_4px_12px_rgba(34,197,94,0.15)]",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "aprobadas" && "border-[var(--success)] shadow-glow"
              )}
              onClick={() => setActiveTab("aprobadas")}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">{t("mis_stats_aprobadas", "Aprobadas")}</p>
                    <p className="text-2xl font-bold text-[var(--fg)] mt-1">{stats.aprobadas}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[var(--success-muted)]/20 grid place-items-center">
                    <CheckCircle2 className="w-6 h-6 text-[var(--success)]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={clsx(
                "hover:border-[var(--danger)] transition-all duration-200 cursor-pointer",
                "hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)]",
                "hover:scale-[1.02] active:scale-[0.98]",
                activeTab === "rechazadas" && "border-[var(--danger)] shadow-glow"
              )}
              onClick={() => setActiveTab("rechazadas")}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">{t("mis_stats_rechazadas", "Rechazadas/Eliminadas")}</p>
                    <p className="text-2xl font-bold text-[var(--fg)] mt-1">{stats.rechazadas}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-[var(--danger-muted)]/20 grid place-items-center">
                    <XCircle className="w-6 h-6 text-[var(--danger)]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      </ScrollReveal>


      {/* Card principal */}
      <ScrollReveal delay={200}>
      <Card className="transition-all duration-200">
        <CardHeader className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("mis_table_title", "Listado de Solicitudes")}</CardTitle>
              <p className="text-sm text-[var(--fg-muted)] mt-1">
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
              <FileSpreadsheet className="w-4 h-4" />
              {t("mis_btn_export", "Exportar XLS")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-1 space-y-4">
          {/* Filtros y búsqueda */}
          <div className="flex flex-col gap-3">
            {/* Fila 1: Búsqueda y Centro */}
            <div className="flex flex-col md:flex-row gap-3">
              <SearchInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("mis_search", "Buscar por ID, asunto, centro, sector...")}
                className="flex-1"
              />
              <Select
                value={centroFilter}
                onChange={(e) => setCentroFilter(e.target.value)}
                className="md:w-48"
              >
                <option value="">{t("mis_filter_all_centros", "Todos los centros")}</option>
                {centrosUnicos.map((centro) => (
                  <option key={centro} value={centro}>
                    {centro}
                  </option>
                ))}
              </Select>
            </div>

            {/* Fila 2: Filtros de fecha */}
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 md:flex-none">
                <label htmlFor="fecha-desde" className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                  {t("mis_filter_desde", "Desde")}
                </label>
                <Input
                  id="fecha-desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  aria-label={t("mis_filter_desde", "Desde")}
                  className="w-full md:w-40"
                />
              </div>
              <div className="flex-1 md:flex-none">
                <label htmlFor="fecha-hasta" className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                  {t("mis_filter_hasta", "Hasta")}
                </label>
                <Input
                  id="fecha-hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  aria-label={t("mis_filter_hasta", "Hasta")}
                  className="w-full md:w-40"
                />
              </div>
              {(fechaDesde || fechaHasta) && (
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={() => {
                    setFechaDesde("");
                    setFechaHasta("");
                  }}
                >
                  {t("mis_clear_dates", "Limpiar fechas")}
                </Button>
              )}
            </div>
          </div>

          {/* Loading skeleton o tabla */}
          {loading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={paginatedItems}
                emptyMessage={
                  filtered.length === 0 && items.length > 0 ? (
                    <EmptyState
                      icon={<Search className="w-8 h-8 text-[var(--fg-subtle)]" />}
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
                      icon={<Inbox className="w-8 h-8 text-[var(--fg-subtle)]" />}
                      title={t("mis_empty_title", "No tienes solicitudes")}
                      description={t("mis_empty_desc", "Crea tu primera solicitud de materiales para comenzar")}
                      action={
                        <Button onClick={() => navigate("/solicitudes/nueva")}>
                          <FilePlus2 className="w-4 h-4 mr-2" />
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
    </div>
  );
}
