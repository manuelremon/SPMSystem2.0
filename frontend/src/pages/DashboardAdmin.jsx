import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { KPIGridSkeleton } from "../components/dashboard/DashboardSkeleton";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { cachedGet } from "../services/cachedApi";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { getTableColumnsAgGrid } from "./DashboardShared";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useTrendData } from '../components/dashboard/TrendChart';
// MUI Components
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
// Sub-components (extracted for maintainability)
import { SolicitudesSection } from './DashboardAdmin/index';
import { FiltersBar } from './DashboardAdmin/index';
import { KPIRow1 } from './DashboardAdmin/index';
import { KPIRow2 } from './DashboardAdmin/index';
import { KPIRow3 } from './DashboardAdmin/index';
import { ExpandedCardDialog } from './DashboardAdmin/index';
import DrillDownModal from '../components/dashboard/DrillDownModal';

// ============================================================================
// DASHBOARD ADMIN COMPONENT
// ============================================================================

export default function DashboardAdmin() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

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
  const [stats, setStats] = useState({
    todas: 0,
    pendientes: 0,
    en_proceso: 0,
    completadas: 0,
    rechazadas: 0,
  });
  const [allData, setAllData] = useState({
    todas: [],
    pendientes: [],
    en_proceso: [],
    completadas: [],
    rechazadas: [],
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

  // Stock inmovilizado con filtros locales (nueva card)
  const [stockFiltradoLocal, setStockFiltradoLocal] = useState({ items: [], total: 0, valorTotal: 0, loading: false });
  const [stockFiltrosCentro, setStockFiltrosCentro] = useState("");
  const [stockFiltrosAlmacen, setStockFiltrosAlmacen] = useState("");
  const [stockFiltrosPeriodo, setStockFiltrosPeriodo] = useState(1); // 1, 2 o 3 anos

  // Compras evitadas detalle (para filtrado)
  const [comprasEvitadasDetalle, setComprasEvitadasDetalle] = useState([]);

  // ============================================================================
  // DATA FETCHING EFFECTS
  // ============================================================================

  // Track which tabs have been loaded (lazy loading)
  const [loadedTabs, setLoadedTabs] = useState({ todas: false, pendientes: false, en_proceso: false, completadas: false, rechazadas: false });
  const [tabLoading, setTabLoading] = useState({});

  // Fetch solicitudes - Solo "todas" en mount (para KPIs), otras tabs on-demand
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

        setStats(prev => ({
          ...prev,
          todas: todasRes?.data?.total || todasLista.length,
        }));

        setAllData(prev => ({ ...prev, todas: todasLista }));
        setLoadedTabs(prev => ({ ...prev, todas: true }));
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        console.error("Error fetching solicitudes:", err);
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

  // Lazy fetch tab data when tab is selected
  const fetchTabData = useCallback(async (tabKey) => {
    if (loadedTabs[tabKey] || tabKey === 'todas') return;

    const estadoMap = {
      pendientes: 'submitted',
      en_proceso: 'processing',
      completadas: 'approved',
      rechazadas: 'rejected',
    };
    const estado = estadoMap[tabKey];
    if (!estado) return;

    setTabLoading(prev => ({ ...prev, [tabKey]: true }));
    try {
      const res = await solicitudes.listar({ estado, page_size: 2000 }).catch(() => null);
      const lista = res?.data?.solicitudes || res?.data?.items || [];
      setAllData(prev => ({ ...prev, [tabKey]: lista }));
      setStats(prev => ({ ...prev, [tabKey]: res?.data?.total || lista.length }));
      setLoadedTabs(prev => ({ ...prev, [tabKey]: true }));
    } catch (err) {
      console.error(`Error fetching tab ${tabKey}:`, err);
    } finally {
      setTabLoading(prev => ({ ...prev, [tabKey]: false }));
    }
  }, [loadedTabs]);

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
        console.error("Error fetching KPIs:", err);
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
        } else {
          console.error("Stock inmovilizado - respuesta no ok:", response.data);
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        console.error("Error fetching stock inmovilizado:", err.response?.status, err.message);
        setStockInmovilizado({ items: [], total: 0, valorTotal: 0, globalTotal: 0, globalValorTotal: 0 });
      }
    };

    fetchStockInmovilizado();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  // Fetch stock inmovilizado con filtros locales (nueva card)
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchStockFiltradoLocal = async () => {
      setStockFiltradoLocal(prev => ({ ...prev, loading: true }));
      try {
        const params = new URLSearchParams();
        if (stockFiltrosCentro) params.set("centro", stockFiltrosCentro);
        if (stockFiltrosAlmacen) params.set("almacen", stockFiltrosAlmacen);
        params.set("periodo_anos", stockFiltrosPeriodo.toString());
        params.set("limit", "10");

        const url = `/kpis/stock-inmovilizado?${params}`;
        const response = await api.get(url, { signal: abortController.signal });

        if (!isMounted) return;

        if (response.data?.ok) {
          setStockFiltradoLocal({
            items: response.data.items || [],
            total: response.data.total || 0,
            valorTotal: response.data.valorTotal || 0,
            loading: false,
          });
        } else {
          setStockFiltradoLocal({ items: [], total: 0, valorTotal: 0, loading: false });
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        console.error("Error fetching stock inmovilizado filtrado local:", err.message);
        setStockFiltradoLocal({ items: [], total: 0, valorTotal: 0, loading: false });
      }
    };

    fetchStockFiltradoLocal();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [stockFiltrosCentro, stockFiltrosAlmacen, stockFiltrosPeriodo]);

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
        console.error("Error fetching compras evitadas:", err.response?.status, err.message);
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
      return estado.includes('progreso') || estado === 'processing' || estado === 'in_progress';
    }).length;
    const completadas = datosFiltrados.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return estado.includes('aprobada') || estado === 'approved';
    }).length;
    const rechazadas = datosFiltrados.filter(s => {
      const estado = (s.estado || s.status || '').toLowerCase();
      return estado.includes('rechazada') || estado === 'rejected';
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

  // Tabs configuration
  const tabs = useMemo(() => [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "pendientes", label: t("dash_pendientes", "Pendientes"), count: stats.pendientes },
    { key: "en_proceso", label: t("dash_en_proceso", "En Proceso"), count: stats.en_proceso },
    { key: "completadas", label: t("dash_completadas", "Completadas"), count: stats.completadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: stats.rechazadas },
  ], [t, stats]);

  const currentData = allData[activeTab] || [];
  const isTabLoading = tabLoading[activeTab] || false;

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'text.primary' }}>
        {t('dash_title', 'Dashboard')}
      </Typography>

      {/* SOLICITUDES SECTION - Contenedor colapsable */}
      <SolicitudesSection
        t={t}
        loading={loading || isTabLoading}
        stats={stats}
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

      {/* FILTROS SECTION */}
      <FiltersBar
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

      {/* KPI SECTION */}
      <Box aria-live="polite" aria-busy={kpiLoading}>
      {kpiLoading ? (
        <KPIGridSkeleton />
      ) : (
        <>
          {/* Fila 1: KPIs principales */}
          <KPIRow1
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

          {/* Fila 2: Distribucion + Tendencia + Presupuesto */}
          <KPIRow2
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

          {/* Fila 3: Materiales y Stock */}
          <KPIRow3
            datosFiltrados={datosFiltrados}
            stockInmovilizadoFiltrado={stockInmovilizadoFiltrado}
            kpiLoading={kpiLoading}
            stockFiltradoLocal={stockFiltradoLocal}
            stockFiltrosCentro={stockFiltrosCentro}
            setStockFiltrosCentro={setStockFiltrosCentro}
            stockFiltrosAlmacen={stockFiltrosAlmacen}
            setStockFiltrosAlmacen={setStockFiltrosAlmacen}
            stockFiltrosPeriodo={stockFiltrosPeriodo}
            setStockFiltrosPeriodo={setStockFiltrosPeriodo}
            filtrosOpciones={filtrosOpciones}
            onKpiDrillDown={handleKpiDrillDown}
          />

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
    </Box>
  );
}
