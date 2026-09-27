/**
 * SpendAnalytics - Spend analytics dashboard with Kraljic matrix
 *
 * Shows spend breakdown by category, maverick spending, Kraljic matrix
 * for strategic sourcing, and monthly trend data.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import api from '../services/api';
import { formatCurrency, formatNumber } from '../utils/formatters';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import { MetricCard } from '../components/ui/MetricCard';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CategoryIcon from '@mui/icons-material/Category';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import KraljicMatrix from '../components/KraljicMatrix';

const CATEGORY_COLORS = [
  'var(--indigo)', 'var(--success)', 'var(--warning-light)', 'var(--danger-light)', 'var(--purple)',
  'var(--cyan)', 'var(--purple-light)', 'var(--accent)', 'var(--warning)', 'var(--neutral)',
];

export default function SpendAnalytics() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [categoryData, setCategoryData] = useState([]);
  const [maverickData, setMaverickData] = useState([]);
  const [kraljicData, setKraljicData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [catRes, mavRes, krajRes, trendRes] = await Promise.allSettled([
        api.get('/spend/by-category'),
        api.get('/spend/maverick'),
        api.get('/spend/kraljic'),
        api.get('/spend/trend'),
      ]);

      if (catRes.status === 'fulfilled' && catRes.value.data?.ok) {
        setCategoryData(catRes.value.data.categories || catRes.value.data.data || []);
      }
      if (mavRes.status === 'fulfilled' && mavRes.value.data?.ok) {
        setMaverickData(mavRes.value.data.maverick || mavRes.value.data.data || []);
      }
      if (krajRes.status === 'fulfilled' && krajRes.value.data?.ok) {
        setKraljicData(krajRes.value.data.kraljic || krajRes.value.data.data || []);
      }
      if (trendRes.status === 'fulfilled' && trendRes.value.data?.ok) {
        setTrendData(trendRes.value.data.trend || trendRes.value.data.data || []);
      }
      const allFailed = [catRes, mavRes, krajRes, trendRes].every(
        (r) => r.status !== 'fulfilled' || !r.value.data?.ok
      );
      setLoadError(allFailed);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Compute KPI values
  const kpis = useMemo(() => {
    const totalSpend = categoryData.reduce((sum, c) => sum + (Number(c.total) || Number(c.monto) || 0), 0);
    const maverickTotal = maverickData.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const maverickPct = totalSpend > 0 ? ((maverickTotal / totalSpend) * 100) : 0;
    const topCategory = categoryData.length > 0
      ? (categoryData[0].categoria || categoryData[0].nombre || '-')
      : '-';
    return { totalSpend, maverickPct, topCategory };
  }, [categoryData, maverickData]);

  // Compute max for category bar widths
  const maxCategoryValue = useMemo(() => {
    return Math.max(...categoryData.map(c => Number(c.total) || Number(c.monto) || 0), 1);
  }, [categoryData]);

  const trendColumnDefs = useMemo(() => [
    { field: 'periodo', headerName: t('spend_periodo', 'Período'), flex: 1, minWidth: 120 },
    {
      field: 'monto_total', headerName: t('spend_monto_total', 'Monto total'), width: 170, type: 'rightAligned',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'cantidad_ocs', headerName: t('spend_cant_ocs', 'Cant. OCs'), width: 120, type: 'rightAligned',
      valueFormatter: (p) => p.value != null ? formatNumber(p.value) : '-',
    },
    {
      field: 'proveedores_activos', headerName: t('spend_proveedores', 'Proveedores'), width: 130,
    },
    {
      field: 'variacion_pct', headerName: t('spend_variacion', 'Var. %'), width: 110,
      cellRenderer: (p) => {
        if (p.value == null) return '-';
        const val = Number(p.value);
        const color = val > 0 ? 'var(--danger-light)' : val < 0 ? 'var(--success-light)' : 'var(--fg-subtle)';
        const arrow = val > 0 ? '\u25B2' : val < 0 ? '\u25BC' : '\u2014';
        return <span style={{ color, fontWeight: 600 }}>{arrow} {formatNumber(Math.abs(val).toFixed(1))} %</span>;
      },
    },
  ], [t]);

  const maverickColumnDefs = useMemo(() => [
    { field: 'proveedor', headerName: t('spend_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    { field: 'categoria', headerName: t('spend_categoria', 'Categoría'), flex: 1, minWidth: 120 },
    {
      field: 'monto', headerName: t('spend_monto', 'Monto'), width: 160, type: 'rightAligned',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    { field: 'motivo', headerName: t('spend_motivo', 'Motivo'), flex: 2, minWidth: 160 },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasCategories = categoryData.length > 0;
  const sinDatos = t('common_sin_datos', 'Sin datos');

  if (loadError) {
    return (
      <PageLayout title={t('spend_title', 'Análisis de gasto')}>
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <EmptyState
            icon={<ErrorOutlineIcon sx={{ color: 'error.main' }} />}
            title={t('spend_error_load', 'Error al cargar datos de gasto')}
            description={t('common_error_reintentar', 'No pudimos cargar la información. Intenta nuevamente en unos minutos.')}
            action={t('common_reintentar', 'Reintentar')}
            onAction={fetchAll}
          />
        </Paper>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('spend_title', 'Análisis de gasto')}>
      {/* KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <MetricCard
          size="lg"
          icon={PaymentsIcon}
          label={t('spend_kpi_total', 'Gasto total')}
          value={hasCategories ? formatCurrency(kpis.totalSpend) : sinDatos}
        />
        <MetricCard
          size="lg"
          icon={ReportProblemIcon}
          variant={!hasCategories ? 'default' : kpis.maverickPct > 10 ? 'danger' : 'success'}
          label={t('spend_kpi_maverick', '% gasto fuera de contrato')}
          value={hasCategories ? `${formatNumber(kpis.maverickPct.toFixed(1))} %` : sinDatos}
        />
        <MetricCard
          size="lg"
          icon={CategoryIcon}
          label={t('spend_kpi_top_cat', 'Categoría principal')}
          value={hasCategories ? kpis.topCategory : sinDatos}
        />
      </Box>

      {/* Spend by Category -- simple bar visualization */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          {t('spend_by_category', 'Gasto por categoría')}
        </Typography>
        {categoryData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {t('spend_no_categories', 'Sin datos de categorías')}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {categoryData.map((cat, idx) => {
              const value = Number(cat.total) || Number(cat.monto) || 0;
              const pct = maxCategoryValue > 0 ? (value / maxCategoryValue) * 100 : 0;
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              return (
                <Box key={cat.categoria || cat.nombre || idx}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {cat.categoria || cat.nombre}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(value)}
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 8, bgcolor: 'grey.200', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${Math.min(pct, 100)}%`,
                        bgcolor: color,
                        transition: 'width 0.5s',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* Kraljic Matrix */}
      {kraljicData.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {t('spend_kraljic_title', 'Matriz de Kraljic')}
          </Typography>
          <KraljicMatrix data={kraljicData} />
        </Paper>
      )}

      {/* Monthly Spend Trend */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('spend_trend_title', 'Tendencia mensual de gasto')}
          </Typography>
        </Box>
        <SPMAgGrid
          columnDefs={trendColumnDefs}
          rowData={trendData}
          loading={false}
          height={350}
          pagination={true}
          paginationPageSize={12}
          enableQuickFilter={false}
          exportFileName="tendencia_gasto"
          emptyMessage={t('spend_trend_empty', 'Sin datos de tendencia')}
          getRowId={(params) => String(params.data.periodo || params.data.id)}
        />
      </Paper>

      {/* Maverick Spend */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <WarningAmberIcon sx={{ color: 'warning.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('spend_maverick_title', 'Gasto fuera de contrato')}
            </Typography>
            {maverickData.length > 0 && (
              <Chip size="small" label={maverickData.length} color="warning" />
            )}
          </Stack>
        </Box>
        <SPMAgGrid
          columnDefs={maverickColumnDefs}
          rowData={maverickData}
          loading={false}
          height={350}
          pagination={true}
          paginationPageSize={15}
          enableQuickFilter={true}
          exportFileName="gasto_maverick"
          emptyMessage={t('spend_maverick_empty', 'Sin gasto fuera de contrato detectado')}
          getRowId={(params) => String(params.data.id || params.data.proveedor)}
        />
      </Paper>
    </PageLayout>
  );
}
