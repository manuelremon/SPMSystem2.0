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
import { PageHeader } from "../components/ui/PageHeader";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import api from "../services/api";
import { SPMLine, SPMDoughnut, SPM_COLORS } from "../components/ui/SPMChartJS";

// CSS Variable Colors (computed at render time)
const MUI_COLORS = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
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
        setError("Error al cargar los KPIs");
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Preparar datos para el grafico de tendencia (SPMLine)
  const trendLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const trendDatasets = [{
    label: 'Solicitudes',
    data: kpiData.solicitudes.trend,
    fill: true,
    borderColor: MUI_COLORS.primary,
    backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
  }];

  // Preparar datos para el Donut de estados (SPMDoughnut)
  const donutData = [
    { label: 'Aprobadas', value: kpiData.solicitudes.aprobadas, color: MUI_COLORS.success },
    { label: 'Rechazadas', value: kpiData.solicitudes.rechazadas, color: MUI_COLORS.danger },
    { label: 'Pendientes', value: kpiData.solicitudes.pendientes, color: MUI_COLORS.warning },
  ];

  const totalSolicitudes = kpiData.solicitudes.aprobadas + kpiData.solicitudes.rechazadas + kpiData.solicitudes.pendientes;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ScrollReveal>
        <PageHeader
          title="KPI's"
          breadcrumbs={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "KPI's" }
          ]}
        />
      </ScrollReveal>

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
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                      Total Solicitudes
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
                      <Typography variant="body2" fontWeight={600}>+{kpiData.solicitudes.trendPercentage}%</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                      <TrendingDownIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2" fontWeight={600}>{kpiData.solicitudes.trendPercentage}%</Typography>
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary">vs mes anterior</Typography>
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
                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                          Tasa de Aprobacion
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
                      {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
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
                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                          Tiempo Promedio
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: valueColor }}>
                          {promedio} dias
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
                          <Typography variant="body2" fontWeight={600}>Bajo meta</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                          <TrendingUpIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>Sobre meta</Typography>
                        </Box>
                      )}
                      <Typography variant="body2" color="text.secondary">Meta: {meta} dias</Typography>
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
                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                          Presupuesto
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
                        {percentage}%
                      </Typography>
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}de {formatCurrency(kpiData.presupuesto.total)}
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
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Tendencia de Solicitudes</Typography>
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
                          grid: { color: 'rgba(0,0,0,0.05)' },
                        },
                      },
                    }}
                  />
                </Box>
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.2)', mt: 1.5 }} />
                <Box sx={{ pt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Promedio semanal</Typography>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    {Math.round(kpiData.solicitudes.trend.reduce((a, b) => a + b, 0) / Math.max(kpiData.solicitudes.trend.length, 1))} solicitudes
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
                height: 280,
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Distribucion de Estados</Typography>
                <BarChart3Icon sx={{ fontSize: 20, color: 'var(--danger)' }} />
              </Box>
              <Box sx={{ px: 3, pb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 60px)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box sx={{ width: 150, height: 150 }}>
                    <SPMDoughnut
                      data={donutData}
                      height={150}
                      centerText={totalSolicitudes}
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
                          <Typography variant="body2" fontWeight="600" color="text.primary">{item.value}</Typography>
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
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Materiales Mas Solicitados</Typography>
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
                              {(material.cantidad || 0).toLocaleString()}
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
                      No hay datos disponibles
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
                bgcolor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Presupuesto por Centro</Typography>
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
                      No hay datos disponibles
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
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <Box sx={{ px: 3, pt: 3, pb: 2 }}>
            <Typography variant="h6" fontWeight={600}>Resumen de Presupuesto</Typography>
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
                      Presupuesto Total
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="text.primary">
                      {formatCurrency(kpiData.presupuesto.total)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                      Utilizado
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {formatCurrency(kpiData.presupuesto.utilizado)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                      Disponible
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
    </Box>
    </Box>
  );
}
