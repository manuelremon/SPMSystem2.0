/**
 * ServiceLevels - Service level objectives editor
 *
 * Displays materials with editable service levels, calculated safety stock
 * and reorder points. Supports inline editing and bulk recalculation.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDate } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ABC_COLORS = {
  A: 'error',
  B: 'warning',
  C: 'default',
};

export default function ServiceLevels() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page] = useState(1);
  const [recalculating, setRecalculating] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page, per_page: 50 };
        const res = await api.get('/inventory-optimization/service-levels', { params });
        if (cancelled) return;
        if (res.data?.ok) {
          setLevels(res.data.levels || res.data.items || []);
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('service_error_load', 'Error al cargar niveles de servicio'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [page, reloadTick]);

  const handleUpdateLevel = useCallback(async (materialCodigo, almacen, nivelServicio) => {
    try {
      const res = await api.put(`/inventory-optimization/service-levels/${materialCodigo}`, {
        almacen,
        nivel_servicio: nivelServicio,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('service_updated', 'Nivel de servicio actualizado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('service_error_update', 'Error al actualizar'));
    }
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await api.post('/inventory-optimization/service-levels/recalculate');
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('service_recalculated', 'Recalculo completado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('service_error_recalculate', 'Error al recalcular'));
    } finally {
      setRecalculating(false);
    }
  };

  const handleCellValueChanged = useCallback((event) => {
    const { data, colDef, newValue } = event;
    if (colDef.field === 'nivel_servicio') {
      const parsed = parseFloat(newValue);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        toastRef.current.warning(tRef.current('service_invalid_value', 'Valor debe ser entre 0 y 100'));
        reload();
        return;
      }
      handleUpdateLevel(data.material_codigo, data.almacen, parsed);
    }
  }, [handleUpdateLevel]);

  const columnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('service_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'almacen', headerName: t('service_almacen', 'Almacen'), width: 120 },
    {
      field: 'nivel_servicio', headerName: t('service_nivel', 'Nivel Servicio (%)'), width: 160,
      editable: true,
      type: 'numericColumn',
      cellStyle: { backgroundColor: 'rgba(25, 118, 210, 0.04)', cursor: 'pointer' },
      valueFormatter: (p) => p.value != null ? `${p.value.toFixed(1)}%` : '-',
    },
    {
      field: 'stock_seguridad_calculado', headerName: t('service_safety_stock', 'Stock Seguridad'), width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Math.round(p.value).toLocaleString('es-ES') : '-',
    },
    {
      field: 'punto_reorden_calculado', headerName: t('service_reorder_point', 'Punto Reorden'), width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Math.round(p.value).toLocaleString('es-ES') : '-',
    },
    {
      field: 'clasificacion_abc', headerName: t('service_abc', 'ABC'), width: 80,
      cellRenderer: (p) => p.value ? <Chip size="small" label={p.value} color={ABC_COLORS[p.value] || 'default'} /> : '-',
    },
    {
      field: 'ultimo_calculo', headerName: t('service_last_calc', 'Ultimo Calculo'), width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <TuneIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('service_title', 'Niveles de Servicio')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={recalculating ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {t('service_recalculate', 'Recalcular Todo')}
        </Button>
      </Stack>

      {/* Info */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', backgroundColor: 'rgba(25, 118, 210, 0.04)' }}>
        <Typography variant="body2" color="text.secondary">
          {t('service_info', 'Haga clic en la columna "Nivel Servicio (%)" para editar el valor. Los cambios se guardan automaticamente. El stock de seguridad y punto de reorden se recalculan al usar "Recalcular Todo".')}
        </Typography>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('service_title', 'Niveles de Servicio')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={levels}
          loading={loading}
          height={550}
          pagination={true}
          paginationPageSize={50}
          enableQuickFilter={true}
          exportFileName="niveles_servicio"
          emptyMessage={t('service_empty', 'No hay niveles de servicio configurados')}
          gridOptions={{ onCellValueChanged: handleCellValueChanged }}
        />
      </Paper>
    </Box>
  );
}
