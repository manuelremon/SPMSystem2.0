import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import api from "../services/api";
import clsx from "clsx";
import {
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";

// Estado badge component
function EstadoBadge({ estado, clase }) {
  const config = {
    danger: { bg: "bg-red-500/20", text: "text-red-400", icon: XCircle },
    warning: { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: AlertTriangle },
    success: { bg: "bg-green-500/20", text: "text-green-400", icon: CheckCircle2 },
    info: { bg: "bg-blue-500/20", text: "text-blue-400", icon: Info },
  };

  const { bg, text, icon: Icon } = config[clase] || config.info;

  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", bg, text)}>
      <Icon className="w-3.5 h-3.5" />
      {estado}
    </span>
  );
}

// Resumen card
function ResumenCard({ titulo, valor, icon: Icon, color }) {
  const colorClasses = {
    danger: "text-red-400 bg-red-500/10 border-red-500/30",
    warning: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    success: "text-green-400 bg-green-500/10 border-green-500/30",
    info: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    primary: "text-[var(--primary)] bg-[var(--primary)]/10 border-[var(--primary)]/30",
  };

  return (
    <div className={clsx("rounded-xl border p-4", colorClasses[color] || colorClasses.primary)}>
      <div className="flex items-center gap-3">
        <div className={clsx("p-2 rounded-lg", colorClasses[color] || colorClasses.primary)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{valor}</p>
          <p className="text-sm text-[var(--fg-muted)]">{titulo}</p>
        </div>
      </div>
    </div>
  );
}

export default function MRPTableroAlertas() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [resumen, setResumen] = useState({});
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, has_more: false });

  // Filtros
  const [filtros, setFiltros] = useState({
    centro: "",
    almacen: "",
    sector: "",
    estado: "",
  });
  const [catalogos, setCatalogos] = useState({ centros: [], almacenes: [], sectores: [] });
  const [showFiltros, setShowFiltros] = useState(true);

  // Ordenamiento
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState("");

  // Cargar catálogos
  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const res = await api.get("/mrp/catalogos");
        if (res.data?.ok) {
          setCatalogos(res.data);
          // Set default centro if available
          if (res.data.centros?.length > 0) {
            setFiltros(prev => ({ ...prev, centro: res.data.centros[0].codigo }));
          }
        }
      } catch (err) {
        console.error("Error loading catalogos:", err);
      }
    };
    fetchCatalogos();
  }, []);

  // Cargar alertas
  const fetchAlertas = useCallback(async () => {
    if (!filtros.centro) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filtros.centro) params.append("centro", filtros.centro);
      if (filtros.almacen) params.append("almacen", filtros.almacen);
      if (filtros.sector) params.append("sector", filtros.sector);
      if (filtros.estado) params.append("estado", filtros.estado);
      params.append("limit", pagination.limit);
      params.append("offset", pagination.offset);

      const res = await api.get(`/mrp/alertas?${params.toString()}`);
      if (res.data?.ok) {
        setAlertas(res.data.data || []);
        setResumen(res.data.resumen || {});
        setPagination(prev => ({ ...prev, ...res.data.pagination }));
      } else {
        setError(res.data?.error?.message || "Error al cargar alertas");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  // Ordenar datos
  const sortedAlertas = [...alertas].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Filtrar por búsqueda
  const filteredAlertas = sortedAlertas.filter(alerta =>
    searchTerm === "" ||
    alerta.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alerta.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const estados = [
    { value: "", label: "Todos" },
    { value: "quiebre", label: "Quiebre de Stock" },
    { value: "bajo punto", label: "Bajo Punto de Pedido" },
    { value: "bajo stock", label: "Bajo Stock de Seguridad" },
    { value: "exceso", label: "Exceso/Sobrestock" },
    { value: "normal", label: "Normal" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("mrp_alertas_titulo", "Tablero de Alertas MRP")}
        subtitle={t("mrp_alertas_subtitulo", "Estado general de materiales planificados")}
      />

      {/* Resumen Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <ResumenCard
          titulo={t("mrp_total", "Total Materiales")}
          valor={resumen.total || 0}
          icon={Package}
          color="primary"
        />
        <ResumenCard
          titulo={t("mrp_quiebre", "Quiebre de Stock")}
          valor={resumen.quiebre_stock || 0}
          icon={XCircle}
          color="danger"
        />
        <ResumenCard
          titulo={t("mrp_bajo_pp", "Bajo Punto Pedido")}
          valor={resumen.bajo_punto_pedido || 0}
          icon={AlertTriangle}
          color="warning"
        />
        <ResumenCard
          titulo={t("mrp_bajo_ss", "Bajo Stock Seg.")}
          valor={resumen.bajo_stock_seguridad || 0}
          icon={AlertCircle}
          color="warning"
        />
        <ResumenCard
          titulo={t("mrp_sobrestock", "Sobrestock")}
          valor={resumen.sobrestock || 0}
          icon={Info}
          color="info"
        />
        <ResumenCard
          titulo={t("mrp_normal", "Normal")}
          valor={resumen.normal || 0}
          icon={CheckCircle2}
          color="success"
        />
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader className="cursor-pointer" onClick={() => setShowFiltros(!showFiltros)}>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[var(--primary)]" />
              {t("mrp_filtros", "Filtros")}
            </span>
            {showFiltros ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </CardTitle>
        </CardHeader>
        {showFiltros && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Centro */}
              <div>
                <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                  {t("mrp_centro", "Centro")} *
                </label>
                <select
                  value={filtros.centro}
                  onChange={(e) => setFiltros(prev => ({ ...prev, centro: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  {catalogos.centros?.map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Almacén */}
              <div>
                <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                  {t("mrp_almacen", "Almacén")}
                </label>
                <select
                  value={filtros.almacen}
                  onChange={(e) => setFiltros(prev => ({ ...prev, almacen: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {catalogos.almacenes?.map(a => (
                    <option key={a.codigo} value={a.codigo}>{a.codigo} - {a.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Sector */}
              <div>
                <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                  {t("mrp_sector", "Sector")}
                </label>
                <select
                  value={filtros.sector}
                  onChange={(e) => setFiltros(prev => ({ ...prev, sector: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {catalogos.sectores?.map(s => (
                    <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                  {t("mrp_estado", "Estado")}
                </label>
                <select
                  value={filtros.estado}
                  onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  {estados.map(e => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>

              {/* Búsqueda */}
              <div>
                <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">
                  {t("mrp_buscar", "Buscar")}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Código o descripción..."
                    className="w-full pl-10 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={fetchAlertas}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--on-primary)] rounded-lg hover:bg-[var(--primary-bright)] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t("mrp_actualizar", "Actualizar")}
              </button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabla de Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[var(--primary)]" />
            {t("mrp_lista_alertas", "Lista de Alertas")}
            <span className="ml-2 text-sm font-normal text-[var(--fg-muted)]">
              ({filteredAlertas.length} materiales)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-400">
              <AlertCircle className="w-6 h-6 mr-2" />
              {error}
            </div>
          ) : filteredAlertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--fg-muted)]">
              <Package className="w-12 h-12 mb-4 opacity-50" />
              <p>{t("mrp_sin_alertas", "No hay alertas para mostrar")}</p>
              <p className="text-sm">{t("mrp_seleccionar_centro", "Seleccione un centro para ver alertas")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:bg-[var(--surface)] transition-colors"
                      onClick={() => handleSort("codigo")}
                    >
                      <span className="flex items-center gap-1">
                        {t("mrp_col_codigo", "Código SAP")}
                        <SortIcon columnKey="codigo" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">{t("mrp_col_descripcion", "Descripción")}</th>
                    <th className="px-4 py-3 text-center">{t("mrp_col_demanda", "Demanda Anual")}</th>
                    <th className="px-4 py-3 text-center">{t("mrp_col_ss", "Stock Seg.")}</th>
                    <th className="px-4 py-3 text-center">{t("mrp_col_pp", "Pto. Pedido")}</th>
                    <th className="px-4 py-3 text-center">{t("mrp_col_smax", "Stock Máx.")}</th>
                    <th
                      className="px-4 py-3 text-center cursor-pointer hover:bg-[var(--surface)] transition-colors"
                      onClick={() => handleSort("stock_actual")}
                    >
                      <span className="flex items-center justify-center gap-1">
                        {t("mrp_col_stock", "Stock Actual")}
                        <SortIcon columnKey="stock_actual" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">{t("mrp_col_pedidos", "Pedidos Curso")}</th>
                    <th
                      className="px-4 py-3 text-center cursor-pointer hover:bg-[var(--surface)] transition-colors"
                      onClick={() => handleSort("rotacion_pct")}
                    >
                      <span className="flex items-center justify-center gap-1">
                        {t("mrp_col_rotacion", "Rotación %")}
                        <SortIcon columnKey="rotacion_pct" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">{t("mrp_col_estado", "Estado")}</th>
                    <th className="px-4 py-3 text-left">{t("mrp_col_sugerencia", "Sugerencia")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlertas.map((alerta, idx) => (
                    <tr
                      key={alerta.codigo}
                      className={clsx(
                        "border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors",
                        idx % 2 === 0 ? "bg-[var(--bg)]" : "bg-[var(--surface)]"
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-[var(--primary)]">{alerta.codigo}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={alerta.descripcion}>
                        {alerta.descripcion}
                      </td>
                      <td className="px-4 py-3 text-center">{alerta.demanda_estimada_anual?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">{alerta.stock_seguridad}</td>
                      <td className="px-4 py-3 text-center">{alerta.punto_pedido}</td>
                      <td className="px-4 py-3 text-center">{alerta.stock_maximo}</td>
                      <td className={clsx(
                        "px-4 py-3 text-center font-medium",
                        alerta.stock_actual <= 0 ? "text-red-400" :
                        alerta.stock_actual < alerta.punto_pedido ? "text-yellow-400" : "text-green-400"
                      )}>
                        {alerta.stock_actual}
                      </td>
                      <td className="px-4 py-3 text-center">{alerta.pedidos_en_curso}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx(
                          "font-medium",
                          alerta.rotacion_pct > 300 ? "text-green-400" :
                          alerta.rotacion_pct > 100 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {alerta.rotacion_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <EstadoBadge estado={alerta.estado} clase={alerta.estado_clase} />
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--fg-muted)] max-w-xs truncate" title={alerta.sugerencia}>
                        {alerta.sugerencia || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--fg-muted)]">
                Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                  className="px-3 py-1 rounded-lg border border-[var(--border)] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface)]"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={!pagination.has_more}
                  className="px-3 py-1 rounded-lg border border-[var(--border)] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface)]"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
