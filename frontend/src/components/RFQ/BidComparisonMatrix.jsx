/**
 * BidComparisonMatrix - Tabla pivot de comparacion de ofertas
 *
 * Filas = items, Columnas = proveedores, Celdas = precio + lead_time.
 * Resalta en verde el precio mas bajo por item.
 * Sprint 57
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';

export default function BidComparisonMatrix({ rfqId }) {
  const { t } = useI18n();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchComparison = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/rfq/${rfqId}/comparison`);
      if (res.data?.ok) {
        setData(res.data);
      }
    } catch {
      toast.error(t('rfq_error_comparacion', 'Error al cargar comparacion'));
    } finally {
      setLoading(false);
    }
  }, [rfqId, t, toast]);

  useEffect(() => {
    if (rfqId) fetchComparison();
  }, [rfqId, fetchComparison]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data || !data.items?.length || !data.proveedores?.length) {
    return (
      <Alert severity="info">
        {t('rfq_comparacion_sin_datos', 'No hay datos suficientes para comparar. Se necesitan ofertas de al menos 2 proveedores.')}
      </Alert>
    );
  }

  const { items, proveedores, matrix } = data;

  // For each item, find the lowest price to highlight
  const getMinPrice = (itemId) => {
    if (!matrix?.[itemId]) return null;
    const prices = Object.values(matrix[itemId])
      .map((cell) => cell.precio)
      .filter((p) => p != null && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t('rfq_comparacion_titulo', 'Matriz de Comparacion de Ofertas')}
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 500 }}>
        <Table size="small" stickyHeader aria-label={t('rfq_comparacion_titulo', 'Matriz de Comparacion')}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 180, bgcolor: 'background.paper' }}>
                {t('rfq_item', 'Item')}
              </TableCell>
              {proveedores.map((prov) => (
                <TableCell
                  key={prov.id || prov.cuit}
                  align="center"
                  sx={{ fontWeight: 700, minWidth: 160, bgcolor: 'background.paper' }}
                >
                  {prov.nombre || prov.cuit}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const minPrice = getMinPrice(item.id || item.material_codigo);
              return (
                <TableRow key={item.id || item.material_codigo} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.material_codigo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.descripcion}
                    </Typography>
                  </TableCell>
                  {proveedores.map((prov) => {
                    const provKey = prov.id || prov.cuit;
                    const itemKey = item.id || item.material_codigo;
                    const cell = matrix?.[itemKey]?.[provKey];

                    if (!cell) {
                      return (
                        <TableCell key={provKey} align="center" sx={{ color: 'text.disabled' }}>
                          -
                        </TableCell>
                      );
                    }

                    const isLowest = minPrice != null && cell.precio != null && cell.precio === minPrice;

                    return (
                      <TableCell
                        key={provKey}
                        align="center"
                        sx={{
                          bgcolor: isLowest ? 'success.lighter' : 'transparent',
                          fontWeight: isLowest ? 700 : 400,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isLowest ? 700 : 400,
                            color: isLowest ? 'success.dark' : 'text.primary',
                          }}
                        >
                          {cell.precio != null
                            ? `USD ${Number(cell.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </Typography>
                        {cell.lead_time != null && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {cell.lead_time} {t('rfq_dias', 'dias')}
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
