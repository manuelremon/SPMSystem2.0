/**
 * NCRList - Lista de No-Conformidades (NCR)
 *
 * Muestra NCRs con filtros por estado, severidad y proveedor.
 * Badges de severidad con colores: critical=red, major=orange, minor=yellow.
 * Sprint 59
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const SEVERIDAD_COLORS = {
  critical: 'error',
  major: 'warning',
  minor: 'default',
};

const SEVERIDAD_LABELS = {
  critical: 'Critica',
  major: 'Mayor',
  minor: 'Menor',
};

const ESTADO_COLORS = {
  open: 'error',
  investigating: 'warning',
  resolved: 'info',
  closed: 'success',
  cancelled: 'default',
};

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abierta' },
  { value: 'investigating', label: 'En Investigacion' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'cancelled', label: 'Cancelada' },
];

const SEVERIDAD_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'critical', label: 'Critica' },
  { value: 'major', label: 'Mayor' },
  { value: 'minor', label: 'Menor' },
];

export default function NCRList() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [ncrs, setNcrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [severidadFilter, setSeveridadFilter] = useState('');
  const [proveedorFilter, setProveedorFilter] = useState('');

  const fetchNCRs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (estadoFilter) params.estado = estadoFilter;
      if (severidadFilter) params.severidad = severidadFilter;
      if (proveedorFilter.trim()) params.proveedor = proveedorFilter.trim();
      const res = await api.get('/quality/ncr', { params });
      if (res.data?.ok) {
        setNcrs(res.data.ncrs || []);
      }
    } catch {
      toast.error(t('ncr_error_cargar', 'Error al cargar NCRs'));
    } finally {
      setLoading(false);
    }
  }, [estadoFilter, severidadFilter, proveedorFilter, t, toast]);

  useEffect(() => {
    fetchNCRs();
  }, [fetchNCRs]);

  const columnDefs = useMemo(() => [
    {
      field: 'numero_ncr',
      headerName: t('ncr_numero', 'N. NCR'),
      width: 130,
    },
    {
      field: 'severidad',
      headerName: t('ncr_severidad', 'Severidad'),
      width: 120,
      cellRenderer: (params) => {
        const sev = params.value || 'minor';
        return (
          <Chip
            label={SEVERIDAD_LABELS[sev] || sev}
            color={SEVERIDAD_COLORS[sev] || 'default'}
            size="small"
          />
        );
      },
      comparator: (a, b) => {
        const order = { critical: 0, major: 1, minor: 2 };
        return (order[a] ?? 3) - (order[b] ?? 3);
      },
    },
    {
      field: 'titulo',
      headerName: t('ncr_titulo', 'Titulo'),
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'estado',
      headerName: t('ncr_estado', 'Estado'),
      width: 140,
      cellRenderer: (params) => (
        <Chip
          label={params.value || 'open'}
          color={ESTADO_COLORS[params.value] || 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'proveedor_nombre',
      headerName: t('ncr_proveedor', 'Proveedor'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'material_codigo',
      headerName: t('ncr_material', 'Material'),
      width: 130,
    },
    {
      field: 'cantidad_afectada',
      headerName: t('ncr_cantidad', 'Cant. Afectada'),
      width: 120,
      type: 'numericColumn',
    },
    {
      field: 'fecha_creacion',
      headerName: t('ncr_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return new Date(params.value).toLocaleDateString('es-AR');
      },
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <ReportProblemIcon sx={{ color: 'error.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('ncr_list_title', 'No-Conformidades (NCR)')}
        </Typography>
      </Stack>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('ncr_filtro_estado', 'Estado')}</InputLabel>
            <Select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              label={t('ncr_filtro_estado', 'Estado')}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('ncr_filtro_severidad', 'Severidad')}</InputLabel>
            <Select
              value={severidadFilter}
              onChange={(e) => setSeveridadFilter(e.target.value)}
              label={t('ncr_filtro_severidad', 'Severidad')}
            >
              {SEVERIDAD_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('ncr_filtro_proveedor', 'Proveedor')}
            value={proveedorFilter}
            onChange={(e) => setProveedorFilter(e.target.value)}
            sx={{ minWidth: 180 }}
            placeholder={t('ncr_filtro_proveedor_placeholder', 'Nombre o CUIT...')}
          />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }} aria-label={t('ncr_list_title', 'No-Conformidades')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={ncrs}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/quality/ncr/${row.id}`)}
          exportFileName="ncrs"
          emptyMessage={t('ncr_empty', 'No hay NCRs registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>
    </Box>
  );
}
