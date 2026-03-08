/**
 * InvoiceDetail - Detail page for a single invoice with 3-way matching comparison
 *
 * Shows invoice header, line items, matching comparison table,
 * and actions to execute matching or resolve discrepancies.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import MatchComparisonTable from '../components/MatchComparisonTable';

const ESTADO_COLORS = {
  pending: 'default',
  matched: 'success',
  disputed: 'error',
  approved: 'info',
  paid: 'success',
};

const ESTADO_LABELS = {
  pending: 'Pendiente',
  matched: 'Matched',
  disputed: 'Disputed',
  approved: 'Aprobada',
  paid: 'Pagada',
};

const MATCH_RESULT_COLORS = {
  ok: 'success',
  mismatch: 'error',
  tolerance: 'warning',
  pending: 'default',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  const [resolveDialog, setResolveDialog] = useState({ open: false, resultId: null, notas: '' });
  const [resolving, setResolving] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/matching/invoices/${id}`);
      if (res.data?.ok) {
        setInvoice(res.data.invoice || res.data);
      }
    } catch {
      toast.error(t('invoice_error_detail', 'Error al cargar factura'));
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  const fetchComparison = useCallback(async () => {
    try {
      setComparisonLoading(true);
      const res = await api.get(`/matching/invoices/${id}/comparison`);
      if (res.data?.ok) {
        setComparison(res.data.comparison || res.data);
      }
    } catch {
      // Comparison may not exist yet, fail silently
    } finally {
      setComparisonLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);
  useEffect(() => { fetchComparison(); }, [fetchComparison]);

  const handleRunMatching = useCallback(async () => {
    try {
      setMatchingInProgress(true);
      const res = await api.post(`/matching/invoices/${id}/match`);
      if (res.data?.ok) {
        toast.success(t('invoice_matching_success', 'Matching ejecutado correctamente'));
        fetchInvoice();
        fetchComparison();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('invoice_matching_error', 'Error al ejecutar matching'));
    } finally {
      setMatchingInProgress(false);
    }
  }, [id, fetchInvoice, fetchComparison, t, toast]);

  const handleResolve = useCallback(async () => {
    try {
      setResolving(true);
      const res = await api.put(`/matching/results/${resolveDialog.resultId}/resolve`, {
        notas: resolveDialog.notas,
      });
      if (res.data?.ok) {
        toast.success(t('invoice_resolve_success', 'Discrepancia resuelta'));
        setResolveDialog({ open: false, resultId: null, notas: '' });
        fetchComparison();
        fetchInvoice();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('invoice_resolve_error', 'Error al resolver discrepancia'));
    } finally {
      setResolving(false);
    }
  }, [resolveDialog, fetchComparison, fetchInvoice, t, toast]);

  const itemColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('invoice_item_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'descripcion', headerName: t('invoice_item_desc', 'Descripcion'), flex: 2, minWidth: 180 },
    {
      field: 'cantidad_facturada', headerName: t('invoice_item_cantidad', 'Cantidad'), width: 120,
      valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString('es-ES') : '-',
    },
    {
      field: 'precio_unitario', headerName: t('invoice_item_precio_unit', 'Precio Unit.'), width: 140,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'precio_total', headerName: t('invoice_item_precio_total', 'Precio Total'), width: 150,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={160} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (!invoice) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('invoice_not_found', 'Factura no encontrada')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/procurement/invoices')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = invoice.estado || 'pending';
  const items = invoice.items || [];
  const matchingResults = comparison?.resultados || comparison?.matching_results || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/procurement/invoices')}
        color="inherit"
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header card */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <ReceiptLongIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {invoice.numero_factura}
              </Typography>
              <Chip
                size="small"
                label={ESTADO_LABELS[estado] || estado}
                color={ESTADO_COLORS[estado] || 'default'}
              />
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">
                {t('invoice_proveedor_cuit', 'CUIT Proveedor')}: <strong>{invoice.proveedor_cuit}</strong>
                {invoice.proveedor_nombre && ` - ${invoice.proveedor_nombre}`}
              </Typography>
              <Typography variant="body2">
                {t('invoice_monto', 'Monto Total')}: <strong>{formatCurrency(invoice.monto_total)}</strong>
              </Typography>
              <Typography variant="body2">
                {t('invoice_fecha', 'Fecha Factura')}: {formatDate(invoice.fecha_factura)}
              </Typography>
              {invoice.tipo_comprobante && (
                <Typography variant="body2">
                  {t('invoice_tipo', 'Tipo Comprobante')}: {invoice.tipo_comprobante}
                </Typography>
              )}
              {invoice.numero_oc && (
                <Typography variant="body2">
                  {t('invoice_oc_ref', 'OC Referencia')}: {invoice.numero_oc}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Action buttons */}
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={matchingInProgress ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
              onClick={handleRunMatching}
              disabled={matchingInProgress}
            >
              {t('invoice_run_matching', 'Ejecutar Matching')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Invoice Items */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('invoice_items_title', 'Items de Factura')}
          </Typography>
        </Box>
        <SPMAgGrid
          columnDefs={itemColumnDefs}
          rowData={items}
          loading={false}
          height={300}
          pagination={false}
          enableQuickFilter={false}
          exportFileName="factura_items"
          emptyMessage={t('invoice_items_empty', 'Sin items')}
          getRowId={(params) => String(params.data.id || params.data.material_codigo)}
        />
      </Paper>

      {/* Matching Comparison */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          {t('invoice_matching_title', 'Comparacion 3-Way Matching')}
        </Typography>

        {comparisonLoading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : comparison ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <MatchComparisonTable comparison={comparison} />

            {/* Matching Results */}
            {matchingResults.length > 0 && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  {t('invoice_match_results', 'Resultados del Matching')}
                </Typography>
                <Stack spacing={1.5}>
                  {matchingResults.map((result, idx) => (
                    <Paper
                      key={result.id || idx}
                      variant="outlined"
                      sx={{ p: 2 }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
                        <Box>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {result.material_codigo || `Item ${idx + 1}`}
                            </Typography>
                            <Chip
                              size="small"
                              label={result.estado || 'pending'}
                              color={MATCH_RESULT_COLORS[result.estado] || 'default'}
                            />
                          </Stack>
                          {result.diferencia_cantidad != null && (
                            <Typography variant="caption" color="text.secondary">
                              {t('invoice_diff_qty', 'Dif. Cantidad')}: {result.diferencia_cantidad}
                            </Typography>
                          )}
                          {result.diferencia_precio != null && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                              {t('invoice_diff_price', 'Dif. Precio')}: {formatCurrency(result.diferencia_precio)}
                            </Typography>
                          )}
                        </Box>
                        {result.estado === 'mismatch' && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => setResolveDialog({ open: true, resultId: result.id, notas: '' })}
                          >
                            {t('invoice_resolve', 'Resolver')}
                          </Button>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {t('invoice_no_comparison', 'No se ha ejecutado el matching aun. Presione "Ejecutar Matching" para comparar.')}
          </Typography>
        )}
      </Paper>

      {/* Resolve Discrepancy Dialog */}
      <Dialog
        open={resolveDialog.open}
        onClose={() => setResolveDialog({ open: false, resultId: null, notas: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('invoice_resolve_title', 'Resolver Discrepancia')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('invoice_resolve_desc', 'Ingrese las notas de resolucion para esta discrepancia.')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('invoice_resolve_notas', 'Notas de resolucion')}
            value={resolveDialog.notas}
            onChange={(e) => setResolveDialog(prev => ({ ...prev, notas: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialog({ open: false, resultId: null, notas: '' })}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleResolve}
            disabled={resolving}
            startIcon={resolving && <CircularProgress size={16} />}
          >
            {t('invoice_resolve_confirm', 'Confirmar Resolucion')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
