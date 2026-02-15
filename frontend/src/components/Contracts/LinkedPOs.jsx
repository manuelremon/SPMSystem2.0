/**
 * LinkedPOs - Purchase orders linked to a contract
 *
 * Simple table showing OCs associated with the given contract.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { SPMAgGrid } from '../ui/SPMAgGrid';

const ESTADO_COLORS = {
  borrador: 'default',
  enviada: 'info',
  confirmada: 'success',
  recibida: 'success',
  cancelada: 'error',
};

export default function LinkedPOs({ contractId }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [ocs, setOcs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOCs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/ordenes-compra', { params: { contrato_id: contractId } });
      if (res.data?.ok) {
        setOcs(res.data.ordenes || res.data.items || []);
      }
    } catch {
      toast.error(t('contracts_ocs_error', 'Error al cargar ordenes de compra'));
    } finally {
      setLoading(false);
    }
  }, [contractId, t, toast]);

  useEffect(() => { fetchOCs(); }, [fetchOCs]);

  const columnDefs = useMemo(() => [
    { field: 'numero_oc', headerName: t('contracts_ocs_numero', 'N. OC'), flex: 1, minWidth: 130 },
    {
      field: 'estado', headerName: t('contracts_ocs_estado', 'Estado'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />,
    },
    {
      field: 'monto_total', headerName: t('contracts_ocs_monto', 'Monto'), width: 140,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'fecha_emision', headerName: t('contracts_ocs_fecha', 'Fecha Emision'), width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        {t('contracts_tab_ocs', 'OCs Vinculadas')} ({ocs.length})
      </Typography>
      <SPMAgGrid
        columnDefs={columnDefs}
        rowData={ocs}
        loading={loading}
        height={300}
        onRowClick={(row) => navigate(`/procurement/ordenes-compra/${row.id}`)}
        emptyMessage={t('contracts_ocs_empty', 'Sin ordenes de compra vinculadas')}
        getRowId={(params) => String(params.data.id)}
      />
    </Box>
  );
}
