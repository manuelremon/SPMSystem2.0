import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { KPIGridSkeleton } from "../components/dashboard/DashboardSkeleton";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { cachedGet } from "../services/cachedApi";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import StatusBadge from "../components/ui/StatusBadge";
import { formatCurrency, formatAlmacen, formatDate } from "../utils/formatters";
import { getCriticidadConfig } from "../utils/styleConfig";
import { useTrendData } from '../components/dashboard/TrendChart';
import { useDashboardLayout } from "../hooks/useDashboardLayout";
// MUI Components
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RestoreIcon from '@mui/icons-material/Restore';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
// Sub-components (extracted for maintainability)
import { SolicitudesSection } from './DashboardAdmin/index';
import { FiltersBar } from './DashboardAdmin/index';
import { KPIRow1 } from './DashboardAdmin/index';
import { KPIRow2 } from './DashboardAdmin/index';
import { KPIRow3 } from './DashboardAdmin/index';
import { ExpandedCardDialog } from './DashboardAdmin/index';
import { AttentionBanner } from './DashboardAdmin/index';
import { QuickActions } from './DashboardAdmin/index';
import { OperationsOverview } from './DashboardAdmin/index';
import { KPIRow4 } from './DashboardAdmin/index';
import DrillDownModal from '../components/dashboard/DrillDownModal';

// ============================================================================
// AG-Grid column definitions for solicitudes table
// ============================================================================

function getTableColumnsAgGrid(t) {
  return [
    {
      field: "id", headerName: "ID", width: 80, flex: 0,
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontFamily: "monospace", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", color: "slate.700" }}>
          {params.data?.id}
        </Typography>
      ),
    },
    {
      field: "solicitante", headerName: t("dash_table_solicitante", "Solicitante"), minWidth: 150,
      valueGetter: (params) => [params.data?.solicitante_nombre, params.data?.solicitante_apellido].filter(Boolean).join(" ").trim() || "-",
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary", fontWeight: 500 }}>
          {[params.data?.solicitante_nombre, params.data?.solicitante_apellido].filter(Boolean).join(" ").trim() || "-"}
        </Typography>
      ),
    },
    {
      field: "created_at", headerName: t("dash_table_fecha", "Fecha"), minWidth: 100,
      valueGetter: (params) => params.data?.created_at ? new Date(params.data.created_at).getTime() : 0,
      valueFormatter: (params) => formatDate(params.data?.created_at),
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
          {formatDate(params.data?.created_at)}
        </Typography>
      ),
    },
    {
      field: "estado", headerName: t("dash_table_estado", "Estado"), minWidth: 120,
      cellRenderer: (params) => {
        const row = params.data;
        return (
          <StatusBadge
            estado={row?.estado || row?.status || "Desconocido"}
            showIcon={false}
            tooltipInfo={{
              aprobador: [row?.aprobador_nombre, row?.aprobador_apellido].filter(Boolean).join(" ").trim() || null,
              planificador: [row?.planner_nombre, row?.planner_apellido].filter(Boolean).join(" ").trim() || null,
              fechaAprobacion: row?.updated_at,
              fechaEnvio: row?.created_at,
            }}
          />
        );
      },
    },
    {
      field: "criticidad", headerName: "Criticidad", minWidth: 100,
      cellRenderer: (params) => {
        const config = getCriticidadConfig(params.data?.criticidad || "Normal");
        return <Typography component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color: config.color }}>{config.label}</Typography>;
      },
    },
    {
      field: "items", headerName: "Items", width: 80, flex: 0,
      valueGetter: (params) => (params.data?.items || []).length,
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontFamily: "monospace", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
          {(params.data?.items || []).length}
        </Typography>
      ),
    },
    {
      field: "total_monto", headerName: "Monto", minWidth: 120, type: "numericColumn",
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) => formatCurrency(params.data?.total_monto || 0),
      cellRenderer: (params) => (
        <Box component="span" sx={{ fontFamily: "monospace", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", fontWeight: 500, display: "block", whiteSpace: "nowrap" }}>
          {formatCurrency(params.data?.total_monto || 0)}
        </Box>
      ),
    },
    {
      field: "sector_nombre", headerName: "Sector", minWidth: 120,
      valueGetter: (params) => params.data?.sector_nombre || params.data?.sector || "-",
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
          {params.data?.sector_nombre || params.data?.sector || "-"}
        </Typography>
      ),
    },
    {
      field: "centro", headerName: "Centro", minWidth: 100,
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{params.data?.centro || "-"}</Typography>
      ),
    },
    {
      field: "almacen_virtual", headerName: "Almacén", minWidth: 100,
      valueGetter: (params) => formatAlmacen(params.data?.almacen_virtual),
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{formatAlmacen(params.data?.almacen_virtual)}</Typography>
      ),
    },
    {
      field: "planificador", headerName: "Planificador", minWidth: 140,
      valueGetter: (params) => [params.data?.planner_nombre, params.data?.planner_apellido].filter(Boolean).join(" ").trim() || "-",
      cellRenderer: (params) => (
        <Typography component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
          {[params.data?.planner_nombre, params.data?.planner_apellido].filter(Boolean).join(" ").trim() || "-"}
        </Typography>
      ),
    },
  ];
}

// ============================================================================
// DASHBOARD ADMIN COMPONENT
// ============================================================================

export default function DashboardAdmin() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const { t } = useI18n();
  const layout = useDashboardLayout();

  // Refs para ampliar cards en modal
  const solicitudesCredasRef = useRef(null);
  const tiemposGestionRef = useRef(null);
  const fuenteAbastecimientoRef = useRef(null);
  const presupuestoGlobalRef = useRef(null);
  const tendenciaRef = useRef(null);
  const distribucionRef = useRef(null);

  // Modal expand state
  const [expandedCard, setExpandedCard] = useState(null);
  const [expandedTitle, setExpandedTitle] = useState('');

  // Drill-down state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownMetrica, setDrillDownMetrica] = useState(null);
  const [drillDownFiltros, setDrillDownFiltros] = useState({});

  // Solicitudes state
  const [solicitudesCollapsed, setSolicitudesCollapsed] = useState(true); // Por defecto colapsado
  const [activeTab, setActiveTab] = useState("todas");
  const [allData, setAllData] = useState({
    todas: [],
  });
  const [stats, setStats] = useState({
    todas: 0,
    pendientes: 0,
    en_proceso: 0,
    completadas: 0,
    rechazadas: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filtros state
  // rangoFechasLocal: para UI inmediata (actualizacion rapida en slider label)
  // rangoFechas: debounced para filtrado real (evita 5 renders/sec)
  const [rangoFechasLocal, setRangoFechasLocal] = useState([0, 365]); // Por defecto: un ano completo
  const rangoFechas = useDebouncedValue(rangoFechasLocal, 300); // Debounce 300ms para filtrado

  const [centrosSeleccionados, setCentrosSeleccionados] = useState([]);
  const [almacenesSeleccionados, setAlmacenesSeleccionados] = useState([]);
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState([]);
  const [solicitantesSeleccionados, setSolicitantesSeleccionados] = useState([]);
  const [filtrosInicializados, setFiltrosInicializados] = useState(false);

  // Funcion para convertir valor del slider a fecha (formato DD/MM/AA)
  // valor 0 = hace 365 dias, valor 365 = hoy
  const sliderAFecha = useCallback((valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const yy = String(fecha.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }, []);

  // Opciones de filtros (extraidas de los datos)
  const [filtrosOpciones, setFiltrosOpciones] = useState({
    centros: [],
    almacenes: [],
    sectores: [],
    solicitantes: [],
  });

  // KPI state
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0, 0, 0, 0, 0, 0, 0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0, trend: [0, 0, 0, 0, 0, 0, 0] },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  });

  // Cumplimiento de proveedores
  const [cumplimientoProveedores, setCumplimientoProveedores] = useState([]);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState([]);

  // Stock inmovilizado (global)
  const [stockInmovilizado, setStockInmovilizado] = useState({ items: [], total: 0, valorTotal: 0, globalTotal: 0, globalValorTotal: 0 });

  // Compras evitadas detalle (para filtrado)
  const [comprasEvitadasDetalle, setComprasEvitadasDetalle] = useState([]);

  // Resumen data for AttentionBanner + MrpAlertsCard
  const [resumenData, setResumenData] = useState(null);

  // ============================================================================
  // DATA FETCHING EFFECTS
  // ============================================================================

  // Fetch solicitudes - todas en mount (para KPIs y tabs)
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        const todasRes = await solicitudes.listar({ page_size: 2000, signal: abortController.signal }).catch(() => null);

        if (!isMounted) return;

        const todasLista = (todasRes?.data?.solicitudes || todasRes?.data?.items || [])
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0) - new Date(a.fecha_creacion || a.created_at || 0));

        setAllData({ todas: todasLista });

        // Calcular conteos por estado desde los datos ya cargados
        const countByFilter = (filterFn) => todasLista.filter(s => {
          const estado = (s.estado || s.status || '').toLowerCase();
          return filterFn(estado);
        }).length;
        setStats({
          todas: todasRes?.data?.total || todasLista.length,
          pendientes: countByFilter(e => e === 'enviada' || e === 'submitted' || e === 'pendiente'),
          en_proceso: countByFilter(e =>
            e === 'approved' || e.includes('aprobada')
            || e === 'in_planning' || e === 'in_treatment'
            || e === 'processing' || e.includes('progreso') || e === 'in_progress'),
          completadas: countByFilter(e =>
            e === 'completed' || e === 'treated'
            || e === 'dispatched' || e === 'closed'
            || e.includes('completada') || e.includes('cerrada')),
          rechazadas: countByFilter(e => e.includes('rechazada') || e === 'rejected' || e === 'cancelled'),
        });
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [user]);

  // Filtrar datos localmente por tab desde allData.todas (sin fetch adicional)
  const filteredTabData = useMemo(() => {
    const todas = allData.todas || [];
    const filterByEstado = (filterFn) => todas.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return filterFn(estado);
    });
    return {
      pendientes: filterByEstado(e => e === 'enviada' || e === 'submitted' || e === 'pendiente'),
      en_proceso: filterByEstado(e =>
        e === 'approved' || e.includes('aprobada')
        || e === 'in_planning' || e === 'in_treatment'
        || e === 'processing' || e.includes('progreso') || e === 'in_progress'),
      completadas: filterByEstado(e =>
        e === 'completed' || e === 'treated'
        || e === 'dispatched' || e === 'closed'
        || e.includes('completada') || e.includes('cerrada')),
      rechazadas: filterByEstado(e => e.includes('rechazada') || e === 'rejected' || e === 'cancelled'),
    };
  }, [allData.todas]);

  // fetchTabData ahora es no-op — datos se filtran localmente
  const fetchTabData = useCallback((_tabKey) => {
    // No-op: los datos de cada tab se calculan desde allData.todas via filteredTabData
  }, []);

  // Fetch KPIs - con AbortController
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchKpis = async () => {
      try {
        setKpiLoading(true);
        // Usar cachedGet para deduplicacion automatica (evita calls duplicados simultaneos)
        const response = await cachedGet("/kpis");

        if (!isMounted) return;

        if (response.data?.ok && response.data?.data) {
          setKpiData(response.data.data);
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
      } finally {
        if (isMounted) setKpiLoading(false);
      }
    };

    fetchKpis();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // Fetch cumplimiento de proveedores - con AbortController
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchCumplimiento = async () => {
      try {
        // Intentar obtener datos de cumplimiento (con deduplicacion)
        const response = await cachedGet("/procurement/kpis/compliance", {
          params: { min_pedidos: 1 },
        });

        if (!isMounted) return;

        const items = response.data?.items || [];

        if (items.length > 0) {
          setCumplimientoProveedores(items);
          if (proveedoresSeleccionados.length === 0) {
            setProveedoresSeleccionados(items.map(p => p.proveedor_cuit || p.proveedor_nombre));
          }
        } else if (user?.is_admin) {
          // Fallback solo para admin: obtener lista de proveedores externos activos
          const provResponse = await api.get("/admin/proveedores/externos", {
            signal: abortController.signal,
          });

          if (!isMounted) return;

          const proveedores = (provResponse.data?.data || provResponse.data || [])
            .filter(p => p.activo !== false && p.activo !== 0)
            .map(p => ({
              proveedor_cuit: p.cuit,
              proveedor_nombre: p.razon_social || p.nombre || p.cuit,
              total_pedidos: 0,
              entregas_a_tiempo: 0,
              pct_otif: null
            }));
          setCumplimientoProveedores(proveedores);
          if (proveedores.length > 0 && proveedoresSeleccionados.length === 0) {
            setProveedoresSeleccionados(proveedores.map(p => p.proveedor_cuit || p.proveedor_nombre));
          }
        } else {
          setCumplimientoProveedores([]);
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;

        if (isMounted) {
          setCumplimientoProveedores([]);
        }
      }
    };

    fetchCumplimiento();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // Fetch stock inmovilizado (inicial - datos globales) - con AbortController
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchStockInmovilizado = async () => {
      try {
        // Usar cachedGet para deduplicacion
        const response = await cachedGet("/kpis/stock-inmovilizado");

        if (!isMounted) return;

        if (response.data?.ok) {
          setStockInmovilizado({
            items: response.data.items || [],
            total: response.data.total || 0,
            valorTotal: response.data.valorTotal || 0,
            globalTotal: response.data.globalTotal || response.data.total || 0,
            globalValorTotal: response.data.globalValorTotal || response.data.valorTotal || 0,
          });
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        setStockInmovilizado({ items: [], total: 0, valorTotal: 0, globalTotal: 0, globalValorTotal: 0 });
      }
    };

    fetchStockInmovilizado();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // Fetch resumen for AttentionBanner + MrpAlertsCard (Tier 1 - immediate)
  useEffect(() => {
    let isMounted = true;

    const fetchResumen = async () => {
      try {
        const response = await cachedGet('/dashboard-data/resumen');
        if (!isMounted) return;
        if (response.data?.ok || response.data?.data) {
          setResumenData(response.data.data || response.data);
        }
      } catch {
        // Silently fail - AttentionBanner handles null gracefully
      }
    };

    fetchResumen();
    return () => { isMounted = false; };
  }, []);

  // Fetch compras evitadas detalle - con AbortController
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchComprasEvitadas = async () => {
      try {
        // Usar cachedGet para deduplicacion
        const response = await cachedGet("/kpis/compras-evitadas-detalle");

        if (!isMounted) return;

        if (response.data?.ok) {
          setComprasEvitadasDetalle(response.data.items || []);
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        setComprasEvitadasDetalle([]);
      }
    };

    fetchComprasEvitadas();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // ============================================================================
  // FILTER / COMPUTED DATA
  // ============================================================================

  // Extraer opciones de filtros de los datos e inicializar con todos seleccionados
  useEffect(() => {
    if (allData.todas.length > 0) {
      const centros = [...new Set(allData.todas.map(s => s.centro).filter(Boolean))].sort();
      const almacenes = [...new Set(allData.todas.map(s => s.almacen_virtual).filter(Boolean))].sort();
      const sectores = [...new Set(allData.todas.map(s => s.sector_nombre || s.sector).filter(Boolean))].sort();
      const solicitantes = [...new Set(allData.todas.map(s => {
        const apellido = s.solicitante_apellido || '';
        const nombre = s.solicitante_nombre || '';
        return [apellido, nombre].filter(Boolean).join(' ').trim() || s.solicitante;
      }).filter(Boolean))].sort();

      setFiltrosOpciones({
        centros,
        almacenes,
        sectores,
        solicitantes,
      });

      // Inicializar filtros con todos seleccionados (solo la primera vez)
      if (!filtrosInicializados) {
        setCentrosSeleccionados(centros);
        setAlmacenesSeleccionados(almacenes);
        setSectoresSeleccionados(sectores);
        setSolicitantesSeleccionados(solicitantes);
        setFiltrosInicializados(true);
      }
    }
  }, [allData.todas, filtrosInicializados]);

  // Funcion para convertir valor del slider a fecha Date
  const sliderAFechaDate = useCallback((valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }, []);

  // Crear indices de filtrado O(1) para busqueda rapida
  const filterIndices = useMemo(() => ({
    centros: new Set(centrosSeleccionados),
    almacenes: new Set(almacenesSeleccionados),
    sectores: new Set(sectoresSeleccionados),
    solicitantes: new Set(solicitantesSeleccionados),
    fechaDesde: sliderAFechaDate(rangoFechas[0]),
    fechaHasta: (() => {
      const d = sliderAFechaDate(rangoFechas[1]);
      d.setHours(23, 59, 59, 999);
      return d;
    })(),
  }), [rangoFechas, centrosSeleccionados, almacenesSeleccionados, sectoresSeleccionados, solicitantesSeleccionados]);

  // Datos filtrados - UNA SOLA PASADA O(n) en lugar de 4-5 pasadas O(n2)
  const datosFiltrados = useMemo(() => {
    // Si no hay ningun filtro seleccionado, no mostrar datos
    const hayFiltrosSeleccionados = centrosSeleccionados.length > 0 ||
      almacenesSeleccionados.length > 0 ||
      sectoresSeleccionados.length > 0 ||
      solicitantesSeleccionados.length > 0;

    if (!hayFiltrosSeleccionados) {
      return [];
    }

    // UNA SOLA PASADA: todas las condiciones en un solo filter()
    return allData.todas.filter(s => {
      // Filtro por rango de fechas
      const fechaCreacion = new Date(s.created_at || s.fecha_creacion);
      if (fechaCreacion < filterIndices.fechaDesde || fechaCreacion > filterIndices.fechaHasta) {
        return false;
      }

      // Filtro por centros - O(1) con Set.has()
      if (filterIndices.centros.size > 0 && !filterIndices.centros.has(s.centro)) {
        return false;
      }

      // Filtro por almacenes - O(1) con Set.has()
      if (filterIndices.almacenes.size > 0 && !filterIndices.almacenes.has(s.almacen_virtual)) {
        return false;
      }

      // Filtro por sectores - O(1) con Set.has()
      if (filterIndices.sectores.size > 0) {
        const sectorSolicitud = s.sector_nombre || s.sector;
        if (!filterIndices.sectores.has(sectorSolicitud)) {
          return false;
        }
      }

      // Filtro por solicitantes - O(1) con Set.has()
      if (filterIndices.solicitantes.size > 0) {
        const apellido = s.solicitante_apellido || '';
        const nombre = s.solicitante_nombre || '';
        const solicitanteCompleto = [apellido, nombre]
          .filter(Boolean)
          .join(' ')
          .trim() || s.solicitante;
        if (!filterIndices.solicitantes.has(solicitanteCompleto)) {
          return false;
        }
      }

      return true;
    });
  }, [allData.todas, filterIndices]);

  // Stock inmovilizado - los datos ya vienen filtrados del endpoint
  const stockInmovilizadoFiltrado = useMemo(() => {
    const sortedItems = [...stockInmovilizado.items].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 10);
    return {
      items: sortedItems,
      total: stockInmovilizado.total,
      valorTotal: stockInmovilizado.valorTotal,
      globalTotal: stockInmovilizado.globalTotal || 0,
      globalValorTotal: stockInmovilizado.globalValorTotal || 0,
      hayDatos: stockInmovilizado.items.length > 0,
    };
  }, [stockInmovilizado]);

  // Estadisticas filtradas
  const statsFiltrados = useMemo(() => {
    const todas = datosFiltrados.length;
    const pendientes = datosFiltrados.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return estado === 'enviada' || estado === 'submitted' || estado === 'pendiente';
    }).length;
    const en_proceso = datosFiltrados.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return estado === 'approved' || estado.includes('aprobada')
        || estado === 'in_planning' || estado === 'in_treatment'
        || estado === 'processing' || estado.includes('progreso') || estado === 'in_progress';
    }).length;
    const completadas = datosFiltrados.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return estado === 'completed' || estado === 'treated'
        || estado === 'dispatched' || estado === 'closed'
        || estado.includes('completada') || estado.includes('cerrada');
    }).length;
    const rechazadas = datosFiltrados.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return estado.includes('rechazada') || estado === 'rejected' || estado === 'cancelled';
    }).length;
    return { todas, pendientes, en_proceso, completadas, rechazadas };
  }, [datosFiltrados]);

  // Datos de tendencia historica (12 meses)
  const trendData = useTrendData(datosFiltrados, 12);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  // Handler para drill-down KPI click (opens modal with granular data)
  const handleKpiDrillDown = useCallback((metrica) => {
    setDrillDownMetrica(metrica);
    setDrillDownFiltros({
      centro: centrosSeleccionados.length < filtrosOpciones.centros.length
        ? centrosSeleccionados.join(',') : undefined,
      sector: sectoresSeleccionados.length < filtrosOpciones.sectores.length
        ? sectoresSeleccionados.join(',') : undefined,
    });
    setDrillDownOpen(true);
  }, [centrosSeleccionados, sectoresSeleccionados, filtrosOpciones]);

  // Handler para drill-down desde graficos
  const handleDrillDown = useCallback((statusId, item) => {
    // Mapear el ID del estado al tab correspondiente
    const tabMapping = {
      aprobadas: 'completadas',
      enviadas: 'pendientes',
      enProceso: 'en_proceso',
      rechazadas: 'rechazadas',
      cerradas: 'completadas',
      borrador: 'todas',
    };
    const targetTab = tabMapping[statusId] || 'todas';
    setActiveTab(targetTab);
    fetchTabData(targetTab);
    setSolicitudesCollapsed(false); // Expandir la tabla
  }, [fetchTabData]);

  const columnDefs = useMemo(() => getTableColumnsAgGrid(t), [t]);

  // Tabs configuration - usar statsFiltrados para todos los conteos (calculados desde datos ya cargados)
  const tabs = useMemo(() => [
    { key: "todas", label: t("dash_todas", "Todas"), count: statsFiltrados.todas },
    { key: "pendientes", label: t("dash_pendientes", "Pendientes"), count: statsFiltrados.pendientes },
    { key: "en_proceso", label: t("dash_en_proceso", "En Proceso"), count: statsFiltrados.en_proceso },
    { key: "completadas", label: t("dash_completadas", "Completadas"), count: statsFiltrados.completadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: statsFiltrados.rechazadas },
  ], [t, statsFiltrados]);

  // Cuando estamos en tab "todas", usar datos filtrados; otras tabs se filtran localmente
  const currentData = activeTab === 'todas' ? datosFiltrados : (filteredTabData[activeTab] || []);
  const isTabLoading = false;

  const handleTabChange = useCallback((value) => {
    if (value === "crear") {
      navigate("/solicitudes/nueva");
    } else {
      setActiveTab(value);
      fetchTabData(value);
    }
  }, [navigate, fetchTabData]);

  const tableTitle = useMemo(() => {
    switch (activeTab) {
      case "todas":
        return t("dash_all_requests", "Todas las Solicitudes");
      case "pendientes":
        return t("dash_pending_review", "Solicitudes Pendientes de Revisi\u00f3n");
      case "en_proceso":
        return t("dash_in_progress", "Solicitudes En Proceso");
      case "completadas":
        return t("dash_completed", "Solicitudes Completadas");
      case "rechazadas":
        return t("dash_rejected", "Solicitudes Rechazadas");
      default:
        return t("dash_solicitudes", "Solicitudes");
    }
  }, [activeTab, t]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Map card IDs to their rendered components
  const renderSection = useCallback((cardId) => {
    switch (cardId) {
      case 'solicitudes':
        return (
          <SolicitudesSection
            key="solicitudes"
            t={t}
            loading={loading || isTabLoading}
            stats={statsFiltrados}
            solicitudesCollapsed={solicitudesCollapsed}
            setSolicitudesCollapsed={setSolicitudesCollapsed}
            activeTab={activeTab}
            handleTabChange={handleTabChange}
            tabs={tabs}
            currentData={currentData}
            columnDefs={columnDefs}
            navigate={navigate}
            tableTitle={tableTitle}
          />
        );
      case 'filters':
        return (
          <FiltersBar
            key="filters"
            t={t}
            rangoFechasLocal={rangoFechasLocal}
            setRangoFechasLocal={setRangoFechasLocal}
            sliderAFecha={sliderAFecha}
            centrosSeleccionados={centrosSeleccionados}
            setCentrosSeleccionados={setCentrosSeleccionados}
            almacenesSeleccionados={almacenesSeleccionados}
            setAlmacenesSeleccionados={setAlmacenesSeleccionados}
            sectoresSeleccionados={sectoresSeleccionados}
            setSectoresSeleccionados={setSectoresSeleccionados}
            solicitantesSeleccionados={solicitantesSeleccionados}
            setSolicitantesSeleccionados={setSolicitantesSeleccionados}
            filtrosOpciones={filtrosOpciones}
          />
        );
      case 'kpi_row1':
        return (
          <KPIRow1
            key="kpi_row1"
            solicitudesCredasRef={solicitudesCredasRef}
            tiemposGestionRef={tiemposGestionRef}
            fuenteAbastecimientoRef={fuenteAbastecimientoRef}
            datosFiltrados={datosFiltrados}
            kpiData={kpiData}
            rangoFechas={rangoFechas}
            sliderAFechaDate={sliderAFechaDate}
            centrosSeleccionados={centrosSeleccionados}
            sectoresSeleccionados={sectoresSeleccionados}
            filtrosOpciones={filtrosOpciones}
            comprasEvitadasDetalle={comprasEvitadasDetalle}
            cumplimientoProveedores={cumplimientoProveedores}
            proveedoresSeleccionados={proveedoresSeleccionados}
            setProveedoresSeleccionados={setProveedoresSeleccionados}
            setExpandedCard={setExpandedCard}
            setExpandedTitle={setExpandedTitle}
            onKpiDrillDown={handleKpiDrillDown}
          />
        );
      case 'kpi_row2':
        return (
          <KPIRow2
            key="kpi_row2"
            distribucionRef={distribucionRef}
            tendenciaRef={tendenciaRef}
            presupuestoGlobalRef={presupuestoGlobalRef}
            datosFiltrados={datosFiltrados}
            trendData={trendData}
            kpiData={kpiData}
            centrosSeleccionados={centrosSeleccionados}
            sectoresSeleccionados={sectoresSeleccionados}
            filtrosOpciones={filtrosOpciones}
            handleDrillDown={handleDrillDown}
            setExpandedCard={setExpandedCard}
            setExpandedTitle={setExpandedTitle}
            onKpiDrillDown={handleKpiDrillDown}
          />
        );
      case 'kpi_row3':
        return (
          <KPIRow3
            key="kpi_row3"
            datosFiltrados={datosFiltrados}
            stockInmovilizadoFiltrado={stockInmovilizadoFiltrado}
            kpiLoading={kpiLoading}
            resumen={resumenData}
            onKpiDrillDown={handleKpiDrillDown}
          />
        );
      case 'attention':
        return <AttentionBanner key="attention" resumen={resumenData} />;
      case 'quick_actions':
        return <QuickActions key="quick_actions" />;
      case 'kpi_row4':
        return <KPIRow4 key="kpi_row4" />;
      case 'operations':
        return <OperationsOverview key="operations" />;
      default:
        return null;
    }
  }, [t, loading, isTabLoading, statsFiltrados, solicitudesCollapsed, activeTab,
      handleTabChange, tabs, currentData, columnDefs, navigate, tableTitle,
      rangoFechasLocal, sliderAFecha, centrosSeleccionados, almacenesSeleccionados,
      sectoresSeleccionados, solicitantesSeleccionados, filtrosOpciones,
      datosFiltrados, kpiData, rangoFechas, sliderAFechaDate, comprasEvitadasDetalle,
      cumplimientoProveedores, proveedoresSeleccionados, trendData, handleDrillDown,
      handleKpiDrillDown, stockInmovilizadoFiltrado, kpiLoading, resumenData]);

  const orderedVisibleIds = layout.getOrderedVisibleIds();
  const isKpiSection = (id) => id.startsWith('kpi_row');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header with customize button */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'text.primary' }}>
          {t('dash_title', 'Dashboard')}
        </Typography>
        <Stack direction="row" spacing={1}>
          {layout.editMode && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={layout.resetLayout}
              aria-label={t('dash_layout_reset', 'Restablecer layout')}
            >
              {t('dash_layout_reset', 'Restablecer')}
            </Button>
          )}
          <Button
            size="small"
            variant={layout.editMode ? 'contained' : 'outlined'}
            startIcon={<DashboardCustomizeIcon />}
            onClick={() => layout.setEditMode(!layout.editMode)}
            aria-label={t('dash_layout_customize', 'Personalizar dashboard')}
          >
            {layout.editMode ? t('dash_layout_done', 'Listo') : t('dash_layout_customize', 'Personalizar')}
          </Button>
        </Stack>
      </Stack>

      {/* Edit mode: card list with reorder and visibility controls */}
      {layout.editMode && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {layout.cards.map((card, index) => (
            <Chip
              key={card.id}
              icon={card.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <span>{card.label}</span>
                  <IconButton
                    size="small"
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); layout.moveCard(index, index - 1); }}
                    aria-label={t('dash_layout_move_up', 'Mover arriba')}
                    sx={{ p: 0, ml: 0.5 }}
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={index === layout.cards.length - 1}
                    onClick={(e) => { e.stopPropagation(); layout.moveCard(index, index + 1); }}
                    aria-label={t('dash_layout_move_down', 'Mover abajo')}
                    sx={{ p: 0 }}
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              }
              variant={card.visible ? 'filled' : 'outlined'}
              color={card.visible ? 'primary' : 'default'}
              onClick={() => layout.toggleCard(card.id)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      )}

      {/* Render sections in layout order */}
      {orderedVisibleIds.map(id => {
        // Non-KPI sections render directly
        if (!isKpiSection(id)) {
          return renderSection(id);
        }
        return null;
      })}

      {/* KPI sections wrapped in their loading container */}
      {orderedVisibleIds.some(isKpiSection) && (
        <Box aria-live="polite" aria-busy={kpiLoading} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {kpiLoading ? (
            <KPIGridSkeleton />
          ) : (
            <>
              {orderedVisibleIds.filter(isKpiSection).map(id => renderSection(id))}

              {/* Drill-Down Modal */}
              <DrillDownModal
                open={drillDownOpen}
                onClose={() => setDrillDownOpen(false)}
                metrica={drillDownMetrica}
                filtros={drillDownFiltros}
              />

              {/* Modal para ampliar cards */}
              <ExpandedCardDialog
                t={t}
                expandedCard={expandedCard}
                expandedTitle={expandedTitle}
                setExpandedCard={setExpandedCard}
                datosFiltrados={datosFiltrados}
                trendData={trendData}
                kpiData={kpiData}
                handleDrillDown={handleDrillDown}
              />
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
