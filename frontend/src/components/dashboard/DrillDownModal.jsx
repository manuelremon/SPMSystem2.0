/**
 * DrillDownModal - Modal genérico para drill-down de KPIs
 *
 * Muestra datos granulares cuando el usuario hace click en un KPI.
 * Incluye AG-Grid filtrable y botón de exportación.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { SPMAgGrid } from '../ui/SPMAgGrid';
import api from '../../services/api';
import { useI18n } from '../../context/i18n';

const METRICAS_CONFIG = {
  solicitudes_diarias: {
    titulo: 'Solicitudes por Día',
    icono: '📋',
  },
  solicitudes_por_estado: {
    titulo: 'Solicitudes por Estado',
    icono: '📊',
  },
  presupuesto_por_centro: {
    titulo: 'Presupuesto por Centro',
    icono: '💰',
  },
  materiales_top: {
    titulo: 'Materiales Más Solicitados',
    icono: '📦',
  },
  tiempos_promedio: {
    titulo: 'Tiempos de Gestión',
    icono: '⏱️',
  },
  stock_critico: {
    titulo: 'Stock Crítico',
    icono: '⚠️',
  },
  compras_evitadas: {
    titulo: 'Compras Evitadas',
    icono: '✅',
  },
};

export default function DrillDownModal({
  open,
  onClose,
  metrica,
  filtros = {},
}) {
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [columnas, setColumnas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const config = METRICAS_CONFIG[metrica] || { titulo: metrica, icono: '📈' };

  const fetchData = useCallback(async () => {
    if (!metrica || !open) return;

    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        page_size: pageSize,
        ...filtros,
      };

      const response = await api.get(`/dashboard-data/drill/${metrica}`, { params });

      if (response.data?.ok) {
        setData(response.data.data || []);
        setTotal(response.data.total || 0);

        if (response.data.columnas && columnas.length === 0) {
          const agGridCols = response.data.columnas.map(col => ({
            field: col.field,
            headerName: col.headerName,
            filter: true,
            sortable: true,
            flex: 1,
            minWidth: 100,
            ...(col.type === 'number' && {
              type: 'numericColumn',
              valueFormatter: (params) => {
                if (params.value == null) return '';
                return typeof params.value === 'number'
                  ? params.value.toLocaleString('es-AR')
                  : params.value;
              },
            }),
            ...(col.type === 'currency' && {
              type: 'numericColumn',
              valueFormatter: (params) => {
                if (params.value == null) return '';
                return `USD ${Number(params.value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
              },
            }),
            ...(col.type === 'date' && {
              valueFormatter: (params) => {
                if (!params.value) return '';
                return new Date(params.value).toLocaleDateString('es-AR');
              },
            }),
            ...(col.type === 'percent' && {
              valueFormatter: (params) => {
                if (params.value == null) return '';
                return `${Number(params.value).toFixed(1)}%`;
              },
            }),
          }));
          setColumnas(agGridCols);
        }
      } else {
        setError(response.data?.error || 'Error al cargar datos');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [metrica, open, page, filtros]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setColumnas([]);
      setData([]);
    }
  }, [open]);

  const handleExport = useCallback(async () => {
    try {
      const params = { ...filtros, formato: 'xlsx' };
      const response = await api.get(`/dashboard-data/drill/${metrica}`, {
        params: { ...params, page_size: 10000 },
      });

      if (response.data?.ok && response.data.data) {
        const rows = response.data.data;
        const { default: XLSX } = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Datos');
        XLSX.writeFile(wb, `drill_down_${metrica}_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
    } catch (err) {
      console.error('Error exporting drill-down:', err);
    }
  }, [metrica, filtros]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '85vh' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {config.titulo}
          </Typography>
          {total > 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              ({total.toLocaleString('es-AR')} {t('common_registros', 'registros')})
            </Typography>
          )}
        </Stack>
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            disabled={data.length === 0}
          >
            Excel
          </Button>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
            <Button onClick={fetchData} sx={{ mt: 2 }}>
              {t('common_reintentar', 'Reintentar')}
            </Button>
          </Box>
        ) : (
          <SPMAgGrid
            columnDefs={columnas}
            rowData={data}
            height="55vh"
            pagination={true}
            paginationPageSize={25}
            enableQuickFilter={true}
            exportFileName={`drill_${metrica}`}
            emptyMessage={t('common_sin_datos', 'Sin datos disponibles')}
          />
        )}
      </DialogContent>

      {totalPages > 1 && (
        <DialogActions sx={{ justifyContent: 'center', gap: 2 }}>
          <Button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            size="small"
          >
            Anterior
          </Button>
          <Typography variant="body2">
            Página {page} de {totalPages}
          </Typography>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            size="small"
          >
            Siguiente
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

DrillDownModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  metrica: PropTypes.string,
  filtros: PropTypes.object,
};
