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
function MiniBarChart({ data, maxValue, color = "blue" }) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500",
    emerald: "from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500",
    red: "from-red-500 to-red-400 hover:from-red-600 hover:to-red-500",
    amber: "from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500",
  };

  // Asegurar que siempre hay datos válidos
  const safeData = data && data.length > 0 ? data : [0];
  const safeMaxValue = maxValue > 0 ? maxValue : 1;

  return (
    <div className="flex items-end gap-1 h-10 overflow-hidden">
      {safeData.map((value, idx) => {
        const height = Math.min((value / safeMaxValue) * 100, 100); // Limitar a 100%
        return (
          <div
            key={idx}
            className={`flex-1 min-w-[4px] bg-gradient-to-t ${colorClasses[color] || colorClasses.blue} rounded-t-sm transition-all duration-300`}
            style={{ height: `${Math.max(height, 2)}%` }} // Mínimo 2% para visibilidad
            title={String(value)}
          />
        );
      })}
    </div>
  );
}

// Componente de círculo de progreso
function ProgressCircle({ percentage, color = "#3b82f6" }) {
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
          stroke="#e2e8f0"
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
        <span className="text-xl font-bold text-slate-800">{percentage}%</span>
      </div>
    </div>
  );
}

// Componente Donut Chart para distribución de estados
function DonutChart({ data, colors, labels }) {
  const total = data.reduce((sum, val) => sum + val, 0) || 1;
  const radius = 70;
  const strokeWidth = 24;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let currentOffset = 0;

  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          {/* Fondo del círculo */}
          <circle
            cx="80"
            cy="80"
            r={innerRadius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Segmentos */}
          {data.map((value, idx) => {
            const percentage = value / total;
            const dashLength = percentage * circumference;
            const dashOffset = currentOffset;
            currentOffset += dashLength;

            if (value === 0) return null;

            return (
              <circle
                key={idx}
                cx="80"
                cy="80"
                r={innerRadius}
                fill="none"
                stroke={colors[idx]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-dashOffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {/* Centro del donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-800">{total}</span>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Total</span>
        </div>
      </div>

      {/* Leyenda */}
      <div className="ml-6 space-y-3">
        {labels.map((label, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: colors[idx] }}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">{label}</span>
              <span className="text-sm font-semibold text-slate-800">{data[idx]}</span>
              <span className="text-xs text-slate-400">
                ({total > 0 ? Math.round((data[idx] / total) * 100) : 0}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de línea de tendencia mejorado con relleno degradado
function TrendLine({ data }) {
  // Asegurar datos válidos
  const safeData = data && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];

  const max = Math.max(...safeData);
  const min = Math.min(...safeData);
  // Usar padding para que la línea tenga más movimiento visual
  const padding = (max - min) * 0.2 || 1;
  const adjustedMin = Math.max(0, min - padding);
  const adjustedMax = max + padding;
  const range = adjustedMax - adjustedMin || 1;

  const points = safeData
    .map((value, idx) => {
      const x = (idx / (safeData.length - 1)) * 100;
      const y = 100 - ((value - adjustedMin) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  // Crear path para el área con curvas suaves
  const areaPath = `M 0,100 L ${points.split(" ").map((p, i) => {
    const [x, y] = p.split(",");
    return i === 0 ? `0,${y} L ${x},${y}` : `${x},${y}`;
  }).join(" L ")} L 100,100 Z`;

  return (
    <div className="h-24 w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Definir gradiente */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Área con relleno degradado */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#areaGradient)"
        />

        {/* Línea principal */}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Puntos en cada dato */}
        {safeData.map((value, idx) => {
          const x = (idx / (safeData.length - 1)) * 100;
          const y = 100 - ((value - adjustedMin) / range) * 100;
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="3"
              fill="white"
              stroke="#3b82f6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-600">{error}</p>
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

      {/* Métricas principales - altura uniforme con iconos mejorados */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Solicitudes - Azul (Neutro/Info) */}
          <Card className="h-[150px] bg-white/70 backdrop-blur-md border-white/30">
            <CardContent className="h-full flex flex-col justify-between py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Total Solicitudes
                  </p>
                  <p className="text-3xl font-bold text-slate-800">{kpiData.solicitudes.total}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 grid place-items-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {kpiData.solicitudes.trendPercentage >= 0 ? (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-semibold">+{kpiData.solicitudes.trendPercentage}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-semibold">{kpiData.solicitudes.trendPercentage}%</span>
                  </div>
                )}
                <span className="text-slate-500">vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          {/* Tasa de Aprobación - Color semántico según valor */}
          {(() => {
            const tasaAprobacion = kpiData.solicitudes.total > 0
              ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100)
              : 0;
            // Color semántico: Verde >= 70%, Amarillo 40-69%, Rojo < 40%
            const isGood = tasaAprobacion >= 70;
            const isWarning = tasaAprobacion >= 40 && tasaAprobacion < 70;
            const isBad = tasaAprobacion < 40;

            const bgColor = isGood ? "bg-emerald-500/10" : isWarning ? "bg-amber-500/10" : "bg-red-500/10";
            const iconColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
            const IconComponent = isGood ? CheckCircle2 : isWarning ? Clock : XCircle;

            return (
              <Card className="h-[150px] bg-white/70 backdrop-blur-md border-white/30">
                <CardContent className="h-full flex flex-col justify-between py-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Tasa de Aprobación
                      </p>
                      <p className={`text-3xl font-bold ${isGood ? 'text-emerald-600' : isWarning ? 'text-amber-600' : 'text-red-600'}`}>
                        {tasaAprobacion}%
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-2xl ${bgColor} grid place-items-center flex-shrink-0`}>
                      <IconComponent className={`w-6 h-6 ${iconColor}`} />
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Tiempo Promedio - Color semántico según meta */}
          {(() => {
            const promedio = kpiData.tiempoAprobacion.promedio;
            const meta = kpiData.tiempoAprobacion.meta;
            // Color semántico: Verde si está bajo la meta, Amarillo si está cerca, Rojo si excede
            const isGood = promedio <= meta;
            const isWarning = promedio > meta && promedio <= meta * 1.5;
            const isBad = promedio > meta * 1.5;

            const bgColor = isGood ? "bg-emerald-500/10" : isWarning ? "bg-amber-500/10" : "bg-red-500/10";
            const iconColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
            const valueColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";

            return (
              <Card className="h-[150px] bg-white/70 backdrop-blur-md border-white/30">
                <CardContent className="h-full flex flex-col justify-between py-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Tiempo Promedio
                      </p>
                      <p className={`text-3xl font-bold ${valueColor}`}>{promedio} días</p>
                    </div>
                    <div className={`h-12 w-12 rounded-2xl ${bgColor} grid place-items-center flex-shrink-0`}>
                      <Clock className={`w-6 h-6 ${iconColor}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {isGood ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <TrendingDown className="w-4 h-4" />
                        <span className="font-semibold">Bajo meta</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-semibold">Sobre meta</span>
                      </div>
                    )}
                    <span className="text-slate-500">Meta: {meta} días</span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Presupuesto Utilizado - Color semántico según uso */}
          {(() => {
            const percentage = kpiData.presupuesto.percentage;
            // Color semántico: Verde < 70%, Amarillo 70-90%, Rojo > 90%
            const isGood = percentage < 70;
            const isWarning = percentage >= 70 && percentage <= 90;
            const isBad = percentage > 90;

            const bgColor = isGood ? "bg-emerald-500/10" : isWarning ? "bg-amber-500/10" : "bg-red-500/10";
            const iconColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
            const textColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";

            return (
              <Card className="h-[150px] bg-white/70 backdrop-blur-md border-white/30">
                <CardContent className="h-full flex flex-col justify-between py-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Presupuesto
                      </p>
                      <p className="text-2xl font-bold text-slate-800">
                        {formatCurrency(kpiData.presupuesto.utilizado)}
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-2xl ${bgColor} grid place-items-center flex-shrink-0`}>
                      <DollarSign className={`w-6 h-6 ${iconColor}`} />
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className={`font-semibold ${textColor}`}>{percentage}%</span>
                    <span className="text-slate-500"> de {formatCurrency(kpiData.presupuesto.total)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </ScrollReveal>

      {/* Fila 1: Tendencia (60%) + Distribución de Estados Donut (40%) */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Tendencia de Solicitudes - 60% */}
          <Card className="lg:col-span-3 h-[280px] bg-white/70 backdrop-blur-md border-white/30">
            <CardHeader className="px-6 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tendencia de Solicitudes</CardTitle>
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5 flex flex-col justify-between h-[calc(100%-60px)]">
              <div className="flex-1 flex flex-col justify-center">
                <TrendLine data={kpiData.solicitudes.trend} />
                <div className="grid grid-cols-7 gap-1 text-xs text-slate-500 text-center mt-2">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-white/20 flex items-center justify-between text-sm">
                <span className="text-slate-500">Promedio semanal</span>
                <span className="font-semibold text-slate-800">
                  {Math.round(kpiData.solicitudes.trend.reduce((a, b) => a + b, 0) / Math.max(kpiData.solicitudes.trend.length, 1))} solicitudes
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Distribución de Estados - Donut Chart 40% */}
          <Card className="lg:col-span-2 h-[280px] bg-white/70 backdrop-blur-md border-white/30">
            <CardHeader className="px-6 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Distribución de Estados</CardTitle>
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5 flex items-center justify-center h-[calc(100%-60px)]">
              <DonutChart
                data={[
                  kpiData.solicitudes.aprobadas,
                  kpiData.solicitudes.rechazadas,
                  kpiData.solicitudes.pendientes,
                ]}
                colors={["#10b981", "#ef4444", "#f59e0b"]}
                labels={["Aprobadas", "Rechazadas", "Pendientes"]}
              />
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>

      {/* Fila 2: Materiales | Grupos de Artículos | Presupuesto por Centro (33% cada uno) */}
      <ScrollReveal delay={250}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Materiales Más Solicitados - Izquierda */}
          <Card className="h-[320px] bg-white/70 backdrop-blur-md border-white/30">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Materiales Más Solicitados</CardTitle>
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 overflow-auto h-[calc(100%-60px)]">
              <div className="space-y-3">
                {(kpiData.materialesMasSolicitados || []).length > 0 ? (
                  kpiData.materialesMasSolicitados.map((material, idx) => {
                    const maxCantidad = Math.max(...kpiData.materialesMasSolicitados.map(m => m.cantidad), 1);
                    const percentage = (material.cantidad / maxCantidad) * 100;
                    return (
                      <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 grid place-items-center text-xs font-bold text-blue-600">
                              {idx + 1}
                            </div>
                            <span
                              className="text-sm text-slate-700 font-medium truncate"
                              title={material.nombre}
                            >
                              {material.nombre}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-800 tabular-nums flex-shrink-0 ml-2">
                            {(material.cantidad || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100/70 backdrop-blur-sm rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 group-hover:from-blue-600 group-hover:to-blue-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No hay datos disponibles
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Grupos de Artículos Más Solicitados - Centro */}
          <Card className="h-[320px] bg-white/70 backdrop-blur-md border-white/30">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Grupos de Artículos</CardTitle>
                <Layers className="w-5 h-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 overflow-auto h-[calc(100%-60px)]">
              <div className="space-y-3">
                {(kpiData.gruposArticulosMasSolicitados || []).length > 0 ? (
                  kpiData.gruposArticulosMasSolicitados.map((grupo, idx) => {
                    const maxCantidad = Math.max(...kpiData.gruposArticulosMasSolicitados.map(g => g.cantidad), 1);
                    const percentage = (grupo.cantidad / maxCantidad) * 100;
                    return (
                      <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 grid place-items-center text-xs font-bold text-cyan-600">
                              {idx + 1}
                            </div>
                            <span
                              className="text-sm text-slate-700 font-medium truncate"
                              title={grupo.nombre}
                            >
                              {grupo.nombre}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-800 tabular-nums flex-shrink-0 ml-2">
                            {(grupo.cantidad || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100/70 backdrop-blur-sm rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500 group-hover:from-cyan-600 group-hover:to-cyan-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No hay datos disponibles
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Presupuesto por Centro - Derecha */}
          <Card className="h-[320px] bg-white/70 backdrop-blur-md border-white/30">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Presupuesto por Centro</CardTitle>
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 overflow-auto h-[calc(100%-60px)]">
              <div className="space-y-3">
                {(kpiData.presupuesto.porCentro || []).length > 0 ? (
                  kpiData.presupuesto.porCentro.map((centro, idx) => {
                    const maxValor = Math.max(...kpiData.presupuesto.porCentro.map(c => c.valor), 1);
                    const percentage = (centro.valor / maxValor) * 100;
                    return (
                      <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="text-sm text-slate-700 font-medium truncate flex-1"
                            title={centro.nombre}
                          >
                            {centro.nombre}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 tabular-nums flex-shrink-0 ml-2">
                            {formatCurrency(centro.valor)}
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100/70 backdrop-blur-sm rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 group-hover:from-emerald-600 group-hover:to-emerald-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No hay datos disponibles
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>

      {/* Card de Progreso de Presupuesto */}
      <ScrollReveal delay={300}>
        <Card className="bg-white/70 backdrop-blur-md border-white/30">
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
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Presupuesto Total
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(kpiData.presupuesto.total)}
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Utilizado
                </p>
                <p className="text-2xl font-bold text-amber-500">
                  {formatCurrency(kpiData.presupuesto.utilizado)}
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Disponible
                </p>
                <p className="text-2xl font-bold text-emerald-500">
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
