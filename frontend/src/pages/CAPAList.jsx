/**
 * CAPAList - Lista de Acciones Correctivas y Preventivas (CAPA)
 *
 * Muestra CAPAs con filtros por tipo, estado y responsable.
 * Tipo badges: corrective (rojo), preventive (azul).
 * Sprint 60
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import BuildIcon from '@mui/icons-material/Build';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const TIPO_COLORS = {
  corrective: 'error',
  preventive: 'info',
};

const TIPO_LABELS = {
  corrective: 'Correctiva',
  preventive: 'Preventiva',
};

const ESTADO_COLORS = {
  open: 'error',
  in_progress: 'warning',
  verification: 'info',
  closed: 'success',
  cancelled: 'default',
};

const ESTADO_LABELS = {
  open: 'Abierta',
  in_progress: 'En Progreso',
  verification: 'Verificacion',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'corrective', label: 'Correctiva' },
  { value: 'preventive', label: 'Preventiva' },
];

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abierta' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'verification', label: 'Verificacion' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'cancelled', label: 'Cancelada' },
];

export default function CAPAList() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const navigate = useNavigate();

  const [capas, setCapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [responsableFilter, setResponsableFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = {};
        if (tipoFilter) params.tipo = tipoFilter;
        if (estadoFilter) params.estado = estadoFilter;
        if (responsableFilter.trim()) params.responsable = responsableFilter.trim();
        const res = await api.get('/quality/capa', { params });
        if (!cancelled && res.data?.ok) setCapas(res.data.capas || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('capa_error_cargar', 'Error al cargar CAPAs'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tipoFilter, estadoFilter, responsableFilter]);

  const columnDefs = useMemo(() => [
    {
      field: 'numero_capa',
      headerName: t('capa_numero', 'N. CAPA'),
      width: 130,
    },
    {
      field: 'tipo',
      headerName: t('capa_tipo', 'Tipo'),
      width: 130,
      cellRenderer: (params) => {
        const tipo = params.value || 'corrective';
        return (
          <Chip
            label={TIPO_LABELS[tipo] || tipo}
            color={TIPO_COLORS[tipo] || 'default'}
            size="small"
          />
        );
      },
    },
    {
      field: 'titulo',
      headerName: t('capa_titulo', 'Titulo'),
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'responsable',
      headerName: t('capa_responsable', 'Responsable'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'fecha_objetivo',
      headerName: t('capa_fecha_objetivo', 'Fecha Objetivo'),
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return new Date(params.value).toLocaleDateString('es-AR');
      },
      cellStyle: (params) => {
        if (!params.value) return {};
        const date = new Date(params.value);
        const isOverdue = date < new Date() && params.data?.estado !== 'closed' && params.data?.estado !== 'cancelled';
        return isOverdue ? { color: '#ef4444', fontWeight: 700 } : {};
      },
    },
    {
      field: 'estado',
      headerName: t('capa_estado', 'Estado'),
      width: 140,
      cellRenderer: (params) => {
        const est = params.value || 'open';
        return (
          <Chip
            label={ESTADO_LABELS[est] || est}
            color={ESTADO_COLORS[est] || 'default'}
            size="small"
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'ncr_numero',
      headerName: t('capa_ncr_origen', 'NCR Origen'),
      width: 130,
      cellRenderer: (params) => {
        if (!params.value) return '-';
        return (
          <Typography
            variant="body2"
            sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={(e) => {
              e.stopPropagation();
              if (params.data?.ncr_id) {
                navigate(`/quality/ncr/${params.data.ncr_id}`);
              }
            }}
          >
            {params.value}
          </Typography>
        );
      },
    },
    {
      field: 'fecha_creacion',
      headerName: t('capa_fecha_creacion', 'Creada'),
      width: 120,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return new Date(params.value).toLocaleDateString('es-AR');
      },
    },
  ], [t, navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <BuildIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('capa_list_title', 'Acciones Correctivas y Preventivas (CAPA)')}
        </Typography>
      </Stack>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('capa_filtro_tipo', 'Tipo')}</InputLabel>
            <Select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              label={t('capa_filtro_tipo', 'Tipo')}
            >
              {TIPO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('capa_filtro_estado', 'Estado')}</InputLabel>
            <Select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              label={t('capa_filtro_estado', 'Estado')}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('capa_filtro_responsable', 'Responsable')}
            value={responsableFilter}
            onChange={(e) => setResponsableFilter(e.target.value)}
            sx={{ minWidth: 180 }}
            placeholder={t('capa_filtro_responsable_placeholder', 'Nombre...')}
          />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('capa_list_title', 'CAPAs')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={capas}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/quality/capa/${row.id}`)}
          exportFileName="capas"
          emptyMessage={t('capa_empty', 'No hay CAPAs registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>
    </Box>
  );
}
