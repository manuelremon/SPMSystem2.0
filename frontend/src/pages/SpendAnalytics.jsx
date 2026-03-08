/**
 * SpendAnalytics - Spend analytics dashboard with Kraljic matrix
 *
 * Shows spend breakdown by category, maverick spending, Kraljic matrix
 * for strategic sourcing, and monthly trend data.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import KraljicMatrix from '../components/KraljicMatrix';

const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
];

export default function SpendAnalytics() {
  const { t } = useI18n();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState([]);
  const [maverickData, setMaverickData] = useState([]);
  const [kraljicData, setKraljicData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
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
    } catch {
      toast.error(t('spend_error_load', 'Error al cargar datos de gasto'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

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
    { field: 'periodo', headerName: t('spend_periodo', 'Periodo'), flex: 1, minWidth: 120 },
    {
      field: 'monto_total', headerName: t('spend_monto', 'Monto Total'), width: 160,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'cantidad_ocs', headerName: t('spend_cant_ocs', 'Cant. OCs'), width: 120,
      valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString('es-ES') : '-',
    },
    {
      field: 'proveedores_activos', headerName: t('spend_proveedores', 'Proveedores'), width: 130,
    },
    {
      field: 'variacion_pct', headerName: t('spend_variacion', 'Var. %'), width: 110,
      cellRenderer: (p) => {
        if (p.value == null) return '-';
        const val = Number(p.value);
        const color = val > 0 ? '#ef4444' : val < 0 ? '#10b981' : '#9ca3af';
        const arrow = val > 0 ? '\u25B2' : val < 0 ? '\u25BC' : '\u2014';
        return <span style={{ color, fontWeight: 600 }}>{arrow} {Math.abs(val).toFixed(1)}%</span>;
      },
    },
  ], [t]);

  const maverickColumnDefs = useMemo(() => [
    { field: 'proveedor', headerName: t('spend_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    { field: 'categoria', headerName: t('spend_categoria', 'Categoria'), flex: 1, minWidth: 120 },
    {
      field: 'monto', headerName: t('spend_monto', 'Monto'), width: 150,
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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <AnalyticsIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('spend_title', 'Analisis de Gasto')}
        </Typography>
      </Stack>

      {/* KPI Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('spend_kpi_total', 'Gasto Total')}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
            {formatCurrency(kpis.totalSpend)}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('spend_kpi_maverick', '% Gasto Maverick')}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: kpis.maverickPct > 10 ? 'error.main' : 'success.main', mt: 0.5 }}>
            {kpis.maverickPct.toFixed(1)}%
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('spend_kpi_top_cat', 'Top Categoria')}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
            {kpis.topCategory}
          </Typography>
        </Paper>
      </Stack>

      {/* Spend by Category -- simple bar visualization */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          {t('spend_by_category', 'Gasto por Categoria')}
        </Typography>
        {categoryData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {t('spend_no_categories', 'Sin datos de categorias')}
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
            {t('spend_trend_title', 'Tendencia Mensual de Gasto')}
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
              {t('spend_maverick_title', 'Gasto Maverick (Fuera de Contrato)')}
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
          emptyMessage={t('spend_maverick_empty', 'Sin gasto maverick detectado')}
          getRowId={(params) => String(params.data.id || params.data.proveedor)}
        />
      </Paper>
    </Box>
    </Box>
  );
}
