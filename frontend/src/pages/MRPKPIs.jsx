import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
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
} from "lucide-react";

// KPI Card component
function KPICard({ titulo, valor, unidad, tendencia, objetivo, descripcion, icon: Icon }) {
  const tendenciaConfig = {
    up: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
    down: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" },
    stable: { icon: Minus, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  };

  const config = tendenciaConfig[tendencia] || tendenciaConfig.stable;
  const TendenciaIcon = config.icon;

  const isPositiveTrend = (tendencia === "up" && !descripcion?.includes("vencidos") && !descripcion?.includes("tiempo")) ||
                          (tendencia === "down" && (descripcion?.includes("vencidos") || descripcion?.includes("tiempo")));

  return (
    <Card className="hover:border-[var(--primary)]/50 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx("p-2.5 rounded-xl", config.bg)}>
            <Icon className={clsx("w-5 h-5", config.color)} />
          </div>
          <div className={clsx("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.bg, config.color)}>
            <TendenciaIcon className="w-3.5 h-3.5" />
            <span>{tendencia === "up" ? "Subiendo" : tendencia === "down" ? "Bajando" : "Estable"}</span>
          </div>
        </div>

        <div className="mb-2">
          <span className="text-3xl font-bold text-[var(--fg)]">{valor}</span>
          <span className="text-lg text-[var(--fg-muted)] ml-1">{unidad}</span>
        </div>

        <h3 className="text-sm font-semibold text-[var(--fg)] mb-1">{titulo}</h3>
        <p className="text-xs text-[var(--fg-muted)]">{descripcion}</p>

        {objetivo && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--fg-muted)]">Objetivo:</span>
              <span className={clsx(
                "font-medium",
                valor <= objetivo ? "text-green-400" : "text-red-400"
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

// Donut Chart component
function DonutChart({ data, size = 200 }) {
  const total = data.reduce((sum, item) => sum + item.valor, 0);
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

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-48 h-48">
        {data.map((item, idx) => {
          const angle = (item.valor / total) * 360;
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
        <circle cx="100" cy="100" r="50" fill="var(--bg)" />
        <text x="100" y="95" textAnchor="middle" className="text-sm fill-[var(--fg-muted)]">
          Total
        </text>
        <text x="100" y="115" textAnchor="middle" className="text-2xl font-bold fill-[var(--fg)]">
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
            <span className="text-sm text-[var(--fg)]">{item.nombre}</span>
            <span className="text-sm font-medium text-[var(--fg-muted)]">{item.valor.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bar Chart component
function BarChart({ data, height = 200 }) {
  const maxValue = Math.max(...data.map(d => Math.max(d.alertas, d.resueltas)));

  return (
    <div className="flex items-end gap-4 justify-between" style={{ height }}>
      {data.map((item, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
          <div className="flex gap-1 items-end h-full">
            <div
              className="w-4 bg-red-400/80 rounded-t transition-all duration-500"
              style={{ height: `${(item.alertas / maxValue) * 100}%` }}
              title={`Alertas: ${item.alertas}`}
            />
            <div
              className="w-4 bg-green-400/80 rounded-t transition-all duration-500"
              style={{ height: `${(item.resueltas / maxValue) * 100}%` }}
              title={`Resueltas: ${item.resueltas}`}
            />
          </div>
          <span className="text-xs text-[var(--fg-muted)] rotate-0 whitespace-nowrap">
            {new Date(item.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}

// Gauge component
function GaugeChart({ value, max = 100, label }) {
  const percentage = Math.min((value / max) * 100, 100);
  const angle = (percentage / 100) * 180 - 90;

  const getColor = () => {
    if (percentage >= 80) return "#22c55e";
    if (percentage >= 50) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-40 h-24">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--border)"
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
          stroke="var(--fg)"
          strokeWidth="3"
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <circle cx="100" cy="100" r="6" fill="var(--fg)" />
      </svg>
      <div className="text-center mt-2">
        <span className="text-2xl font-bold" style={{ color: getColor() }}>{value}%</span>
        <p className="text-sm text-[var(--fg-muted)]">{label}</p>
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

  const periodos = [
    { value: "mes", label: "Último Mes" },
    { value: "trimestre", label: "Último Trimestre" },
    { value: "anio", label: "Último Año" },
  ];

  return (
    <Layout>
      <PageHeader
        title={t("mrp_kpis_titulo", "KPI's MRP")}
        subtitle={t("mrp_kpis_subtitulo", "Métricas inteligentes sobre el comportamiento del MRP")}
      />

      {/* Período selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--primary)]" />
          <span className="text-sm text-[var(--fg-muted)]">Período:</span>
          <div className="flex gap-1">
            {periodos.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  periodo === p.value
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={fetchKPIs}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t("mrp_actualizar", "Actualizar")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24 text-red-400">
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
              />
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-[var(--primary)]" />
                  {t("mrp_distribucion_estados", "Distribución de Estados")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-6">
                {kpisData.graficos?.distribucion_estados && (
                  <DonutChart data={kpisData.graficos.distribucion_estados} />
                )}
              </CardContent>
            </Card>

            {/* Cumplimiento Gauge */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[var(--primary)]" />
                  {t("mrp_cumplimiento", "Cumplimiento MRP")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-6">
                <GaugeChart
                  value={kpisData.kpis?.cumplimiento_mrp?.valor || 0}
                  label="Nivel de Cumplimiento"
                />
              </CardContent>
            </Card>
          </div>

          {/* Evolution Chart */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--primary)]" />
                {t("mrp_evolucion_alertas", "Evolución de Alertas")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded" />
                  <span className="text-sm text-[var(--fg-muted)]">Alertas Generadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded" />
                  <span className="text-sm text-[var(--fg-muted)]">Alertas Resueltas</span>
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
                <AlertTriangle className="w-5 h-5 text-[var(--primary)]" />
                {t("mrp_top_riesgo", "Top Materiales en Riesgo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {kpisData.graficos?.top_materiales_riesgo?.map((mat, idx) => (
                  <div
                    key={mat.codigo}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-lg",
                      "bg-[var(--surface)] border border-[var(--border)]",
                      "hover:border-[var(--primary)]/30 transition-all"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        idx === 0 ? "bg-red-500/20 text-red-400" :
                        idx === 1 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-orange-500/20 text-orange-400"
                      )}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-mono text-[var(--primary)]">{mat.codigo}</p>
                        <p className="text-sm text-[var(--fg-muted)]">{mat.descripcion}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-400">{mat.dias_sin_stock} días</p>
                      <p className="text-xs text-[var(--fg-muted)]">sin stock</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info footer */}
          <div className="mt-6 p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-4 text-sm text-[var(--fg-muted)]">
              <span>
                <strong className="text-[var(--fg)]">Período:</strong> {kpisData.fecha_inicio} a {kpisData.fecha_fin}
              </span>
              <span>
                <strong className="text-[var(--fg)]">Total materiales:</strong> {kpisData.total_materiales}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </Layout>
  );
}
