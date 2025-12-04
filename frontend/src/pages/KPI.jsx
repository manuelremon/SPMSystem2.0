import { useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
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
  BarChart3,
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

  // Mock data - En producción vendría del backend
  const kpiData = useMemo(() => ({
    solicitudes: {
      total: 248,
      aprobadas: 189,
      rechazadas: 32,
      pendientes: 27,
      trend: [45, 52, 48, 61, 58, 67, 72],
      trendPercentage: 12.5,
    },
    presupuesto: {
      total: 2500000,
      utilizado: 1875000,
      disponible: 625000,
      percentage: 75,
      porCentro: [
        { nombre: "Centro 1008", valor: 580000 },
        { nombre: "Centro 1009", valor: 420000 },
        { nombre: "Centro 1010", valor: 380000 },
        { nombre: "Centro 1011", valor: 295000 },
        { nombre: "Centro 1012", valor: 200000 },
      ],
    },
    tiempoAprobacion: {
      promedio: 2.3,
      meta: 3.0,
      trend: [3.2, 2.9, 2.7, 2.5, 2.4, 2.3, 2.3],
    },
    materialesMasSolicitados: [
      { nombre: "Tuercas M12", cantidad: 4500 },
      { nombre: "Tornillos M10", cantidad: 3800 },
      { nombre: "Arandelas", cantidad: 3200 },
      { nombre: "Pernos", cantidad: 2900 },
      { nombre: "Cables", cantidad: 2400 },
    ],
    solicitudesPorEstado: {
      labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
      aprobadas: [28, 35, 42, 38, 45, 52],
      rechazadas: [5, 6, 4, 8, 5, 7],
      pendientes: [3, 5, 4, 6, 5, 4],
    },
  }), []);


  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI's"
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "KPI's" }
        ]}
      />

      {/* Métricas principales */}
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

      {/* Gráficos detallados */}
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
              {kpiData.materialesMasSolicitados.map((material, idx) => {
                const maxCantidad = Math.max(...kpiData.materialesMasSolicitados.map(m => m.cantidad));
                const percentage = (material.cantidad / maxCantidad) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--primary-muted)]/20 grid place-items-center text-sm font-bold text-[var(--primary)]">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5 text-sm">
                        <span className="text-[var(--fg)] font-medium">{material.nombre}</span>
                        <span className="text-[var(--fg-muted)]">{material.cantidad.toLocaleString()}</span>
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
              })}
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
                  data={kpiData.solicitudesPorEstado.aprobadas}
                  maxValue={Math.max(...kpiData.solicitudesPorEstado.aprobadas)}
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
                  data={kpiData.solicitudesPorEstado.rechazadas}
                  maxValue={Math.max(...kpiData.solicitudesPorEstado.aprobadas)}
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
                  data={kpiData.solicitudesPorEstado.pendientes}
                  maxValue={Math.max(...kpiData.solicitudesPorEstado.aprobadas)}
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-6 gap-1 text-xs text-[var(--fg-muted)] text-center">
              {kpiData.solicitudesPorEstado.labels.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Progreso de Presupuesto */}
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
    </div>
  );
}
