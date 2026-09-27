/**
 * AdminAuditLog - Visualización del log de auditoría
 *
 * Muestra registros de auditoría con filtros, KPIs y detalle de cambios.
 * La paginación es server-side (API /audit/logs); cada página se muestra en SPMAgGrid.
 * Sprint 51
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Pagination from '@mui/material/Pagination';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import CategoryIcon from '@mui/icons-material/Category';
import BoltIcon from '@mui/icons-material/Bolt';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import PageLayout from '../components/ui/PageLayout';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { actionsColumn } from '../components/admin/AdminCrudParts';
import { formatDateTime, formatNumber } from '../utils/formatters';

const INITIAL_FILTERS = {
  fecha_desde: '',
  fecha_hasta: '',
  entidad: '',
  accion: '',
  search: '',
};

const ACTION_COLORS = {
  crear: 'success',
  create: 'success',
  editar: 'info',
  update: 'info',
  eliminar: 'error',
  delete: 'error',
  aprobar: 'success',
  rechazar: 'warning',
  login: 'default',
};

/** Etiquetas en español (tipo oración) para las acciones conocidas. */
const ACTION_LABELS = {
  crear: ['audit_accion_crear', 'Crear'],
  create: ['audit_accion_crear', 'Crear'],
  editar: ['audit_accion_editar', 'Editar'],
  update: ['audit_accion_editar', 'Editar'],
  eliminar: ['audit_accion_eliminar', 'Eliminar'],
  delete: ['audit_accion_eliminar', 'Eliminar'],
  aprobar: ['audit_accion_aprobar', 'Aprobar'],
  rechazar: ['audit_accion_rechazar', 'Rechazar'],
  cancelar: ['audit_accion_cancelar', 'Cancelar'],
  enviar: ['audit_accion_enviar', 'Enviar'],
  login: ['audit_accion_login', 'Inicio de sesión'],
  logout: ['audit_accion_logout', 'Cierre de sesión'],
};

/** Valores conocidos para los filtros (se completan con los que devuelve /audit/stats). */
const KNOWN_ACTIONS = ['crear', 'editar', 'eliminar', 'aprobar', 'rechazar', 'cancelar'];
const KNOWN_ENTITIES = ['solicitud', 'usuario'];

const capitalize = (value) => {
  const text = String(value || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

export default function AdminAuditLog() {
  const { t } = useI18n();
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailLog, setDetailLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const { data } = await api.get('/audit/logs', { params });
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch {
      toast.error(t('audit_error_loading', 'Error al cargar el registro de auditoría'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, filters]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/audit/stats');
      setStats(data);
    } catch {
      /* stats are non-critical */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFilter = useCallback(() => {
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const totalPages = Math.ceil(total / perPage);

  const getActionColor = (accion) => {
    const lower = (accion || '').toLowerCase();
    return ACTION_COLORS[lower] || 'default';
  };

  const getActionLabel = useCallback(
    (accion) => {
      const entry = ACTION_LABELS[(accion || '').toLowerCase()];
      return entry ? t(entry[0], entry[1]) : capitalize(accion);
    },
    [t]
  );

  const actionOptions = useMemo(() => {
    const fromStats = (stats?.por_accion || []).map((a) => a.accion).filter(Boolean);
    return [...new Set([...fromStats, ...KNOWN_ACTIONS])];
  }, [stats]);

  const entityOptions = useMemo(() => {
    const fromStats = (stats?.por_entidad || []).map((e) => e.entidad).filter(Boolean);
    return [...new Set([...fromStats, ...KNOWN_ENTITIES])];
  }, [stats]);

  const columnDefs = useMemo(
    () => [
      {
        field: 'created_at',
        headerName: t('audit_date', 'Fecha'),
        flex: 1,
        minWidth: 150,
        valueFormatter: (params) => formatDateTime(params.value),
      },
      {
        field: 'actor_nombre',
        headerName: t('audit_user', 'Usuario'),
        flex: 1,
        minWidth: 140,
        valueGetter: (params) =>
          params.data?.actor_nombre ||
          `${t('audit_usuario_numero', 'Usuario n.º')} ${params.data?.actor_id ?? ''}`.trim(),
      },
      {
        field: 'accion',
        headerName: t('audit_action', 'Acción'),
        flex: 0.8,
        minWidth: 130,
        valueFormatter: (params) => getActionLabel(params.value),
        cellRenderer: (params) => (
          <Chip
            label={getActionLabel(params.value)}
            size="small"
            color={getActionColor(params.value)}
            variant="outlined"
          />
        ),
      },
      {
        field: 'entidad',
        headerName: t('audit_entity', 'Entidad'),
        flex: 0.8,
        minWidth: 130,
        valueFormatter: (params) => capitalize(params.value),
      },
      {
        field: 'entidad_id',
        headerName: t('audit_entidad_id', 'ID'),
        flex: 0.5,
        minWidth: 90,
      },
      actionsColumn(
        t('common_acciones', 'Acciones'),
        (params) => (
          <Tooltip title={t('audit_view_changes', 'Ver cambios')}>
            <IconButton
              size="small"
              onClick={() => setDetailLog(params.data)}
              aria-label={t('audit_view_changes', 'Ver cambios')}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
        { width: 100 }
      ),
    ],
    [t, getActionLabel]
  );

  const kpis = stats
    ? [
        {
          icon: <HistoryIcon fontSize="small" color="primary" />,
          label: t('audit_total', 'Total de registros'),
          value: formatNumber(stats.total || 0),
        },
        {
          icon: <BoltIcon fontSize="small" color="info" />,
          label: t('audit_top_action', 'Acción más frecuente'),
          value: stats.por_accion?.[0]?.accion ? getActionLabel(stats.por_accion[0].accion) : '-',
          detail: `${formatNumber(stats.por_accion?.[0]?.cnt || 0)} ${t('audit_times', 'veces')}`,
        },
        {
          icon: <CategoryIcon fontSize="small" color="warning" />,
          label: t('audit_top_entity', 'Entidad más activa'),
          value: capitalize(stats.por_entidad?.[0]?.entidad) || '-',
          detail: `${formatNumber(stats.por_entidad?.[0]?.cnt || 0)} ${t('audit_changes', 'cambios')}`,
        },
        {
          icon: <PersonIcon fontSize="small" color="success" />,
          label: t('audit_top_user', 'Usuario más activo'),
          value: stats.top_usuarios?.[0]?.actor_nombre || '-',
          detail: `${formatNumber(stats.top_usuarios?.[0]?.cnt || 0)} ${t('audit_actions', 'acciones')}`,
        },
      ]
    : [];

  const renderJson = (value) => (
    <Box
      component="pre"
      sx={{
        bgcolor: 'grey.50',
        p: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        maxHeight: 280,
        overflow: 'auto',
        mt: 0.5,
        mb: 0,
        fontSize: '0.75rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {value ? JSON.stringify(value, null, 2) : t('audit_no_data', 'Sin datos')}
    </Box>
  );

  return (
    <PageLayout title={t('audit_title', 'Registro de auditoría')} backTo="/admin">
      {/* KPI Cards */}
      {statsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : stats ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {kpis.map((kpi) => (
            <Paper key={kpi.label} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                {kpi.icon}
                <Typography variant="caption" color="text.secondary">
                  {kpi.label}
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={700}>
                {kpi.value}
              </Typography>
              {kpi.detail && (
                <Typography variant="caption" color="text.secondary">
                  {kpi.detail}
                </Typography>
              )}
            </Paper>
          ))}
        </Box>
      ) : null}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            type="date"
            size="small"
            label={t('audit_from', 'Desde')}
            value={filters.fecha_desde}
            onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', sm: 170 } }}
          />
          <TextField
            type="date"
            size="small"
            label={t('audit_to', 'Hasta')}
            value={filters.fecha_hasta}
            onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', sm: 170 } }}
          />
          <TextField
            select
            label={t('audit_entity', 'Entidad')}
            size="small"
            value={filters.entidad}
            onChange={(e) => handleFilterChange('entidad', e.target.value)}
            sx={{ width: { xs: '100%', sm: 170 } }}
          >
            <MenuItem value="">{t('audit_todas', 'Todas')}</MenuItem>
            {entityOptions.map((ent) => (
              <MenuItem key={ent} value={ent}>
                {capitalize(ent)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('audit_action', 'Acción')}
            size="small"
            value={filters.accion}
            onChange={(e) => handleFilterChange('accion', e.target.value)}
            sx={{ width: { xs: '100%', sm: 170 } }}
          >
            <MenuItem value="">{t('audit_todas', 'Todas')}</MenuItem>
            {actionOptions.map((acc) => (
              <MenuItem key={acc} value={acc}>
                {getActionLabel(acc)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('audit_buscar', 'Buscar')}
            size="small"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder={t('audit_buscar_ph', 'ID, nombre...')}
            sx={{ width: { xs: '100%', sm: 190 } }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<SearchIcon />}
            onClick={handleFilter}
            sx={{ textTransform: 'none' }}
          >
            {t('audit_filtrar', 'Filtrar')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
            sx={{ textTransform: 'none' }}
          >
            {t('audit_limpiar', 'Limpiar')}
          </Button>
        </Box>
      </Paper>

      {/* Table (paginación del servidor: la grilla muestra la página actual) */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <SPMAgGrid
          rowData={logs}
          columnDefs={columnDefs}
          loading={loading}
          height={560}
          pagination={false}
          enableQuickFilter={true}
          exportFileName="registro_auditoria"
          emptyMessage={t('audit_empty', 'Sin registros')}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            py: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {formatNumber(total)} {t('audit_records', 'registros')}
          </Typography>
          {totalPages > 1 && (
            <Pagination
              size="small"
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              disabled={loading}
            />
          )}
        </Box>
      </Paper>

      {/* Detalle de cambios */}
      <Dialog open={!!detailLog} onClose={() => setDetailLog(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('audit_view_changes', 'Ver cambios')}
          {detailLog && (
            <Typography variant="body2" color="text.secondary">
              {getActionLabel(detailLog.accion)} · {capitalize(detailLog.entidad)} {detailLog.entidad_id} ·{' '}
              {formatDateTime(detailLog.created_at)}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {t('audit_before', 'Datos anteriores')}
              </Typography>
              {renderJson(detailLog?.datos_anteriores)}
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {t('audit_after', 'Datos nuevos')}
              </Typography>
              {renderJson(detailLog?.datos_nuevos)}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailLog(null)} sx={{ textTransform: 'none' }}>
            {t('common_cerrar', 'Cerrar')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
}
