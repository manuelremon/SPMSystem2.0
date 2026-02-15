/**
 * InventoryAging - Analisis de antiguedad de inventario y disposicion SLOB
 *
 * Tab 1: Analisis de antiguedad con filas coloreadas por rango de dias.
 * Tab 2: Disposiciones SLOB con badges de estado y boton para proponer.
 * Sprint 53
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InventoryIcon from '@mui/icons-material/Inventory';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import DispositionModal from '../components/SLOB/DispositionModal';

const AGING_COLORS = {
  fresh: { bg: 'bg-green-50', border: 'border-green-200', label: '0-30 dias', color: 'success' },
  moderate: { bg: 'bg-yellow-50', border: 'border-yellow-200', label: '31-90 dias', color: 'warning' },
  aging: { bg: 'bg-orange-50', border: 'border-orange-200', label: '91-180 dias', color: 'warning' },
  obsolete: { bg: 'bg-red-50', border: 'border-red-200', label: '180+ dias', color: 'error' },
};

function getAgingBucket(days) {
  if (days <= 30) return 'fresh';
  if (days <= 90) return 'moderate';
  if (days <= 180) return 'aging';
  return 'obsolete';
}

const DISPOSITION_STATUS_COLORS = {
  pendiente: 'warning',
  aprobada: 'success',
  rechazada: 'error',
  ejecutada: 'info',
};

export default function InventoryAging() {
  const { t } = useI18n();
  const toast = useToast();

  const [tab, setTab] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [agingData, setAgingData] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ categoria: '', almacen: '', material: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchKpis = useCallback(async () => {
    try {
      const { data } = await api.get('/api/slob/kpis');
      setKpis(data);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchAging = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const { data } = await api.get('/api/slob/aging', { params });
      setAgingData(data.items || []);
    } catch {
      toast.error(t('slob_error_aging', 'Error al cargar datos de antiguedad'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  const fetchDispositions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/slob/disposition');
      setDispositions(data.items || []);
    } catch {
      toast.error(t('slob_error_dispositions', 'Error al cargar disposiciones'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    if (tab === 0) {
      fetchAging();
    } else {
      fetchDispositions();
    }
  }, [tab, fetchAging, fetchDispositions]);

  const handleRefreshSnapshot = useCallback(async () => {
    setRefreshing(true);
    try {
      await api.post('/api/slob/snapshot');
      toast.success(t('slob_snapshot_ok', 'Snapshot actualizado'));
      fetchKpis();
      fetchAging();
    } catch {
      toast.error(t('slob_snapshot_error', 'Error al actualizar snapshot'));
    } finally {
      setRefreshing(false);
    }
  }, [t, toast, fetchKpis, fetchAging]);

  const handleProposeDisposition = useCallback((item) => {
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const handleDispositionCreated = useCallback(() => {
    setModalOpen(false);
    setSelectedItem(null);
    fetchDispositions();
    fetchKpis();
    toast.success(t('slob_disposition_created', 'Disposicion propuesta exitosamente'));
  }, [fetchDispositions, fetchKpis, t, toast]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const fmtMoney = (val) =>
    (val || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          {t('slob_title', 'Inventario Aging & SLOB')}
        </Typography>
        <Tooltip title={t('slob_refresh', 'Actualizar snapshot')}>
          <IconButton onClick={handleRefreshSnapshot} disabled={refreshing}>
            {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <InventoryIcon fontSize="small" color="primary" />
              <Typography variant="caption" color="text.secondary">
                {t('slob_total_items', 'Items en Stock')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold">
              {(kpis.total_items || 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <WarningAmberIcon fontSize="small" color="warning" />
              <Typography variant="caption" color="text.secondary">
                {t('slob_items_over_180', 'Items > 180 dias')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold" color="error.main">
              {(kpis.items_over_180 || 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <AttachMoneyIcon fontSize="small" color="error" />
              <Typography variant="caption" color="text.secondary">
                {t('slob_valor_obsoleto', 'Valor Obsoleto')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold" color="error.main">
              {fmtMoney(kpis.valor_obsoleto)}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <DeleteSweepIcon fontSize="small" color="info" />
              <Typography variant="caption" color="text.secondary">
                {t('slob_dispositions_pending', 'Disposiciones Pendientes')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold">
              {kpis.disposiciones_pendientes || 0}
            </Typography>
          </Paper>
        </div>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t('slob_tab_aging', 'Analisis de Antiguedad')} />
          <Tab label={t('slob_tab_dispositions', 'Disposiciones SLOB')} />
        </Tabs>
      </Paper>

      {/* Tab 0: Aging Analysis */}
      {tab === 0 && (
        <>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="end">
              <TextField
                label={t('slob_filter_category', 'Categoria')}
                size="small"
                value={filters.categoria}
                onChange={(e) => handleFilterChange('categoria', e.target.value)}
                sx={{ width: 160 }}
              />
              <TextField
                label={t('slob_filter_warehouse', 'Almacen')}
                size="small"
                value={filters.almacen}
                onChange={(e) => handleFilterChange('almacen', e.target.value)}
                sx={{ width: 160 }}
              />
              <TextField
                label={t('slob_filter_material', 'Material')}
                size="small"
                value={filters.material}
                onChange={(e) => handleFilterChange('material', e.target.value)}
                sx={{ width: 200 }}
              />
              <Button variant="contained" size="small" onClick={fetchAging}>
                {t('common_filter', 'Filtrar')}
              </Button>
            </Stack>
          </Paper>

          {/* Aging Legend */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            {Object.entries(AGING_COLORS).map(([key, cfg]) => (
              <Stack key={key} direction="row" spacing={0.5} alignItems="center">
                <div className={`w-3 h-3 rounded ${cfg.bg} ${cfg.border} border`} />
                <Typography variant="caption">{cfg.label}</Typography>
              </Stack>
            ))}
          </Stack>

          {/* Aging Table */}
          <Paper sx={{ overflow: 'hidden' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_material', 'Material')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_description', 'Descripcion')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_warehouse', 'Almacen')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('slob_quantity', 'Cantidad')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('slob_value', 'Valor')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">{t('slob_days', 'Dias')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">{t('slob_bucket', 'Rango')}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <CircularProgress size={24} />
                    </td>
                  </tr>
                ) : agingData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      {t('slob_empty', 'Sin datos')}
                    </td>
                  </tr>
                ) : (
                  agingData.map((item) => {
                    const bucket = getAgingBucket(item.dias || 0);
                    const style = AGING_COLORS[bucket];
                    return (
                      <tr key={item.id || item.material} className={`${style.bg} hover:opacity-90`}>
                        <td className="px-4 py-2 font-mono text-xs">{item.material}</td>
                        <td className="px-4 py-2">{item.descripcion}</td>
                        <td className="px-4 py-2">{item.almacen}</td>
                        <td className="px-4 py-2 text-right">{(item.cantidad || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{fmtMoney(item.valor)}</td>
                        <td className="px-4 py-2 text-right font-medium">{item.dias}</td>
                        <td className="px-4 py-2 text-center">
                          <Chip label={style.label} size="small" color={style.color} variant="outlined" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          {bucket === 'obsolete' && (
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={() => handleProposeDisposition(item)}
                            >
                              {t('slob_propose', 'Disponer')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Paper>
        </>
      )}

      {/* Tab 1: Dispositions */}
      {tab === 1 && (
        <Paper sx={{ overflow: 'hidden' }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_material', 'Material')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_warehouse', 'Almacen')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_disposition_type', 'Tipo')}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">{t('slob_quantity', 'Cantidad')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_status', 'Estado')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_created_by', 'Creado por')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('slob_date', 'Fecha')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <CircularProgress size={24} />
                  </td>
                </tr>
              ) : dispositions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {t('slob_no_dispositions', 'Sin disposiciones registradas')}
                  </td>
                </tr>
              ) : (
                dispositions.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{d.material}</td>
                    <td className="px-4 py-2">{d.almacen}</td>
                    <td className="px-4 py-2 capitalize">{d.tipo}</td>
                    <td className="px-4 py-2 text-right">{(d.cantidad || 0).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <Chip
                        label={d.estado}
                        size="small"
                        color={DISPOSITION_STATUS_COLORS[d.estado] || 'default'}
                        variant="outlined"
                      />
                    </td>
                    <td className="px-4 py-2">{d.creado_por_nombre || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Paper>
      )}

      {/* Disposition Modal */}
      <DispositionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        onCreated={handleDispositionCreated}
      />
    </Box>
  );
}
