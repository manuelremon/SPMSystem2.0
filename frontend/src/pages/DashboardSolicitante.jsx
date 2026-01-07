import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { formatCurrency } from "../utils/formatters";
import {
  FileText,
  Plus,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Package,
  BarChart3,
  Loader2,
  ICON_COLORS,
} from "../components/ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useNavigate, Link } from "react-router-dom";
import { getTableColumns } from "./DashboardShared";
import { Button } from "../components/ui/Button";
import { WeeklyRequestsKpiCard } from "../components/dashboard/WeeklyRequestsKpiCard";
import clsx from "clsx";

// KPI CHART COMPONENTS
function DonutChart({ data, colors, labels }) {
  const total = data.reduce((sum, val) => sum + val, 0) || 1;
  const radius = 70, strokeWidth = 24, innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;
  let currentOffset = 0;
  // Detectar dark mode para el color del fondo del círculo
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgStroke = isDark ? '#334155' : '#f1f5f9'; // slate-700 vs slate-100
  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={innerRadius} fill="none" stroke={bgStroke} strokeWidth={strokeWidth} />
          {data.map((value, idx) => {
            const pct = value / total, dashLength = pct * circumference, dashOffset = currentOffset;
            currentOffset += dashLength;
            if (value === 0) return null;
            return <circle key={idx} cx="80" cy="80" r={innerRadius} fill="none" stroke={colors[idx]} strokeWidth={strokeWidth} strokeDasharray={`${dashLength} ${circumference - dashLength}`} strokeDashoffset={-dashOffset} strokeLinecap="round" className="transition-all duration-500" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{total}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
        </div>
      </div>
      <div className="ml-6 space-y-3">
        {labels.map((label, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[idx] }} />
            <div className="flex items-center gap-2"><span className="text-sm text-slate-600 dark:text-slate-300">{label}</span><span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{data[idx]}</span><span className="text-xs text-slate-400 dark:text-slate-500">({total > 0 ? Math.round((data[idx] / total) * 100) : 0}%)</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressCircle({ percentage, color = "#3b82f6" }) {
  const radius = 40, circumference = 2 * Math.PI * radius, offset = circumference - (percentage / 100) * circumference;
  // Detectar dark mode para el color del fondo del círculo
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgStroke = isDark ? '#334155' : '#e2e8f0'; // slate-700 vs slate-200
  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90"><circle cx="48" cy="48" r={radius} stroke={bgStroke} strokeWidth="8" fill="none" /><circle cx="48" cy="48" r={radius} stroke={color} strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" /></svg>
      <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold text-slate-800 dark:text-slate-100">{percentage}%</span></div>
    </div>
  );
}

export default function DashboardSolicitante() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState("todas");
  const [stats, setStats] = useState({ todas: 0, borradores: 0, enviadas: 0, aprobadas: 0, rechazadas: 0 });
  const [allData, setAllData] = useState({ todas: [], borradores: [], enviadas: [], aprobadas: [], rechazadas: [] });
  const [loading, setLoading] = useState(true);

  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0,0,0,0,0,0,0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0 },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  });

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    solicitudes.listar({ user_id: user.id, page_size: 100 })
      .then((res) => {
        const lista = res.data.solicitudes || res.data.items || res.data || [];
        const borradores = [], enviadas = [], aprobadas = [], rechazadas = [];
        lista.forEach(s => {
          const estado = (s.status || s.estado || "").toLowerCase();
          if (estado === "borrador" || estado === "draft") borradores.push(s);
          else if (estado === "enviada" || estado === "submitted" || estado === "pendiente_de_aprobacion") enviadas.push(s);
          else if (estado === "aprobada" || estado === "approved") aprobadas.push(s);
          else if (estado === "rechazada" || estado === "rejected") rechazadas.push(s);
        });
        setStats({ todas: lista.length, borradores: borradores.length, enviadas: enviadas.length, aprobadas: aprobadas.length, rechazadas: rechazadas.length });
        setAllData({ todas: lista, borradores, enviadas, aprobadas, rechazadas });
      })
      .catch((err) => console.error("Error solicitudes usuario", err))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setKpiLoading(true);
        const response = await api.get("/kpis");
        if (response.data?.ok && response.data?.data) setKpiData(response.data.data);
      } catch (err) { console.error("Error fetching KPIs:", err); }
      finally { setKpiLoading(false); }
    };
    fetchKpis();
  }, []);

  const columns = useMemo(() => getTableColumns(t), [t]);
  const tabs = [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "borradores", label: t("dash_borradores", "Borradores"), count: stats.borradores },
    { key: "enviadas", label: t("dash_enviadas", "Enviadas"), count: stats.enviadas },
    { key: "aprobadas", label: t("dash_aprobadas", "Aprobadas"), count: stats.aprobadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: stats.rechazadas },
  ];
  const currentData = allData[activeTab] || [];

  const getTableTitle = () => {
    switch (activeTab) {
      case "todas": return t("dash_mis_solicitudes", "Mis Solicitudes");
      case "borradores": return t("dash_borradores_title", "Mis Borradores");
      case "enviadas": return t("dash_enviadas_title", "Solicitudes Enviadas");
      case "aprobadas": return t("dash_aprobadas_title", "Solicitudes Aprobadas");
      case "rechazadas": return t("dash_rechazadas_title", "Solicitudes Rechazadas");
      default: return t("dash_solicitudes", "Solicitudes");
    }
  };

  return (
    <div className="space-y-6">
      {/* Contenedor unificado: Tabs + Tabla de Solicitudes */}
      <Card>
        <CardContent className="p-0">
          {/* Header con tabs y botón */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                    activeTab === tab.key ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50")}>
                  <span>{tab.label}</span>
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums", activeTab === tab.key ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>{tab.count}</span>
                </button>
              ))}
            </div>
            <Button as={Link} to="/solicitudes/nueva" size="sm"><Plus className="w-4 h-4" />{t("dash_new_request", "Nueva Solicitud")}</Button>
          </div>

          {/* Subtítulo con contador */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50/50 dark:bg-slate-800/30">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">{getTableTitle()}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{currentData.length} {t("dash_items", "items")}</span>
          </div>

          {/* Tabla */}
          <div className="p-4">
            {loading ? <TableSkeleton rows={5} columns={7} /> : currentData.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-60" />
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{stats.todas === 0 ? t("dash_no_requests_user", "No tienes solicitudes. Crea tu primera solicitud.") : t("dash_no_requests_category", "No hay solicitudes en esta categoría")}</p>
                {stats.todas === 0 && <Button as={Link} to="/solicitudes/nueva"><Plus className="w-4 h-4" />{t("dash_create_first", "Crear solicitud")}</Button>}
              </div>
            ) : <DataTable columns={columns} rows={currentData} emptyMessage={t("dash_no_requests", "No hay solicitudes")} onRowClick={(row) => navigate(`/solicitudes/${row.id}`)} />}
          </div>
        </CardContent>
      </Card>

      {kpiLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : (
        <>
          <ScrollReveal delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="h-[150px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                <CardContent className="h-full flex flex-col justify-between py-5">
                  <div className="flex items-start justify-between">
                    <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Solicitudes</p><p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{kpiData.solicitudes.total}</p></div>
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 grid place-items-center"><FileText className={`w-6 h-6 ${ICON_COLORS.primary}`} /></div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {kpiData.solicitudes.trendPercentage >= 0 ? <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-4 h-4" /><span className="font-semibold">+{kpiData.solicitudes.trendPercentage}%</span></div>
                      : <div className="flex items-center gap-1 text-red-600 dark:text-red-400"><TrendingDown className="w-4 h-4" /><span className="font-semibold">{kpiData.solicitudes.trendPercentage}%</span></div>}
                    <span className="text-slate-500 dark:text-slate-400">vs mes anterior</span>
                  </div>
                </CardContent>
              </Card>

              {(() => {
                const tasa = kpiData.solicitudes.total > 0 ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100) : 0;
                const isGood = tasa >= 70, isWarning = tasa >= 40 && tasa < 70;
                const bgColor = isGood ? "bg-emerald-500/10 dark:bg-emerald-500/20" : isWarning ? "bg-amber-500/10 dark:bg-amber-500/20" : "bg-red-500/10 dark:bg-red-500/20";
                const iconColor = isGood ? "text-emerald-600 dark:text-emerald-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                const Icon = isGood ? CheckCircle2 : isWarning ? Clock : XCircle;
                return (
                  <Card className="h-[150px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                    <CardContent className="h-full flex flex-col justify-between py-5">
                      <div className="flex items-start justify-between">
                        <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tasa de Aprobación</p><p className={`text-3xl font-bold ${isGood ? 'text-emerald-600 dark:text-emerald-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{tasa}%</p></div>
                        <div className={`h-12 w-12 rounded-2xl ${bgColor} grid place-items-center`}><Icon className={`w-6 h-6 ${iconColor}`} /></div>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}</div>
                    </CardContent>
                  </Card>
                );
              })()}

              {(() => {
                const prom = kpiData.tiempoAprobacion.promedio, meta = kpiData.tiempoAprobacion.meta;
                const isGood = prom <= meta, isWarning = prom > meta && prom <= meta * 1.5;
                const bgColor = isGood ? "bg-emerald-500/10 dark:bg-emerald-500/20" : isWarning ? "bg-amber-500/10 dark:bg-amber-500/20" : "bg-red-500/10 dark:bg-red-500/20";
                const iconColor = isGood ? "text-emerald-600 dark:text-emerald-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                const valueColor = isGood ? "text-emerald-600 dark:text-emerald-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                return (
                  <Card className="h-[150px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                    <CardContent className="h-full flex flex-col justify-between py-5">
                      <div className="flex items-start justify-between">
                        <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tiempo Promedio</p><p className={`text-3xl font-bold ${valueColor}`}>{prom} días</p></div>
                        <div className={`h-12 w-12 rounded-2xl ${bgColor} grid place-items-center`}><Clock className={`w-6 h-6 ${iconColor}`} /></div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {isGood ? <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><TrendingDown className="w-4 h-4" /><span className="font-semibold">Bajo meta</span></div>
                          : <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><TrendingUp className="w-4 h-4" /><span className="font-semibold">Sobre meta</span></div>}
                        <span className="text-slate-500 dark:text-slate-400">Meta: {meta} días</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {(() => {
                const pct = kpiData.presupuesto.percentage;
                const isGood = pct < 70, isWarning = pct >= 70 && pct <= 90;
                const bgColor = isGood ? "bg-emerald-500/10 dark:bg-emerald-500/20" : isWarning ? "bg-amber-500/10 dark:bg-amber-500/20" : "bg-red-500/10 dark:bg-red-500/20";
                const iconColor = isGood ? "text-emerald-600 dark:text-emerald-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                const textColor = isGood ? "text-emerald-600 dark:text-emerald-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                return (
                  <Card className="h-[150px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                    <CardContent className="h-full flex flex-col justify-between py-5">
                      <div className="flex items-start justify-between">
                        <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Presupuesto</p><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(kpiData.presupuesto.utilizado)}</p></div>
                        <div className={`h-12 w-12 rounded-2xl ${bgColor} grid place-items-center`}><DollarSign className={`w-6 h-6 ${iconColor}`} /></div>
                      </div>
                      <div className="text-sm"><span className={`font-semibold ${textColor}`}>{pct}%</span><span className="text-slate-500 dark:text-slate-400"> de {formatCurrency(kpiData.presupuesto.total)}</span></div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* KPI Card compacta con sparkline */}
              <WeeklyRequestsKpiCard
                data={kpiData.solicitudes.trend}
                trendPercentage={kpiData.solicitudes.trendPercentage}
              />

              {/* Distribucion de Estados */}
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                <CardHeader className="px-6 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Distribución de Estados</CardTitle>
                    <BarChart3 className={`w-5 h-5 ${ICON_COLORS.charts}`} />
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-5 flex items-center justify-center">
                  <DonutChart
                    data={[kpiData.solicitudes.aprobadas, kpiData.solicitudes.rechazadas, kpiData.solicitudes.pendientes]}
                    colors={["#10b981", "#ef4444", "#f59e0b"]}
                    labels={["Aprobadas", "Rechazadas", "Pendientes"]}
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={250}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="h-[320px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                <CardHeader className="px-5 pt-5 pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Materiales Más Solicitados</CardTitle><Package className={`w-5 h-5 ${ICON_COLORS.logistics}`} /></div></CardHeader>
                <CardContent className="px-5 pb-5 overflow-auto h-[calc(100%-60px)]">
                  <div className="space-y-3">
                    {(kpiData.materialesMasSolicitados || []).length > 0 ? kpiData.materialesMasSolicitados.map((m, i) => {
                      const maxC = Math.max(...kpiData.materialesMasSolicitados.map(x => x.cantidad), 1);
                      return (<div key={i} className="group"><div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-2 min-w-0 flex-1"><div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 grid place-items-center text-xs font-bold text-blue-600 dark:text-blue-400">{i + 1}</div><span className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate" title={m.nombre}>{m.nombre}</span></div><span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums flex-shrink-0 ml-2">{(m.cantidad || 0).toLocaleString()}</span></div><div className="h-2.5 bg-slate-100/70 dark:bg-slate-700/70 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 group-hover:from-blue-600 group-hover:to-blue-500" style={{ width: `${(m.cantidad / maxC) * 100}%` }} /></div></div>);
                    }) : <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No hay datos disponibles</p>}
                  </div>
                </CardContent>
              </Card>
              <Card className="h-[320px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
                <CardHeader className="px-5 pt-5 pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Presupuesto por Centro</CardTitle><DollarSign className={`w-5 h-5 ${ICON_COLORS.money}`} /></div></CardHeader>
                <CardContent className="px-5 pb-5 overflow-auto h-[calc(100%-60px)]">
                  <div className="space-y-3">
                    {(kpiData.presupuesto.porCentro || []).length > 0 ? kpiData.presupuesto.porCentro.map((c, i) => {
                      const maxV = Math.max(...kpiData.presupuesto.porCentro.map(x => x.valor), 1);
                      return (<div key={i} className="group"><div className="flex items-center justify-between mb-1.5"><span className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate flex-1" title={c.nombre}>{c.nombre}</span><span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums flex-shrink-0 ml-2">{formatCurrency(c.valor)}</span></div><div className="h-2.5 bg-slate-100/70 dark:bg-slate-700/70 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 group-hover:from-emerald-600 group-hover:to-emerald-500" style={{ width: `${(c.valor / maxV) * 100}%` }} /></div></div>);
                    }) : <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No hay datos disponibles</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30">
              <CardHeader className="px-6 pt-6 pb-4"><CardTitle>Resumen de Presupuesto</CardTitle></CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex-shrink-0"><ProgressCircle percentage={kpiData.presupuesto.percentage} /></div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    <div className="text-center md:text-left"><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Presupuesto Total</p><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(kpiData.presupuesto.total)}</p></div>
                    <div className="text-center md:text-left"><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Utilizado</p><p className="text-2xl font-bold text-amber-500 dark:text-amber-400">{formatCurrency(kpiData.presupuesto.utilizado)}</p></div>
                    <div className="text-center md:text-left"><p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Disponible</p><p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{formatCurrency(kpiData.presupuesto.disponible)}</p></div>
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
