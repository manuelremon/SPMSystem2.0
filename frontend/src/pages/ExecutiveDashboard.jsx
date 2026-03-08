import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Assessment,
  Star,
  Refresh,
  Download
} from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
// Chart replaced with simple table (recharts removed from project)
import api from '../services/api';
import { useI18n } from '../context/i18n';

const ExecutiveDashboard = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('all');
  const [modalTrend, setModalTrend] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [scorecards, setScorecards] = useState([]);
  const [generatingScorecard, setGeneratingScorecard] = useState(false);

  const categorias = ['all', 'procurement', 'sourcing', 'quality', 'logistics', 'finance', 'sustainability'];

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/executive/dashboard');
      setDashboard(res.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScorecards = useCallback(async () => {
    try {
      const res = await api.get('/executive/scorecards?limit=5');
      setScorecards(res.data.scorecards || []);
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchScorecards();
  }, [fetchDashboard, fetchScorecards]);

  const handleKpiClick = async (kpi) => {
    setModalTrend(kpi);
    setLoadingTrends(true);
    try {
      const res = await api.get(`/executive/trends/${kpi.kpi_key}?meses=12`);
      setTrendsData(res.data.tendencias || []);
    } catch (error) {
      setTrendsData([]);
    } finally {
      setLoadingTrends(false);
    }
  };

  const handleGenerateScorecard = async () => {
    setGeneratingScorecard(true);
    try {
      await api.post('/executive/scorecards/generate', {});
      alert(t('exec_scorecard_generated', 'Scorecard generado exitosamente'));
      fetchScorecards();
    } catch (error) {
      alert(t('exec_error_generating_scorecard', 'Error al generar scorecard'));
    } finally {
      setGeneratingScorecard(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp sx={{ color: 'success.main' }} />;
    if (trend === 'down') return <TrendingDown sx={{ color: 'error.main' }} />;
    return <TrendingFlat sx={{ color: 'grey.500' }} />;
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'excellent':
        return 'success';
      case 'normal':
        return 'primary';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const kpisFiltrados = dashboard?.kpis?.filter((kpi) => {
    if (filtroCategoria === 'all') return true;
    return kpi.categoria === filtroCategoria;
  }) || [];

  const scorecardColumns = [
    { field: 'nombre', headerName: t('exec_name', 'Nombre'), flex: 1 },
    { field: 'periodo', headerName: t('exec_period', 'Periodo'), width: 120 },
    {
      field: 'score_total',
      headerName: t('exec_score', 'Score'),
      width: 100,
      valueFormatter: (params) => params.value ? `${Number(params.value).toFixed(1)}%` : 'N/A'
    },
    {
      field: 'categorias_evaluadas',
      headerName: t('exec_categories', 'Categorías'),
      flex: 1,
      valueFormatter: (params) => Array.isArray(params.value) ? params.value.join(', ') : ''
    }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('exec_dashboard_title', 'Dashboard Ejecutivo de Procurement')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('exec_filter_category', 'Categoría')}</InputLabel>
            <Select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              label={t('exec_filter_category', 'Categoría')}
            >
              {categorias.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat === 'all' ? t('common_all', 'Todos') : t(`exec_cat_${cat}`, cat)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchDashboard}
          >
            {t('common_refresh', 'Actualizar')}
          </Button>
        </Box>
      </Box>

      {dashboard && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('exec_last_update', 'Última actualización')}: {new Date(dashboard.ultima_actualizacion).toLocaleString()}
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpisFiltrados.map((kpi) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={kpi.kpi_key}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
              onClick={() => handleKpiClick(kpi)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    {t(`exec_cat_${kpi.categoria}`, kpi.categoria)}
                  </Typography>
                  {getTrendIcon(kpi.trend)}
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {Number(kpi.valor_actual || 0).toFixed(1)}{kpi.unidad}
                </Typography>

                <Typography variant="body2" sx={{ mb: 2 }}>
                  {kpi.nombre}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={`${kpi.variacion_pct >= 0 ? '+' : ''}${Number(kpi.variacion_pct || 0).toFixed(1)}%`}
                    size="small"
                    color={kpi.variacion_pct >= 0 ? 'success' : 'error'}
                  />
                  <Chip
                    label={t(`exec_estado_${kpi.estado}`, kpi.estado)}
                    size="small"
                    color={getEstadoColor(kpi.estado)}
                  />
                </Box>

                {kpi.target_value && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('exec_target', 'Meta')}: {kpi.target_value}{kpi.unidad}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (kpi.valor_actual / kpi.target_value) * 100)}
                      sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                      color={getEstadoColor(kpi.estado)}
                    />
                  </Box>
                )}

                {kpi.benchmark && (
                  <Tooltip title={`${kpi.benchmark.industria} - ${kpi.benchmark.region}`}>
                    <Chip
                      icon={<Star />}
                      label={`${t('exec_benchmark', 'Benchmark')}: ${Number(kpi.benchmark.mediana || 0).toFixed(1)}`}
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Scorecards Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{t('exec_scorecards', 'Scorecards')}</Typography>
            <Button
              variant="contained"
              startIcon={<Assessment />}
              onClick={handleGenerateScorecard}
              disabled={generatingScorecard}
            >
              {generatingScorecard ? t('common_generating', 'Generando...') : t('exec_generate_scorecard', 'Generar Scorecard')}
            </Button>
          </Box>

          <SPMAgGrid
            rowData={scorecards}
            columnDefs={scorecardColumns}
            pagination={true}
            paginationPageSize={5}
            height={300}
            exportFileName="executive-scorecards"
          />
        </CardContent>
      </Card>

      {/* Trend Modal */}
      <Dialog
        open={!!modalTrend}
        onClose={() => setModalTrend(null)}
        maxWidth="md"
        fullWidth
      >
        {modalTrend && (
          <>
            <DialogTitle>
              {modalTrend.nombre}
              <Typography variant="caption" display="block" color="text.secondary">
                {modalTrend.descripcion}
              </Typography>
            </DialogTitle>
            <DialogContent>
              {loadingTrends ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : trendsData.length > 0 ? (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                          {t('exec_period', 'Periodo')}
                        </th>
                        <th style={{ padding: '8px 12px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>
                          {modalTrend.nombre}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsData.map((row, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>{row.periodo}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>
                            {Number(row.valor || 0).toFixed(2)}{modalTrend.unidad || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              ) : (
                <Alert severity="info">{t('exec_no_trend_data', 'No hay datos de tendencia disponibles')}</Alert>
              )}

              {modalTrend.benchmark && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('exec_benchmark_data', 'Datos de Benchmark')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        {t('exec_industry', 'Industria')}
                      </Typography>
                      <Typography variant="body2">{modalTrend.benchmark.industria}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        {t('exec_region', 'Región')}
                      </Typography>
                      <Typography variant="body2">{modalTrend.benchmark.region}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">P25</Typography>
                      <Typography variant="body2">{Number(modalTrend.benchmark.percentil_25 || 0).toFixed(1)}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">{t('exec_median', 'Mediana')}</Typography>
                      <Typography variant="body2">{Number(modalTrend.benchmark.mediana || 0).toFixed(1)}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">P75</Typography>
                      <Typography variant="body2">{Number(modalTrend.benchmark.percentil_75 || 0).toFixed(1)}</Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setModalTrend(null)}>{t('common_close', 'Cerrar')}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ExecutiveDashboard;
