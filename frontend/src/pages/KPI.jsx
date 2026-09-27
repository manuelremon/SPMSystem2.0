import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Grid,
  Divider,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Description as FileTextIcon,
  CheckCircle as CheckCircle2Icon,
  Cancel as XCircleIcon,
  AccessTime as ClockIcon,
  AttachMoney as DollarSignIcon,
  Inventory as PackageIcon,
  BarChart as BarChart3Icon,
} from "@mui/icons-material";
import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatCurrency, formatNumber } from "../utils/formatters";
import api from "../services/api";
import { SPMLine, SPMDoughnut, SPM_COLORS } from "../components/ui/SPMChartJS";

// Chart.js dibuja en canvas y no resuelve var(--...) ni color-mix: usar hex resueltos.
// Se lee la variable CSS en tiempo de ejecucion y, si no existe, la paleta hex del tema.
function resolveCssColor(varName, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function withAlpha(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const MUI_COLORS = {
  primary: 'var(--primary)',
};

// Componente de mini grafico de barras (mantenemos SVG por simplicidad)
function MiniBarChart({ data, maxValue, color = "blue" }) {
  const colorMap = {
    blue: { from: 'var(--primary)', to: 'var(--primary-light)' },
    emerald: { from: 'var(--success)', to: 'var(--success-light)' },
    red: { from: 'var(--danger)', to: 'var(--danger-light)' },
    amber: { from: 'var(--warning)', to: 'var(--warning-light)' },
  };

  const safeData = data && data.length > 0 ? data : [0];
  const safeMaxValue = maxValue > 0 ? maxValue : 1;
  const colors = colorMap[color] || colorMap.blue;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 40, overflow: 'hidden' }}>
      {safeData.map((value, idx) => {
        const height = Math.min((value / safeMaxValue) * 100, 100);
        return (
          <Box
            key={idx}
            sx={{
              flex: 1,
              minWidth: '4px',
              background: `linear-gradient(to top, ${colors.from}, ${colors.to})`,
              borderRadius: '2px 2px 0 0',
              transition: 'all 0.3s',
              height: `${Math.max(height, 2)}%`,
              '&:hover': {
                filter: 'brightness(1.1)',
              },
            }}
            title={String(value)}
          />
        );
      })}
    </Box>
  );
}

// Componente de circulo de progreso
function ProgressCircle({ percentage, color = MUI_COLORS.primary }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', width: 96, height: 96 }}>
      <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
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
          style={{ transition: 'all 0.5s' }}
        />
      </svg>
      <Box sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Typography variant="h5" fontWeight="bold" color="text.primary">
          {percentage}%
        </Typography>
      </Box>
    </Box>
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
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <PageLayout title={t("kpi_titulo", "Indicadores")}>
        <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
          <EmptyState
            title={t("kpi_error_carga", "No se pudieron cargar los indicadores")}
            description={t("kpi_error_carga_desc", "Intenta nuevamente en unos minutos.")}
          />
        </Paper>
      </PageLayout>
    );
  }

  // Preparar datos para el grafico de tendencia (SPMLine)
  const chartColors = {
    primary: resolveCssColor('--primary', SPM_COLORS.primary),
    success: resolveCssColor('--success', SPM_COLORS.success),
    danger: resolveCssColor('--danger', SPM_COLORS.error),
    warning: resolveCssColor('--warning', SPM_COLORS.warning),
  };
  const trendLabels = [
    t("common_dia_lun", "Lun"),
    t("common_dia_mar", "Mar"),
    t("common_dia_mie", "Mié"),
    t("common_dia_jue", "Jue"),
    t("common_dia_vie", "Vie"),
    t("common_dia_sab", "Sáb"),
    t("common_dia_dom", "Dom"),
  ];
  const trendDatasets = [{
    label: t("kpi_solicitudes", "Solicitudes"),
    data: kpiData.solicitudes.trend,
    fill: true,
    borderColor: chartColors.primary,
    pointBackgroundColor: chartColors.primary,
    backgroundColor: withAlpha(chartColors.primary, 0.12),
  }];

  // Preparar datos para el Donut de estados (SPMDoughnut)
  const donutData = [
    { label: t("kpi_aprobadas", "Aprobadas"), value: kpiData.solicitudes.aprobadas, color: chartColors.success },
    { label: t("kpi_rechazadas", "Rechazadas"), value: kpiData.solicitudes.rechazadas, color: chartColors.danger },
    { label: t("kpi_pendientes", "Pendientes"), value: kpiData.solicitudes.pendientes, color: chartColors.warning },
  ];

  const totalSolicitudes = kpiData.solicitudes.aprobadas + kpiData.solicitudes.rechazadas + kpiData.solicitudes.pendientes;

  return (
    <PageLayout title={t("kpi_titulo", "Indicadores")}>

      {/* Metricas principales - altura uniforme con iconos mejorados */}
      <ScrollReveal delay={100}>
        <Grid container spacing={2}>
          {/* Total Solicitudes - Azul (Neutro/Info) */}
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <Paper
              elevation={0}
              sx={{
                height: 150,
                p: 2.5,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                      {t("kpi_total_solicitudes", "Total de solicitudes")}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="text.primary">
                      {kpiData.solicitudes.total}
                    </Typography>
                  </Box>
                  <Box sx={{
                    height: 48,
                    width: 48,
                    borderRadius: 3,
                    bgcolor: 'var(--primary-muted)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}>
                    <FileTextIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {kpiData.solicitudes.trendPercentage >= 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                      <TrendingUpIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2" fontWeight={600}>+{formatNumber(kpiData.solicitudes.trendPercentage)}%</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                      <TrendingDownIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2" fontWeight={600}>{formatNumber(kpiData.solicitudes.trendPercentage)}%</Typography>
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary">{t("kpi_vs_mes_anterior", "vs. mes anterior")}</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Tasa de Aprobacion - Color semantico segun valor */}
          {(() => {
            const tasaAprobacion = kpiData.solicitudes.total > 0
              ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100)
              : 0;
            const isGood = tasaAprobacion >= 70;
            const isWarning = tasaAprobacion >= 40 && tasaAprobacion < 70;

            const bgColor = isGood ? 'var(--success-bg)' : isWarning ? 'var(--warning-bg)' : 'var(--danger-bg)';
            const iconColor = isGood ? 'success.main' : isWarning ? 'warning.main' : 'error.main';
            const textColor = isGood ? 'success.main' : isWarning ? 'warning.main' : 'error.main';
            const IconComponent = isGood ? CheckCircle2Icon : isWarning ? ClockIcon : XCircleIcon;

            return (
              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    height: 150,
                    p: 2.5,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                          {t("kpi_tasa_aprobacion", "Tasa de aprobación")}
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: textColor }}>
                          {tasaAprobacion}%
                        </Typography>
                      </Box>
                      <Box sx={{
                        height: 48,
                        width: 48,
                        borderRadius: 3,
                        bgcolor: bgColor,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}>
                        <IconComponent sx={{ fontSize: 24, color: iconColor }} />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {formatNumber(kpiData.solicitudes.aprobadas)} {t("kpi_aprobadas_de", "aprobadas de")} {formatNumber(kpiData.solicitudes.total)}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            );
          })()}

          {/* Tiempo Promedio - Color semantico segun meta */}
          {(() => {
            const promedio = kpiData.tiempoAprobacion.promedio;
            const meta = kpiData.tiempoAprobacion.meta;
            const isGood = promedio <= meta;
            const isWarning = promedio > meta && promedio <= meta * 1.5;

            const bgColor = isGood ? 'var(--success-bg)' : isWarning ? 'var(--warning-bg)' : 'var(--danger-bg)';
            const iconColor = isGood ? 'success.main' : isWarning ? 'warning.main' : 'error.main';
            const valueColor = isGood ? 'success.main' : isWarning ? 'warning.main' : 'error.main';

            return (
              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    height: 150,
                    p: 2.5,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                          {t("kpi_tiempo_promedio", "Tiempo promedio")}
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: valueColor }}>
                          {formatNumber(promedio)} {t("kpi_dias", "días")}
                        </Typography>
                      </Box>
                      <Box sx={{
                        height: 48,
                        width: 48,
                        borderRadius: 3,
                        bgcolor: bgColor,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}>
                        <ClockIcon sx={{ fontSize: 24, color: iconColor }} />
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isGood ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                          <TrendingDownIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>{t("kpi_bajo_meta", "Bajo la meta")}</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                          <TrendingUpIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>{t("kpi_sobre_meta", "Sobre la meta")}</Typography>
                        </Box>
                      )}
                      <Typography variant="body2" color="text.secondary">{t("kpi_meta", "Meta")}: {formatNumber(meta)} {t("kpi_dias", "días")}</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })()}

          {/* Presupuesto Utilizado - Color semantico segun uso */}
          {(() => {
            const percentage = kpiData.presupuesto.percentage;
            const isGood = percentage < 70;
            const isWarning = percentage >= 70 && percentage <= 90;

            const bgColor = isGood ? 'var(--success-bg)' : isWarning ? 'var(--warning-bg)' : 'var(--danger-bg)';
            const iconColor = isGood ? 'success.main' : isWarning ? 'warning.main' : 'error.main';
            const textColor = isGood ? 'success.main' : isWarning ? 'warning.main' : 'error.main';

            return (
              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    height: 150,
                    p: 2.5,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                          {t("kpi_presupuesto", "Presupuesto")}
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                          {formatCurrency(kpiData.presupuesto.utilizado)}
                        </Typography>
                      </Box>
                      <Box sx={{
                        height: 48,
                        width: 48,
                        borderRadius: 3,
                        bgcolor: bgColor,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}>
                        <DollarSignIcon sx={{ fontSize: 24, color: iconColor }} />
                      </Box>
                    </Box>
                    <Typography variant="body2">
                      <Typography component="span" variant="body2" fontWeight={600} sx={{ color: textColor }}>
                        {formatNumber(percentage)}%
                      </Typography>
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}{t("kpi_de", "de")} {formatCurrency(kpiData.presupuesto.total)}
                      </Typography>
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            );
          })()}
        </Grid>
      </ScrollReveal>

      {/* Fila 1: Tendencia (60%) + Distribucion de Estados Donut (40%) */}
      <ScrollReveal delay={200}>
        <Grid container spacing={3}>
          {/* Tendencia de Solicitudes - 60% - Usando SPMLine */}
          <Grid size={{ xs: 12, lg: 7.2 }}>
            <Paper
              elevation={0}
              sx={{
                height: 280,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>{t("kpi_tendencia_solicitudes", "Tendencia de solicitudes")}</Typography>
                <BarChart3Icon sx={{ fontSize: 20, color: 'var(--danger)' }} />
              </Box>
              <Box sx={{ px: 3, pb: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'calc(100% - 60px)' }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <SPMLine
                    labels={trendLabels}
                    datasets={trendDatasets}
                    height={120}
                    options={{
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        x: {
                          grid: { display: false },
                        },
                        y: {
                          beginAtZero: true,
                          grid: { color: withAlpha(SPM_COLORS.grey, 0.12) },
                        },
                      },
                    }}
                  />
                </Box>
                <Divider sx={{ mt: 1.5 }} />
                <Box sx={{ pt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t("kpi_promedio_semanal", "Promedio semanal")}</Typography>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    {formatNumber(Math.round(kpiData.solicitudes.trend.reduce((a, b) => a + b, 0) / Math.max(kpiData.solicitudes.trend.length, 1)))} {t("kpi_solicitudes_min", "solicitudes")}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Distribucion de Estados - Donut Chart 40% - Usando SPMDoughnut */}
          <Grid size={{ xs: 12, lg: 4.8 }}>
            <Paper
              elevation={0}
              sx={{
                minHeight: 280,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>{t("kpi_distribucion_estados", "Distribución de estados")}</Typography>
                <BarChart3Icon sx={{ fontSize: 20, color: 'var(--danger)' }} />
              </Box>
              <Box sx={{ px: 3, pb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(280px - 60px)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <Box sx={{ width: 150, height: 150, flexShrink: 0 }}>
                    <SPMDoughnut
                      data={donutData}
                      height={150}
                      centerText={formatNumber(totalSolicitudes)}
                      options={{
                        plugins: {
                          legend: { display: false },
                        },
                      }}
                    />
                  </Box>
                  {/* Leyenda personalizada */}
                  <Stack spacing={1.5}>
                    {donutData.map((item, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            flexShrink: 0,
                            backgroundColor: item.color,
                          }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                          <Typography variant="body2" fontWeight="600" color="text.primary">{formatNumber(item.value)}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            ({totalSolicitudes > 0 ? Math.round((item.value / totalSolicitudes) * 100) : 0}%)
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </ScrollReveal>

      {/* Fila 2: Materiales | Presupuesto por Centro (50% cada uno) */}
      <ScrollReveal delay={250}>
        <Grid container spacing={3}>
          {/* Materiales Mas Solicitados */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper
              elevation={0}
              sx={{
                height: 320,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>{t("kpi_materiales_mas_solicitados", "Materiales más solicitados")}</Typography>
                <PackageIcon sx={{ fontSize: 20, color: 'var(--info)' }} />
              </Box>
              <Box sx={{ px: 2.5, pb: 2.5, overflow: 'auto', height: 'calc(100% - 60px)' }}>
                <Stack spacing={1.5}>
                  {(kpiData.materialesMasSolicitados || []).length > 0 ? (
                    kpiData.materialesMasSolicitados.map((material, idx) => {
                      const maxCantidad = Math.max(...kpiData.materialesMasSolicitados.map(m => m.cantidad), 1);
                      const percentage = (material.cantidad / maxCantidad) * 100;
                      return (
                        <Box key={idx} sx={{ '&:hover .progress-bar': { filter: 'brightness(1.1)' } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                              <Box sx={{
                                flexShrink: 0,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                bgcolor: 'var(--primary-muted)',
                                display: 'grid',
                                placeItems: 'center',
                              }}>
                                <Typography variant="caption" fontWeight="bold" color="primary">
                                  {idx + 1}
                                </Typography>
                              </Box>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color="text.primary"
                                title={material.nombre}
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {material.nombre}
                              </Typography>
                            </Box>
                            <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, ml: 1 }}>
                              {formatNumber(material.cantidad || 0)}
                            </Typography>
                          </Box>
                          <Box sx={{
                            height: 10,
                            bgcolor: 'color-mix(in srgb, var(--bg-soft) 70%, transparent)',
                            backdropFilter: 'blur(4px)',
                            borderRadius: 5,
                            overflow: 'hidden',
                          }}>
                            <Box
                              className="progress-bar"
                              sx={{
                                height: '100%',
                                width: `${percentage}%`,
                                background: 'linear-gradient(to right, var(--primary), var(--primary-light))',
                                borderRadius: 5,
                                transition: 'all 0.5s',
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      {t("common_sin_datos", "No hay datos disponibles")}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Paper>
          </Grid>

          {/* Presupuesto por Centro */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper
              elevation={0}
              sx={{
                height: 320,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>{t("kpi_presupuesto_por_centro", "Presupuesto por centro")}</Typography>
                <DollarSignIcon sx={{ fontSize: 20, color: 'var(--warning)' }} />
              </Box>
              <Box sx={{ px: 2.5, pb: 2.5, overflow: 'auto', height: 'calc(100% - 60px)' }}>
                <Stack spacing={1.5}>
                  {(kpiData.presupuesto.porCentro || []).length > 0 ? (
                    kpiData.presupuesto.porCentro.map((centro, idx) => {
                      const maxValor = Math.max(...kpiData.presupuesto.porCentro.map(c => c.valor), 1);
                      const percentage = (centro.valor / maxValor) * 100;
                      return (
                        <Box key={idx} sx={{ '&:hover .progress-bar': { filter: 'brightness(1.1)' } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color="text.primary"
                              title={centro.nombre}
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                            >
                              {centro.nombre}
                            </Typography>
                            <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, ml: 1 }}>
                              {formatCurrency(centro.valor)}
                            </Typography>
                          </Box>
                          <Box sx={{
                            height: 10,
                            bgcolor: 'color-mix(in srgb, var(--bg-soft) 70%, transparent)',
                            backdropFilter: 'blur(4px)',
                            borderRadius: 5,
                            overflow: 'hidden',
                          }}>
                            <Box
                              className="progress-bar"
                              sx={{
                                height: '100%',
                                width: `${percentage}%`,
                                background: 'linear-gradient(to right, var(--success), var(--success-light))',
                                borderRadius: 5,
                                transition: 'all 0.5s',
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      {t("common_sin_datos", "No hay datos disponibles")}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </ScrollReveal>

      {/* Card de Progreso de Presupuesto */}
      <ScrollReveal delay={300}>
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ px: 3, pt: 3, pb: 2 }}>
            <Typography variant="h6" fontWeight={600}>{t("kpi_resumen_presupuesto", "Resumen de presupuesto")}</Typography>
          </Box>
          <Box sx={{ px: 3, pb: 3 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
            }}>
              <Box sx={{ flexShrink: 0 }}>
                <ProgressCircle percentage={kpiData.presupuesto.percentage} />
              </Box>
              <Grid container spacing={3} sx={{ flex: 1, width: '100%' }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                      {t("kpi_presupuesto_total", "Presupuesto total")}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="text.primary">
                      {formatCurrency(kpiData.presupuesto.total)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                      {t("kpi_utilizado", "Utilizado")}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {formatCurrency(kpiData.presupuesto.utilizado)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                      {t("kpi_disponible", "Disponible")}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {formatCurrency(kpiData.presupuesto.disponible)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Paper>
      </ScrollReveal>
    </PageLayout>
  );
}
