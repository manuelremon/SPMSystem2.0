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
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import LinkIcon from '@mui/icons-material/Link';
import InventoryIcon from '@mui/icons-material/Inventory';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import ImbalanceHeatmap from '../components/ImbalanceHeatmap';
import PageLayout from '../components/ui/PageLayout';
import MetricCard from '../components/ui/MetricCard';
import EmptyState from '../components/ui/EmptyState';
import { formatNumber } from '../utils/formatters';

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
  in_transit: 'En tránsito',
  completed: 'Completada',
  received: 'Recibida',
  cancelled: 'Cancelada',
};

const PRIORIDAD_LABELS = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
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
  const [errorImbalances, setErrorImbalances] = useState(false);
  const [errorTransfers, setErrorTransfers] = useState(false);
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
      setErrorImbalances(false);
      try {
        const res = await api.get('/inventory-optimization/imbalances');
        if (!cancelled && res.data?.ok) setImbalances(res.data.imbalances || res.data.items || []);
      } catch {
        if (!cancelled) setErrorImbalances(true);
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
      setErrorTransfers(false);
      try {
        const res = await api.get('/inventory-optimization/transfers');
        if (!cancelled && res.data?.ok) setTransfers(res.data.transfers || res.data.items || []);
      } catch {
        if (!cancelled) setErrorTransfers(true);
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
    { field: 'almacen_exceso', headerName: t('inventory_almacen_exceso', 'Almacén exceso'), width: 140 },
    { field: 'almacen_deficit', headerName: t('inventory_almacen_deficit', 'Almacén déficit'), width: 140 },
    { field: 'qty_exceso', headerName: t('inventory_qty_exceso', 'Cant. exceso'), width: 120, type: 'numericColumn', valueFormatter: (p) => (p.value != null ? formatNumber(p.value) : '') },
    { field: 'qty_deficit', headerName: t('inventory_qty_deficit', 'Cant. déficit'), width: 120, type: 'numericColumn', valueFormatter: (p) => (p.value != null ? formatNumber(p.value) : '') },
  ], [t]);

  const transferColumns = useMemo(() => [
    { field: 'numero_transferencia', headerName: t('inventory_numero', 'N.º transferencia'), flex: 1, minWidth: 150 },
    { field: 'material_codigo', headerName: t('inventory_material', 'Material'), width: 140 },
    { field: 'almacen_origen', headerName: t('inventory_origen', 'Origen'), width: 120 },
    { field: 'almacen_destino', headerName: t('inventory_destino', 'Destino'), width: 120 },
    { field: 'cantidad', headerName: t('inventory_cantidad', 'Cantidad'), width: 110, type: 'numericColumn', valueFormatter: (p) => (p.value != null ? formatNumber(p.value) : '') },
    {
      field: 'estado', headerName: t('inventory_estado', 'Estado'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={TRANSFER_ESTADO_LABELS[p.value] ? t(`inventory_estado_${p.value}`, TRANSFER_ESTADO_LABELS[p.value]) : p.value} color={TRANSFER_ESTADO_COLORS[p.value] || 'default'} />,
    },
    {
      field: 'prioridad', headerName: t('inventory_prioridad', 'Prioridad'), width: 110,
      cellRenderer: (p) => <Chip size="small" label={PRIORIDAD_LABELS[p.value] ? t(`inventory_prioridad_${p.value}`, PRIORIDAD_LABELS[p.value]) : p.value} color={PRIORIDAD_COLORS[p.value] || 'default'} variant="outlined" />,
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

  const errorState = (
    <EmptyState
      icon={<ErrorOutlineIcon sx={{ fontSize: 32, color: 'error.main' }} />}
      title={t('inventory_error_title', 'No pudimos cargar los datos')}
      description={t('inventory_error_desc', 'Ocurrió un error al consultar la información. Intenta nuevamente en unos minutos.')}
      action={t('common_reintentar', 'Reintentar')}
      onAction={reload}
    />
  );

  const sinDatos = t('common_sin_datos', 'Sin datos');

  return (
    <PageLayout
      title={t('inventory_title', 'Optimización de inventario')}
      actions={
        <>
          <Button variant="outlined" size="small" startIcon={<LinkIcon />} onClick={() => navigate('/operations/niveles-de-servicio')} sx={{ textTransform: 'none' }}>
            {t('inventory_service_levels', 'Niveles de servicio')}
          </Button>
          <Button variant="contained" size="small" startIcon={processing ? <CircularProgress size={16} /> : <SwapHorizIcon />} onClick={handleProposeTransfers} disabled={processing} sx={{ textTransform: 'none' }}>
            {t('inventory_propose', 'Proponer transferencias')}
          </Button>
        </>
      }
    >
      {/* KPI Cards */}
      {kpis && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          <MetricCard
            size="lg"
            variant="info"
            icon={LocalShippingIcon}
            label={t('inventory_kpi_pending', 'Transferencias pendientes')}
            value={kpis.transferencias_pendientes != null ? formatNumber(kpis.transferencias_pendientes) : sinDatos}
          />
          <MetricCard
            size="lg"
            variant="warning"
            icon={WarningAmberIcon}
            label={t('inventory_kpi_imbalances', 'Desbalances detectados')}
            value={kpis.desbalances_detectados != null ? formatNumber(kpis.desbalances_detectados) : sinDatos}
          />
          <MetricCard
            size="lg"
            variant="success"
            icon={TrendingUpIcon}
            label={t('inventory_kpi_service', 'Nivel de servicio promedio')}
            value={kpis.nivel_servicio_promedio != null ? `${formatNumber(Number(kpis.nivel_servicio_promedio).toFixed(1))}%` : sinDatos}
          />
          <MetricCard
            size="lg"
            icon={InventoryIcon}
            label={t('inventory_kpi_monitored', 'Materiales monitoreados')}
            value={kpis.materiales_monitoreados != null ? formatNumber(kpis.materiales_monitoreados) : sinDatos}
          />
        </Box>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_, val) => setCurrentTab(val)} aria-label={t('inventory_tabs', 'Secciones de inventario')} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('inventory_tab_imbalances', 'Desbalances')} />
          <Tab label={t('inventory_tab_transfers', 'Transferencias')} />
        </Tabs>

        <Box sx={{ p: currentTab === 0 ? 2 : 0 }}>
          {currentTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Heatmap */}
              {heatmapData.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('inventory_heatmap', 'Mapa de calor de desbalances')}</Typography>
                  <ImbalanceHeatmap data={heatmapData} />
                </Box>
              )}
              {/* Table */}
              {errorImbalances ? errorState : (
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
              )}
            </Box>
          )}
          {currentTab === 1 && errorTransfers && errorState}
          {currentTab === 1 && !errorTransfers && (
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
    </PageLayout>
  );
}
