import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Divider,
} from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import { formatCurrency } from '../utils/formatters';

export default function CashflowSimulator() {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [escenario, setEscenario] = useState('');
  const [diasAnticipacion, setDiasAnticipacion] = useState(15);
  const [descuentoPct, setDescuentoPct] = useState(2.0);
  const [porcentajeElegibles, setPorcentajeElegibles] = useState(80);
  const [simulaciones, setSimulaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    if (!escenario.trim()) {
      addToast('Ingrese nombre del escenario', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/supplier-finance/simulate', {
        escenario,
        dias_anticipacion: diasAnticipacion,
        descuento_pct: descuentoPct,
        porcentaje_facturas_elegibles: porcentajeElegibles,
      });

      if (res.data.ok) {
        setSimulaciones(res.data.simulaciones);
        addToast('Simulación completada', 'success');
      }
    } catch (error) {
      addToast(error.response?.data?.error || 'Error al simular', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalAhorro = simulaciones.reduce((acc, s) => acc + s.ahorro_neto, 0);
  const totalDescuentos = simulaciones.reduce((acc, s) => acc + s.monto_descuentos, 0);
  const avgDpoBefore = 30;
  const avgDpoAfter =
    simulaciones.length > 0
      ? simulaciones.reduce((acc, s) => acc + s.dias_pago_promedio, 0) / simulaciones.length
      : 30;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('finance_cashflow_title')}
      </Typography>

      <Grid container spacing={3}>
        {/* Scenario Configuration */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configuración del Escenario
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <TextField
                  label={t('finance_scenario_name')}
                  value={escenario}
                  onChange={(e) => setEscenario(e.target.value)}
                  fullWidth
                  required
                />

                <TextField
                  label={t('finance_anticipation_days')}
                  type="number"
                  value={diasAnticipacion}
                  onChange={(e) => setDiasAnticipacion(parseInt(e.target.value, 10))}
                  fullWidth
                  inputProps={{ step: 1, min: 1, max: 60 }}
                  helperText="Días de anticipo en el pago"
                />

                <TextField
                  label={t('finance_discount_pct')}
                  type="number"
                  value={descuentoPct}
                  onChange={(e) => setDescuentoPct(parseFloat(e.target.value))}
                  fullWidth
                  inputProps={{ step: 0.1, min: 0.1, max: 10 }}
                  helperText="Descuento ofrecido por pago anticipado"
                />

                <TextField
                  label={t('finance_eligible_invoices')}
                  type="number"
                  value={porcentajeElegibles}
                  onChange={(e) => setPorcentajeElegibles(parseFloat(e.target.value))}
                  fullWidth
                  inputProps={{ step: 5, min: 0, max: 100 }}
                  helperText="% de facturas elegibles para descuento"
                />

                <Button
                  variant="contained"
                  onClick={handleSimulate}
                  disabled={loading || !escenario.trim()}
                  startIcon={<PlayArrow />}
                  fullWidth
                  size="large"
                >
                  {t('finance_simulate')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Results */}
        <Grid item xs={12} md={8}>
          {simulaciones.length === 0 ? (
            <Alert severity="info">
              Configure los parámetros del escenario y haga clic en &quot;Simular&quot; para ver la proyección.
            </Alert>
          ) : (
            <Box>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" variant="body2" gutterBottom>
                        {t('finance_net_savings')} (6 meses)
                      </Typography>
                      <Typography variant="h5" color="success.main">
                        {formatCurrency(totalAhorro)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" variant="body2" gutterBottom>
                        {t('finance_discounts_amount')} Total
                      </Typography>
                      <Typography variant="h5">{formatCurrency(totalDescuentos)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" variant="body2" gutterBottom>
                        DPO Promedio
                      </Typography>
                      <Typography variant="h5">{avgDpoAfter.toFixed(1)} días</Typography>
                      <Typography variant="caption" color="textSecondary">
                        Antes: {avgDpoBefore} días
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Projection Table */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('finance_projection_6mo')}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('finance_period')}</TableCell>
                          <TableCell align="right">{t('finance_invoices_amount')}</TableCell>
                          <TableCell align="right">{t('finance_discounts_amount')}</TableCell>
                          <TableCell align="right">{t('finance_net_savings')}</TableCell>
                          <TableCell align="right">{t('finance_avg_payment_days')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {simulaciones.map((sim, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{sim.periodo}</TableCell>
                            <TableCell align="right">{formatCurrency(sim.monto_facturas)}</TableCell>
                            <TableCell align="right">{formatCurrency(sim.monto_descuentos)}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                              {formatCurrency(sim.ahorro_neto)}
                            </TableCell>
                            <TableCell align="right">{sim.dias_pago_promedio.toFixed(1)} días</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Before/After Comparison */}
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('finance_before_after')}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                          Antes
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          DPO: {avgDpoBefore} días
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Descuentos capturados: $0
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Proceso manual de aprobación
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="subtitle1" gutterBottom fontWeight="bold" color="success.main">
                          Después
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          DPO: {avgDpoAfter.toFixed(1)} días ({(avgDpoAfter - avgDpoBefore).toFixed(1)} días
                          menos)
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Descuentos capturados: {formatCurrency(totalAhorro)} (6 meses)
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Automatización de ofertas dinámicas
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>ROI Proyectado:</strong> Al implementar un programa de descuento dinámico con un{' '}
                      {descuentoPct}% de descuento en {porcentajeElegibles}% de las facturas, se puede capturar un
                      ahorro de {formatCurrency(totalAhorro)} en 6 meses, reduciendo el DPO en{' '}
                      {(avgDpoBefore - avgDpoAfter).toFixed(1)} días.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
