import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { planner, solicitudes } from "../services/spm";
import api from "../services/api";
import { cachedGet, invalidateCache } from "../services/cachedApi";
import { formatCurrency } from "../utils/formatters";
import {
  Plus,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Package,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "../components/ui/Icons";
import { useI18n } from "../context/i18n";
import { toNumber } from "../utils/formatters";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { getTableColumnsAgGrid } from "./DashboardShared";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { WeeklyRequestsKpiCard } from "../components/dashboard/WeeklyRequestsKpiCard";
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
// MUI Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// Componentes de graficos Chart.js (SPMChartJS)
import { StatusDistributionChart } from '../components/dashboard/StatusDistributionChart';
import { TrendChart, useTrendData } from '../components/dashboard/TrendChart';
import { ChartExportButton } from '../components/dashboard/ChartExportButton';
import { ChartLegend } from '../components/dashboard/ChartLegend';
import { SPMGauge, SPMBar, SPMPolarArea, SPM_COLORS, STATUS_COLORS, PHASE_COLORS, BUDGET_COLORS, FONT_SIZES, TOOLTIP_CONFIG, ANIMATION_CONFIG } from '../components/ui/SPMChartJS';

// MenuProps para los multiselect
const ITEM_HEIGHT = 32;
const ITEM_PADDING_TOP = 4;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 6 + ITEM_PADDING_TOP,
      width: 160,
    },
  },
};

// ============================================================================
// KPI CHART COMPONENTS - Usando Chart.js (SPMChartJS)
// ============================================================================

// Los componentes de graficos ahora se importan desde:
// - StatusDistributionChart: Doughnut interactivo con drill-down (Chart.js)
// - TrendChart: LineChart de tendencia historica (Chart.js)
// - SPMGauge: Gauge con colores dinamicos segun umbral (Chart.js)
// - ChartExportButton: Exportar graficos como PNG

// ============================================================================
// COMPONENT: ExpandCardButton
// ============================================================================
function ExpandCardButton({ onClick, size = 'small' }) {
  return (
    <Tooltip title="Ampliar">
      <IconButton
        size={size}
        onClick={onClick}
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          },
        }}
      >
        <OpenInFullIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

// ============================================================================
// DASHBOARD ADMIN COMPONENT
// ============================================================================

export default function DashboardAdmin() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Refs para exportar graficos
  const distributionChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const budgetChartRef = useRef(null);

  // Refs para ampliar cards en modal
  const solicitudesCredasRef = useRef(null);
  const tiemposGestionRef = useRef(null);
  const fuenteAbastecimientoRef = useRef(null);
  const presupuestoGlobalRef = useRef(null);
  const tendenciaRef = useRef(null);
  const distribucionRef = useRef(null);

  // Drill-down state
  const [drillDownFilter, setDrillDownFilter] = useState(null);

  // Modal expand state
  const [expandedCard, setExpandedCard] = useState(null);
  const [expandedTitle, setExpandedTitle] = useState('');

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
  // rangoFechasLocal: para UI inmediata (actualización rápida en slider label)
  // rangoFechas: debounced para filtrado real (evita 5 renders/sec)
  const [rangoFechasLocal, setRangoFechasLocal] = useState([0, 365]); // Por defecto: un año completo
  const rangoFechas = useDebouncedValue(rangoFechasLocal, 300); // Debounce 300ms para filtrado

  const [centrosSeleccionados, setCentrosSeleccionados] = useState([]);
  const [almacenesSeleccionados, setAlmacenesSeleccionados] = useState([]);
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState([]);
  const [solicitantesSeleccionados, setSolicitantesSeleccionados] = useState([]);
  const [filtrosInicializados, setFiltrosInicializados] = useState(false);

  // Función para convertir valor del slider a fecha (formato DD/MM/AA)
  // valor 0 = hace 365 días, valor 365 = hoy
  const sliderAFecha = useCallback((valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const yy = String(fecha.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }, []);

  // Opciones de filtros (extraídas de los datos)
  const [filtrosOpciones, setFiltrosOpciones] = useState({
    centros: [],
    almacenes: [],
    sectores: [],
    solicitantes: [],
  });

  // KPI state
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0,0,0,0,0,0,0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0, trend: [0,0,0,0,0,0,0] },
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
  const [stockFiltrosPeriodo, setStockFiltrosPeriodo] = useState(1); // 1, 2 o 3 años

  // Compras evitadas detalle (para filtrado)
  const [comprasEvitadasDetalle, setComprasEvitadasDetalle] = useState([]);

  // Fetch solicitudes - con AbortController para cleanup
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true; // Flag para tracking de unmount

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch ALL solicitudes for "Todas" tab (no estado filter)
        const [todasRes, pendientesRes, enProcesoRes, completadasRes, rechazadasRes] = await Promise.all([
          solicitudes.listar({ page_size: 500, signal: abortController.signal }).catch(() => null),
          solicitudes.listar({ estado: "submitted", page_size: 500, signal: abortController.signal }).catch(() => null),
          solicitudes.listar({ estado: "processing", page_size: 500, signal: abortController.signal }).catch(() => null),
          solicitudes.listar({ estado: "approved", page_size: 500, signal: abortController.signal }).catch(() => null),
          solicitudes.listar({ estado: "rejected", page_size: 500, signal: abortController.signal }).catch(() => null),
        ]);

        // Verificar que el componente siga montado antes de updatear state
        if (!isMounted) return;

        const todasLista = (todasRes?.data?.solicitudes || todasRes?.data?.items || [])
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0) - new Date(a.fecha_creacion || a.created_at || 0));
        const pendientesLista = pendientesRes?.data?.solicitudes || pendientesRes?.data?.items || [];
        const enProcesoLista = enProcesoRes?.data?.solicitudes || enProcesoRes?.data?.items || [];
        const completadasLista = completadasRes?.data?.solicitudes || completadasRes?.data?.items || [];
        const rechazadasLista = rechazadasRes?.data?.solicitudes || rechazadasRes?.data?.items || [];

        setStats({
          todas: todasLista.length,
          pendientes: pendientesLista.length,
          en_proceso: enProcesoLista.length,
          completadas: completadasLista.length,
          rechazadas: rechazadasLista.length,
        });

        setAllData({
          todas: todasLista,
          pendientes: pendientesLista,
          en_proceso: enProcesoLista,
          completadas: completadasLista,
          rechazadas: rechazadasLista,
        });
      } catch (err) {
        // Ignorar AbortError y errores si componente fue unmounted
        if (!isMounted || err?.name === 'AbortError') return;
        console.error("Error fetching solicitudes:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup: abortar fetch y marcar como unmounted
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [user]);

  // Fetch KPIs - con AbortController
  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const fetchKpis = async () => {
      try {
        setKpiLoading(true);
        // Usar cachedGet para deduplicación automática (evita calls duplicados simultáneos)
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
        // Intentar obtener datos de cumplimiento (con deduplicación)
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
        // Usar cachedGet para deduplicación
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

  // Refetch stock inmovilizado cuando cambian los filtros de Centro - con AbortController
  // Solo Centro aplica a esta card (no Sector, Solicitante ni Almacén de solicitudes)
  useEffect(() => {
    // Si no hay filtros inicializados, no hacer nada
    if (!filtrosInicializados) return;

    const abortController = new AbortController();
    let isMounted = true;

    const fetchStockFiltrado = async () => {
      try {
        // Construir params - solo centros aplican
        const params = new URLSearchParams();
        if (centrosSeleccionados.length > 0) {
          params.set("centros", centrosSeleccionados.join(","));
        }

        const url = params.toString() ? `/kpis/stock-inmovilizado?${params}` : "/kpis/stock-inmovilizado";
        const response = await api.get(url, { signal: abortController.signal });

        if (!isMounted) return;

        if (response.data?.ok) {
          setStockInmovilizado(prev => ({
            items: response.data.items || [],
            total: response.data.total || 0,
            valorTotal: response.data.valorTotal || 0,
            globalTotal: prev.globalTotal || response.data.globalTotal || 0,
            globalValorTotal: prev.globalValorTotal || response.data.globalValorTotal || 0,
          }));
        }
      } catch (err) {
        if (!isMounted || err?.name === 'AbortError') return;
        console.error("Error fetching stock inmovilizado filtrado:", err.message);
      }
    };

    fetchStockFiltrado();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [centrosSeleccionados, filtrosInicializados]);

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
        // Usar cachedGet para deduplicación
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

  // Función para convertir valor del slider a fecha Date
  const sliderAFechaDate = useCallback((valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }, []);

  // Crear índices de filtrado O(1) para búsqueda rápida
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

  // Datos filtrados - UNA SOLA PASADA O(n) en lugar de 4-5 pasadas O(n²)
  const datosFiltrados = useMemo(() => {
    // Si no hay ningún filtro seleccionado, no mostrar datos
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
  // Solo el filtro Centro aplica. Sector, Solicitante y Almacén NO aplican a esta card.
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

  // Estadísticas filtradas
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

  // Handler para drill-down desde graficos
  const handleDrillDown = useCallback((statusId, item) => {
    setDrillDownFilter(statusId);
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
    setSolicitudesCollapsed(false); // Expandir la tabla
  }, []);

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

  const handleTabChange = useCallback((value) => {
    if (value === "crear") {
      navigate("/solicitudes/nueva");
    } else {
      setActiveTab(value);
    }
  }, [navigate]);

  const tableTitle = useMemo(() => {
    switch (activeTab) {
      case "todas":
        return t("dash_all_requests", "Todas las Solicitudes");
      case "pendientes":
        return t("dash_pending_review", "Solicitudes Pendientes de Revisión");
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ================================================================== */}
      {/* SOLICITUDES SECTION - Contenedor colapsable */}
      {/* ================================================================== */}
      <Paper elevation={0} sx={{ overflow: 'hidden', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        {/* Header con botón de colapsar/expandir y crear solicitud */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
          <Button
            onClick={() => setSolicitudesCollapsed(!solicitudesCollapsed)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textAlign: 'left',
              '&:hover': { bgcolor: 'grey.50' },
              borderRadius: 1,
              px: 1,
              py: 0.5,
              ml: -1,
              zIndex: 10,
              textTransform: 'none',
              color: 'text.primary',
            }}
          >
            {solicitudesCollapsed ? (
              <ChevronRightIcon sx={{ width: 20, height: 20, color: 'grey.500' }} />
            ) : (
              <ExpandMoreIcon sx={{ width: 20, height: 20, color: 'grey.500' }} />
            )}
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'grey.700' }}>
              Solicitudes
            </Typography>
            <Typography variant="caption" sx={{ color: 'grey.500', ml: 0.5 }}>
              {loading ? 'Cargando...' : `(${stats.todas} total)`}
            </Typography>
          </Button>
        </Box>

        {/* Contenido colapsable */}
        <Box
          sx={{
            transition: 'all 0.3s ease-in-out',
            transformOrigin: 'top left',
            maxHeight: solicitudesCollapsed ? 0 : 2000,
            opacity: solicitudesCollapsed ? 0 : 1,
            transform: solicitudesCollapsed ? 'scaleY(0)' : 'scaleY(1)',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 0 }}>
            {/* Header con tabs */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList>
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      sx={tab.isAction ? { color: 'var(--primary)', fontWeight: 600 } : undefined}
                    >
                      {tab.isAction ? tab.label : `${tab.label} (${tab.count})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </Box>

            {/* Tabla */}
            <Box sx={{ p: 2 }}>
              {loading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : currentData.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <CheckCircleIcon sx={{ width: 48, height: 48, color: 'success.main', mx: 'auto', mb: 2, opacity: 0.6 }} />
                  <Typography variant="body2" sx={{ color: 'grey.500' }}>
                    {activeTab === "pendientes"
                      ? t("dash_no_pending", "No hay solicitudes pendientes de revisión")
                      : t("dash_no_requests_category", "No hay solicitudes en esta categoría")}
                  </Typography>
                </Box>
              ) : (
                <SPMAgGrid
                  columnDefs={columnDefs}
                  rowData={currentData}
                  emptyMessage={t("dash_no_requests", "No hay solicitudes")}
                  onRowClick={(row) => navigate(`/solicitudes/${row.id}`)}
                  height={500}
                  enableQuickFilter={true}
                  exportFileName="dashboard_admin"
                />
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ================================================================== */}
      {/* FILTROS SECTION */}
      {/* ================================================================== */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'var(--surface)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          },
        }}
      >
        <Box sx={{ py: 1, px: 3, height: 73, maxWidth: 1850 }}>
          <Stack direction="row" alignItems="center" gap={3} sx={{ height: '100%' }}>
            {/* Slider de rango de fechas - con debounce */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 320, ml: '180px' }}>
              <Typography variant="caption" sx={{ fontWeight: 500, color: 'grey.600', mt: 1 }}>
                Desde <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[0])}</Box> hasta <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[1])}</Box>
              </Typography>
              <Slider
                size="small"
                value={rangoFechasLocal}
                onChange={(_, value) => setRangoFechasLocal(value)}
                min={0}
                max={365}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => sliderAFecha(value)}
                getAriaLabel={() => 'Rango de fechas'}
                sx={{
                  color: 'var(--primary)',
                  '& .MuiSlider-thumb': {
                    width: 14,
                    height: 14,
                  },
                  '& .MuiSlider-valueLabel': {
                    fontSize: 10,
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between" sx={{ mt: -0.5 }}>
                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'grey.400' }}>Hace 1 año</Typography>
                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'grey.400' }}>Hoy</Typography>
              </Stack>
            </Box>

            {/* Separador vertical */}
            <Divider orientation="vertical" flexItem sx={{ height: 64 }} />

            {/* Centro Multiselect */}
            <FormControl size="small" sx={{ minWidth: 160, ml: '40px' }}>
              <InputLabel id="centro-label" sx={{ fontSize: FONT_SIZES.md }}>Centro</InputLabel>
              <Select
                labelId="centro-label"
                multiple
                value={centrosSeleccionados}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.includes('__todos__')) {
                    if (centrosSeleccionados.length === filtrosOpciones.centros.length) {
                      setCentrosSeleccionados([]);
                    } else {
                      setCentrosSeleccionados([...filtrosOpciones.centros]);
                    }
                  } else {
                    setCentrosSeleccionados(typeof value === 'string' ? value.split(',') : value);
                  }
                }}
                input={<OutlinedInput label="Centro" />}
                renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
                MenuProps={MenuProps}
                sx={{ fontSize: FONT_SIZES.md }}
              >
                <MenuItem value="__todos__">
                  <Checkbox checked={centrosSeleccionados.length === filtrosOpciones.centros.length && filtrosOpciones.centros.length > 0} size="small" />
                  <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                </MenuItem>
                {filtrosOpciones.centros.map((centro) => (
                  <MenuItem key={centro} value={centro}>
                    <Checkbox checked={centrosSeleccionados.includes(centro)} size="small" />
                    <ListItemText primary={centro} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Almacén Multiselect */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="almacen-label" sx={{ fontSize: FONT_SIZES.md }}>Almacén</InputLabel>
              <Select
                labelId="almacen-label"
                multiple
                value={almacenesSeleccionados}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.includes('__todos__')) {
                    if (almacenesSeleccionados.length === filtrosOpciones.almacenes.length) {
                      setAlmacenesSeleccionados([]);
                    } else {
                      setAlmacenesSeleccionados([...filtrosOpciones.almacenes]);
                    }
                  } else {
                    setAlmacenesSeleccionados(typeof value === 'string' ? value.split(',') : value);
                  }
                }}
                input={<OutlinedInput label="Almacén" />}
                renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
                MenuProps={MenuProps}
                sx={{ fontSize: FONT_SIZES.md }}
              >
                <MenuItem value="__todos__">
                  <Checkbox checked={almacenesSeleccionados.length === filtrosOpciones.almacenes.length && filtrosOpciones.almacenes.length > 0} size="small" />
                  <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                </MenuItem>
                {filtrosOpciones.almacenes.map((almacen) => (
                  <MenuItem key={almacen} value={almacen}>
                    <Checkbox checked={almacenesSeleccionados.includes(almacen)} size="small" />
                    <ListItemText primary={almacen} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Sector Multiselect */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="sector-label" sx={{ fontSize: FONT_SIZES.md }}>Sector</InputLabel>
              <Select
                labelId="sector-label"
                multiple
                value={sectoresSeleccionados}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.includes('__todos__')) {
                    if (sectoresSeleccionados.length === filtrosOpciones.sectores.length) {
                      setSectoresSeleccionados([]);
                    } else {
                      setSectoresSeleccionados([...filtrosOpciones.sectores]);
                    }
                  } else {
                    setSectoresSeleccionados(typeof value === 'string' ? value.split(',') : value);
                  }
                }}
                input={<OutlinedInput label="Sector" />}
                renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
                MenuProps={MenuProps}
                sx={{ fontSize: FONT_SIZES.md }}
              >
                <MenuItem value="__todos__">
                  <Checkbox checked={sectoresSeleccionados.length === filtrosOpciones.sectores.length && filtrosOpciones.sectores.length > 0} size="small" />
                  <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                </MenuItem>
                {filtrosOpciones.sectores.map((sector) => (
                  <MenuItem key={sector} value={sector}>
                    <Checkbox checked={sectoresSeleccionados.includes(sector)} size="small" />
                    <ListItemText primary={sector} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Solicitante Multiselect */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="solicitante-label" sx={{ fontSize: FONT_SIZES.md }}>Solicitante</InputLabel>
              <Select
                labelId="solicitante-label"
                multiple
                value={solicitantesSeleccionados}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.includes('__todos__')) {
                    if (solicitantesSeleccionados.length === filtrosOpciones.solicitantes.length) {
                      setSolicitantesSeleccionados([]);
                    } else {
                      setSolicitantesSeleccionados([...filtrosOpciones.solicitantes]);
                    }
                  } else {
                    setSolicitantesSeleccionados(typeof value === 'string' ? value.split(',') : value);
                  }
                }}
                input={<OutlinedInput label="Solicitante" />}
                renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
                MenuProps={MenuProps}
                sx={{ fontSize: FONT_SIZES.md }}
              >
                <MenuItem value="__todos__">
                  <Checkbox checked={solicitantesSeleccionados.length === filtrosOpciones.solicitantes.length && filtrosOpciones.solicitantes.length > 0} size="small" />
                  <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                </MenuItem>
                {filtrosOpciones.solicitantes.map((solicitante) => (
                  <MenuItem key={solicitante} value={solicitante}>
                    <Checkbox checked={solicitantesSeleccionados.includes(solicitante)} size="small" />
                    <ListItemText primary={solicitante} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Botón limpiar filtros (deseleccionar todos) */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setRangoFechasLocal([0, 365]); // Un año completo
                setCentrosSeleccionados([]);
                setAlmacenesSeleccionados([]);
                setSectoresSeleccionados([]);
                setSolicitantesSeleccionados([]);
              }}
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: FONT_SIZES.md,
                fontWeight: 500,
                color: 'grey.600',
                borderColor: 'grey.200',
                '&:hover': {
                  color: 'primary.main',
                  borderColor: 'primary.light',
                },
                textTransform: 'none',
              }}
            >
              Limpiar Filtros
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* ================================================================== */}
      {/* KPI SECTION */}
      {/* ================================================================== */}

      {kpiLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          {/* Grid principal - Layout unificado */}
          {/* Fila 1: KPIs principales */}
          <ScrollReveal delay={100}>
            <Stack direction="row" gap={1.5} flexWrap="wrap">
              {/* Solicitudes Creadas - Sparkline */}
              {(() => {
                const fechaDesde = sliderAFechaDate(rangoFechas[0]);
                const fechaHasta = sliderAFechaDate(rangoFechas[1]);
                fechaHasta.setHours(23, 59, 59, 999);

                const diasTotales = Math.max(1, Math.ceil((fechaHasta - fechaDesde) / (1000 * 60 * 60 * 24)));
                const segmentos = 7;
                const diasPorSegmento = Math.max(1, Math.ceil(diasTotales / segmentos));

                const datosSparkline = [];
                const labelsSparkline = [];

                const formatFecha = (date) => {
                  const dd = String(date.getDate()).padStart(2, '0');
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const yy = String(date.getFullYear()).slice(-2);
                  return `${dd}/${mm}/${yy}`;
                };

                for (let i = 0; i < segmentos; i++) {
                  const inicioSegmento = new Date(fechaDesde);
                  inicioSegmento.setDate(fechaDesde.getDate() + (i * diasPorSegmento));

                  const finSegmento = new Date(inicioSegmento);
                  finSegmento.setDate(inicioSegmento.getDate() + diasPorSegmento - 1);
                  finSegmento.setHours(23, 59, 59, 999);

                  const finReal = finSegmento > fechaHasta ? fechaHasta : finSegmento;

                  const count = datosFiltrados.filter(s => {
                    const fechaCreacion = new Date(s.created_at || s.fecha_creacion);
                    return fechaCreacion >= inicioSegmento && fechaCreacion <= finReal;
                  }).length;

                  datosSparkline.push(count);
                  labelsSparkline.push(formatFecha(inicioSegmento));
                }

                return (
                  <Box ref={solicitudesCredasRef} sx={{ flex: '1 1 340px', minWidth: 300, maxWidth: 420, height: 180, position: 'relative' }}>
                    <Box sx={{ position: 'absolute', top: 40, right: 8, zIndex: 10 }}>
                      <ExpandCardButton
                        onClick={() => {
                          setExpandedCard('solicitudes');
                          setExpandedTitle('Solicitudes Creadas');
                        }}
                      />
                    </Box>
                    <WeeklyRequestsKpiCard
                      data={datosSparkline}
                      labels={labelsSparkline}
                      previousWeekTotal={null}
                      trendPercentage={null}
                      compact={false}
                    />
                  </Box>
                );
              })()}

              {/* Cumplimiento de Proveedores - Diseño original */}
              {(() => {
                const totalPedidos = cumplimientoProveedores.reduce((sum, p) => sum + (p.total_pedidos || 0), 0);
                const entregasATiempo = cumplimientoProveedores.reduce((sum, p) => sum + (p.entregas_a_tiempo || 0), 0);
                const pctCumplimiento = totalPedidos > 0 ? Math.round((entregasATiempo / totalPedidos) * 100) : 0;

                // Filtrar proveedores seleccionados
                const proveedoresFiltrados = cumplimientoProveedores.filter(p =>
                  proveedoresSeleccionados.includes(p.proveedor_cuit || p.proveedor_nombre)
                );

                return (
                  <Paper
                    elevation={0}
                    sx={{
                      flex: '1 1 400px',
                      minWidth: 380,
                      maxWidth: 500,
                      height: 180,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      overflow: 'hidden',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box sx={{ p: 2, height: '100%' }}>
                      <Stack direction="row" gap={2} sx={{ height: '100%' }}>
                        {/* Lado izquierdo - KPI */}
                        <Box sx={{ flexShrink: 0, minWidth: 120 }}>
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                              Cumplimiento Proveedores
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.800' }}>
                              {totalPedidos > 0 ? `${pctCumplimiento}%` : 'N/A'}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: 'grey.500' }}>
                            {totalPedidos > 0 ? `${entregasATiempo}/${totalPedidos} a tiempo` : `${cumplimientoProveedores.length} proveedores`}
                          </Typography>
                        </Box>

                        {/* Separador */}
                        <Divider orientation="vertical" flexItem />

                        {/* Lado derecho - Selector y datos */}
                        <Box sx={{ flex: 1 }}>
                          <FormControl size="small" fullWidth sx={{ mb: 0.5 }}>
                            <InputLabel id="proveedores-label" sx={{ fontSize: FONT_SIZES.md }}>Proveedores</InputLabel>
                            <Select
                              labelId="proveedores-label"
                              multiple
                              value={proveedoresSeleccionados}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value.includes('__todos__')) {
                                  const todosIds = cumplimientoProveedores.map(p => p.proveedor_cuit || p.proveedor_nombre);
                                  if (proveedoresSeleccionados.length === todosIds.length) {
                                    setProveedoresSeleccionados([]);
                                  } else {
                                    setProveedoresSeleccionados(todosIds);
                                  }
                                } else {
                                  setProveedoresSeleccionados(typeof value === 'string' ? value.split(',') : value);
                                }
                              }}
                              input={<OutlinedInput label="Proveedores" />}
                              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected[0] || ''}
                              MenuProps={MenuProps}
                              sx={{ fontSize: FONT_SIZES.md }}
                            >
                              <MenuItem value="__todos__">
                                <Checkbox checked={proveedoresSeleccionados.length === cumplimientoProveedores.length && cumplimientoProveedores.length > 0} size="small" />
                                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                              </MenuItem>
                              {cumplimientoProveedores.map((p) => (
                                <MenuItem key={p.proveedor_cuit || p.proveedor_nombre} value={p.proveedor_cuit || p.proveedor_nombre}>
                                  <Checkbox checked={proveedoresSeleccionados.includes(p.proveedor_cuit || p.proveedor_nombre)} size="small" />
                                  <ListItemText primary={p.proveedor_nombre || 'Proveedor'} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          {proveedoresFiltrados.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 80, overflow: 'auto' }}>
                              {proveedoresFiltrados.slice(0, 5).map((p, idx) => {
                                const pct = p.pct_otif !== null && p.pct_otif !== undefined
                                  ? Math.round(p.pct_otif)
                                  : p.total_pedidos > 0
                                    ? Math.round((p.entregas_a_tiempo / p.total_pedidos) * 100)
                                    : null;
                                return (
                                  <Stack key={idx} direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="caption" sx={{ color: 'grey.600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {p.proveedor_nombre || 'Proveedor'}
                                    </Typography>
                                    {pct !== null ? (
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 600,
                                          ml: 1,
                                          color: pct >= 90 ? 'success.main' : pct >= 70 ? 'warning.main' : 'error.main',
                                        }}
                                      >
                                        {pct}%
                                      </Typography>
                                    ) : (
                                      <Typography variant="caption" sx={{ color: 'grey.400', ml: 1, fontSize: FONT_SIZES.xs }}>Sin datos</Typography>
                                    )}
                                  </Stack>
                                );
                              })}
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: 'grey.400', textAlign: 'center', py: 1, display: 'block' }}>
                              No hay datos de proveedores disponibles
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  </Paper>
                );
              })()}

              {/* Tiempos de Gestión - Barras Apiladas */}
              {(() => {
                // Calcular tiempos promedio desde datos filtrados
                const calcularTiempos = () => {
                  // Filtrar solicitudes que han pasado por el proceso completo (aprobadas o más avanzadas)
                  const solicitudesProcesadas = datosFiltrados.filter(s => {
                    const estado = (s.estado || s.status || '').toLowerCase();
                    return estado.includes('aprobada') || estado === 'approved' ||
                           estado.includes('proceso') || estado === 'processing' ||
                           estado.includes('despach') || estado === 'dispatched' ||
                           estado.includes('complet') || estado === 'completed' ||
                           estado.includes('cerrada') || estado === 'closed';
                  });

                  if (solicitudesProcesadas.length === 0) {
                    // Si no hay datos filtrados, usar el KPI global como fallback
                    const tiempoKpi = kpiData?.tiempoAprobacion?.promedio || 0;
                    if (tiempoKpi > 0) {
                      // Distribuir proporcionalmente: 35% aprobación, 40% planificación, 25% proveedor
                      return {
                        aprobacion: Math.round(tiempoKpi * 0.35),
                        planificacion: Math.round(tiempoKpi * 0.40),
                        proveedor: Math.round(tiempoKpi * 0.25),
                        total: Math.round(tiempoKpi)
                      };
                    }
                    return { aprobacion: 0, planificacion: 0, proveedor: 0, total: 0 };
                  }

                  // Calcular tiempo total real (updated_at - created_at) para cada solicitud
                  let tiempoTotalAcumulado = 0;
                  let count = 0;

                  solicitudesProcesadas.forEach(s => {
                    const fechaCreacion = new Date(s.created_at || s.fecha_creacion);
                    const fechaActualizacion = new Date(s.updated_at || s.fecha_actualizacion || s.created_at);

                    if (fechaActualizacion > fechaCreacion) {
                      const dias = Math.max(1, Math.round((fechaActualizacion - fechaCreacion) / (1000 * 60 * 60 * 24)));
                      tiempoTotalAcumulado += dias;
                      count++;
                    }
                  });

                  const tiempoPromedio = count > 0 ? Math.round(tiempoTotalAcumulado / count) : 0;

                  if (tiempoPromedio === 0) {
                    return { aprobacion: 0, planificacion: 0, proveedor: 0, total: 0 };
                  }

                  // Distribuir el tiempo total entre las fases según proporciones típicas del proceso
                  // 35% aprobación, 40% planificación, 25% proveedor
                  const tiempoAprobacion = Math.round(tiempoPromedio * 0.35);
                  const tiempoPlanificacion = Math.round(tiempoPromedio * 0.40);
                  // El resto va a proveedor para asegurar que sume exactamente el total
                  const tiempoProveedor = tiempoPromedio - tiempoAprobacion - tiempoPlanificacion;

                  return {
                    aprobacion: Math.max(0, tiempoAprobacion),
                    planificacion: Math.max(0, tiempoPlanificacion),
                    proveedor: Math.max(0, tiempoProveedor),
                    total: tiempoPromedio
                  };
                };

                const tiempos = calcularTiempos();
                const total = tiempos.total || 1; // Evitar división por 0

                // Colores para cada segmento - usando colores unificados
                const colores = PHASE_COLORS;

                // Porcentajes
                const pctAprobacion = tiempos.total > 0 ? (tiempos.aprobacion / tiempos.total) * 100 : 0;
                const pctPlanificacion = tiempos.total > 0 ? (tiempos.planificacion / tiempos.total) * 100 : 0;
                const pctProveedor = tiempos.total > 0 ? (tiempos.proveedor / tiempos.total) * 100 : 0;

                return (
                  <Paper
                    ref={tiemposGestionRef}
                    elevation={0}
                    sx={{
                      flex: '1 1 320px',
                      minWidth: 280,
                      maxWidth: 420,
                      height: 180,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'visible',
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      {/* Header - Aligned con Fuente de Abastecimiento */}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                          Tiempos de Gestión
                        </Typography>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: SPM_COLORS.primary, fontSize: FONT_SIZES.sm }}>
                            Promedio: {tiempos.total || 0}d
                          </Typography>
                          <ExpandCardButton
                            onClick={() => {
                              setExpandedCard('tiempos');
                              setExpandedTitle('Tiempos de Gestión');
                            }}
                          />
                        </Stack>
                      </Stack>

                      {/* Barra apilada horizontal */}
                      <Stack spacing={1.5} sx={{ flex: 1, justifyContent: 'center' }}>
                        {/* Barra principal apilada */}
                        <Box>
                          <Stack direction="row" spacing={0.5} sx={{ width: '100%', height: 12, borderRadius: 1, overflow: 'hidden' }}>
                            {/* Segmento Aprobación */}
                            <Box
                              sx={{
                                flex: pctAprobacion,
                                bgcolor: colores.aprobacion.bg,
                                minWidth: pctAprobacion > 5 ? 'auto' : 0,
                                transition: 'flex 0.3s ease',
                              }}
                            />
                            {/* Segmento Planificación */}
                            <Box
                              sx={{
                                flex: pctPlanificacion,
                                bgcolor: colores.planificacion.bg,
                                minWidth: pctPlanificacion > 5 ? 'auto' : 0,
                                transition: 'flex 0.3s ease',
                              }}
                            />
                            {/* Segmento Proveedor */}
                            <Box
                              sx={{
                                flex: pctProveedor,
                                bgcolor: colores.proveedor.bg,
                                minWidth: pctProveedor > 5 ? 'auto' : 0,
                                transition: 'flex 0.3s ease',
                              }}
                            />
                          </Stack>
                        </Box>

                        {/* Leyenda - Estilo consistente con otras cards, horizontal */}
                        <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'space-around' }}>
                          {/* Aprobación */}
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colores.aprobacion.bg, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                                Aprobación
                              </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: colores.aprobacion.bg, fontSize: FONT_SIZES.lg }}>
                                {tiempos.aprobacion}d
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                                ({pctAprobacion.toFixed(0)}%)
                              </Typography>
                            </Stack>
                          </Box>

                          {/* Planificación */}
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colores.planificacion.bg, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                                Planificación
                              </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: colores.planificacion.bg, fontSize: FONT_SIZES.lg }}>
                                {tiempos.planificacion}d
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                                ({pctPlanificacion.toFixed(0)}%)
                              </Typography>
                            </Stack>
                          </Box>

                          {/* Proveedor */}
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colores.proveedor.bg, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                                Proveedor
                              </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: colores.proveedor.bg, fontSize: FONT_SIZES.lg }}>
                                {tiempos.proveedor}d
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                                ({pctProveedor.toFixed(0)}%)
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </Stack>
                    </Box>
                  </Paper>
                );
              })()}

              {/* Compras Evitadas - Polar Area Chart */}
              {(() => {
                // Filtrar compras evitadas según filtros seleccionados
                const fechaDesde = sliderAFechaDate(rangoFechas[0]);
                const fechaHasta = sliderAFechaDate(rangoFechas[1]);
                fechaHasta.setHours(23, 59, 59, 999);

                // Filtrar ítems abastecidos internamente
                const comprasFiltradas = comprasEvitadasDetalle.filter(item => {
                  if (item.fecha) {
                    const fechaItem = new Date(item.fecha);
                    if (fechaItem < fechaDesde || fechaItem > fechaHasta) return false;
                  }
                  if (centrosSeleccionados.length > 0 && !centrosSeleccionados.includes(item.centro)) return false;
                  if (sectoresSeleccionados.length > 0 && !sectoresSeleccionados.includes(item.sector)) return false;
                  return centrosSeleccionados.length > 0 && sectoresSeleccionados.length > 0;
                });

                // Valor de stock interno (compras evitadas)
                const valorStockInterno = comprasFiltradas.reduce((sum, item) => sum + (item.valor || 0), 0);
                const itemsStockInterno = comprasFiltradas.length;

                // Calcular valor de compras externas desde solicitudes filtradas
                // Solicitudes que NO fueron abastecidas internamente (requieren compra a proveedor)
                const solicitudesConCompra = datosFiltrados.filter(s =>
                  ['processing', 'dispatched', 'closed'].includes(s.estado_actual) &&
                  s.origen_abastecimiento !== 'interno' &&
                  s.origen_abastecimiento !== 'stock'
                );
                const valorCompraExterna = solicitudesConCompra.reduce((sum, s) =>
                  sum + (Number(s.monto_total) || Number(s.valor_estimado) || 0), 0
                );
                const itemsCompraExterna = solicitudesConCompra.length;

                // Datos para Polar Area
                const polarData = [
                  {
                    label: 'Stock interno',
                    value: valorStockInterno || 0.01, // Mínimo para que se muestre
                    color: SPM_COLORS.success // Verde esmeralda
                  },
                  {
                    label: 'Compra externa',
                    value: valorCompraExterna || 0.01,
                    color: SPM_COLORS.warning // Ámbar
                  }
                ];

                const totalValor = valorStockInterno + valorCompraExterna;
                const pctInterno = totalValor > 0 ? ((valorStockInterno / totalValor) * 100).toFixed(1) : 0;

                // Formatear monto como KUSD o MUSD
                const formatMontoCorto = (val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                  return val.toFixed(0);
                };

                // Verificar si hay filtros activos
                const todosLosCentros = centrosSeleccionados.length === filtrosOpciones.centros.length;
                const todosLosSectores = sectoresSeleccionados.length === filtrosOpciones.sectores.length;
                const rangoCompleto = rangoFechas[0] === 0 && rangoFechas[1] === 365;
                const hayFiltrosActivos = !todosLosCentros || !todosLosSectores || !rangoCompleto;

                return (
                  <Paper
                    ref={fuenteAbastecimientoRef}
                    elevation={0}
                    sx={{
                      flex: '1 1 320px',
                      minWidth: 280,
                      maxWidth: 400,
                      height: 180,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                      position: 'relative',
                    }}
                  >
                    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {/* Header */}
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                            Fuente de Abastecimiento
                          </Typography>
                          {hayFiltrosActivos && (
                            <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'primary.main' }}>(filtrado)</Typography>
                          )}
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: SPM_COLORS.success, fontSize: FONT_SIZES.sm }}>
                            {pctInterno}% interno
                          </Typography>
                          <ExpandCardButton
                            onClick={() => {
                              setExpandedCard('fuente');
                              setExpandedTitle('Fuente de Abastecimiento');
                            }}
                          />
                        </Stack>
                      </Stack>

                      {/* Content: Chart + Legend */}
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1 }}>
                        {/* Polar Area Chart */}
                        <Box sx={{ width: 110, height: 110, flexShrink: 0 }}>
                          <SPMPolarArea
                            data={polarData}
                            height={110}
                            options={{
                              plugins: {
                                legend: { display: false },
                                tooltip: {
                                  ...TOOLTIP_CONFIG,
                                  callbacks: {
                                    label: (context) => {
                                      const value = context.parsed.r;
                                      const pct = totalValor > 0 ? ((value / totalValor) * 100).toFixed(1) : 0;
                                      return `USD ${formatMontoCorto(value)} (${pct}%)`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                r: {
                                  display: false,
                                  beginAtZero: true,
                                }
                              },
                              animation: ANIMATION_CONFIG,
                            }}
                          />
                        </Box>

                        {/* Leyenda personalizada */}
                        <Stack spacing={1} sx={{ flex: 1 }}>
                          {/* Stock interno */}
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SPM_COLORS.success, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                                Stock interno
                              </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: SPM_COLORS.success, fontSize: FONT_SIZES.lg }}>
                                USD {formatMontoCorto(valorStockInterno)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                                ({itemsStockInterno} ítems)
                              </Typography>
                            </Stack>
                          </Box>

                          {/* Compra externa */}
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SPM_COLORS.warning, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                                Compra externa
                              </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: SPM_COLORS.warning, fontSize: FONT_SIZES.lg }}>
                                USD {formatMontoCorto(valorCompraExterna)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                                ({itemsCompraExterna} sol.)
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </Stack>
                    </Box>
                  </Paper>
                );
              })()}
            </Stack>
          </ScrollReveal>

          {/* Fila: Distribucion + Tendencia + Presupuesto */}
          <ScrollReveal delay={200}>
            <Stack direction="row" flexWrap="wrap" gap={1.5}>

              {/* Distribución de Estados - Chart.js Doughnut */}
              {(() => {
                const estados = {
                  borrador: 0,
                  enviadas: 0,
                  aprobadas: 0,
                  enProceso: 0,
                  rechazadas: 0,
                  cerradas: 0
                };

                datosFiltrados.forEach(s => {
                  const estado = (s.estado || s.status || '').toLowerCase().trim();
                  if (estado.includes('draft') || estado.includes('borrador')) {
                    estados.borrador++;
                  } else if (estado.includes('submitted') || estado.includes('enviada') || estado.includes('pending') || estado.includes('pendiente') || estado === '') {
                    estados.enviadas++;
                  } else if (estado.includes('approved') || estado.includes('aprobada')) {
                    estados.aprobadas++;
                  } else if (estado.includes('processing') || estado.includes('proceso') || estado.includes('in_processing') || estado.includes('en proceso') || estado.includes('compra')) {
                    estados.enProceso++;
                  } else if (estado.includes('rejected') || estado.includes('rechazada')) {
                    estados.rechazadas++;
                  } else if (estado.includes('closed') || estado.includes('cerrada') || estado.includes('dispatched') || estado.includes('despachada') || estado.includes('completed')) {
                    estados.cerradas++;
                  } else {
                    // Contar como "en proceso" los estados no reconocidos
                    estados.enProceso++;
                  }
                });

                // Datos para StatusDistributionChart - usando colores unificados
                const chartData = [
                  { id: 'borrador', label: 'Borrador', value: estados.borrador, color: STATUS_COLORS['borrador'] || '#94a3b8' },
                  { id: 'enviadas', label: 'Enviadas', value: estados.enviadas, color: STATUS_COLORS['enviadas'] || '#3b82f6' },
                  { id: 'aprobadas', label: 'Aprobadas', value: estados.aprobadas, color: STATUS_COLORS['aprobadas'] || '#10b981' },
                  { id: 'enProceso', label: 'En Proceso', value: estados.enProceso, color: STATUS_COLORS['enProceso'] || '#8b5cf6' },
                  { id: 'rechazadas', label: 'Rechazadas', value: estados.rechazadas, color: STATUS_COLORS['rechazadas'] || '#ef4444' },
                  { id: 'cerradas', label: 'Cerradas', value: estados.cerradas, color: STATUS_COLORS['cerradas'] || '#8b5cf6' },
                ];

                return (
                  <Paper
                    ref={distribucionRef}
                    elevation={0}
                    sx={{
                      flex: '0 0 280px',
                      height: 200,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                      p: 1.5,
                      overflow: 'visible',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                        Distribución de Estados
                      </Typography>
                      <Stack direction="row" alignItems="center" gap={0}>
                        <ExpandCardButton
                          onClick={() => {
                            setExpandedCard('distribucion');
                            setExpandedTitle('Distribución de Estados');
                          }}
                        />
                        <ChartExportButton chartRef={distribucionRef} filename="distribucion-estados" size="small" />
                      </Stack>
                    </Stack>
                    <Box sx={{ height: 155 }}>
                      <StatusDistributionChart
                        data={chartData}
                        onDrillDown={handleDrillDown}
                        height={150}
                        innerRadius={35}
                        outerRadius={55}
                      />
                    </Box>
                  </Paper>
                );
              })()}

              {/* Tendencia Historica - Chart.js Line */}
              <Paper
                ref={tendenciaRef}
                elevation={0}
                sx={{
                  flex: '1 1 350px',
                  minWidth: 350,
                  height: 200,
                  bgcolor: 'var(--surface)',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  transition: 'box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                    Tendencia Histórica (12 meses)
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0}>
                    <ExpandCardButton
                      onClick={() => {
                        setExpandedCard('tendencia');
                        setExpandedTitle('Tendencia Histórica (12 meses)');
                      }}
                    />
                    <ChartExportButton chartRef={tendenciaRef} filename="tendencia-historica" size="small" />
                  </Stack>
                </Stack>
                <Box>
                  <TrendChart
                    data={trendData}
                    height={145}
                    showLegend={true}
                    showArea={true}
                  />
                </Box>
              </Paper>

              {/* Presupuesto - Filtrable por Centro/Sector - Con Chart.js Gauge */}
              {(() => {
                // Filtrar topCentros y topSectores según selección
                const topCentros = (kpiData.presupuesto.topCentros || []);
                const topSectores = (kpiData.presupuesto.topSectores || []);

                // Filtrar centros seleccionados
                const centrosFiltrados = centrosSeleccionados.length > 0
                  ? topCentros.filter(c => centrosSeleccionados.includes(c.nombre))
                  : topCentros;

                // Filtrar sectores seleccionados
                const sectoresFiltrados = sectoresSeleccionados.length > 0
                  ? topSectores.filter(s => sectoresSeleccionados.includes(s.nombre))
                  : topSectores;

                // Calcular presupuesto filtrado desde topCentros si hay filtros
                let presupuestoFiltrado = {
                  total: kpiData.presupuesto.total,
                  utilizado: kpiData.presupuesto.utilizado,
                  disponible: kpiData.presupuesto.disponible,
                  percentage: kpiData.presupuesto.percentage,
                };

                // Si hay centros seleccionados Y tenemos datos de esos centros, recalcular
                if (centrosSeleccionados.length > 0 && centrosFiltrados.length > 0) {
                  const utilizadoFiltrado = centrosFiltrados.reduce((sum, c) => sum + (c.utilizado || 0), 0);
                  const totalFiltrado = centrosFiltrados.reduce((sum, c) => sum + (c.monto || 0), 0);
                  presupuestoFiltrado = {
                    total: totalFiltrado,
                    utilizado: utilizadoFiltrado,
                    disponible: totalFiltrado - utilizadoFiltrado,
                    percentage: totalFiltrado > 0 ? Math.round((utilizadoFiltrado / totalFiltrado) * 100) : 0,
                  };
                }

                const hayFiltrosActivos = centrosSeleccionados.length > 0 && centrosSeleccionados.length < filtrosOpciones.centros.length;
                const mostrandoGlobal = !hayFiltrosActivos || centrosFiltrados.length === 0;

                return (
                  <Paper
                    ref={presupuestoGlobalRef}
                    elevation={0}
                    sx={{
                      flex: '1 1 auto',
                      minWidth: 480,
                      maxWidth: 620,
                      height: 200,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                      p: 1.5,
                      overflow: 'visible',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={0.5}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                          Presupuesto {mostrandoGlobal ? 'Global' : 'Filtrado'}
                        </Typography>
                        {!mostrandoGlobal && (
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'primary.main' }}>
                            ({centrosFiltrados.length} centros)
                          </Typography>
                        )}
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={0}>
                        <ExpandCardButton
                          onClick={() => {
                            setExpandedCard('presupuesto');
                            setExpandedTitle('Presupuesto Global');
                          }}
                        />
                        <ChartExportButton chartRef={presupuestoGlobalRef} filename="presupuesto-global" size="small" />
                      </Stack>
                    </Stack>
                    <Stack direction="row" alignItems="flex-start" gap={1.5}>
                      {/* Medidores con SPMGauge Chart.js - Colores unificados BUDGET_COLORS */}
                      <Stack direction="row" gap={0} sx={{ flexShrink: 0 }}>
                        <Stack alignItems="center" sx={{ width: 75 }}>
                          <SPMGauge
                            value={100}
                            valueMax={100}
                            width={70}
                            height={70}
                            color={BUDGET_COLORS.total}
                            startAngle={-90}
                            endAngle={90}
                          />
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.secondary', mt: -0.5 }}>Total</Typography>
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.total, whiteSpace: 'nowrap' }}>
                            MUSD {(presupuestoFiltrado.total / 1000000).toFixed(1)}
                          </Typography>
                        </Stack>
                        <Stack alignItems="center" sx={{ width: 75 }}>
                          <SPMGauge
                            value={presupuestoFiltrado.percentage}
                            valueMax={100}
                            width={70}
                            height={70}
                            color={BUDGET_COLORS.utilizado}
                            startAngle={-90}
                            endAngle={90}
                          />
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.secondary', mt: -0.5 }}>Utilizado</Typography>
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.utilizado, whiteSpace: 'nowrap' }}>
                            MUSD {(presupuestoFiltrado.utilizado / 1000000).toFixed(1)}
                          </Typography>
                        </Stack>
                        <Stack alignItems="center" sx={{ width: 75 }}>
                          <SPMGauge
                            value={100 - presupuestoFiltrado.percentage}
                            valueMax={100}
                            width={70}
                            height={70}
                            color={BUDGET_COLORS.disponible}
                            startAngle={-90}
                            endAngle={90}
                          />
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.secondary', mt: -0.5 }}>Disponible</Typography>
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.disponible, whiteSpace: 'nowrap' }}>
                            MUSD {(presupuestoFiltrado.disponible / 1000000).toFixed(1)}
                          </Typography>
                        </Stack>
                      </Stack>
                      {/* Separador vertical */}
                      <Box sx={{ width: '1px', height: 120, bgcolor: 'divider', flexShrink: 0, alignSelf: 'center' }} />
                      {/* Top 3 en dos columnas - Barras de progreso */}
                      <Box sx={{ flex: 1, minWidth: 240, overflow: 'visible' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontSize: FONT_SIZES.xs, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.3px', mb: 0.75, textAlign: 'center' }}>
                          {mostrandoGlobal ? 'Top3 consumo del Presupuesto Global por:' : 'Seleccionados'}
                        </Typography>
                        <Stack direction="row" gap={2}>
                          {/* Top Centros */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ display: 'block', fontSize: FONT_SIZES.xs, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                              Centros
                            </Typography>
                            <Stack spacing={0.75}>
                              {(mostrandoGlobal ? topCentros : centrosFiltrados).slice(0, 3).map((centro, idx) => (
                                <Box key={idx}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25, width: '100%', overflow: 'visible' }}>
                                    <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                      {centro.nombre}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.utilizado, ml: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {centro.porcentaje}%
                                    </Typography>
                                  </Stack>
                                  <Box sx={{ height: 4, bgcolor: 'grey.200', borderRadius: 2, overflow: 'hidden' }}>
                                    <Box sx={{ height: '100%', width: `${Math.min(centro.porcentaje || 0, 100)}%`, bgcolor: BUDGET_COLORS.utilizado, borderRadius: 2, transition: 'width 0.3s ease' }} />
                                  </Box>
                                </Box>
                              ))}
                              {(mostrandoGlobal ? topCentros : centrosFiltrados).length === 0 && (
                                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.disabled' }}>Sin datos</Typography>
                              )}
                            </Stack>
                          </Box>
                          {/* Top Sectores */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ display: 'block', fontSize: FONT_SIZES.xs, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                              Sectores
                            </Typography>
                            <Stack spacing={0.75}>
                              {(mostrandoGlobal ? topSectores : sectoresFiltrados).slice(0, 3).map((sector, idx) => (
                                <Box key={idx}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25, width: '100%', overflow: 'visible' }}>
                                    <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                      {sector.nombre}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.total, ml: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {sector.porcentaje}%
                                    </Typography>
                                  </Stack>
                                  <Box sx={{ height: 4, bgcolor: 'grey.200', borderRadius: 2, overflow: 'hidden' }}>
                                    <Box sx={{ height: '100%', width: `${Math.min(sector.porcentaje || 0, 100)}%`, bgcolor: BUDGET_COLORS.total, borderRadius: 2, transition: 'width 0.3s ease' }} />
                                  </Box>
                                </Box>
                              ))}
                              {(mostrandoGlobal ? topSectores : sectoresFiltrados).length === 0 && (
                                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.disabled' }}>Sin datos</Typography>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })()}

            </Stack>
          </ScrollReveal>

          {/* Fila 3: Materiales y Stock */}
          <ScrollReveal delay={300}>
            <Stack direction="row" flexWrap="wrap" gap={1.5}>

              {/* Materiales Más Solicitados - Lista simple top 10 */}
              {(() => {
                const materialesCount = {};
                datosFiltrados.forEach(s => {
                  (s.items || []).forEach(item => {
                    // Campos correctos según estructura de BD: material, precio_usd, subtotal
                    const codigo = item.material || item.codigo || item.codigo_sap || '';
                    const nombre = item.descripcion || item.nombre || item.material_nombre || `Material ${item.material_id || codigo}`;
                    const cantidad = item.cantidad || 1;
                    const precio = item.precio_usd || item.precio_unitario || item.precio || item.precio_estimado || 0;
                    const subtotal = item.subtotal || (cantidad * precio);
                    const key = codigo || nombre;
                    if (!materialesCount[key]) {
                      materialesCount[key] = { codigo, nombre, cantidad: 0, monto: 0, precioUnitario: precio };
                    }
                    materialesCount[key].cantidad += cantidad;
                    materialesCount[key].monto += subtotal;
                    // Actualizar precio unitario si es mayor (para tener el más reciente o mayor)
                    if (precio > materialesCount[key].precioUnitario) {
                      materialesCount[key].precioUnitario = precio;
                    }
                  });
                });

                const materialesList = Object.values(materialesCount)
                  .sort((a, b) => b.monto - a.monto)
                  .slice(0, 10);

                // Verificar si hay algún monto > 0 para decidir si mostrar la columna
                const hayMontos = materialesList.some(m => m.monto > 0);

                const formatMonto = (val) => {
                  if (val >= 1000000) return `MUSD ${(val / 1000000).toFixed(2).replace('.', ',')}`;
                  if (val >= 1000) return `KUSD ${(val / 1000).toFixed(2).replace('.', ',')}`;
                  return `USD ${val.toFixed(2).replace('.', ',')}`;
                };

                return (
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                        Materiales Más Solicitados
                      </Typography>
                    </Box>
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
                        {materialesList.length > 0 ? (
                          materialesList.map((material, idx) => (
                            <Stack
                              key={idx}
                              direction="row"
                              alignItems="center"
                              gap={1}
                              sx={{
                                py: 0.75,
                                px: 0.5,
                                mx: -0.5,
                                '&:hover': { bgcolor: 'grey.50' },
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'grey.400', width: 16, fontSize: FONT_SIZES.xs }}>{idx + 1}.</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace' }}>{material.codigo || '-'}</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                                {material.nombre}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(material.cantidad)}</Typography>
                              {hayMontos && (
                                <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMonto(material.monto)}</Typography>
                              )}
                            </Stack>
                          ))
                        ) : (
                          <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>No hay datos</Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              })()}

              {/* Stock Inmovilizado Global - Lista top 10 */}
              {(() => {
                const formatMontoStock = (val) => {
                  if (val >= 1000000) return `MUSD ${(val / 1000000).toFixed(2).replace('.', ',')}`;
                  if (val >= 1000) return `KUSD ${(val / 1000).toFixed(2).replace('.', ',')}`;
                  return `USD ${(val || 0).toFixed(2).replace('.', ',')}`;
                };

                // Verificar si hay algún monto > 0
                const hayMontosStock = stockInmovilizadoFiltrado.items.some(item => (item.valor || 0) > 0);

                return (
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                        Stock Inmovilizado Global
                      </Typography>
                    </Box>
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
                        {stockInmovilizadoFiltrado.items.length > 0 ? (
                          stockInmovilizadoFiltrado.items.map((item, idx) => (
                            <Stack
                              key={idx}
                              direction="row"
                              alignItems="center"
                              gap={1}
                              sx={{
                                py: 0.75,
                                px: 0.5,
                                mx: -0.5,
                                '&:hover': { bgcolor: 'grey.50' },
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'grey.400', width: 16, fontSize: FONT_SIZES.xs }}>{idx + 1}.</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace' }}>{item.codigo || '-'}</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                                {item.descripcion}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(item.stock || 0)}</Typography>
                              {hayMontosStock && (
                                <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMontoStock(item.valor || 0)}</Typography>
                              )}
                            </Stack>
                          ))
                        ) : (
                          <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>
                            {kpiLoading ? 'Cargando...' : 'No hay stock inmovilizado disponible'}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              })()}

              {/* Stock Inmovilizado con Filtros - Nueva card */}
              {(() => {
                const formatMontoStock = (val) => {
                  if (val >= 1000000) return `MUSD ${(val / 1000000).toFixed(2).replace('.', ',')}`;
                  if (val >= 1000) return `KUSD ${(val / 1000).toFixed(2).replace('.', ',')}`;
                  return `USD ${(val || 0).toFixed(2).replace('.', ',')}`;
                };

                const hayMontosStock = stockFiltradoLocal.items.some(item => (item.valor || 0) > 0);

                return (
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      bgcolor: 'var(--surface)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                        Stock Inmovilizado
                      </Typography>
                      {/* Filtros MUI */}
                      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel id="stock-centro-label" sx={{ fontSize: '0.7rem' }}>Centro</InputLabel>
                          <Select
                            labelId="stock-centro-label"
                            value={stockFiltrosCentro}
                            onChange={(e) => setStockFiltrosCentro(e.target.value)}
                            input={<OutlinedInput label="Centro" />}
                            sx={{ fontSize: '0.7rem' }}
                          >
                            <MenuItem value=""><em>Todos</em></MenuItem>
                            {filtrosOpciones.centros.map((centro) => (
                              <MenuItem key={centro} value={centro} sx={{ fontSize: FONT_SIZES.md }}>{centro}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel id="stock-almacen-label" sx={{ fontSize: '0.7rem' }}>Almacén</InputLabel>
                          <Select
                            labelId="stock-almacen-label"
                            value={stockFiltrosAlmacen}
                            onChange={(e) => setStockFiltrosAlmacen(e.target.value)}
                            input={<OutlinedInput label="Almacén" />}
                            sx={{ fontSize: '0.7rem' }}
                          >
                            <MenuItem value=""><em>Todos</em></MenuItem>
                            {filtrosOpciones.almacenes.map((almacen) => (
                              <MenuItem key={almacen} value={almacen} sx={{ fontSize: FONT_SIZES.md }}>{almacen}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="stock-periodo-label" sx={{ fontSize: '0.7rem' }}>Periodo</InputLabel>
                          <Select
                            labelId="stock-periodo-label"
                            value={stockFiltrosPeriodo}
                            onChange={(e) => setStockFiltrosPeriodo(Number(e.target.value))}
                            input={<OutlinedInput label="Periodo" />}
                            sx={{ fontSize: '0.7rem' }}
                          >
                            <MenuItem value={1} sx={{ fontSize: FONT_SIZES.md }}>1 año sin consumo</MenuItem>
                            <MenuItem value={2} sx={{ fontSize: FONT_SIZES.md }}>2 años sin consumo</MenuItem>
                            <MenuItem value={3} sx={{ fontSize: FONT_SIZES.md }}>3 años sin consumo</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </Box>
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
                        {stockFiltradoLocal.loading ? (
                          <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>Cargando...</Typography>
                        ) : stockFiltradoLocal.items.length > 0 ? (
                          [...stockFiltradoLocal.items].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 10).map((item, idx) => (
                            <Stack
                              key={idx}
                              direction="row"
                              alignItems="center"
                              gap={1}
                              sx={{
                                py: 0.75,
                                px: 0.5,
                                mx: -0.5,
                                '&:hover': { bgcolor: 'grey.50' },
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'grey.400', width: 16, fontSize: FONT_SIZES.xs }}>{idx + 1}.</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace' }}>{item.codigo || '-'}</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                                {item.descripcion}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(item.stock || 0)}</Typography>
                              {hayMontosStock && (
                                <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMontoStock(item.valor || 0)}</Typography>
                              )}
                            </Stack>
                          ))
                        ) : (
                          <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>
                            No hay stock inmovilizado con estos filtros
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              })()}

            </Stack>
          </ScrollReveal>

          {/* Modal para ampliar cards */}
          <Dialog
            open={Boolean(expandedCard)}
            onClose={() => setExpandedCard(null)}
            maxWidth="lg"
            fullWidth
            sx={{
              '& .MuiDialog-paper': {
                maxHeight: '90vh',
              }
            }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: FONT_SIZES.lg }}>
                {expandedTitle}
              </Typography>
              <IconButton onClick={() => setExpandedCard(null)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ overflow: 'auto', py: 2, minHeight: 300 }}>
              {/* Distribución de Estados - ampliado */}
              {expandedCard === 'distribucion' && (() => {
                const estados = { borrador: 0, enviadas: 0, aprobadas: 0, enProceso: 0, rechazadas: 0, cerradas: 0 };
                datosFiltrados.forEach(s => {
                  const e = (s.estado || s.status || '').toLowerCase().trim();
                  if (e.includes('draft') || e.includes('borrador')) estados.borrador++;
                  else if (e.includes('submitted') || e.includes('enviada') || e.includes('pending') || e.includes('pendiente') || e === '') estados.enviadas++;
                  else if (e.includes('approved') || e.includes('aprobada')) estados.aprobadas++;
                  else if (e.includes('processing') || e.includes('proceso') || e.includes('in_processing') || e.includes('compra')) estados.enProceso++;
                  else if (e.includes('rejected') || e.includes('rechazada')) estados.rechazadas++;
                  else if (e.includes('closed') || e.includes('cerrada') || e.includes('dispatched') || e.includes('completed')) estados.cerradas++;
                  else estados.enProceso++;
                });
                const data = [
                  { id: 'borrador', label: 'Borrador', value: estados.borrador, color: STATUS_COLORS['borrador'] || '#94a3b8' },
                  { id: 'enviadas', label: 'Enviadas', value: estados.enviadas, color: STATUS_COLORS['enviadas'] || '#3b82f6' },
                  { id: 'aprobadas', label: 'Aprobadas', value: estados.aprobadas, color: STATUS_COLORS['aprobadas'] || '#10b981' },
                  { id: 'enProceso', label: 'En Proceso', value: estados.enProceso, color: STATUS_COLORS['enProceso'] || '#8b5cf6' },
                  { id: 'rechazadas', label: 'Rechazadas', value: estados.rechazadas, color: STATUS_COLORS['rechazadas'] || '#ef4444' },
                  { id: 'cerradas', label: 'Cerradas', value: estados.cerradas, color: STATUS_COLORS['cerradas'] || '#8b5cf6' },
                ];
                return (
                  <Box sx={{ height: 400 }}>
                    <StatusDistributionChart data={data} onDrillDown={handleDrillDown} height={380} innerRadius={80} outerRadius={140} />
                  </Box>
                );
              })()}

              {/* Tendencia Histórica - ampliado */}
              {expandedCard === 'tendencia' && (
                <Box sx={{ height: 400 }}>
                  <TrendChart data={trendData} height={380} showLegend={true} showArea={true} />
                </Box>
              )}

              {/* Presupuesto Global - ampliado */}
              {expandedCard === 'presupuesto' && (() => {
                const p = kpiData.presupuesto;
                const fmt = (val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                  return (val || 0).toFixed(0);
                };
                const topC = (p.topCentros || []).slice(0, 5);
                const topS = (p.topSectores || []).slice(0, 5);
                return (
                  <Stack spacing={3}>
                    <Stack direction="row" justifyContent="space-around" alignItems="center">
                      <Stack alignItems="center" sx={{ width: 140 }}>
                        <SPMGauge value={p.percentage || 0} max={100} height={120} color={BUDGET_COLORS.total} />
                        <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.5 }}>Total MUSD {fmt(p.total)}</Typography>
                      </Stack>
                      <Stack alignItems="center" sx={{ width: 140 }}>
                        <SPMGauge value={p.total > 0 ? Math.round((p.utilizado / p.total) * 100) : 0} max={100} height={120} color={BUDGET_COLORS.utilizado} />
                        <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.5 }}>Utilizado MUSD {fmt(p.utilizado)}</Typography>
                      </Stack>
                      <Stack alignItems="center" sx={{ width: 140 }}>
                        <SPMGauge value={p.total > 0 ? Math.round((p.disponible / p.total) * 100) : 0} max={100} height={120} color={BUDGET_COLORS.disponible} />
                        <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.5 }}>Disponible MUSD {fmt(p.disponible)}</Typography>
                      </Stack>
                    </Stack>
                    {topC.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Top Centros</Typography>
                        {topC.map((c, i) => (
                          <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <Typography variant="caption" sx={{ width: 80, flexShrink: 0 }}>{c.nombre}</Typography>
                            <Box sx={{ flex: 1, height: 8, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                              <Box sx={{ width: `${c.monto > 0 ? Math.min(100, (c.utilizado / c.monto) * 100) : 0}%`, height: '100%', bgcolor: BUDGET_COLORS.utilizado, borderRadius: 1 }} />
                            </Box>
                            <Typography variant="caption" sx={{ width: 70, textAlign: 'right' }}>KUSD {fmt(c.utilizado)}</Typography>
                          </Stack>
                        ))}
                      </Box>
                    )}
                    {topS.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Top Sectores</Typography>
                        {topS.map((s, i) => (
                          <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            <Typography variant="caption" sx={{ width: 100, flexShrink: 0 }}>{s.nombre}</Typography>
                            <Box sx={{ flex: 1, height: 8, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                              <Box sx={{ width: `${s.monto > 0 ? Math.min(100, (s.utilizado / s.monto) * 100) : 0}%`, height: '100%', bgcolor: BUDGET_COLORS.disponible, borderRadius: 1 }} />
                            </Box>
                            <Typography variant="caption" sx={{ width: 70, textAlign: 'right' }}>KUSD {fmt(s.utilizado)}</Typography>
                          </Stack>
                        ))}
                      </Box>
                    )}
                  </Stack>
                );
              })()}

              {/* Solicitudes Creadas - ampliado */}
              {expandedCard === 'solicitudes' && (
                <Box sx={{ height: 350 }}>
                  <WeeklyRequestsKpiCard
                    data={datosFiltrados.map(() => 1)}
                    labels={[]}
                    previousWeekTotal={null}
                    trendPercentage={null}
                    compact={false}
                  />
                </Box>
              )}

              {/* Tiempos de Gestión - ampliado */}
              {expandedCard === 'tiempos' && (() => {
                const sols = datosFiltrados.filter(s => {
                  const e = (s.estado || s.status || '').toLowerCase();
                  return ['approved', 'aprobada', 'in_planning', 'in_treatment', 'treated', 'completed', 'closed'].some(st => e.includes(st));
                });
                let sumAprobacion = 0, sumPlanificacion = 0, sumProveedor = 0, count = 0;
                sols.forEach(s => {
                  const creado = new Date(s.created_at || s.fecha_creacion);
                  const aprobado = s.fecha_aprobacion ? new Date(s.fecha_aprobacion) : null;
                  const planificado = s.fecha_planificacion ? new Date(s.fecha_planificacion) : null;
                  if (aprobado) { sumAprobacion += Math.max(0, (aprobado - creado) / 86400000); count++; }
                  if (planificado && aprobado) sumPlanificacion += Math.max(0, (planificado - aprobado) / 86400000);
                });
                const avgA = count > 0 ? Math.round(sumAprobacion / count) : 0;
                const avgP = count > 0 ? Math.round(sumPlanificacion / count) : 0;
                const avgPr = Math.max(0, Math.round(avgA * 0.7));
                const total = avgA + avgP + avgPr || 1;
                return (
                  <Stack spacing={3} sx={{ py: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, textAlign: 'center' }}>Promedio total: {total}d</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ width: '100%', height: 32, borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ flex: avgA, bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{avgA}d</Typography>
                      </Box>
                      <Box sx={{ flex: avgP, bgcolor: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{avgP}d</Typography>
                      </Box>
                      <Box sx={{ flex: avgPr, bgcolor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{avgPr}d</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-around">
                      {[{ label: 'Aprobacion', val: avgA, color: '#3b82f6' }, { label: 'Planificacion', val: avgP, color: '#f59e0b' }, { label: 'Proveedor', val: avgPr, color: '#10b981' }].map(item => (
                        <Stack key={item.label} alignItems="center" spacing={0.5}>
                          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: item.color }} />
                          <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>{item.val}d</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>({total > 0 ? ((item.val / total) * 100).toFixed(0) : 0}%)</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                );
              })()}

              {/* Fuente de Abastecimiento - ampliado */}
              {expandedCard === 'fuente' && (() => {
                const compras = datosFiltrados.filter(s => {
                  const origen = (s.origen_abastecimiento || '').toLowerCase();
                  return origen === 'stock' || origen.includes('interno') || origen.includes('almacen');
                });
                const valInt = compras.reduce((sum, item) => sum + (item.valor || 0), 0);
                const itemsInt = compras.length;
                const externas = datosFiltrados.filter(s => {
                  const o = (s.origen_abastecimiento || '').toLowerCase();
                  return o && o !== 'stock' && !o.includes('interno') && !o.includes('almacen');
                });
                const valExt = externas.reduce((sum, s) => sum + (Number(s.monto_total) || Number(s.valor_estimado) || 0), 0);
                const itemsExt = externas.length;
                const polar = [
                  { label: 'Stock interno', value: valInt || 0.01, color: SPM_COLORS.success },
                  { label: 'Compra externa', value: valExt || 0.01, color: SPM_COLORS.warning },
                ];
                const tot = valInt + valExt;
                const fmt = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : (v || 0).toFixed(0);
                return (
                  <Stack direction="row" alignItems="center" spacing={4} sx={{ py: 2 }}>
                    <Box sx={{ width: 280, height: 280 }}>
                      <SPMPolarArea data={polar} height={280} options={{ plugins: { legend: { display: true }, tooltip: TOOLTIP_CONFIG }, scales: { r: { display: false, beginAtZero: true } }, animation: ANIMATION_CONFIG }} />
                    </Box>
                    <Stack spacing={2}>
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: SPM_COLORS.success }} />
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>Stock interno</Typography>
                        </Stack>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: SPM_COLORS.success, ml: 3.5 }}>USD {fmt(valInt)}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>{itemsInt} items ({tot > 0 ? ((valInt / tot) * 100).toFixed(1) : 0}%)</Typography>
                      </Box>
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: SPM_COLORS.warning }} />
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>Compra externa</Typography>
                        </Stack>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: SPM_COLORS.warning, ml: 3.5 }}>USD {fmt(valExt)}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>{itemsExt} solicitudes ({tot > 0 ? ((valExt / tot) * 100).toFixed(1) : 0}%)</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                );
              })()}
            </DialogContent>
          </Dialog>

        </>
      )}
    </Box>
  );
}
