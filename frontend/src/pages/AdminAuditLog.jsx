/**
 * AdminAuditLog - Visualizacion del log de auditoria
 *
 * Muestra registros de auditoria con filtros, KPIs y detalle expandible.
 * Permite exportar a Excel y paginar server-side.
 * Sprint 51
 */

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import CategoryIcon from '@mui/icons-material/Category';
import BoltIcon from '@mui/icons-material/Bolt';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

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
  const [expandedRow, setExpandedRow] = useState(null);

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
      toast.error(t('audit_error_loading', 'Error al cargar audit log'));
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

  const handleExport = useCallback(async () => {
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const response = await api.get('/audit/export', {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t('audit_export_ok', 'Exportacion iniciada'));
    } catch {
      toast.error(t('audit_error_export', 'Error al exportar'));
    }
  }, [filters, t, toast]);

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

  const toggleRow = useCallback((id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  }, []);

  const totalPages = Math.ceil(total / perPage);

  const getActionColor = (accion) => {
    const lower = (accion || '').toLowerCase();
    return ACTION_COLORS[lower] || 'default';
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t('audit_title', 'Audit Log')}
        </Typography>
        <Button
          variant="contained"
          color="success"
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          size="small"
        >
          {t('audit_export', 'Exportar Excel')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {statsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <HistoryIcon fontSize="small" color="primary" />
              <Typography variant="caption" color="text.secondary">
                {t('audit_total', 'Total Registros')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold">
              {(stats.total || 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <BoltIcon fontSize="small" color="info" />
              <Typography variant="caption" color="text.secondary">
                {t('audit_top_action', 'Accion mas frecuente')}
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight="bold">
              {stats.por_accion?.[0]?.accion || '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.por_accion?.[0]?.cnt || 0} {t('audit_times', 'veces')}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <CategoryIcon fontSize="small" color="warning" />
              <Typography variant="caption" color="text.secondary">
                {t('audit_top_entity', 'Entidad mas activa')}
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight="bold">
              {stats.por_entidad?.[0]?.entidad || '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.por_entidad?.[0]?.cnt || 0} {t('audit_changes', 'cambios')}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <PersonIcon fontSize="small" color="success" />
              <Typography variant="caption" color="text.secondary">
                {t('audit_top_user', 'Usuario mas activo')}
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight="bold">
              {stats.top_usuarios?.[0]?.actor_nombre || '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.top_usuarios?.[0]?.cnt || 0} {t('audit_actions', 'acciones')}
            </Typography>
          </Paper>
        </div>
      ) : null}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('audit_from', 'Desde')}
            </label>
            <TextField
              type="date"
              size="small"
              value={filters.fecha_desde}
              onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('audit_to', 'Hasta')}
            </label>
            <TextField
              type="date"
              size="small"
              value={filters.fecha_hasta}
              onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
          </div>
          <TextField
            label={t('audit_entity', 'Entidad')}
            size="small"
            value={filters.entidad}
            onChange={(e) => handleFilterChange('entidad', e.target.value)}
            placeholder="solicitud, usuario..."
            sx={{ width: 160 }}
          />
          <TextField
            label={t('audit_action', 'Accion')}
            size="small"
            value={filters.accion}
            onChange={(e) => handleFilterChange('accion', e.target.value)}
            placeholder="crear, editar..."
            sx={{ width: 160 }}
          />
          <TextField
            label={t('common_search', 'Buscar')}
            size="small"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="ID, nombre..."
            sx={{ width: 180 }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<SearchIcon />}
            onClick={handleFilter}
          >
            {t('common_filter', 'Filtrar')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
          >
            {t('common_clear', 'Limpiar')}
          </Button>
        </div>
      </Paper>

      {/* Table */}
      <Paper sx={{ overflow: 'hidden', mb: 2 }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-8"></th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                {t('audit_date', 'Fecha')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                {t('audit_user', 'Usuario')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                {t('audit_action', 'Accion')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                {t('audit_entity', 'Entidad')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <CircularProgress size={24} />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {t('audit_empty', 'Sin registros')}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleRow(log.id)}
                    aria-label={t('audit_toggle_detail', 'Ver detalle')}
                  >
                    <td className="px-2 py-2 text-center">
                      <IconButton size="small">
                        {expandedRow === log.id ? (
                          <KeyboardArrowUpIcon fontSize="small" />
                        ) : (
                          <KeyboardArrowDownIcon fontSize="small" />
                        )}
                      </IconButton>
                    </td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      {log.actor_nombre || `User #${log.actor_id}`}
                    </td>
                    <td className="px-4 py-2">
                      <Chip
                        label={log.accion}
                        size="small"
                        color={getActionColor(log.accion)}
                        variant="outlined"
                      />
                    </td>
                    <td className="px-4 py-2">{log.entidad}</td>
                    <td className="px-4 py-2 text-gray-500">{log.entidad_id}</td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary">
                              {t('audit_before', 'Datos Anteriores')}
                            </Typography>
                            <pre className="bg-white p-2 rounded border max-h-40 overflow-auto mt-1 text-xs">
                              {log.datos_anteriores
                                ? JSON.stringify(log.datos_anteriores, null, 2)
                                : t('audit_no_data', 'Sin datos')}
                            </pre>
                          </div>
                          <div>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary">
                              {t('audit_after', 'Datos Nuevos')}
                            </Typography>
                            <pre className="bg-white p-2 rounded border max-h-40 overflow-auto mt-1 text-xs">
                              {log.datos_nuevos
                                ? JSON.stringify(log.datos_nuevos, null, 2)
                                : t('audit_no_data', 'Sin datos')}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {total.toLocaleString()} {t('audit_records', 'registros')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('common_prev', 'Anterior')}
            </Button>
            <Typography variant="body2">
              {page} / {totalPages}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common_next', 'Siguiente')}
            </Button>
          </Stack>
        </Stack>
      )}
      </Box>
    </Box>
  );
}
