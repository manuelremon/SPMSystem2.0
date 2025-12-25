import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import clsx from "clsx";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  PieChart,
  Activity,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Target,
  Gauge,
  Loader2,
  AlertCircle,
  RefreshCw,
  Calendar,
} from "../components/ui/Icons";

// KPI Card component - Glass Morphism style
function KPICard({ titulo, valor, unidad, tendencia, objetivo, descripcion, icon: Icon, t }) {
  const tendenciaConfig = {
    up: {
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50/70 backdrop-blur-sm border border-emerald-200/50",
      label: t("mrp_tendencia_up", "Subiendo"),
    },
    down: {
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50/70 backdrop-blur-sm border border-red-200/50",
      label: t("mrp_tendencia_down", "Bajando"),
    },
    stable: {
      icon: Minus,
      color: "text-amber-600",
      bg: "bg-amber-50/70 backdrop-blur-sm border border-amber-200/50",
      label: t("mrp_tendencia_stable", "Estable"),
    },
  };

  const config = tendenciaConfig[tendencia] || tendenciaConfig.stable;
  const TendenciaIcon = config.icon;

  return (
    <Card className="hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx("p-2.5 rounded-xl", config.bg)}>
            <Icon className={clsx("w-5 h-5", config.color)} />
          </div>
          <div className={clsx("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.bg, config.color)}>
            <TendenciaIcon className="w-4 h-4" />
            <span>{config.label}</span>
          </div>
        </div>

        <div className="mb-2">
          <span className="text-3xl font-bold text-slate-800">{valor}</span>
          <span className="text-lg text-slate-500 ml-1">{unidad}</span>
        </div>

        <h3 className="text-sm font-semibold text-slate-700 mb-1">{titulo}</h3>
        <p className="text-xs text-slate-500">{descripcion}</p>

        {objetivo && (
          <div className="mt-3 pt-3 border-t border-white/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{t("mrp_objetivo", "Objetivo:")}</span>
              <span className={clsx(
                "font-medium",
                valor <= objetivo ? "text-emerald-600" : "text-red-600"
              )}>
                {objetivo} {unidad}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Donut Chart component - with memoization and null safety
function DonutChart({ data = [], size = 200, t }) {
  // FASE 5: Memoización del total
  const total = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, item) => sum + (item.valor || 0), 0);
  }, [data]);

  let currentAngle = 0;

  const createArc = (startAngle, endAngle, color) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    const radius = 80;
    const cx = 100;
    const cy = 100;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  // FASE 6: Null safety - retornar placeholder si no hay datos
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-center py-8">Sin datos disponibles</div>;
  }

  return (
    <div className="flex items-center gap-6">
      {/* FASE 7: aria-label para accesibilidad */}
      <svg
        viewBox="0 0 200 200"
        className="w-48 h-48"
        role="img"
        aria-label={t("mrp_grafico_distribucion", "Gráfico de distribución de estados")}
      >
        {data.map((item, idx) => {
          const angle = total > 0 ? (item.valor / total) * 360 : 0;
          const path = createArc(currentAngle, currentAngle + angle, item.color);
          currentAngle += angle;
          return (
            <path
              key={idx}
              d={path}
              fill={item.color}
              className="transition-all duration-300 hover:opacity-80"
            />
          );
        })}
        <circle cx="100" cy="100" r="50" fill="white" fillOpacity="0.8" />
        <text x="100" y="95" textAnchor="middle" className="text-sm fill-slate-500">
          {t("mrp_total", "Total")}
        </text>
        <text x="100" y="115" textAnchor="middle" className="text-2xl font-bold fill-slate-800">
          {total.toFixed(0)}%
        </text>
      </svg>

      <div className="flex flex-col gap-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-slate-700">{item.nombre}</span>
            <span className="text-sm font-medium text-slate-500">{(item.valor || 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bar Chart component - Glass Morphism style with memoization
function BarChart({ data = [], height = 200 }) {
  // FASE 5: Memoización del valor máximo
  // FASE 6: Null safety para array vacío
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => Math.max(d.alertas || 0, d.resueltas || 0)), 1);
  }, [data]);

  // FASE 6: Null safety - retornar placeholder si no hay datos
  if (!data || data.length === 0) {
    return <div className="text-slate-500 text-center py-8">Sin datos disponibles</div>;
  }

  return (
    <div className="flex items-end gap-4 justify-between" style={{ height }}>
      {data.map((item, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
          <div className="flex gap-1 items-end h-full">
            <div
              className="w-4 bg-gradient-to-t from-red-500 to-red-400 rounded-t transition-all duration-500 shadow-sm"
              style={{ height: `${((item.alertas || 0) / maxValue) * 100}%` }}
              title={`Alertas: ${item.alertas || 0}`}
            />
            <div
              className="w-4 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t transition-all duration-500 shadow-sm"
              style={{ height: `${((item.resueltas || 0) / maxValue) * 100}%` }}
              title={`Resueltas: ${item.resueltas || 0}`}
            />
          </div>
          <span className="text-xs text-slate-500 rotate-0 whitespace-nowrap">
            {new Date(item.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}

// Gauge component - Glass Morphism style with accessibility
function GaugeChart({ value, max = 100, label, t }) {
  const percentage = Math.min((value / max) * 100, 100);
  const angle = (percentage / 100) * 180 - 90;

  const getColor = () => {
    if (percentage >= 80) return "#22c55e";
    if (percentage >= 50) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className="flex flex-col items-center">
      {/* FASE 7: aria-label para accesibilidad */}
      <svg
        viewBox="0 0 200 120"
        className="w-40 h-24"
        role="img"
        aria-label={t("mrp_grafico_cumplimiento", "Gráfico de nivel de cumplimiento")}
      >
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={getColor()}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 2.51} 251`}
          className="transition-all duration-1000"
        />
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2={100 + 60 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 60 * Math.sin((angle * Math.PI) / 180)}
          stroke="#334155"
          strokeWidth="3"
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <circle cx="100" cy="100" r="6" fill="#334155" />
      </svg>
      <div className="text-center mt-2">
        <span className="text-2xl font-bold" style={{ color: getColor() }}>{value}%</span>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function MRPKPIs() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpisData, setKpisData] = useState(null);
  const [periodo, setPeriodo] = useState("mes");

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`/mrp/kpis?periodo=${periodo}`);
      if (res.data?.ok) {
        setKpisData(res.data);
      } else {
        setError(res.data?.error?.message || "Error al cargar KPIs");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  const kpiIcons = {
    materiales_en_riesgo: AlertTriangle,
    materiales_sobrestock: Package,
    rotacion_promedio: Activity,
    lead_time_promedio: Clock,
    cumplimiento_mrp: Target,
    pedidos_vencidos: AlertCircle,
    pct_pedidos_vencidos: AlertCircle,
    velocidad_respuesta: Gauge,
  };

  // FASE 4: i18n para periodos
  const periodos = [
    { value: "mes", label: t("mrp_periodo_mes", "Último Mes") },
    { value: "trimestre", label: t("mrp_periodo_trimestre", "Último Trimestre") },
    { value: "anio", label: t("mrp_periodo_anio", "Último Año") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("mrp_kpis_titulo", "KPI's MRP")}
      />

      {/* Período selector - Glass Morphism */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-slate-500">{t("mrp_periodo", "Período:")}</span>
          <div className="flex gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30" role="tablist">
            {periodos.map(p => (
              <button
                key={p.value}
                role="tab"
                aria-selected={periodo === p.value}
                onClick={() => setPeriodo(p.value)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  periodo === p.value
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                    : "text-slate-600 hover:bg-white/70"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={fetchKPIs}
          className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/50 rounded-xl text-slate-700 hover:bg-white/80 hover:border-blue-400/50 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          {t("mrp_actualizar", "Actualizar")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24 text-red-600 bg-red-50/70 backdrop-blur-sm rounded-2xl border border-red-200/50">
          <AlertCircle className="w-6 h-6 mr-2" />
          {error}
        </div>
      ) : kpisData ? (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Object.entries(kpisData.kpis || {}).map(([key, kpi]) => (
              <KPICard
                key={key}
                titulo={key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                valor={kpi.valor}
                unidad={kpi.unidad}
                tendencia={kpi.tendencia}
                objetivo={kpi.objetivo}
                descripcion={kpi.descripcion}
                icon={kpiIcons[key] || BarChart3}
                t={t}
              />
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-600" />
                  {t("mrp_distribucion_estados", "Distribución de Estados")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-6">
                {kpisData.graficos?.distribucion_estados && (
                  <DonutChart data={kpisData.graficos.distribucion_estados} t={t} />
                )}
              </CardContent>
            </Card>

            {/* Cumplimiento Gauge */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  {t("mrp_cumplimiento", "Cumplimiento MRP")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-6">
                <GaugeChart
                  value={kpisData.kpis?.cumplimiento_mrp?.valor || 0}
                  label={t("mrp_nivel_cumplimiento", "Nivel de Cumplimiento")}
                  t={t}
                />
              </CardContent>
            </Card>
          </div>

          {/* Evolution Chart */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                {t("mrp_evolucion_alertas", "Evolución de Alertas")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-br from-red-500 to-red-400 rounded shadow-sm" />
                  <span className="text-sm text-slate-500">{t("mrp_alertas_generadas", "Alertas Generadas")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-br from-emerald-500 to-emerald-400 rounded shadow-sm" />
                  <span className="text-sm text-slate-500">{t("mrp_alertas_resueltas", "Alertas Resueltas")}</span>
                </div>
              </div>
              {kpisData.graficos?.evolucion_alertas && (
                <BarChart data={kpisData.graficos.evolucion_alertas} height={180} />
              )}
            </CardContent>
          </Card>

          {/* Top Materials at Risk */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {t("mrp_top_riesgo", "Top Materiales en Riesgo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* FASE 6: Null safety con || [] */}
                {(kpisData.graficos?.top_materiales_riesgo || []).map((mat, idx) => (
                  <div
                    key={mat.codigo}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl",
                      "bg-white/50 backdrop-blur-sm border border-white/50",
                      "hover:bg-white/70 hover:border-blue-400/30 transition-all"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm backdrop-blur-sm",
                        idx === 0 ? "bg-red-50/70 text-red-600 border border-red-200/50" :
                        idx === 1 ? "bg-amber-50/70 text-amber-600 border border-amber-200/50" :
                        "bg-blue-50/70 text-blue-600 border border-blue-200/50"
                      )}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-mono text-blue-600 font-medium">{mat.codigo}</p>
                        <p className="text-sm text-slate-500">{mat.descripcion}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{mat.dias_sin_stock} {t("mrp_dias", "días")}</p>
                      <p className="text-xs text-slate-500">{t("mrp_sin_stock", "sin stock")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info footer - Glass style */}
          <div className="mt-6 p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-white/50">
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>
                <strong className="text-slate-700">{t("mrp_periodo", "Período:")}</strong> {kpisData.fecha_inicio} a {kpisData.fecha_fin}
              </span>
              <span>
                <strong className="text-slate-700">{t("mrp_total_materiales", "Total materiales:")}</strong> {kpisData.total_materiales}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
