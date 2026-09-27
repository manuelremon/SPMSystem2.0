/**
 * ABC Analysis - Análisis ABC de materiales por valor de consumo
 * Sprint 45
 */

import { useState, useEffect, useMemo } from 'react';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import { MetricCard } from '../components/ui/MetricCard';
import { useI18n } from '../context/i18n';
import api from '../services/api';
import { formatCurrency, formatNumber } from '../utils/formatters';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import RefreshIcon from '@mui/icons-material/Refresh';
import PaymentsIcon from '@mui/icons-material/Payments';
import LooksOneIcon from '@mui/icons-material/LooksOne';
import LooksTwoIcon from '@mui/icons-material/LooksTwo';
import Looks3Icon from '@mui/icons-material/Looks3';
import PercentIcon from '@mui/icons-material/Percent';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';

// Importar Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const ABCAnalysis = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState({
    total_valor: 0,
    items_a: 0,
    items_b: 0,
    items_c: 0,
    pct_valor_a: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    centro: '',
    sector: '',
    periodo_meses: 12,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (filters.centro) params.append('centro', filters.centro);
      if (filters.sector) params.append('sector', filters.sector);
      params.append('periodo_meses', filters.periodo_meses);

      const response = await api.get(`/ai/abc-analysis?${params.toString()}`);

      if (response.data.ok) {
        setData(response.data.data);
        setKpis(response.data.kpis);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    fetchData();
  };

  // AG-Grid column definitions
  const columnDefs = useMemo(
    () => [
      {
        headerName: t('abc_material', 'Material'),
        field: 'material',
        sortable: true,
        filter: true,
        width: 150,
      },
      {
        headerName: t('abc_descripcion', 'Descripción'),
        field: 'descripcion',
        sortable: true,
        filter: true,
        flex: 1,
      },
      {
        headerName: t('abc_valor_total', 'Valor total'),
        field: 'valor_total',
        sortable: true,
        filter: 'agNumberColumnFilter',
        width: 170,
        type: 'rightAligned',
        valueFormatter: (params) => (params.value != null ? formatCurrency(params.value) : '-'),
      },
      {
        headerName: t('abc_pct_acumulado', '% Acumulado'),
        field: 'pct_acumulado',
        sortable: true,
        filter: 'agNumberColumnFilter',
        width: 150,
        type: 'rightAligned',
        valueFormatter: (params) => `${formatNumber(Number(params.value || 0).toFixed(2))} %`,
      },
      {
        headerName: t('abc_clase', 'Clase'),
        field: 'clase',
        sortable: true,
        filter: true,
        width: 100,
        cellStyle: (params) => {
          const clase = params.value;
          if (clase === 'A') return { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 'bold' };
          if (clase === 'B') return { backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 'bold' };
          if (clase === 'C') return { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', fontWeight: 'bold' };
          return {};
        },
      },
    ],
    [t]
  );

  // Pareto chart data
  const paretoChartData = useMemo(() => {
    if (!data.length) return null;

    // Take top 20 items for readability
    const topItems = data.slice(0, 20);

    return {
      labels: topItems.map((item) => item.material),
      datasets: [
        {
          type: 'bar',
          label: t('abc_valor_total', 'Valor total'),
          data: topItems.map((item) => item.valor_total),
          backgroundColor: topItems.map((item) => {
            if (item.clase === 'A') return 'rgba(22, 163, 74, 0.7)';
            if (item.clase === 'B') return 'rgba(234, 179, 8, 0.7)';
            return 'rgba(239, 68, 68, 0.7)';
          }),
          borderColor: topItems.map((item) => {
            if (item.clase === 'A') return 'rgb(22, 163, 74)';
            if (item.clase === 'B') return 'rgb(234, 179, 8)';
            return 'rgb(239, 68, 68)';
          }),
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: t('abc_pct_acumulado', '% Acumulado'),
          data: topItems.map((item) => item.pct_acumulado),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          yAxisID: 'y1',
          tension: 0.3,
        },
      ],
    };
  }, [data, t]);

  const paretoChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: t('abc_pareto_chart', 'Análisis de Pareto'),
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: t('abc_valor', 'Valor'),
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: t('abc_pct_acumulado', '% Acumulado'),
        },
        min: 0,
        max: 100,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const hasData = !loading && !loadError && data.length > 0;

  return (
    <PageLayout
      title={t('abc_title', 'Análisis ABC de materiales')}
      subtitle={t('abc_subtitle', 'Clasificación de materiales por valor de consumo (A: 80%, B: 15%, C: 5%)')}
    >
      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label={t('abc_filter_centro', 'Centro')}
            value={filters.centro}
            onChange={(e) => handleFilterChange('centro', e.target.value)}
            placeholder={t('abc_filter_centro_placeholder', 'Ej: 1000')}
            sx={{ flex: '1 1 180px' }}
          />
          <TextField
            size="small"
            label={t('abc_filter_sector', 'Sector')}
            value={filters.sector}
            onChange={(e) => handleFilterChange('sector', e.target.value)}
            placeholder={t('abc_filter_sector_placeholder', 'Ej: PROD')}
            sx={{ flex: '1 1 180px' }}
          />
          <TextField
            select
            size="small"
            label={t('abc_filter_periodo', 'Período (meses)')}
            value={filters.periodo_meses}
            onChange={(e) => handleFilterChange('periodo_meses', parseInt(e.target.value, 10))}
            sx={{ flex: '1 1 180px' }}
          >
            {[6, 12, 24].map((m) => (
              <MenuItem key={m} value={m}>
                {m} {t('common_months', 'meses')}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleApplyFilters}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            {t('abc_apply_filters', 'Aplicar')}
          </Button>
        </Box>
      </Paper>

      {loadError ? (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <EmptyState
            icon={<ErrorOutlineIcon sx={{ color: 'error.main' }} />}
            title={t('abc_error', 'Error al cargar análisis ABC')}
            description={t('common_error_reintentar', 'No pudimos cargar la información. Intenta nuevamente en unos minutos.')}
            action={t('common_reintentar', 'Reintentar')}
            onAction={fetchData}
          />
        </Paper>
      ) : !loading && data.length === 0 ? (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <EmptyState
            icon={<InventoryIcon sx={{ color: 'text.disabled' }} />}
            title={t('abc_sin_datos', 'No hay datos disponibles para el período seleccionado')}
          />
        </Paper>
      ) : (
        <>
          {hasData && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2 }}>
              <MetricCard size="lg" icon={PaymentsIcon} label={t('abc_total_valor', 'Valor total')} value={formatCurrency(kpis.total_valor)} />
              <MetricCard size="lg" icon={LooksOneIcon} variant="success" label={t('abc_items_a_label', 'Ítems clase A')} value={formatNumber(kpis.items_a)} />
              <MetricCard size="lg" icon={LooksTwoIcon} variant="warning" label={t('abc_items_b_label', 'Ítems clase B')} value={formatNumber(kpis.items_b)} />
              <MetricCard size="lg" icon={Looks3Icon} variant="danger" label={t('abc_items_c_label', 'Ítems clase C')} value={formatNumber(kpis.items_c)} />
              <MetricCard size="lg" icon={PercentIcon} variant="success" label={t('abc_pct_valor_a', '% valor en A')} value={`${formatNumber(Number(kpis.pct_valor_a || 0).toFixed(1))} %`} />
            </Box>
          )}

          {hasData && paretoChartData && (
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ height: 400 }}>
                <Bar data={paretoChartData} options={paretoChartOptions} />
              </Box>
            </Paper>
          )}

          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <SPMAgGrid
              rowData={data}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true,
              }}
              pagination={true}
              paginationPageSize={25}
              loading={loading}
              height={500}
              exportFileName="abc-analysis"
            />
          </Paper>
        </>
      )}
    </PageLayout>
  );
};

export default ABCAnalysis;
