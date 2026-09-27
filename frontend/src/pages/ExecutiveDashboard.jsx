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
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Assessment,
  Star,
  Refresh,
  ErrorOutline,
  Insights,
} from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
// Chart replaced with simple table (recharts removed from project)
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import { formatDateTime, formatNumber } from '../utils/formatters';

// Numero con 1 decimal y coma decimal (formato es-ES)
const fmt1 = (v) => formatNumber(Number(v || 0).toFixed(1));
const fmt2 = (v) => formatNumber(Number(v || 0).toFixed(2));

const ExecutiveDashboard = () => {
  const { t } = useI18n();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('all');
  const [modalTrend, setModalTrend] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [scorecards, setScorecards] = useState([]);
  const [generatingScorecard, setGeneratingScorecard] = useState(false);

  const categorias = ['all', 'procurement', 'sourcing', 'quality', 'logistics', 'finance', 'sustainability'];
  const categoriaLabels = {
    procurement: t('exec_categoria_compras', 'Compras'),
    sourcing: t('exec_categoria_abastecimiento', 'Abastecimiento'),
    quality: t('exec_cat_quality', 'Calidad'),
    logistics: t('exec_cat_logistics', 'Logística'),
    finance: t('exec_cat_finance', 'Finanzas'),
    sustainability: t('exec_cat_sustainability', 'Sostenibilidad'),
  };
  const catLabel = (cat) => categoriaLabels[cat] || cat;

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get('/executive/dashboard');
      setDashboard(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScorecards = useCallback(async () => {
    try {
      const res = await api.get('/executive/scorecards?limit=5');
      setScorecards(res.data.scorecards || []);
    } catch {
      setScorecards([]);
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
    } catch {
      setTrendsData([]);
    } finally {
      setLoadingTrends(false);
    }
  };

  const handleGenerateScorecard = async () => {
    setGeneratingScorecard(true);
    try {
      await api.post('/executive/scorecards/generate', {});
      toast.success(t('exec_cuadro_generado', 'Cuadro de mando generado correctamente'));
      fetchScorecards();
    } catch {
      toast.error(t('exec_error_generar_cuadro', 'Error al generar el cuadro de mando'));
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
    { field: 'periodo', headerName: t('exec_periodo', 'Período'), width: 120 },
    {
      field: 'score_total',
      headerName: t('exec_puntaje', 'Puntaje'),
      width: 110,
      type: 'rightAligned',
      valueFormatter: (params) => params.value ? `${fmt1(params.value)} %` : t('common_nd', 'N/D')
    },
    {
      field: 'categorias_evaluadas',
      headerName: t('exec_categories', 'Categorías'),
      flex: 1,
      valueFormatter: (params) => Array.isArray(params.value) ? params.value.map(catLabel).join(', ') : ''
    }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const headerActions = (
    <>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>{t('exec_filter_category', 'Categoría')}</InputLabel>
        <Select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          label={t('exec_filter_category', 'Categoría')}
        >
          {categorias.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat === 'all' ? t('common_all', 'Todos') : catLabel(cat)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Refresh />}
        onClick={fetchDashboard}
        sx={{ textTransform: 'none' }}
      >
        {t('common_refresh', 'Actualizar')}
      </Button>
    </>
  );

  return (
    <PageLayout
      title={t('exec_titulo', 'Dashboard ejecutivo')}
      subtitle={
        dashboard?.ultima_actualizacion
          ? `${t('exec_last_update', 'Última actualización')}: ${formatDateTime(dashboard.ultima_actualizacion)}`
          : undefined
      }
      actions={headerActions}
    >
        {loadError ? (
          <Card variant="outlined">
            <EmptyState
              icon={<ErrorOutline sx={{ color: 'error.main' }} />}
              title={t('exec_error_carga', 'No se pudo cargar el dashboard ejecutivo')}
              description={t('common_error_reintentar', 'No pudimos cargar la información. Intenta nuevamente en unos minutos.')}
              action={t('common_reintentar', 'Reintentar')}
              onAction={fetchDashboard}
            />
          </Card>
        ) : kpisFiltrados.length === 0 ? (
          <Card variant="outlined">
            <EmptyState
              icon={<Insights sx={{ color: 'text.disabled' }} />}
              title={t('exec_sin_kpis', 'No hay indicadores disponibles')}
              description={t('exec_sin_kpis_desc', 'Todavía no hay indicadores calculados para la categoría seleccionada.')}
            />
          </Card>
        ) : (
        <Grid container spacing={2}>
          {kpisFiltrados.map((kpi) => (
            <Grid
              key={kpi.kpi_key}
              size={{
                xs: 12,
                sm: 6,
                md: 4,
                lg: 3
              }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 3 }
                }}
                onClick={() => handleKpiClick(kpi)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                      {catLabel(kpi.categoria)}
                    </Typography>
                    {getTrendIcon(kpi.trend)}
                  </Box>

                  <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {fmt1(kpi.valor_actual)}{kpi.unidad}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {kpi.nombre}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${kpi.variacion_pct >= 0 ? '+' : ''}${fmt1(kpi.variacion_pct)} %`}
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
                        {t('exec_target', 'Meta')}: {formatNumber(kpi.target_value)}{kpi.unidad}
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
                        label={`${t('exec_referencia', 'Referencia')}: ${fmt1(kpi.benchmark.mediana)}`}
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
        )}

        {/* Scorecards Section */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('exec_cuadros_mando', 'Cuadros de mando')}</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<Assessment />}
                onClick={handleGenerateScorecard}
                disabled={generatingScorecard}
                sx={{ textTransform: 'none' }}
              >
                {generatingScorecard ? t('common_generating', 'Generando...') : t('exec_generar_cuadro', 'Generar cuadro de mando')}
              </Button>
            </Box>

            <SPMAgGrid
              rowData={scorecards}
              columnDefs={scorecardColumns}
              pagination={true}
              paginationPageSize={25}
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
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('exec_periodo', 'Período')}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {modalTrend.nombre}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {trendsData.map((row, idx) => (
                          <TableRow key={idx} sx={{ '&:nth-of-type(even)': { bgcolor: 'grey.50' } }}>
                            <TableCell>{row.periodo}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {fmt2(row.valor)}{modalTrend.unidad || ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">{t('exec_no_trend_data', 'No hay datos de tendencia disponibles')}</Alert>
                )}

                {modalTrend.benchmark && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('exec_datos_referencia', 'Datos de referencia')}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <Typography variant="caption" color="text.secondary">
                          {t('exec_industry', 'Industria')}
                        </Typography>
                        <Typography variant="body2">{modalTrend.benchmark.industria}</Typography>
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="caption" color="text.secondary">
                          {t('exec_region', 'Región')}
                        </Typography>
                        <Typography variant="body2">{modalTrend.benchmark.region}</Typography>
                      </Grid>
                      <Grid size={4}>
                        <Typography variant="caption" color="text.secondary">P25</Typography>
                        <Typography variant="body2">{fmt1(modalTrend.benchmark.percentil_25)}</Typography>
                      </Grid>
                      <Grid size={4}>
                        <Typography variant="caption" color="text.secondary">{t('exec_median', 'Mediana')}</Typography>
                        <Typography variant="body2">{fmt1(modalTrend.benchmark.mediana)}</Typography>
                      </Grid>
                      <Grid size={4}>
                        <Typography variant="caption" color="text.secondary">P75</Typography>
                        <Typography variant="body2">{fmt1(modalTrend.benchmark.percentil_75)}</Typography>
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
    </PageLayout>
  );
};

export default ExecutiveDashboard;
