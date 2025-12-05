import { useState, useEffect } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import api from "../services/api";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Package,
  Layers,
  BarChart3,
  Loader2,
} from "lucide-react";

// Componente de mini gráfico de barras
function MiniBarChart({ data, maxValue }) {
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, idx) => {
        const height = (value / maxValue) * 100;
        return (
          <div
            key={idx}
            className="flex-1 bg-[var(--primary)] rounded-t-sm transition-all duration-300 hover:bg-[var(--primary-bright)]"
            style={{ height: `${height}%` }}
            title={value}
          />
        );
      })}
    </div>
  );
}

// Componente de círculo de progreso
function ProgressCircle({ percentage, color = "var(--primary)" }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="var(--border)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-[var(--fg)]">{percentage}%</span>
      </div>
    </div>
  );
}

// Componente de mini línea de tendencia
function TrendLine({ data }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-12 w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={`0,100 ${points} 100,100`}
          fill="var(--primary)"
          fillOpacity="0.1"
        />
      </svg>
    </div>
  );
}

export default function KPI() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0,0,0,0,0,0,0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0, trend: [0,0,0,0,0,0,0] },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
    solicitudesPorEstado: { labels: [], aprobadas: [], rechazadas: [], pendientes: [] },
  });

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setLoading(true);
        const response = await api.get("/kpis");
        if (response.data?.ok && response.data?.data) {
          setKpiData(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching KPIs:", err);
        setError("Error al cargar los KPIs");
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <ScrollReveal>
        <PageHeader
          title="KPI's"
          breadcrumbs={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "KPI's" }
          ]}
        />
      </ScrollReveal>

      {/* Métricas principales */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Solicitudes */}
        <Card className="border-l-4 border-l-[var(--primary)]">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-1">
                  Total Solicitudes
                </p>
                <p className="text-3xl font-bold text-[var(--fg)]">{kpiData.solicitudes.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[var(--primary-muted)]/20 grid place-items-center">
                <FileText className="w-6 h-6 text-[var(--primary)]" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-green-500">
                <TrendingUp className="w-4 h-4" />
                <span className="font-semibold">+{kpiData.solicitudes.trendPercentage}%</span>
              </div>
              <span className="text-[var(--fg-muted)]">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Tasa de Aprobación */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-1">
                  Tasa de Aprobación
                </p>
                <p className="text-3xl font-bold text-[var(--fg)]">
                  {Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100)}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 grid place-items-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <div className="text-sm text-[var(--fg-muted)]">
              {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
            </div>
          </CardContent>
        </Card>

        {/* Tiempo Promedio */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-1">
                  Tiempo Promedio
                </p>
                <p className="text-3xl font-bold text-[var(--fg)]">{kpiData.tiempoAprobacion.promedio} días</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 grid place-items-center">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-green-500">
                <TrendingDown className="w-4 h-4" />
                <span className="font-semibold">Mejorando</span>
              </div>
              <span className="text-[var(--fg-muted)]">Meta: {kpiData.tiempoAprobacion.meta} días</span>
            </div>
          </CardContent>
        </Card>

        {/* Presupuesto Utilizado */}
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-1">
                  Presupuesto
                </p>
                <p className="text-2xl font-bold text-[var(--fg)]">
                  {formatCurrency(kpiData.presupuesto.utilizado)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-500/20 grid place-items-center">
                <DollarSign className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
            <div className="text-sm text-[var(--fg-muted)]">
              {kpiData.presupuesto.percentage}% de {formatCurrency(kpiData.presupuesto.total)}
            </div>
          </CardContent>
        </Card>
        </div>
      </ScrollReveal>

      {/* Gráficos detallados */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia de Solicitudes */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Tendencia de Solicitudes</CardTitle>
              <BarChart3 className="w-5 h-5 text-[var(--primary)]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="mb-4">
              <TrendLine data={kpiData.solicitudes.trend} />
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-[var(--fg-muted)] text-center">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
              <span className="text-[var(--fg-muted)]">Promedio semanal</span>
              <span className="font-semibold text-[var(--fg)]">
                {Math.round(kpiData.solicitudes.trend.reduce((a, b) => a + b, 0) / kpiData.solicitudes.trend.length)} solicitudes
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Presupuesto por Centro */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Presupuesto por Centro</CardTitle>
              <DollarSign className="w-5 h-5 text-[var(--primary)]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-4">
              {kpiData.presupuesto.porCentro.map((centro, idx) => {
                const maxValor = Math.max(...kpiData.presupuesto.porCentro.map(c => c.valor));
                const percentage = (centro.valor / maxValor) * 100;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-[var(--fg-muted)] font-medium">{centro.nombre}</span>
                      <span className="text-[var(--fg)] font-semibold">{formatCurrency(centro.valor)}</span>
                    </div>
                    <div className="h-2 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Materiales Más Solicitados */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Materiales Más Solicitados</CardTitle>
              <Package className="w-5 h-5 text-[var(--primary)]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-3">
              {(kpiData.materialesMasSolicitados || []).length > 0 ? (
                kpiData.materialesMasSolicitados.map((material, idx) => {
                  const maxCantidad = Math.max(...kpiData.materialesMasSolicitados.map(m => m.cantidad), 1);
                  const percentage = (material.cantidad / maxCantidad) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--primary-muted)]/20 grid place-items-center text-sm font-bold text-[var(--primary)]">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5 text-sm">
                          <span className="text-[var(--fg)] font-medium">{material.nombre}</span>
                          <span className="text-[var(--fg-muted)]">{(material.cantidad || 0).toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-bright)] rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--fg-muted)] text-center py-4">
                  No hay datos de materiales disponibles
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estado de Solicitudes */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Distribución de Estados</CardTitle>
              <BarChart3 className="w-5 h-5 text-[var(--primary)]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-6">
              {/* Aprobadas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-[var(--fg)]">Aprobadas</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--fg)]">{kpiData.solicitudes.aprobadas}</span>
                </div>
                <MiniBarChart
                  data={kpiData.solicitudesPorEstado.aprobadas || []}
                  maxValue={Math.max(...(kpiData.solicitudesPorEstado.aprobadas || [1]), 1)}
                />
              </div>

              {/* Rechazadas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-[var(--fg)]">Rechazadas</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--fg)]">{kpiData.solicitudes.rechazadas}</span>
                </div>
                <MiniBarChart
                  data={kpiData.solicitudesPorEstado.rechazadas || []}
                  maxValue={Math.max(...(kpiData.solicitudesPorEstado.aprobadas || [1]), 1)}
                />
              </div>

              {/* Pendientes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-[var(--fg)]">Pendientes</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--fg)]">{kpiData.solicitudes.pendientes}</span>
                </div>
                <MiniBarChart
                  data={kpiData.solicitudesPorEstado.pendientes || []}
                  maxValue={Math.max(...(kpiData.solicitudesPorEstado.aprobadas || [1]), 1)}
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-6 gap-1 text-xs text-[var(--fg-muted)] text-center">
              {(kpiData.solicitudesPorEstado.labels || []).map((label, idx) => (
                <div key={idx}>{label}</div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Grupos de Artículos Más Solicitados */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Grupos de Artículos Más Solicitados</CardTitle>
              <Layers className="w-5 h-5 text-[var(--accent)]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-3">
              {(kpiData.gruposArticulosMasSolicitados || []).length > 0 ? (
                kpiData.gruposArticulosMasSolicitados.map((grupo, idx) => {
                  const maxCantidad = Math.max(...kpiData.gruposArticulosMasSolicitados.map(g => g.cantidad));
                  const percentage = (grupo.cantidad / maxCantidad) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent)]/20 grid place-items-center text-sm font-bold text-[var(--accent)]">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5 text-sm">
                          <span className="text-[var(--fg)] font-medium">{grupo.nombre}</span>
                          <span className="text-[var(--fg-muted)]">{grupo.cantidad.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--accent)] to-cyan-400 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--fg-muted)] text-center py-4">
                  No hay datos de grupos disponibles
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </ScrollReveal>

      {/* Card de Progreso de Presupuesto */}
      <ScrollReveal delay={300}>
        <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle>Resumen de Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-shrink-0">
              <ProgressCircle percentage={kpiData.presupuesto.percentage} />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="text-center md:text-left">
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2">
                  Presupuesto Total
                </p>
                <p className="text-2xl font-bold text-[var(--fg)]">
                  {formatCurrency(kpiData.presupuesto.total)}
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2">
                  Utilizado
                </p>
                <p className="text-2xl font-bold text-yellow-500">
                  {formatCurrency(kpiData.presupuesto.utilizado)}
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2">
                  Disponible
                </p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(kpiData.presupuesto.disponible)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  );
}
