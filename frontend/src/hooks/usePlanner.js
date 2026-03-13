/**
 * usePlanner Hook
 * Extracts business logic and state management from Planner.jsx
 * Sprint: Technical Audit - Phase 2
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { planner, solicitudes } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { useRealtimeEvent } from "../hooks/useRealtime";
import { useDebouncedValue as useDebounced } from "../hooks/useDebouncedValue";
import { getSectorNombre, formatDate, exportToExcel } from "../utils/formatters";
import api from "../services/api";

const DEBOUNCE_MS = 300;
const ITEMS_PER_PAGE = 20;

// Opciones estáticas para Estado y Criticidad
const ESTADOS_OPTIONS = [
  { value: "aprobada", label: "Aprobada" },
  { value: "progreso", label: "En Progreso" },
  { value: "finalizada", label: "Finalizada" },
  { value: "rechazada", label: "Rechazada" },
];

const CRITICIDAD_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
];

/**
 * @typedef {Object} RejectModalState
 * @property {boolean} open
 * @property {Object|null} solicitud
 * @property {string} motivo
 */

/**
 * @typedef {Object} HistorialModalState
 * @property {boolean} open
 * @property {Object|null} solicitud
 */

/**
 * Custom hook for Planner page state management and business logic
 * @param {Object} options - Hook options
 * @param {Function} options.t - Translation function from useI18n
 * @param {string} options.filterMode - Filter mode: "asignadas", "no-asignadas", or undefined for all
 * @returns {Object} Planner state and methods
 */
export function usePlanner({ t, filterMode }) {
  const { user } = useAuthStore();

  // Core state
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Search
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);

  // Catálogos del sistema
  const [catalogos, setCatalogos] = useState({ centros: [], almacenes: [], sectores: [] });

  // Filters - Ahora son arrays para multiselect
  const [filtroCentros, setFiltroCentros] = useState([]);
  const [filtroAlmacenes, setFiltroAlmacenes] = useState([]);
  const [filtroSectores, setFiltroSectores] = useState([]);
  const [filtroEstados, setFiltroEstados] = useState([]);
  const [filtroCriticidades, setFiltroCriticidades] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Active tab for treatment state filtering
  const [activeTab, setActiveTab] = useState("pendientes");

  // Modals
  const [selectedParaTratar, setSelectedParaTratar] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, solicitud: null, motivo: "" });
  const [historialModal, setHistorialModal] = useState({ open: false, solicitud: null });

  // Load data from API
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};

      // Filter by assignment mode
      if (filterMode === "asignadas") {
        // Solo solicitudes asignadas al usuario actual
        params.planner_id = user?.id_spm || user?.id;
      } else if (filterMode === "no-asignadas") {
        // Solo solicitudes sin asignar
        params.sin_asignar = true;
      }
      // Sin filterMode: admin y planificador ven todas (para poder "tomar" de otros)

      const res = await planner.listar(params);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.rol, user?.id, user?.id_spm, filterMode]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Cargar catálogos
  useEffect(() => {
    let cancelled = false;
    const fetchCatalogos = async () => {
      try {
        const res = await api.get("/catalogos");
        if (cancelled) return;
        setCatalogos({
          centros: res.data?.centros || [],
          almacenes: res.data?.almacenes || [],
          sectores: res.data?.sectores || [],
        });
      } catch (err) {
        if (cancelled) return;
        try {
          const [centrosRes, almacenesRes, sectoresRes] = await Promise.all([
            api.get("/catalogos/centros"),
            api.get("/catalogos/almacenes"),
            api.get("/catalogos/sectores"),
          ]);
          if (cancelled) return;
          setCatalogos({
            centros: centrosRes.data || [],
            almacenes: almacenesRes.data || [],
            sectores: sectoresRes.data || [],
          });
        } catch {
          // Silenciar error de catálogos
        }
      }
    };
    fetchCatalogos();
    return () => { cancelled = true; };
  }, []);

  // Limpiar todos los filtros
  const limpiarFiltros = useCallback(() => {
    setQ("");
    setFiltroCentros([]);
    setFiltroAlmacenes([]);
    setFiltroSectores([]);
    setFiltroEstados([]);
    setFiltroCriticidades([]);
  }, []);

  // Verificar si hay filtros activos
  const hayFiltrosActivos = useMemo(() => {
    return q.trim() !== "" ||
      filtroCentros.length > 0 ||
      filtroAlmacenes.length > 0 ||
      filtroSectores.length > 0 ||
      filtroEstados.length > 0 ||
      filtroCriticidades.length > 0;
  }, [q, filtroCentros, filtroAlmacenes, filtroSectores, filtroEstados, filtroCriticidades]);

  // Auto-refresh on realtime events
  useRealtimeEvent('notification:solicitud_to_plan', () => {
    load();
  }, [load]);

  useRealtimeEvent('notification:solicitud_approved', () => {
    load();
  }, [load]);

  // Reset pagination when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQ, filtroCentros, filtroAlmacenes, filtroSectores, filtroEstados, filtroCriticidades, activeTab]);

  // Helper to classify state category
  const getEstadoCategoria = useCallback((item) => {
    const estado = (item.status || item.estado || "").toLowerCase();
    if (estado.includes("finaliz") || estado.includes("complet") || estado.includes("tratad")) {
      return "finalizadas";
    }
    if (estado.includes("progreso") || estado.includes("proceso")) {
      return "en_progreso";
    }
    return "pendientes";
  }, []);

  // Tab counts for badges
  const tabCounts = useMemo(() => {
    const counts = { pendientes: 0, en_progreso: 0, finalizadas: 0 };
    items.forEach((item) => {
      const cat = getEstadoCategoria(item);
      counts[cat]++;
    });
    return counts;
  }, [items, getEstadoCategoria]);

  // Handle treating a solicitud
  const handleTratar = useCallback(async (row) => {
    const estadoVal = (row.status || row.estado || "").toLowerCase();
    const isAprobada = estadoVal.includes("aprobad");

    if (isAprobada) {
      setSuccess("");
      setError("");
      try {
        await planner.aceptar(row.id);
        setItems(prev => prev.map(item =>
          item.id === row.id ? { ...item, status: "En Progreso", estado: "En Progreso" } : item
        ));
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
        return;
      }
    }

    setSelectedParaTratar(row);
  }, []);

  // Take over a solicitud from another planner
  const handleTomar = useCallback(async (row) => {
    setSuccess("");
    setError("");
    try {
      await planner.tomar(row.id);
      setSuccess(t("planner_msg_tomar", "Solicitud tomada correctamente"));
      setTimeout(() => setSuccess(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [load, t]);

  // Finalize a solicitud
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

  // Reject a solicitud
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

  // Filtered items
  const filtered = useMemo(() => {
    let result = [...items];

    // Filter by tab (treatment state)
    result = result.filter((s) => getEstadoCategoria(s) === activeTab);

    // General search
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

    // Filter by centro (multiselect)
    if (filtroCentros.length > 0) {
      const centrosIds = filtroCentros.map(c => c.id?.toString() || c.codigo?.toString());
      result = result.filter((s) =>
        centrosIds.includes((s.centro || "").toString())
      );
    }

    // Filter by almacen (multiselect)
    if (filtroAlmacenes.length > 0) {
      const almacenesIds = filtroAlmacenes.map(a => a.codigo?.toString() || a.id?.toString());
      result = result.filter((s) =>
        almacenesIds.includes((s.almacen || "").toString())
      );
    }

    // Filter by sector (multiselect)
    if (filtroSectores.length > 0) {
      const sectoresNombres = filtroSectores.map(s => s.nombre?.toLowerCase());
      result = result.filter((s) =>
        sectoresNombres.includes(getSectorNombre(s.sector).toLowerCase())
      );
    }

    // Filter by estado (multiselect)
    if (filtroEstados.length > 0) {
      const estadosValues = filtroEstados.map(e => e.value.toLowerCase());
      result = result.filter((s) => {
        const estado = (s.status || s.estado || "").toLowerCase();
        return estadosValues.some(ev => estado.includes(ev));
      });
    }

    // Filter by criticidad (multiselect)
    if (filtroCriticidades.length > 0) {
      const criticidadesValues = filtroCriticidades.map(c => c.value.toLowerCase());
      result = result.filter((s) =>
        criticidadesValues.includes((s.criticidad || "Normal").toLowerCase())
      );
    }

    return result;
  }, [items, activeTab, getEstadoCategoria, debouncedQ, filtroCentros, filtroAlmacenes, filtroSectores, filtroEstados, filtroCriticidades]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Export to Excel
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

  // Close treatment modal
  const closeTratarModal = useCallback(() => {
    setSelectedParaTratar(null);
  }, []);

  // On treatment complete
  const onTratarComplete = useCallback(() => {
    setSelectedParaTratar(null);
    load();
  }, [load]);

  // Open reject modal
  const openRejectModal = useCallback((solicitud) => {
    setRejectModal({ open: true, solicitud, motivo: "" });
  }, []);

  // Close reject modal
  const closeRejectModal = useCallback(() => {
    setRejectModal({ open: false, solicitud: null, motivo: "" });
  }, []);

  // Update reject motivo
  const updateRejectMotivo = useCallback((motivo) => {
    setRejectModal(prev => ({ ...prev, motivo }));
  }, []);

  // Open historial modal
  const openHistorialModal = useCallback((solicitud) => {
    setHistorialModal({ open: true, solicitud });
  }, []);

  // Close historial modal
  const closeHistorialModal = useCallback(() => {
    setHistorialModal({ open: false, solicitud: null });
  }, []);

  // Clear messages
  const clearError = useCallback(() => setError(""), []);
  const clearSuccess = useCallback(() => setSuccess(""), []);

  return {
    // State
    items,
    error,
    success,
    loading,
    q,
    filtroCentros,
    filtroAlmacenes,
    filtroSectores,
    filtroEstados,
    filtroCriticidades,
    currentPage,
    activeTab,
    selectedParaTratar,
    rejectModal,
    historialModal,

    // Catálogos y opciones
    catalogos,
    estadosOptions: ESTADOS_OPTIONS,
    criticidadOptions: CRITICIDAD_OPTIONS,

    // Derived state
    filtered,
    paginatedItems,
    totalPages,
    tabCounts,
    itemsPerPage: ITEMS_PER_PAGE,
    hayFiltrosActivos,

    // Setters
    setQ,
    setFiltroCentros,
    setFiltroAlmacenes,
    setFiltroSectores,
    setFiltroEstados,
    setFiltroCriticidades,
    setCurrentPage,
    setActiveTab,

    // Actions
    load,
    handleTratar,
    handleTomar,
    finalizar,
    rechazar,
    handleExport,
    getEstadoCategoria,
    limpiarFiltros,

    // Modal controls
    closeTratarModal,
    onTratarComplete,
    openRejectModal,
    closeRejectModal,
    updateRejectMotivo,
    openHistorialModal,
    closeHistorialModal,

    // Message controls
    clearError,
    clearSuccess,
  };
}

/**
 * Helper to render solicitante name
 */
export function renderSolicitante(row) {
  const nombre = row.solicitante_nombre || row.nombre || "";
  const apellido = row.solicitante_apellido || row.apellido || "";
  const full = `${nombre} ${apellido}`.trim();
  return full || row.id_usuario || "N/D";
}

export default usePlanner;
