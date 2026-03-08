/**
 * ABC Analysis - Análisis ABC de materiales por valor de consumo
 * Sprint 45
 */

import React, { useState, useEffect, useMemo } from 'react';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';

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
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
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
        showToast(t('abc_error', 'Error al cargar análisis ABC'), 'error');
      }
    } catch (error) {
      showToast(t('abc_error', 'Error al cargar análisis ABC'), 'error');
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

  const handleExport = () => {
    if (!data.length) {
      showToast(t('abc_empty', 'No hay datos para exportar'), 'warning');
      return;
    }

    // Simple CSV export
    const headers = ['Material', 'Descripción', 'Valor Total', '% Acumulado', 'Clase'];
    const rows = data.map((row) => [
      row.material,
      row.descripcion,
      row.valor_total,
      row.pct_acumulado,
      row.clase,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `abc_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
        headerName: t('abc_valor_total', 'Valor Total'),
        field: 'valor_total',
        sortable: true,
        filter: 'agNumberColumnFilter',
        width: 150,
        valueFormatter: (params) => params.value?.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
      },
      {
        headerName: t('abc_pct_acumulado', '% Acumulado'),
        field: 'pct_acumulado',
        sortable: true,
        filter: 'agNumberColumnFilter',
        width: 150,
        valueFormatter: (params) => `${params.value?.toFixed(2)}%`,
      },
      {
        headerName: t('abc_clase', 'Clase'),
        field: 'clase',
        sortable: true,
        filter: true,
        width: 100,
        cellStyle: (params) => {
          const clase = params.value;
          if (clase === 'A') return { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 'bold' };
          if (clase === 'B') return { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 'bold' };
          if (clase === 'C') return { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' };
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
          label: t('abc_valor_total', 'Valor Total'),
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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t('abc_title', 'Análisis ABC de Materiales')}
        </Typography>
        <p className="text-gray-600">
          {t('abc_subtitle', 'Clasificación de materiales por valor de consumo (A: 80%, B: 15%, C: 5%)')}
        </p>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('abc_filter_centro', 'Centro')}
              </label>
              <input
                type="text"
                value={filters.centro}
                onChange={(e) => handleFilterChange('centro', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('abc_filter_centro_placeholder', 'Ej: 1000')}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('abc_filter_sector', 'Sector')}
              </label>
              <input
                type="text"
                value={filters.sector}
                onChange={(e) => handleFilterChange('sector', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('abc_filter_sector_placeholder', 'Ej: PROD')}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('abc_filter_periodo', 'Período (meses)')}
              </label>
              <select
                value={filters.periodo_meses}
                onChange={(e) => handleFilterChange('periodo_meses', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={6}>6 {t('common_months', 'meses')}</option>
                <option value={12}>12 {t('common_months', 'meses')}</option>
                <option value={24}>24 {t('common_months', 'meses')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters} disabled={loading}>
                <RefreshIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('abc_apply_filters', 'Aplicar')}
              </Button>
              <Button onClick={handleExport} variant="outline" disabled={!data.length}>
                <DownloadIcon className="w-4 h-4 mr-2" />
                {t('abc_export', 'Exportar')}
              </Button>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-600">{t('abc_total_valor', 'Valor Total')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {kpis.total_valor.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">{t('abc_items_a', 'Items Clase A')}</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{kpis.items_a}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">{t('abc_items_b', 'Items Clase B')}</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{kpis.items_b}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">{t('abc_items_c', 'Items Clase C')}</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{kpis.items_c}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">{t('abc_pct_valor_a', '% Valor en A')}</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{kpis.pct_valor_a.toFixed(1)}%</div>
            </Card>
          </div>
        )}

        {/* Pareto Chart */}
        {!loading && paretoChartData && (
          <Card className="p-4">
            <div style={{ height: '400px' }}>
              <Bar data={paretoChartData} options={paretoChartOptions} />
            </div>
          </Card>
        )}

        {/* Data Table */}
        <Card className="p-4">
          <SPMAgGrid
            rowData={data}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true,
            }}
            pagination={true}
            paginationPageSize={50}
            loading={loading}
            height={500}
            exportFileName="abc-analysis"
          />
        </Card>

        {/* Empty state */}
        {!loading && data.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-gray-500">{t('abc_empty', 'No hay datos disponibles para el período seleccionado')}</p>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default ABCAnalysis;
