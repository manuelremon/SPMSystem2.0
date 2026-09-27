/**
 * WhatIfInventario - Simulador de impacto en inventario
 *
 * Permite ajustar parámetros MRP (ROP, EOQ) y ver el impacto en capital,
 * riesgo de stockout y costos de mantenimiento.
 */

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SavingsIcon from '@mui/icons-material/Savings';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import { SPMBar } from '../components/ui/SPMChartJS';
import api from '../services/api';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, formatNumber } from '../utils/formatters';

const RISK_COLORS = {
  bajo: 'var(--success-light)',
  medio: 'var(--warning-light)',
  alto: 'var(--danger-light)',
};

export default function WhatIfInventario() {
  const { t } = useI18n();
  const toast = useToast();

  const [material, setMaterial] = useState('');
  const [ropDelta, setRopDelta] = useState(0);
  const [eoqDelta, setEoqDelta] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSimulate = useCallback(async () => {
    if (!material.trim()) {
      toast.warning(t('whatif_material_requerido', 'Ingresa un código de material'));
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/mrp/what-if', {
        params: { material: material.trim(), rop_delta: ropDelta, eoq_delta: eoqDelta },
      });

      if (response.data?.ok) {
        setResult(response.data);
      } else {
        toast.error(response.data?.error?.message || t('whatif_error', 'Error al simular'));
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || t('whatif_error', 'Error al simular');
      toast.error(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [material, ropDelta, eoqDelta, t]);

  const handleReset = useCallback(() => {
    setRopDelta(0);
    setEoqDelta(0);
    setResult(null);
  }, []);

  const chartData = result
    ? {
        labels: [t('whatif_current', 'Actual'), t('whatif_adjusted', 'Ajustado')],
        datasets: [
          {
            label: 'ROP',
            data: [result.current.rop, result.adjusted.rop],
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
          },
          {
            label: 'EOQ',
            data: [result.current.eoq, result.adjusted.eoq],
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
          },
          {
            label: t('whatif_avg_stock', 'Stock promedio'),
            data: [result.current.avg_stock, result.adjusted.avg_stock],
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
          },
        ],
      }
    : null;

  const riskLabels = {
    bajo: t('whatif_riesgo_bajo', 'Bajo'),
    medio: t('whatif_riesgo_medio', 'Medio'),
    alto: t('whatif_riesgo_alto', 'Alto'),
  };

  return (
    <PageLayout
      title={t('whatif_titulo', 'Simulador de inventario')}
      subtitle={t('whatif_subtitle', 'Simula ajustes en parámetros MRP y observa el impacto en capital y riesgo')}
    >
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <TextField
                label={t('whatif_material', 'Código de Material')}
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder={t('whatif_material_placeholder', 'Ej: 10000123')}
                fullWidth
                autoFocus
              />

              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('whatif_rop_adjustment', 'Ajuste ROP (punto de pedido)')}: {ropDelta > 0 ? '+' : ''}
                  {ropDelta} %
                </Typography>
                <Slider
                  value={ropDelta}
                  onChange={(_, val) => setRopDelta(val)}
                  min={-50}
                  max={50}
                  step={5}
                  marks={[
                    { value: -50, label: '-50%' },
                    { value: 0, label: '0%' },
                    { value: 50, label: '+50%' },
                  ]}
                  valueLabelDisplay="auto"
                  sx={{ mx: 1.5, width: 'calc(100% - 24px)' }}
                  aria-label={t('whatif_rop_adjustment', 'Ajuste ROP (Punto de Pedido)')}
                />
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('whatif_eoq_adjustment', 'Ajuste EOQ (Cantidad Óptima)')}:{' '}
                  {eoqDelta > 0 ? '+' : ''}
                  {eoqDelta} %
                </Typography>
                <Slider
                  value={eoqDelta}
                  onChange={(_, val) => setEoqDelta(val)}
                  min={-50}
                  max={50}
                  step={5}
                  marks={[
                    { value: -50, label: '-50%' },
                    { value: 0, label: '0%' },
                    { value: 50, label: '+50%' },
                  ]}
                  valueLabelDisplay="auto"
                  sx={{ mx: 1.5, width: 'calc(100% - 24px)' }}
                  aria-label={t('whatif_eoq_adjustment', 'Ajuste EOQ (Cantidad Óptima)')}
                />
              </Box>

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  onClick={handleSimulate}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <TrendingUpIcon />}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  {loading ? t('whatif_simulating', 'Simulando...') : t('whatif_simulate', 'Simular')}
                </Button>
                <Button variant="outlined" onClick={handleReset} disabled={loading} sx={{ textTransform: 'none' }}>
                  {t('whatif_reset', 'Reiniciar')}
                </Button>
              </Stack>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            {!result && !loading && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 300,
                  border: '2px dashed',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <EmptyState
                  icon={<TrendingUpIcon sx={{ color: 'text.disabled' }} />}
                  title={t('whatif_vacio', 'Ingresa un material y ajusta los parámetros para ver resultados')}
                />
              </Box>
            )}

            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 300,
                }}
              >
                <CircularProgress />
              </Box>
            )}

            {result && !loading && (
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('whatif_results', 'Resultados de la simulación')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.descripcion || result.material}
                </Typography>

                <Alert
                  severity={
                    result.impact.riesgo_stockout === 'alto'
                      ? 'error'
                      : result.impact.riesgo_stockout === 'medio'
                        ? 'warning'
                        : 'success'
                  }
                  icon={<WarningAmberIcon />}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('whatif_riesgo_quiebre', 'Riesgo de quiebre de stock')}:{' '}
                    <Chip
                      label={riskLabels[result.impact.riesgo_stockout] || result.impact.riesgo_stockout}
                      size="small"
                      sx={{
                        bgcolor: RISK_COLORS[result.impact.riesgo_stockout],
                        color: 'white',
                        fontWeight: 700,
                      }}
                    />
                  </Typography>
                </Alert>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <SavingsIcon color="success" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t('whatif_capital_liberado', 'Capital liberado')}
                    </Typography>
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatCurrency(result.impact.capital_liberado)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {result.impact.capital_liberado_pct > 0 ? '+' : ''}
                    {formatNumber(result.impact.capital_liberado_pct)} % {t('whatif_vs_current', 'vs. actual')}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    {t('whatif_ahorro_mantener', 'Ahorro anual en mantenimiento')}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {formatCurrency(result.impact.ahorro_mantener)}
                  </Typography>
                </Paper>
              </Stack>
            )}
          </Grid>
        </Grid>
      </Paper>

      {chartData && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {t('whatif_comparison', 'Comparación actual vs. ajustado')}
          </Typography>
          <Box sx={{ height: 300 }}>
            <SPMBar data={chartData} indexAxis="y" />
          </Box>
        </Paper>
      )}
    </PageLayout>
  );
}
