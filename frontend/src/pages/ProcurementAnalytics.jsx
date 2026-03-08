/**
 * ProcurementAnalytics - Analytics de Impacto de Procurement
 * Dashboard consolidado mostrando el impacto del modulo en produccion
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { procurementService } from '../services/procurement';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import BusinessIcon from '@mui/icons-material/Business';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DescriptionIcon from '@mui/icons-material/Description';

// Color mapping for MetricCard
const colorMap = {
  blue: { bg: 'primary.light', icon: 'primary.main', border: 'primary.main' },
  green: { bg: 'success.light', icon: 'success.main', border: 'success.main' },
  purple: { bg: 'secondary.light', icon: 'secondary.main', border: 'secondary.main' },
  orange: { bg: 'warning.light', icon: 'warning.main', border: 'warning.main' }
};

// Componente Card con indicador de valor
const MetricCard = ({ title, value, subtitle, icon: Icon, color = 'blue' }) => {
  const colors = colorMap[color] || colorMap.blue;

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2.5,
        borderLeft: 4,
        borderColor: colors.border
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {title}
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="text.primary" sx={{ mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            p: 1,
            bgcolor: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon sx={{ fontSize: 20, color: colors.icon }} />
        </Box>
      </Stack>
    </Paper>
  );
};

// Pipeline visual con embudo
const PipelineViz = ({ data }) => {
  if (!data || data.length === 0) return null;

  const colors = ['primary.main', 'primary.light', 'info.main', 'info.light'];

  return (
    <Stack spacing={1.5}>
      {data.map((item, idx) => (
        <Stack key={idx} direction="row" alignItems="center" spacing={1.5}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ width: 112, textAlign: 'right' }}
          >
            {item.etapa}
          </Typography>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <Box
              sx={{
                height: 32,
                bgcolor: 'grey.100',
                borderRadius: 3,
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  bgcolor: colors[idx] || 'primary.main',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  pr: 1.5,
                  width: `${Math.max(item.porcentaje, 5)}%`
                }}
              >
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>
                  {item.porcentaje}%
                </Typography>
              </Box>
            </Box>
          </Box>
          <Typography
            variant="body2"
            fontWeight={600}
            color="text.primary"
            sx={{ width: 80, textAlign: 'right' }}
          >
            {item.cantidad?.toLocaleString()}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

// OTIF Gauge mejorado
const OTIFGaugeCard = ({ data }) => {
  const objetivo = data?.objetivo_otif || 85;
  const actual = data?.pct_otif || 0;
  const aTiempo = data?.pct_a_tiempo || 0;
  const completas = data?.pct_completas || 0;

  const getColor = (val) => {
    if (val >= 85) return 'success.main';
    if (val >= 70) return 'warning.main';
    return 'error.main';
  };

  const getStrokeColor = (val) => {
    if (val >= 85) return 'var(--success)';
    if (val >= 70) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          Cumplimiento OTIF
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <GpsFixedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            Objetivo: {objetivo}%
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box sx={{ position: 'relative', width: 144, height: 144 }}>
          <svg
            style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
            viewBox="0 0 36 36"
          >
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--border)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={getStrokeColor(actual)}
              strokeWidth="3"
              strokeDasharray={`${actual}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="h4" fontWeight="bold" sx={{ color: getColor(actual) }}>
              {actual}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              OTIF
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mt: 3 }}>
        <Grid item xs={6}>
          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'grey.50' }}>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ color: aTiempo >= 70 ? 'success.main' : 'warning.main' }}
            >
              {aTiempo}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              A Tiempo
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'grey.50' }}>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ color: completas >= 90 ? 'success.main' : 'warning.main' }}
            >
              {completas}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Completas
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

// Tabla de proveedores migrada a SPMAgGrid
const ProveedoresTable = ({ data, columns }) => {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((row, idx) => ({ ...row, id: idx }));
  }, [data]);

  const columnDefs = useMemo(() => {
    return columns.map((col) => ({
      field: col.key,
      headerName: col.header,
      flex: 1,
      minWidth: 120,
      cellRenderer: col.render
        ? (params) => col.render(params.value, params.data)
        : undefined,
    }));
  }, [columns]);

  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        {t("common_no_data", "No hay datos disponibles")}
      </Typography>
    );
  }

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={300}
      pagination={false}
      enableQuickFilter={true}
      exportFileName="procurement_analytics"
      emptyMessage={t("common_no_data", "Sin datos")}
    />
  );
};

// Centro distribution
const CentrosChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const maxSolpeds = Math.max(...data.map(d => d.total_solpeds || 0));

  return (
    <Stack spacing={1.5}>
      {data.map((centro, idx) => (
        <Stack key={idx} direction="row" alignItems="center" spacing={1.5}>
          <Typography
            variant="body2"
            fontWeight={500}
            color="text.secondary"
            sx={{ width: 64 }}
          >
            {centro.centro}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ height: 24, bgcolor: 'grey.100', overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  bgcolor: 'secondary.main',
                  width: `${(centro.total_solpeds / maxSolpeds) * 100}%`
                }}
              />
            </Box>
          </Box>
          <Box sx={{ width: 96, textAlign: 'right' }}>
            <Typography component="span" variant="body2" fontWeight={600} color="text.primary">
              {centro.total_solpeds}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              solpeds
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

// Componente principal
export default function ProcurementAnalytics() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await procurementService.getAnalytics();
      setAnalytics(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar analytics de procurement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !analytics) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Cargando analytics...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: 'grey.50', minHeight: '100vh' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" fontWeight="bold" color="text.primary">
              {t('procurement_analytics', 'Analítica de Compras SAP')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Impacto del módulo de compras en producción
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={2}>
            {lastUpdated && (
              <Typography variant="caption" color="text.disabled">
                Actualizado: {lastUpdated.toLocaleTimeString('es-AR')}
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={fetchData}
              disabled={loading}
              startIcon={
                <RefreshIcon
                  sx={{
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' }
                    }
                  }}
                />
              }
            >
              Actualizar
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" icon={<WarningAmberIcon />}>
            {error}
          </Alert>
        )}

        {analytics && (
          <>
            {/* Metricas principales */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6} lg={3}>
                <MetricCard
                  title="Total SOLPEDs"
                  value={analytics.volumenes?.solpeds?.toLocaleString() || 0}
                  subtitle={`${analytics.volumenes?.materiales || 0} materiales únicos`}
                  icon={InventoryIcon}
                  color="blue"
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <MetricCard
                  title="Órdenes de Compra"
                  value={analytics.volumenes?.orders?.toLocaleString() || 0}
                  subtitle={`${analytics.volumenes?.recibidos || 0} recibidos`}
                  icon={LocalShippingIcon}
                  color="green"
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <MetricCard
                  title="Proveedores"
                  value={analytics.volumenes?.proveedores || 0}
                  subtitle={`${analytics.cumplimiento?.proveedores_evaluados || 0} evaluados`}
                  icon={PeopleIcon}
                  color="purple"
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <MetricCard
                  title="Tiempo de Entrega Promedio"
                  value={`${analytics.lead_times?.promedio || 0} días`}
                  subtitle={`Mín: ${analytics.lead_times?.minimo || 0}d | Máx: ${analytics.lead_times?.maximo || 0}d`}
                  icon={AccessTimeIcon}
                  color="orange"
                />
              </Grid>
            </Grid>

            {/* Segunda fila: Pipeline + OTIF */}
            <Grid container spacing={3}>
              {/* Pipeline */}
              <Grid item xs={12} lg={8}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <TrendingUpIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      Embudo de Conversión
                    </Typography>
                  </Stack>
                  <PipelineViz data={analytics.pipeline} />
                </Paper>
              </Grid>

              {/* OTIF Gauge */}
              <Grid item xs={12} lg={4}>
                <OTIFGaugeCard data={analytics.cumplimiento} />
              </Grid>
            </Grid>

            {/* Tercera fila: Top Proveedores + Mas Rapidos */}
            <Grid container spacing={3}>
              {/* Top por volumen */}
              <Grid item xs={12} lg={6}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <PeopleIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      Top Proveedores por Volumen
                    </Typography>
                  </Stack>
                  <ProveedoresTable
                    data={analytics.top_proveedores_volumen}
                    columns={[
                      { key: 'proveedor_nombre', header: 'Proveedor', render: (v) => v || 'Sin nombre' },
                      { key: 'total_pedidos', header: 'Pedidos', align: 'right' },
                      { key: 'pct_completas', header: '% Completas', align: 'right', render: (v) => `${v || 0}%` }
                    ]}
                  />
                </Paper>
              </Grid>

              {/* Mas rapidos */}
              <Grid item xs={12} lg={6}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <AccessTimeIcon sx={{ color: 'success.main' }} />
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      Proveedores Más Rápidos
                    </Typography>
                  </Stack>
                  <ProveedoresTable
                    data={analytics.proveedores_mas_rapidos}
                    columns={[
                      { key: 'proveedor_nombre', header: 'Proveedor', render: (v) => v || 'Sin nombre' },
                      { key: 'entregas', header: 'Entregas', align: 'right' },
                      { key: 'lead_time_promedio', header: 'Tiempo Entrega', align: 'right', render: (v) => `${v || 0} días` }
                    ]}
                  />
                </Paper>
              </Grid>
            </Grid>

            {/* Cuarta fila: Centros + Info importacion */}
            <Grid container spacing={3}>
              {/* Distribucion por centro */}
              <Grid item xs={12} lg={8}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <BusinessIcon sx={{ color: 'secondary.main' }} />
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      Distribución por Centro
                    </Typography>
                  </Stack>
                  <CentrosChart data={analytics.distribucion_centros} />
                </Paper>
              </Grid>

              {/* Info de importacion */}
              <Grid item xs={12} lg={4}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <DescriptionIcon sx={{ color: 'text.secondary' }} />
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      Importaciones
                    </Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Total importaciones
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {analytics.importaciones?.total || 0}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Registros insertados
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {analytics.importaciones?.registros_insertados?.toLocaleString() || 0}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Errores
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          color: analytics.importaciones?.errores > 0 ? 'error.main' : 'success.main'
                        }}
                      >
                        {analytics.importaciones?.errores || 0}
                      </Typography>
                    </Stack>
                    {analytics.importaciones?.ultima && (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ py: 1 }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Última importación
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(analytics.importaciones.ultima).toLocaleDateString('es-AR')}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            {/* Resumen de valor */}
            {analytics.volumenes?.valor_total > 0 && (
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  background: 'linear-gradient(to right, var(--primary), var(--info))',
                  color: 'white'
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Valor Total de Órdenes
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                      ${analytics.volumenes.valor_total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      Centros activos
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                      {analytics.volumenes?.centros || 0}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
