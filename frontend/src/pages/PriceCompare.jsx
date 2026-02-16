/**
 * PriceCompare - Comparar precios de materiales entre proveedores
 *
 * Material searcher + multi-supplier comparison table
 * Quantity input to apply tiered pricing
 *
 * Sprint 82
 */

import { useState, useCallback } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';

import SearchIcon from '@mui/icons-material/Search';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export default function PriceCompare() {
  const { t } = useI18n();
  const toast = useToast();

  const [materialCodigo, setMaterialCodigo] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [searching, setSearching] = useState(false);
  const [precios, setPrecios] = useState([]);
  const [searchExecuted, setSearchExecuted] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!materialCodigo.trim()) {
      toast.warning(t('price_material_requerido', 'Ingrese codigo de material'));
      return;
    }

    const qty = Math.max(1, parseInt(cantidad) || 1);
    setSearching(true);
    setSearchExecuted(true);

    try {
      const res = await api.get(`/prices/material/${materialCodigo.trim()}/compare`, {
        params: { cantidad: qty },
      });

      if (res.data?.ok) {
        setPrecios(res.data.precios || []);
        if (res.data.precios.length === 0) {
          toast.info(t('price_no_precios', 'No se encontraron precios para este material'));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('price_error_comparar', 'Error al comparar precios'));
      setPrecios([]);
    } finally {
      setSearching(false);
    }
  }, [materialCodigo, cantidad, t, toast]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const mejorPrecio = precios.length > 0 ? Math.min(...precios.map((p) => p.precio_final)) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <CompareArrowsIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('price_compare_title', 'Comparar Precios')}
        </Typography>
      </Stack>

      {/* Search Section */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          {t('price_compare_subtitle', 'Buscar y comparar precios entre proveedores')}
        </Typography>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              label={t('price_material', 'Material')}
              value={materialCodigo}
              onChange={(e) => setMaterialCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('price_material_placeholder', 'Codigo de material')}
              fullWidth
              size="small"
              disabled={searching}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label={t('price_cantidad', 'Cantidad')}
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={handleKeyDown}
              fullWidth
              size="small"
              inputProps={{ min: 1 }}
              disabled={searching}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="contained"
              startIcon={searching ? <CircularProgress size={16} /> : <SearchIcon />}
              onClick={handleSearch}
              fullWidth
              disabled={searching}
            >
              {t('price_buscar', 'Buscar')}
            </Button>
          </Grid>
        </Grid>

        {searchExecuted && precios.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('price_compare_hint', 'Mostrando precios para cantidad')}: <strong>{cantidad}</strong>. {t('price_tiered_hint', 'Los precios pueden variar segun cantidad (tiered pricing)')}
          </Alert>
        )}
      </Paper>

      {/* Results Section */}
      {searching ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : searchExecuted && precios.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('price_no_precios', 'No se encontraron precios para este material')}
          </Typography>
        </Paper>
      ) : precios.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Summary Cards */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'success.main', bgcolor: 'success.50' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_mejor_precio', 'Mejor Precio')}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatCurrency(mejorPrecio)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_proveedores_comparados', 'Proveedores Comparados')}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {precios.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_diferencia_maxima', 'Diferencia Maxima')}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatCurrency(
                      Math.max(...precios.map((p) => p.precio_final)) - mejorPrecio
                    )}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Comparison Table */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('price_proveedor', 'Proveedor')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('price_precio_unitario', 'Precio Unitario')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('price_descuento', 'Descuento')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('price_precio_final', 'Precio Final')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('price_rango_cantidad', 'Rango Cantidad')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('price_vigencia', 'Vigencia')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>
                    {t('price_diferencia', 'Diferencia')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {precios.map((precio, idx) => {
                  const esMejor = precio.precio_final === mejorPrecio;
                  const diferenciaPct = mejorPrecio > 0
                    ? ((precio.precio_final - mejorPrecio) / mejorPrecio) * 100
                    : 0;

                  return (
                    <TableRow
                      key={idx}
                      sx={{
                        bgcolor: esMejor ? 'success.50' : 'inherit',
                        '&:hover': { bgcolor: esMejor ? 'success.100' : 'grey.50' },
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="body2" sx={{ fontWeight: esMejor ? 700 : 400 }}>
                            {precio.proveedor_nombre || t('price_sin_proveedor', 'Sin proveedor')}
                          </Typography>
                          {esMejor && (
                            <Chip size="small" label={t('price_mejor', 'Mejor')} color="success" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {precio.lista_nombre}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatCurrency(precio.precio_unitario)}
                        </Typography>
                        {precio.unidad && (
                          <Typography variant="caption" color="text.secondary">
                            / {precio.unidad}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {precio.descuento_pct > 0 ? (
                            <span style={{ color: 'green' }}>{precio.descuento_pct}%</span>
                          ) : (
                            '-'
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: esMejor ? 700 : 400 }}>
                          {formatCurrency(precio.precio_final)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {precio.cantidad_minima}{' '}
                          {precio.cantidad_maxima ? `- ${precio.cantidad_maxima}` : '+'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {precio.fecha_vigencia_desde ? formatDate(precio.fecha_vigencia_desde) : '-'}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {precio.fecha_vigencia_hasta ? formatDate(precio.fecha_vigencia_hasta) : t('price_sin_limite', 'Sin limite')}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {esMejor ? (
                          <Chip
                            size="small"
                            icon={<TrendingDownIcon />}
                            label="0%"
                            color="success"
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<TrendingUpIcon />}
                            label={`+${diferenciaPct.toFixed(1)}%`}
                            color={diferenciaPct > 20 ? 'error' : 'warning'}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>

          {/* Footer Note */}
          <Alert severity="info" variant="outlined">
            {t('price_compare_note', 'Los precios mostrados corresponden a listas activas. Verifique disponibilidad y condiciones con el proveedor antes de generar la orden de compra.')}
          </Alert>
        </Box>
      ) : null}
    </Box>
  );
}
