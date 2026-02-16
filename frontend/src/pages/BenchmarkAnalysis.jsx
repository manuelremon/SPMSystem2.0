import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { Add, CompareArrows } from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useAuthStore } from '../store/authStore';

const BenchmarkAnalysis = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isAdmin = user?.rol === 'admin';

  const [loading, setLoading] = useState(true);
  const [benchmarks, setBenchmarks] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState('');
  const [formData, setFormData] = useState({
    kpi_key: '',
    industria: '',
    region: '',
    percentil_25: '',
    mediana: '',
    percentil_75: '',
    fuente: '',
    periodo_dato: ''
  });

  const fetchBenchmarks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/executive/benchmarks');
      setBenchmarks(res.data.benchmarks || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await api.get('/api/executive/kpis');
      setKpis(res.data.kpis || []);
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    fetchBenchmarks();
    fetchKpis();
  }, [fetchBenchmarks, fetchKpis]);

  const handleCreate = async () => {
    try {
      await api.post('/api/executive/benchmarks', {
        ...formData,
        percentil_25: parseFloat(formData.percentil_25),
        mediana: parseFloat(formData.mediana),
        percentil_75: parseFloat(formData.percentil_75)
      });
      alert(t('exec_benchmark_created', 'Benchmark creado exitosamente'));
      setModalOpen(false);
      setFormData({
        kpi_key: '',
        industria: '',
        region: '',
        percentil_25: '',
        mediana: '',
        percentil_75: '',
        fuente: '',
        periodo_dato: ''
      });
      fetchBenchmarks();
    } catch (error) {
      alert(t('exec_error_creating_benchmark', 'Error al crear benchmark'));
    }
  };

  const getPositionIndicator = (value, benchmark) => {
    if (!value || !benchmark) return null;
    if (value >= benchmark.percentil_75) {
      return <Chip label="Top 25%" color="success" size="small" />;
    } else if (value >= benchmark.mediana) {
      return <Chip label="Top 50%" color="primary" size="small" />;
    } else if (value >= benchmark.percentil_25) {
      return <Chip label="Bottom 50%" color="warning" size="small" />;
    } else {
      return <Chip label="Bottom 25%" color="error" size="small" />;
    }
  };

  const columnDefs = [
    {
      field: 'kpi_key',
      headerName: t('exec_kpi', 'KPI'),
      flex: 1,
      valueGetter: (params) => {
        const kpi = kpis.find((k) => k.kpi_key === params.data.kpi_key);
        return kpi ? kpi.nombre : params.data.kpi_key;
      }
    },
    { field: 'industria', headerName: t('exec_industry', 'Industria'), width: 150 },
    { field: 'region', headerName: t('exec_region', 'Región'), width: 120 },
    {
      field: 'percentil_25',
      headerName: 'P25',
      width: 100,
      valueFormatter: (params) => params.value?.toFixed(1) || 'N/A'
    },
    {
      field: 'mediana',
      headerName: t('exec_median', 'Mediana'),
      width: 100,
      valueFormatter: (params) => params.value?.toFixed(1) || 'N/A'
    },
    {
      field: 'percentil_75',
      headerName: 'P75',
      width: 100,
      valueFormatter: (params) => params.value?.toFixed(1) || 'N/A'
    },
    { field: 'fuente', headerName: t('exec_source', 'Fuente'), flex: 1 },
    { field: 'periodo_dato', headerName: t('exec_period', 'Periodo'), width: 120 }
  ];

  // Group benchmarks by KPI
  const benchmarksByKpi = benchmarks.reduce((acc, b) => {
    if (!acc[b.kpi_key]) acc[b.kpi_key] = [];
    acc[b.kpi_key].push(b);
    return acc;
  }, {});

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
          {t('exec_benchmark_analysis', 'Análisis de Benchmarks')}
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setModalOpen(true)}
          >
            {t('exec_add_benchmark', 'Agregar Benchmark')}
          </Button>
        )}
      </Box>

      {/* Company vs Benchmark Comparison */}
      {Object.keys(benchmarksByKpi).length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('exec_company_vs_benchmark', 'Posición vs Benchmark')}
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(benchmarksByKpi).map(([kpiKey, benchs]) => {
                const kpi = kpis.find((k) => k.kpi_key === kpiKey);
                if (!kpi) return null;

                const latestBench = benchs[0]; // Most recent benchmark
                return (
                  <Grid item xs={12} sm={6} md={4} key={kpiKey}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          {kpi.nombre}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {latestBench.industria} - {latestBench.region}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">P25</Typography>
                            <Typography variant="body2">{latestBench.percentil_25?.toFixed(1)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">P50</Typography>
                            <Typography variant="body2">{latestBench.mediana?.toFixed(1)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">P75</Typography>
                            <Typography variant="body2">{latestBench.percentil_75?.toFixed(1)}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* All Benchmarks Grid */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('exec_all_benchmarks', 'Todos los Benchmarks')}
          </Typography>
          <SPMAgGrid
            rowData={benchmarks}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={20}
            height={500}
            exportFileName="benchmarks"
          />
        </CardContent>
      </Card>

      {/* Create Benchmark Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('exec_add_benchmark', 'Agregar Benchmark')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label={t('exec_kpi', 'KPI')}
                value={formData.kpi_key}
                onChange={(e) => setFormData({ ...formData, kpi_key: e.target.value })}
                required
              >
                {kpis.map((kpi) => (
                  <MenuItem key={kpi.kpi_key} value={kpi.kpi_key}>
                    {kpi.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('exec_industry', 'Industria')}
                value={formData.industria}
                onChange={(e) => setFormData({ ...formData, industria: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('exec_region', 'Región')}
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Percentil 25"
                value={formData.percentil_25}
                onChange={(e) => setFormData({ ...formData, percentil_25: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label={t('exec_median', 'Mediana')}
                value={formData.mediana}
                onChange={(e) => setFormData({ ...formData, mediana: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Percentil 75"
                value={formData.percentil_75}
                onChange={(e) => setFormData({ ...formData, percentil_75: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('exec_source', 'Fuente')}
                value={formData.fuente}
                onChange={(e) => setFormData({ ...formData, fuente: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="month"
                label={t('exec_period', 'Periodo')}
                value={formData.periodo_dato}
                onChange={(e) => setFormData({ ...formData, periodo_dato: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!formData.kpi_key || !formData.industria || !formData.region || !formData.percentil_25 || !formData.mediana || !formData.percentil_75}
          >
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BenchmarkAnalysis;
