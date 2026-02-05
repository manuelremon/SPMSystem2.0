import React, { useEffect, useState, useMemo } from "react";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { formatCurrency, formatAlmacen, formatDate } from "../utils/formatters";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Package,
  Loader2,
} from "../components/ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { WeeklyRequestsKpiCard } from "../components/dashboard/WeeklyRequestsKpiCard";
import StatusBadge from "../components/ui/StatusBadge";
import { getCriticidadConfig } from "../utils/styleConfig";
import { SPM_COLORS } from "../utils/chartTheme";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";

// KPI CHART COMPONENTS
function DonutChart({ data, colors, labels }) {
  const total = data.reduce((sum, val) => sum + val, 0) || 1;
  const radius = 70, strokeWidth = 24, innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;
  let currentOffset = 0;
  return (
    <Box sx={{ position: "relative", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Box sx={{ position: "relative", width: 192, height: 192 }}>
        <svg viewBox="0 0 160 160" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="80" cy="80" r={innerRadius} fill="none" stroke="var(--bg-soft)" strokeWidth={strokeWidth} />
          {data.map((value, idx) => {
            const pct = value / total, dashLength = pct * circumference, dashOffset = currentOffset;
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
                style={{ transition: "all 0.5s" }}
              />
            );
          })}
        </svg>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "slate.800" }}>{total}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</Typography>
        </Box>
      </Box>
      <Stack spacing={1.5} sx={{ ml: 3 }}>
        {labels.map((label, idx) => (
          <Stack key={idx} direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, bgcolor: colors[idx] }} />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{data[idx]}</Typography>
              <Typography variant="caption" color="text.disabled">({total > 0 ? Math.round((data[idx] / total) * 100) : 0}%)</Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function ProgressCircle({ percentage, color = "var(--primary)" }) {
  const radius = 40, circumference = 2 * Math.PI * radius, offset = circumference - (percentage / 100) * circumference;
  return (
    <Box sx={{ position: "relative", width: 96, height: 96 }}>
      <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={radius} stroke="var(--border)" strokeWidth="8" fill="none" />
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
          style={{ transition: "all 0.5s" }}
        />
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>{percentage}%</Typography>
      </Box>
    </Box>
  );
}

export default function DashboardPlanificador() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({ todas: 0, por_planificar: 0, en_proceso: 0, completadas: 0 });
  const [allData, setAllData] = useState({ todas: [], por_planificar: [], en_proceso: [], completadas: [] });
  const [loading, setLoading] = useState(true);

  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0,0,0,0,0,0,0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0 },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  });

  const tabKeys = ["todas", "por_planificar", "en_proceso", "completadas"];

  useEffect(() => {
    setLoading(true);
    const aprobadasCall = solicitudes.listar({ estado: "Aprobada", page_size: 100 }).catch(() => null);
    const enProcesoCall = solicitudes.listar({ estado: "En Progreso", page_size: 100 }).catch(() => null);
    const completadasCall = solicitudes.listar({ estado: "Despachada", page_size: 100 }).catch(() => null);

    Promise.all([aprobadasCall, enProcesoCall, completadasCall])
      .then(([aprobadasRes, enProcesoRes, completadasRes]) => {
        const aprobadasLista = aprobadasRes?.data?.solicitudes || aprobadasRes?.data?.items || [];
        const enProcesoLista = enProcesoRes?.data?.solicitudes || enProcesoRes?.data?.items || [];
        const completadasLista = completadasRes?.data?.solicitudes || completadasRes?.data?.items || [];
        const todasLista = [...aprobadasLista, ...enProcesoLista, ...completadasLista]
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0) - new Date(a.fecha_creacion || a.created_at || 0));
        setStats({ todas: todasLista.length, por_planificar: aprobadasLista.length, en_proceso: enProcesoLista.length, completadas: completadasLista.length });
        setAllData({ todas: todasLista, por_planificar: aprobadasLista, en_proceso: enProcesoLista, completadas: completadasLista });
      })
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

  // AG Grid column definitions
  const columnDefs = useMemo(() => [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            color: "slate.700",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "solicitante",
      headerName: t("dash_table_solicitante", "Solicitante"),
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => {
        const data = params.data || {};
        return [data.solicitante_nombre, data.solicitante_apellido]
          .filter(Boolean).join(" ").trim() || "-";
      },
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontWeight: 500,
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "created_at",
      headerName: t("dash_table_fecha", "Fecha"),
      width: 110,
      valueGetter: (params) => params.data?.created_at,
      valueFormatter: (params) => formatDate(params.value),
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDate(params.data?.created_at)}
        </Typography>
      ),
    },
    {
      field: "estado",
      headerName: t("dash_table_estado", "Estado"),
      width: 140,
      cellRenderer: (params) => {
        const data = params.data || {};
        const aprobadorNombre = [data.aprobador_nombre, data.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [data.planner_nombre, data.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;
        return (
          <StatusBadge
            estado={data.estado || data.status || "Desconocido"}
            showIcon={false}
            tooltipInfo={{
              aprobador: aprobadorNombre,
              planificador: plannerNombre,
              fechaAprobacion: data.updated_at,
              fechaEnvio: data.created_at,
            }}
          />
        );
      },
    },
    {
      field: "criticidad",
      headerName: "Criticidad",
      width: 100,
      cellRenderer: (params) => {
        const criticidad = params.data?.criticidad || "Normal";
        const config = getCriticidadConfig(criticidad);
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: config.color,
            }}
          >
            {config.label}
          </Typography>
        );
      },
    },
    {
      field: "items",
      headerName: "Items",
      width: 70,
      valueGetter: (params) => (params.data?.items || []).length,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {(params.data?.items || []).length}
        </Typography>
      ),
    },
    {
      field: "total_monto",
      headerName: "Monto",
      width: 120,
      type: "numericColumn",
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) => formatCurrency(params.value || 0),
      cellRenderer: (params) => (
        <Box
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            display: "block",
            whiteSpace: "nowrap",
          }}
        >
          {formatCurrency(params.data?.total_monto || 0)}
        </Box>
      ),
    },
    {
      field: "sector_nombre",
      headerName: "Sector",
      flex: 1,
      minWidth: 100,
      valueGetter: (params) => params.data?.sector_nombre || params.data?.sector || "-",
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.data?.sector_nombre || params.data?.sector || "-"}
        </Typography>
      ),
    },
    {
      field: "centro",
      headerName: "Centro",
      width: 100,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.data?.centro || "-"}
        </Typography>
      ),
    },
    {
      field: "almacen_virtual",
      headerName: "Almacen",
      width: 100,
      valueGetter: (params) => formatAlmacen(params.data?.almacen_virtual),
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {formatAlmacen(params.data?.almacen_virtual)}
        </Typography>
      ),
    },
    {
      field: "planificador",
      headerName: "Planificador",
      flex: 1,
      minWidth: 120,
      valueGetter: (params) => {
        const data = params.data || {};
        return [data.planner_nombre, data.planner_apellido]
          .filter(Boolean).join(" ").trim() || "-";
      },
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
  ], [t]);

  const tabs = [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "por_planificar", label: t("dash_por_planificar", "Por Planificar"), count: stats.por_planificar },
    { key: "en_proceso", label: t("dash_en_proceso", "En Proceso"), count: stats.en_proceso },
    { key: "completadas", label: t("dash_despachadas", "Despachadas"), count: stats.completadas },
  ];
  const currentData = allData[tabKeys[activeTab]] || [];

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getTableTitle = () => {
    const key = tabKeys[activeTab];
    switch (key) {
      case "todas": return t("dash_all_requests", "Todas las Solicitudes");
      case "por_planificar": return t("dash_pending_planning", "Solicitudes Pendientes de Planificacion");
      case "en_proceso": return t("dash_in_progress", "Solicitudes En Proceso");
      case "completadas": return t("dash_dispatched", "Solicitudes Despachadas");
      default: return t("dash_solicitudes", "Solicitudes");
    }
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 500,
              minHeight: 40,
            },
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              label={`${tab.label} (${tab.count})`}
            />
          ))}
        </Tabs>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ p: 2 }}>
          {loading ? <TableSkeleton rows={5} columns={7} /> : currentData.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <Calendar sx={{ width: 48, height: 48, color: "info.main", mx: "auto", mb: 2, opacity: 0.6 }} />
              <Typography variant="body2" color="text.secondary">
                {tabKeys[activeTab] === "por_planificar"
                  ? t("dash_no_pending_planning", "No hay solicitudes pendientes de planificacion")
                  : t("dash_no_requests_category", "No hay solicitudes en esta categoria")}
              </Typography>
            </Box>
          ) : (
            <SPMAgGrid
              columnDefs={columnDefs}
              rowData={currentData}
              emptyMessage={t("dash_no_requests", "No hay solicitudes")}
              onRowClick={(row) => navigate(`/planificador?solicitud=${row.id}`)}
              height={400}
              pagination={true}
              paginationPageSize={10}
              enableQuickFilter={true}
              exportFileName="solicitudes_planificador"
            />
          )}
        </Box>
      </Paper>

      {kpiLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          <ScrollReveal delay={100}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6} lg={3}>
                <Paper
                  elevation={0}
                  sx={{
                    height: 150,
                    bgcolor: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5, display: "block" }}>
                          Total Solicitudes
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "text.primary" }}>
                          {kpiData.solicitudes.total}
                        </Typography>
                      </Box>
                      <Box sx={{ height: 48, width: 48, borderRadius: 4, bgcolor: "primary.main", opacity: 0.1, display: "grid", placeItems: "center", position: "relative" }}>
                        <FileText sx={{ position: "absolute", width: 24, height: 24, color: "primary.main" }} />
                      </Box>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {kpiData.solicitudes.trendPercentage >= 0 ? (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "success.main" }}>
                          <TrendingUp sx={{ width: 16, height: 16 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>+{kpiData.solicitudes.trendPercentage}%</Typography>
                        </Stack>
                      ) : (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "error.main" }}>
                          <TrendingDown sx={{ width: 16, height: 16 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{kpiData.solicitudes.trendPercentage}%</Typography>
                        </Stack>
                      )}
                      <Typography variant="body2" color="text.secondary">vs mes anterior</Typography>
                    </Stack>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6} lg={3}>
                {(() => {
                  const tasa = kpiData.solicitudes.total > 0 ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100) : 0;
                  const isGood = tasa >= 70, isWarning = tasa >= 40 && tasa < 70;
                  const bgColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                  const Icon = isGood ? CheckCircle2 : isWarning ? Clock : XCircle;
                  return (
                    <Paper
                      elevation={0}
                      sx={{
                        height: 150,
                        bgcolor: "rgba(255, 255, 255, 0.7)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                    >
                      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", p: 2.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5, display: "block" }}>
                              Tasa de Aprobacion
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: bgColor }}>
                              {tasa}%
                            </Typography>
                          </Box>
                          <Box sx={{ height: 48, width: 48, borderRadius: 4, bgcolor: bgColor, opacity: 0.1, display: "grid", placeItems: "center", position: "relative" }}>
                            <Icon sx={{ position: "absolute", width: 24, height: 24, color: bgColor }} />
                          </Box>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })()}
              </Grid>

              <Grid item xs={12} md={6} lg={3}>
                {(() => {
                  const prom = kpiData.tiempoAprobacion.promedio, meta = kpiData.tiempoAprobacion.meta;
                  const isGood = prom <= meta, isWarning = prom > meta && prom <= meta * 1.5;
                  const bgColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                  return (
                    <Paper
                      elevation={0}
                      sx={{
                        height: 150,
                        bgcolor: "rgba(255, 255, 255, 0.7)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                    >
                      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", p: 2.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5, display: "block" }}>
                              Tiempo Promedio
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: bgColor }}>
                              {prom} dias
                            </Typography>
                          </Box>
                          <Box sx={{ height: 48, width: 48, borderRadius: 4, bgcolor: bgColor, opacity: 0.1, display: "grid", placeItems: "center", position: "relative" }}>
                            <Clock sx={{ position: "absolute", width: 24, height: 24, color: bgColor }} />
                          </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {isGood ? (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "success.main" }}>
                              <TrendingDown sx={{ width: 16, height: 16 }} />
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>Bajo meta</Typography>
                            </Stack>
                          ) : (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "warning.main" }}>
                              <TrendingUp sx={{ width: 16, height: 16 }} />
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>Sobre meta</Typography>
                            </Stack>
                          )}
                          <Typography variant="body2" color="text.secondary">Meta: {meta} dias</Typography>
                        </Stack>
                      </Box>
                    </Paper>
                  );
                })()}
              </Grid>

              <Grid item xs={12} md={6} lg={3}>
                {(() => {
                  const pct = kpiData.presupuesto.percentage;
                  const isGood = pct < 70, isWarning = pct >= 70 && pct <= 90;
                  const bgColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                  return (
                    <Paper
                      elevation={0}
                      sx={{
                        height: 150,
                        bgcolor: "rgba(255, 255, 255, 0.7)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                    >
                      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", p: 2.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5, display: "block" }}>
                              Presupuesto
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                              {formatCurrency(kpiData.presupuesto.utilizado)}
                            </Typography>
                          </Box>
                          <Box sx={{ height: 48, width: 48, borderRadius: 4, bgcolor: bgColor, opacity: 0.1, display: "grid", placeItems: "center", position: "relative" }}>
                            <DollarSign sx={{ position: "absolute", width: 24, height: 24, color: bgColor }} />
                          </Box>
                        </Stack>
                        <Typography variant="body2">
                          <Box component="span" sx={{ fontWeight: 600, color: bgColor }}>{pct}%</Box>
                          <Box component="span" sx={{ color: "text.secondary" }}> de {formatCurrency(kpiData.presupuesto.total)}</Box>
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })()}
              </Grid>
            </Grid>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <WeeklyRequestsKpiCard
                  data={kpiData.solicitudes.trend}
                  trendPercentage={kpiData.solicitudes.trendPercentage}
                />
              </Grid>
              <Grid item xs={12} lg={6}>
                <Paper
                  elevation={0}
                  sx={{
                    bgcolor: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Distribucion de Estados</Typography>
                  </Box>
                  <Box sx={{ px: 3, pb: 2.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DonutChart
                      data={[kpiData.solicitudes.aprobadas, kpiData.solicitudes.rechazadas, kpiData.solicitudes.pendientes]}
                      colors={[SPM_COLORS.success, SPM_COLORS.error, SPM_COLORS.warning]}
                      labels={["Aprobadas", "Rechazadas", "Pendientes"]}
                    />
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </ScrollReveal>

          <ScrollReveal delay={250}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Paper
                  elevation={0}
                  sx={{
                    height: 320,
                    bgcolor: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Materiales Mas Solicitados</Typography>
                    <Package sx={{ width: 20, height: 20, color: "primary.main" }} />
                  </Stack>
                  <Box sx={{ px: 2.5, pb: 2.5, overflow: "auto", height: "calc(100% - 60px)" }}>
                    <Stack spacing={1.5}>
                      {(kpiData.materialesMasSolicitados || []).length > 0 ? kpiData.materialesMasSolicitados.map((m, i) => {
                        const maxC = Math.max(...kpiData.materialesMasSolicitados.map(x => x.cantidad), 1);
                        return (
                          <Box key={i} sx={{ "&:hover .progress-bar": { bgcolor: "primary.dark" } }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                                <Box sx={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", bgcolor: "primary.main", opacity: 0.1, display: "grid", placeItems: "center" }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main" }}>{i + 1}</Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.nombre}>
                                  {m.nombre}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums", flexShrink: 0, ml: 1 }}>
                                {(m.cantidad || 0).toLocaleString()}
                              </Typography>
                            </Stack>
                            <Box sx={{ height: 10, bgcolor: "grey.100", borderRadius: 5, overflow: "hidden" }}>
                              <Box
                                className="progress-bar"
                                sx={{
                                  height: "100%",
                                  background: `linear-gradient(to right, ${SPM_COLORS.primary}, ${SPM_COLORS.primaryLight})`,
                                  borderRadius: 5,
                                  transition: "all 0.5s",
                                  width: `${(m.cantidad / maxC) * 100}%`,
                                }}
                              />
                            </Box>
                          </Box>
                        );
                      }) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                          No hay datos disponibles
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Paper
                  elevation={0}
                  sx={{
                    height: 320,
                    bgcolor: "rgba(255, 255, 255, 0.7)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Presupuesto por Centro</Typography>
                    <DollarSign sx={{ width: 20, height: 20, color: "success.main" }} />
                  </Stack>
                  <Box sx={{ px: 2.5, pb: 2.5, overflow: "auto", height: "calc(100% - 60px)" }}>
                    <Stack spacing={1.5}>
                      {(kpiData.presupuesto.porCentro || []).length > 0 ? kpiData.presupuesto.porCentro.map((c, i) => {
                        const maxV = Math.max(...kpiData.presupuesto.porCentro.map(x => x.valor), 1);
                        return (
                          <Box key={i} sx={{ "&:hover .progress-bar": { bgcolor: "success.dark" } }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={c.nombre}>
                                {c.nombre}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums", flexShrink: 0, ml: 1 }}>
                                {formatCurrency(c.valor)}
                              </Typography>
                            </Stack>
                            <Box sx={{ height: 10, bgcolor: "grey.100", borderRadius: 5, overflow: "hidden" }}>
                              <Box
                                className="progress-bar"
                                sx={{
                                  height: "100%",
                                  background: `linear-gradient(to right, ${SPM_COLORS.success}, ${SPM_COLORS.successLight})`,
                                  borderRadius: 5,
                                  transition: "all 0.5s",
                                  width: `${(c.valor / maxV) * 100}%`,
                                }}
                              />
                            </Box>
                          </Box>
                        );
                      }) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                          No hay datos disponibles
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <Paper
              elevation={0}
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>Resumen de Presupuesto</Typography>
              </Box>
              <Box sx={{ px: 3, pb: 3 }}>
                <Stack direction={{ xs: "column", md: "row" }} alignItems="center" justifyContent="space-between" spacing={4}>
                  <Box sx={{ flexShrink: 0 }}>
                    <ProgressCircle percentage={kpiData.presupuesto.percentage} />
                  </Box>
                  <Grid container spacing={3} sx={{ flex: 1 }}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1, display: "block" }}>
                          Presupuesto Total
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                          {formatCurrency(kpiData.presupuesto.total)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1, display: "block" }}>
                          Utilizado
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "warning.main" }}>
                          {formatCurrency(kpiData.presupuesto.utilizado)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1, display: "block" }}>
                          Disponible
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "success.main" }}>
                          {formatCurrency(kpiData.presupuesto.disponible)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Stack>
              </Box>
            </Paper>
          </ScrollReveal>
        </>
      )}
    </Stack>
  );
}
