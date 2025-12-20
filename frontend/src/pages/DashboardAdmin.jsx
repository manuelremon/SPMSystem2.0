import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { planner, solicitudes } from "../services/spm";
import api from "../services/api";
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
  Layers,
  BarChart3,
  Loader2,
  ChevronRight,
} from "../components/ui/Icons";
import { useI18n } from "../context/i18n";
import { toNumber } from "../utils/formatters";
import { useAuthStore } from "../store/authStore";
import { useNavigate, Link } from "react-router-dom";
import { getTableColumns } from "./DashboardShared";
import { Button } from "../components/ui/Button";
import clsx from "clsx";

// ============================================================================
// KPI CHART COMPONENTS
// ============================================================================

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
          <circle
            cx="80"
            cy="80"
            r={innerRadius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-800">{total}</span>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Total</span>
        </div>
      </div>
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

// Componente de línea de tendencia con relleno degradado
function TrendLine({ data }) {
  const safeData = data && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeData);
  const min = Math.min(...safeData);
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

  return (
    <div className="h-24 w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradientDash" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${points} 100,100`} fill="url(#areaGradientDash)" />
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
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

// Componente de círculo de progreso - tamaño ajustado para mejor proporción
function ProgressCircle({ percentage, color = "#3b82f6", size = "md" }) {
  const sizes = {
    sm: { container: "w-16 h-16", viewBox: "0 0 64 64", cx: 32, radius: 24, stroke: 6, text: "text-sm" },
    md: { container: "w-20 h-20", viewBox: "0 0 80 80", cx: 40, radius: 30, stroke: 7, text: "text-base" },
    lg: { container: "w-24 h-24", viewBox: "0 0 96 96", cx: 48, radius: 36, stroke: 8, text: "text-lg" },
  };
  const s = sizes[size] || sizes.md;
  const circumference = 2 * Math.PI * s.radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative ${s.container}`}>
      <svg viewBox={s.viewBox} className="w-full h-full -rotate-90">
        <circle cx={s.cx} cy={s.cx} r={s.radius} stroke="#e2e8f0" strokeWidth={s.stroke} fill="none" />
        <circle
          cx={s.cx}
          cy={s.cx}
          r={s.radius}
          stroke={color}
          strokeWidth={s.stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${s.text} font-bold text-slate-800`}>{percentage}%</span>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD ADMIN COMPONENT
// ============================================================================

export default function DashboardAdmin() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Solicitudes state
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

  // KPI state
  const [kpiLoading, setKpiLoading] = useState(true);
  const [materialesPeriodo, setMaterialesPeriodo] = useState("mes");
  const [estadosPeriodo, setEstadosPeriodo] = useState("mes");
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0,0,0,0,0,0,0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0, trend: [0,0,0,0,0,0,0] },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  });

  // Fetch solicitudes
  useEffect(() => {
    setLoading(true);

    // Fetch ALL solicitudes for "Todas" tab (no estado filter)
    const todasCall = solicitudes.listar({ page_size: 500 }).catch(() => null);
    const pendientesCall = solicitudes.listar({ estado: "Enviada", page_size: 100 }).catch(() => null);
    const enProcesoCall = solicitudes.listar({ estado: "En Progreso", page_size: 100 }).catch(() => null);
    const completadasCall = solicitudes.listar({ estado: "Aprobada", page_size: 100 }).catch(() => null);
    const rechazadasCall = solicitudes.listar({ estado: "Rechazada", page_size: 100 }).catch(() => null);

    Promise.all([todasCall, pendientesCall, enProcesoCall, completadasCall, rechazadasCall])
      .then(([todasRes, pendientesRes, enProcesoRes, completadasRes, rechazadasRes]) => {
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
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  // Fetch KPIs
  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setKpiLoading(true);
        const response = await api.get("/kpis");
        if (response.data?.ok && response.data?.data) {
          setKpiData(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching KPIs:", err);
      } finally {
        setKpiLoading(false);
      }
    };
    fetchKpis();
  }, []);

  const columns = useMemo(() => getTableColumns(t), [t]);

  // Tabs configuration
  const tabs = [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "pendientes", label: t("dash_pendientes", "Pendientes"), count: stats.pendientes },
    { key: "en_proceso", label: t("dash_en_proceso", "En Proceso"), count: stats.en_proceso },
    { key: "completadas", label: t("dash_completadas", "Completadas"), count: stats.completadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: stats.rechazadas },
  ];

  const currentData = allData[activeTab] || [];
  const limitedData = currentData.slice(0, 10);
  const hasMoreData = currentData.length > 10;

  const getTableTitle = () => {
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
  };

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* SOLICITUDES SECTION */}
      {/* ================================================================== */}

      {/* Header: Tabs + Nueva Solicitud button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab.key
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  "px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums",
                  activeTab === tab.key
                    ? "bg-blue-100 text-blue-600"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <Button as={Link} to="/solicitudes/nueva">
          <Plus className="w-4 h-4" />
          {t("dash_new_request", "Nueva Solicitud")}
        </Button>
      </div>

      {/* Tabla principal */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">
              {getTableTitle()}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {currentData.length} {t("dash_items", "items")}
            </span>
          </div>

          <div className="p-4">
            {loading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : currentData.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-60" />
                <p className="text-slate-500 text-sm">
                  {activeTab === "pendientes"
                    ? t("dash_no_pending", "No hay solicitudes pendientes de revisión")
                    : t("dash_no_requests_category", "No hay solicitudes en esta categoría")}
                </p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={limitedData}
                emptyMessage={t("dash_no_requests", "No hay solicitudes")}
                onRowClick={(row) => navigate(`/solicitudes/${row.id}`)}
              />
            )}
          </div>
          {hasMoreData && (
            <div className="px-4 pb-4">
              <Link
                to={`/solicitudes/todas?tab=${activeTab}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Ver todas las solicitudes ({currentData.length})
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* KPI SECTION */}
      {/* ================================================================== */}

      {kpiLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Métricas principales - 4 tarjetas compactas */}
          <ScrollReveal delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Solicitudes */}
              <Card className="bg-white/70 backdrop-blur-md border-white/30">
                <CardContent className="flex flex-col gap-2 py-4 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                      Total Solicitudes
                    </p>
                    <div className="h-8 w-8 rounded-lg bg-blue-50 grid place-items-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{kpiData.solicitudes.total}</p>
                  <div className="flex items-center gap-1.5 text-xs">
                    {kpiData.solicitudes.trendPercentage >= 0 ? (
                      <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                        <TrendingUp className="w-3 h-3" />
                        +{kpiData.solicitudes.trendPercentage}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-red-600 font-medium">
                        <TrendingDown className="w-3 h-3" />
                        {kpiData.solicitudes.trendPercentage}%
                      </span>
                    )}
                    <span className="text-slate-400">vs mes anterior</span>
                  </div>
                </CardContent>
              </Card>

              {/* Tasa de Aprobación */}
              {(() => {
                const tasaAprobacion = kpiData.solicitudes.total > 0
                  ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100)
                  : 0;
                const isGood = tasaAprobacion >= 70;
                const isWarning = tasaAprobacion >= 40 && tasaAprobacion < 70;
                const bgColor = isGood ? "bg-emerald-50" : isWarning ? "bg-amber-50" : "bg-red-50";
                const iconColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
                const valueColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";

                return (
                  <Card className="bg-white/70 backdrop-blur-md border-white/30">
                    <CardContent className="flex flex-col gap-2 py-4 px-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                          Tasa de Aprobación
                        </p>
                        <div className={`h-8 w-8 rounded-lg ${bgColor} grid place-items-center flex-shrink-0`}>
                          <CheckCircle2 className={`w-4 h-4 ${iconColor}`} />
                        </div>
                      </div>
                      <p className={`text-2xl font-bold ${valueColor}`}>{tasaAprobacion}%</p>
                      <p className="text-xs text-slate-400">
                        {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Tiempo Promedio */}
              {(() => {
                const promedio = kpiData.tiempoAprobacion.promedio;
                const meta = kpiData.tiempoAprobacion.meta;
                const isGood = promedio <= meta;
                const isWarning = promedio > meta && promedio <= meta * 1.5;
                const bgColor = isGood ? "bg-emerald-50" : isWarning ? "bg-amber-50" : "bg-red-50";
                const iconColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
                const valueColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";

                return (
                  <Card className="bg-white/70 backdrop-blur-md border-white/30">
                    <CardContent className="flex flex-col gap-2 py-4 px-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                          Tiempo Promedio
                        </p>
                        <div className={`h-8 w-8 rounded-lg ${bgColor} grid place-items-center flex-shrink-0`}>
                          <Clock className={`w-4 h-4 ${iconColor}`} />
                        </div>
                      </div>
                      <p className={`text-2xl font-bold ${valueColor}`}>{promedio} días</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        {isGood ? (
                          <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                            <TrendingDown className="w-3 h-3" />
                            Bajo meta
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                            <TrendingUp className="w-3 h-3" />
                            Sobre meta
                          </span>
                        )}
                        <span className="text-slate-400">Meta: {meta} días</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Presupuesto Utilizado */}
              {(() => {
                const percentage = kpiData.presupuesto.percentage;
                const isGood = percentage < 70;
                const isWarning = percentage >= 70 && percentage <= 90;
                const bgColor = isGood ? "bg-emerald-50" : isWarning ? "bg-amber-50" : "bg-red-50";
                const iconColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";
                const textColor = isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600";

                return (
                  <Card className="bg-white/70 backdrop-blur-md border-white/30">
                    <CardContent className="flex flex-col gap-2 py-4 px-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                          Presupuesto Utilizado
                        </p>
                        <div className={`h-8 w-8 rounded-lg ${bgColor} grid place-items-center flex-shrink-0`}>
                          <DollarSign className={`w-4 h-4 ${iconColor}`} />
                        </div>
                      </div>
                      <p className={`text-2xl font-bold ${textColor}`}>
                        {formatCurrency(kpiData.presupuesto.utilizado)}
                      </p>
                      <p className="text-xs">
                        <span className={`font-medium ${textColor}`}>{percentage}% consumido</span>
                        <span className="text-slate-400"> del total</span>
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </ScrollReveal>

          {/* Tendencia + Donut Chart */}
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-3 h-[280px] bg-white/70 backdrop-blur-md border-white/30">
                <CardHeader className="px-6 pt-5 pb-3 text-center">
                  <CardTitle className="text-base">Tendencia de Solicitudes</CardTitle>
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

              <Card className="lg:col-span-2 h-[280px] bg-white/70 backdrop-blur-md border-white/30">
                <CardHeader className="px-6 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Distribución de Estados</CardTitle>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                      {[
                        { key: "semana", label: "Sem" },
                        { key: "mes", label: "Mes" },
                        { key: "año", label: "Año" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setEstadosPeriodo(opt.key)}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                            estadosPeriodo === opt.key
                              ? "bg-white text-blue-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
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

          {/* Materiales | Presupuesto por Centro */}
          <ScrollReveal delay={250}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Materiales Más Solicitados */}
              <Card className="h-[320px] bg-white/70 backdrop-blur-md border-white/30">
                <CardHeader className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Materiales Más Solicitados</CardTitle>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                      {[
                        { key: "semana", label: "Sem" },
                        { key: "mes", label: "Mes" },
                        { key: "año", label: "Año" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setMaterialesPeriodo(opt.key)}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                            materialesPeriodo === opt.key
                              ? "bg-white text-blue-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
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
                                <span className="text-sm text-slate-700 font-medium truncate" title={material.nombre}>
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
                      <p className="text-sm text-slate-500 text-center py-4">No hay datos disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Presupuesto por Centro */}
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
                              <span className="text-sm text-slate-700 font-medium truncate flex-1" title={centro.nombre}>
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
                      <p className="text-sm text-slate-500 text-center py-4">No hay datos disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>

          {/* Resumen de Presupuesto - Con gráficos circulares */}
          <ScrollReveal delay={300}>
            <Card className="bg-white/70 backdrop-blur-md border-white/30">
              <CardHeader className="px-5 pt-5 pb-3 text-center">
                <CardTitle className="text-base">Resumen de Presupuesto</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-3 gap-6">
                  {/* Total */}
                  <div className="flex items-center gap-3">
                    <ProgressCircle percentage={100} size="sm" color="#3b82f6" />
                    <div>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        Total
                      </p>
                      <p className="text-base font-bold text-slate-800">
                        {formatCurrency(kpiData.presupuesto.total)}
                      </p>
                    </div>
                  </div>
                  {/* Utilizado */}
                  <div className="flex items-center gap-3">
                    <ProgressCircle percentage={kpiData.presupuesto.percentage} size="sm" color="#f59e0b" />
                    <div>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        Utilizado
                      </p>
                      <p className="text-base font-bold text-amber-500">
                        {formatCurrency(kpiData.presupuesto.utilizado)}
                      </p>
                    </div>
                  </div>
                  {/* Disponible */}
                  <div className="flex items-center gap-3">
                    <ProgressCircle percentage={100 - kpiData.presupuesto.percentage} size="sm" color="#10b981" />
                    <div>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        Disponible
                      </p>
                      <p className="text-base font-bold text-emerald-500">
                        {formatCurrency(kpiData.presupuesto.disponible)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </>
      )}
    </div>
  );
}
