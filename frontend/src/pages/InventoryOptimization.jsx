/**
 * InventoryOptimization - Multi-location inventory optimization
 *
 * Shows imbalances and transfers in tabbed view with KPI cards.
 * Includes ImbalanceHeatmap visualization and transfer management.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BalanceIcon from '@mui/icons-material/Balance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import LinkIcon from '@mui/icons-material/Link';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import ImbalanceHeatmap from '../components/ImbalanceHeatmap';

const TRANSFER_ESTADO_COLORS = {
  proposed: 'default',
  approved: 'info',
  in_transit: 'warning',
  completed: 'success',
  received: 'success',
  cancelled: 'error',
};

const TRANSFER_ESTADO_LABELS = {
  proposed: 'Propuesta',
  approved: 'Aprobada',
  in_transit: 'En Transito',
  completed: 'Completada',
  received: 'Recibida',
  cancelled: 'Cancelada',
};

const PRIORIDAD_COLORS = {
  urgent: 'error',
  high: 'warning',
  normal: 'default',
  low: 'info',
};

export default function InventoryOptimization() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [currentTab, setCurrentTab] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [imbalances, setImbalances] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loadingImbalances, setLoadingImbalances] = useState(true);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/inventory-optimization/kpis');
        if (!cancelled && res.data?.ok) setKpis(res.data);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingImbalances(true);
      try {
        const res = await api.get('/inventory-optimization/imbalances');
        if (!cancelled && res.data?.ok) setImbalances(res.data.imbalances || res.data.items || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('inventory_error_imbalances', 'Error al cargar desbalances'));
      } finally {
        if (!cancelled) setLoadingImbalances(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTransfers(true);
      try {
        const res = await api.get('/inventory-optimization/transfers');
        if (!cancelled && res.data?.ok) setTransfers(res.data.transfers || res.data.items || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('inventory_error_transfers', 'Error al cargar transferencias'));
      } finally {
        if (!cancelled) setLoadingTransfers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const handleProposeTransfers = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.post('/inventory-optimization/transfers/propose');
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('inventory_transfers_proposed', 'Transferencias propuestas exitosamente'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('inventory_error_propose', 'Error al proponer transferencias'));
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleTransferAction = useCallback(async (transferId, action) => {
    try {
      // Map action to correct endpoint
      const endpoint = action === 'approved'
        ? `/inventory-optimization/transfers/${transferId}/approve`
        : `/inventory-optimization/transfers/${transferId}/complete`;
      const res = await api.put(endpoint);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('inventory_transfer_updated', 'Transferencia actualizada'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('inventory_error_action', 'Error al actualizar transferencia'));
    }
  }, []);

  const imbalanceColumns = useMemo(() => [
    { field: 'material_codigo', headerName: t('inventory_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'almacen_exceso', headerName: t('inventory_almacen_exceso', 'Almacen Exceso'), width: 140 },
    { field: 'almacen_deficit', headerName: t('inventory_almacen_deficit', 'Almacen Deficit'), width: 140 },
    { field: 'qty_exceso', headerName: t('inventory_qty_exceso', 'Cant. Exceso'), width: 120, type: 'numericColumn' },
    { field: 'qty_deficit', headerName: t('inventory_qty_deficit', 'Cant. Deficit'), width: 120, type: 'numericColumn' },
  ], [t]);

  const transferColumns = useMemo(() => [
    { field: 'numero_transferencia', headerName: t('inventory_numero', 'N. Transferencia'), flex: 1, minWidth: 150 },
    { field: 'material_codigo', headerName: t('inventory_material', 'Material'), width: 140 },
    { field: 'almacen_origen', headerName: t('inventory_origen', 'Origen'), width: 120 },
    { field: 'almacen_destino', headerName: t('inventory_destino', 'Destino'), width: 120 },
    { field: 'cantidad', headerName: t('inventory_cantidad', 'Cantidad'), width: 100, type: 'numericColumn' },
    {
      field: 'estado', headerName: t('inventory_estado', 'Estado'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={TRANSFER_ESTADO_LABELS[p.value] || p.value} color={TRANSFER_ESTADO_COLORS[p.value] || 'default'} />,
    },
    {
      field: 'prioridad', headerName: t('inventory_prioridad', 'Prioridad'), width: 110,
      cellRenderer: (p) => <Chip size="small" label={p.value} color={PRIORIDAD_COLORS[p.value] || 'default'} variant="outlined" />,
    },
    {
      field: 'acciones', headerName: t('inventory_acciones', 'Acciones'), width: 200,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const estado = p.data?.estado;
        const actions = [];
        if (estado === 'proposed') {
          actions.push(
            <Button key="approve" size="small" variant="outlined" color="info" startIcon={<ThumbUpIcon sx={{ fontSize: 14 }} />} onClick={(e) => { e.stopPropagation(); handleTransferAction(p.data.id, 'approved'); }} sx={{ textTransform: 'none', fontSize: '0.7rem', mr: 0.5 }}>
              {t('inventory_approve', 'Aprobar')}
            </Button>
          );
        }
        if (estado === 'approved' || estado === 'in_transit') {
          actions.push(
            <Button key="complete" size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />} onClick={(e) => { e.stopPropagation(); handleTransferAction(p.data.id, 'completed'); }} sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
              {t('inventory_complete', 'Completar')}
            </Button>
          );
        }
        return <Stack direction="row" gap={0.5}>{actions}</Stack>;
      },
    },
  ], [t, handleTransferAction]);

  // Prepare heatmap data from imbalances
  const heatmapData = useMemo(() => {
    const dataPoints = [];
    imbalances.forEach(imb => {
      if (imb.almacen_exceso && imb.qty_exceso != null) {
        dataPoints.push({ material_codigo: imb.material_codigo, almacen: imb.almacen_exceso, ratio: 2.0 });
      }
      if (imb.almacen_deficit && imb.qty_deficit != null) {
        dataPoints.push({ material_codigo: imb.material_codigo, almacen: imb.almacen_deficit, ratio: 0.3 });
      }
    });
    return dataPoints;
  }, [imbalances]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 180 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        {icon}
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>
        {value != null ? value : '--'}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <BalanceIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
            {t('inventory_title', 'Optimizacion de Inventario')}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => navigate('/operations/service-levels')}>
            {t('inventory_service_levels', 'Niveles de Servicio')}
          </Button>
          <Button variant="contained" startIcon={processing ? <CircularProgress size={16} /> : <SwapHorizIcon />} onClick={handleProposeTransfers} disabled={processing}>
            {t('inventory_propose', 'Proponer Transferencias')}
          </Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <KpiCard
            icon={<LocalShippingIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('inventory_kpi_pending', 'Transferencias Pendientes')}
            value={kpis.transferencias_pendientes}
            color="info.main"
          />
          <KpiCard
            icon={<WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('inventory_kpi_imbalances', 'Desbalances Detectados')}
            value={kpis.desbalances_detectados}
            color="warning.main"
          />
          <KpiCard
            icon={<TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('inventory_kpi_service', 'Nivel Servicio Promedio')}
            value={kpis.nivel_servicio_promedio != null ? `${Number(kpis.nivel_servicio_promedio).toFixed(1)}%` : null}
            color="success.main"
          />
        </Stack>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_, val) => setCurrentTab(val)} aria-label={t('inventory_tabs', 'Secciones de Inventario')} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('inventory_tab_imbalances', 'Desbalances')} />
          <Tab label={t('inventory_tab_transfers', 'Transferencias')} />
        </Tabs>

        <Box sx={{ p: currentTab === 0 ? 2 : 0 }}>
          {currentTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Heatmap */}
              {heatmapData.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('inventory_heatmap', 'Mapa de Calor de Desbalances')}</Typography>
                  <ImbalanceHeatmap data={heatmapData} />
                </Box>
              )}
              {/* Table */}
              <SPMAgGrid
                columnDefs={imbalanceColumns}
                rowData={imbalances}
                loading={loadingImbalances}
                height={400}
                pagination={true}
                paginationPageSize={20}
                enableQuickFilter={true}
                exportFileName="desbalances_inventario"
                emptyMessage={t('inventory_no_imbalances', 'No se detectaron desbalances')}
              />
            </Box>
          )}
          {currentTab === 1 && (
            <SPMAgGrid
              columnDefs={transferColumns}
              rowData={transfers}
              loading={loadingTransfers}
              height={500}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="transferencias_inventario"
              emptyMessage={t('inventory_no_transfers', 'No hay transferencias registradas')}
              getRowId={(params) => String(params.data.id)}
            />
          )}
        </Box>
      </Paper>
    </Box>
    </Box>
  );
}
