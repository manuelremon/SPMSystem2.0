/**
 * MatchComparisonTable - Reusable side-by-side PO vs Receipt vs Invoice comparison
 *
 * Renders a 3-column-group MUI Table comparing order, receipt, and invoice line items.
 * Highlights mismatches with a red background and shows difference rows at the bottom.
 */

import { useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { formatCurrency } from '../utils/formatters';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

const MISMATCH_BG = 'rgba(239, 68, 68, 0.08)';
const MISMATCH_COLOR = '#dc2626';

function hasMismatch(poVal, receiptVal, invoiceVal) {
  const vals = [poVal, receiptVal, invoiceVal].filter(v => v != null);
  if (vals.length < 2) return false;
  return !vals.every(v => Number(v) === Number(vals[0]));
}

export default function MatchComparisonTable({ comparison }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!comparison) return [];

    const poItems = comparison.po_items || [];
    const receiptItems = comparison.receipt_items || [];
    const invoiceItems = comparison.invoice_items || [];

    // Build a unified list of materials across all three sources
    const materialMap = new Map();

    const addItems = (items, source) => {
      items.forEach(item => {
        const key = item.material_codigo || item.material || item.codigo;
        if (!key) return;
        if (!materialMap.has(key)) {
          materialMap.set(key, { material: key, descripcion: item.descripcion || '' });
        }
        materialMap.get(key)[source] = item;
      });
    };

    addItems(poItems, 'po');
    addItems(receiptItems, 'receipt');
    addItems(invoiceItems, 'invoice');

    return Array.from(materialMap.values());
  }, [comparison]);

  if (!comparison || rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('match_no_data', 'No hay datos de comparacion disponibles')}
        </Typography>
      </Box>
    );
  }

  // Compute totals
  const totals = rows.reduce((acc, row) => {
    acc.po_qty += Number(row.po?.cantidad || 0);
    acc.po_price += Number(row.po?.precio_total || row.po?.precio_unitario || 0);
    acc.receipt_qty += Number(row.receipt?.cantidad_recibida || row.receipt?.cantidad || 0);
    acc.invoice_qty += Number(row.invoice?.cantidad_facturada || row.invoice?.cantidad || 0);
    acc.invoice_price += Number(row.invoice?.precio_total || row.invoice?.precio_unitario || 0);
    return acc;
  }, { po_qty: 0, po_price: 0, receipt_qty: 0, invoice_qty: 0, invoice_price: 0 });

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label={t('match_comparison_table', 'Tabla de comparacion 3-way')}>
        <TableHead>
          <TableRow>
            <TableCell rowSpan={2} sx={{ fontWeight: 700, borderRight: '1px solid', borderColor: 'divider' }}>
              {t('match_material', 'Material')}
            </TableCell>
            <TableCell
              colSpan={2}
              align="center"
              sx={{ fontWeight: 700, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'primary.50', color: 'primary.main' }}
            >
              {t('match_oc', 'Orden de Compra')}
            </TableCell>
            <TableCell
              colSpan={1}
              align="center"
              sx={{ fontWeight: 700, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'info.50', color: 'info.main' }}
            >
              {t('match_recepcion', 'Recepcion')}
            </TableCell>
            <TableCell
              colSpan={2}
              align="center"
              sx={{ fontWeight: 700, bgcolor: 'warning.50', color: 'warning.main' }}
            >
              {t('match_factura', 'Factura')}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid', borderColor: 'divider', fontSize: '0.75rem' }}>
              {t('match_cantidad', 'Cantidad')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid', borderColor: 'divider', fontSize: '0.75rem' }}>
              {t('match_precio', 'Precio')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid', borderColor: 'divider', fontSize: '0.75rem' }}>
              {t('match_cant_recibida', 'Cant. Recibida')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              {t('match_cant_facturada', 'Cant. Facturada')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              {t('match_precio_facturado', 'Precio Facturado')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const poQty = row.po?.cantidad;
            const poPrice = row.po?.precio_total || row.po?.precio_unitario;
            const receiptQty = row.receipt?.cantidad_recibida || row.receipt?.cantidad;
            const invoiceQty = row.invoice?.cantidad_facturada || row.invoice?.cantidad;
            const invoicePrice = row.invoice?.precio_total || row.invoice?.precio_unitario;

            const qtyMismatch = hasMismatch(poQty, receiptQty, invoiceQty);
            const priceMismatch = hasMismatch(poPrice, null, invoicePrice);

            return (
              <TableRow key={row.material} hover>
                <TableCell sx={{ fontWeight: 600, borderRight: '1px solid', borderColor: 'divider' }}>
                  {row.material}
                  {row.descripcion && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {row.descripcion}
                    </Typography>
                  )}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: qtyMismatch ? MISMATCH_BG : 'transparent',
                    color: qtyMismatch ? MISMATCH_COLOR : 'text.primary',
                  }}
                >
                  {poQty != null ? Number(poQty).toLocaleString('es-ES') : '-'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: priceMismatch ? MISMATCH_BG : 'transparent',
                    color: priceMismatch ? MISMATCH_COLOR : 'text.primary',
                  }}
                >
                  {poPrice != null ? formatCurrency(poPrice) : '-'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    bgcolor: qtyMismatch ? MISMATCH_BG : 'transparent',
                    color: qtyMismatch ? MISMATCH_COLOR : 'text.primary',
                  }}
                >
                  {receiptQty != null ? Number(receiptQty).toLocaleString('es-ES') : '-'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    bgcolor: qtyMismatch ? MISMATCH_BG : 'transparent',
                    color: qtyMismatch ? MISMATCH_COLOR : 'text.primary',
                  }}
                >
                  {invoiceQty != null ? Number(invoiceQty).toLocaleString('es-ES') : '-'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    bgcolor: priceMismatch ? MISMATCH_BG : 'transparent',
                    color: priceMismatch ? MISMATCH_COLOR : 'text.primary',
                  }}
                >
                  {invoicePrice != null ? formatCurrency(invoicePrice) : '-'}
                </TableCell>
              </TableRow>
            );
          })}

          {/* Totals / Difference row */}
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 700, borderRight: '1px solid', borderColor: 'divider' }}>
              {t('match_diferencia', 'TOTALES / DIFERENCIA')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, borderRight: '1px solid', borderColor: 'divider' }}>
              {totals.po_qty.toLocaleString('es-ES')}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, borderRight: '1px solid', borderColor: 'divider' }}>
              {formatCurrency(totals.po_price)}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontWeight: 700,
                borderRight: '1px solid',
                borderColor: 'divider',
                color: totals.receipt_qty !== totals.po_qty ? MISMATCH_COLOR : 'text.primary',
              }}
            >
              {totals.receipt_qty.toLocaleString('es-ES')}
              {totals.receipt_qty !== totals.po_qty && (
                <Typography variant="caption" display="block" sx={{ color: MISMATCH_COLOR }}>
                  ({totals.receipt_qty - totals.po_qty > 0 ? '+' : ''}{(totals.receipt_qty - totals.po_qty).toLocaleString('es-ES')})
                </Typography>
              )}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontWeight: 700,
                color: totals.invoice_qty !== totals.po_qty ? MISMATCH_COLOR : 'text.primary',
              }}
            >
              {totals.invoice_qty.toLocaleString('es-ES')}
              {totals.invoice_qty !== totals.po_qty && (
                <Typography variant="caption" display="block" sx={{ color: MISMATCH_COLOR }}>
                  ({totals.invoice_qty - totals.po_qty > 0 ? '+' : ''}{(totals.invoice_qty - totals.po_qty).toLocaleString('es-ES')})
                </Typography>
              )}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontWeight: 700,
                color: totals.invoice_price !== totals.po_price ? MISMATCH_COLOR : 'text.primary',
              }}
            >
              {formatCurrency(totals.invoice_price)}
              {totals.invoice_price !== totals.po_price && (
                <Typography variant="caption" display="block" sx={{ color: MISMATCH_COLOR }}>
                  ({formatCurrency(totals.invoice_price - totals.po_price)})
                </Typography>
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
