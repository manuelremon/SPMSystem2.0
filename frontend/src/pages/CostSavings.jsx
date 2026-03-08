/**
 * CostSavings - Registro y seguimiento de ahorros en compras
 *
 * Muestra KPIs de ahorro (YTD, MTD, hard/soft), tabla paginada,
 * modal de registro de nuevos ahorros, metas con barras de progreso.
 * Sprint 52
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SavingsIcon from '@mui/icons-material/Savings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const TIPOS_AHORRO = [
  { value: 'hard', label: 'Hard Saving' },
  { value: 'soft', label: 'Soft Saving' },
  { value: 'cost_avoidance', label: 'Cost Avoidance' },
];

const CATEGORIAS = [
  { value: 'negociacion', label: 'Negociacion' },
  { value: 'consolidacion', label: 'Consolidacion' },
  { value: 'sustituto', label: 'Material Sustituto' },
  { value: 'proceso', label: 'Mejora de Proceso' },
  { value: 'otro', label: 'Otro' },
];

const INITIAL_FORM = {
  descripcion: '',
  tipo: 'hard',
  categoria: 'negociacion',
  monto: '',
  moneda: 'USD',
  solicitud_id: '',
  proveedor: '',
  notas: '',
};

const TIPO_COLORS = {
  hard: 'success',
  soft: 'info',
  cost_avoidance: 'warning',
};

export default function CostSavings() {
  const { t } = useI18n();
  const toast = useToast();

  const [kpis, setKpis] = useState(null);
  const [savings, setSavings] = useState([]);
  const [goals, setGoals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchKpis = useCallback(async () => {
    try {
      const { data } = await api.get('/savings/kpis');
      setKpis(data);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchSavings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/savings', {
        params: { page, per_page: perPage },
      });
      setSavings(data.items || []);
      setTotal(data.total || 0);
    } catch {
      toast.error(t('savings_error_loading', 'Error al cargar ahorros'));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, t, toast]);

  const fetchGoals = useCallback(async () => {
    try {
      const { data } = await api.get('/savings/goals');
      setGoals(data.goals || []);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchGoals();
  }, [fetchKpis, fetchGoals]);

  useEffect(() => {
    fetchSavings();
  }, [fetchSavings]);

  const handleExport = useCallback(async () => {
    try {
      const response = await api.get('/savings/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `cost_savings_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t('savings_export_ok', 'Exportacion iniciada'));
    } catch {
      toast.error(t('savings_error_export', 'Error al exportar'));
    }
  }, [t, toast]);

  const handleSubmit = useCallback(async () => {
    if (!form.descripcion.trim() || !form.monto) {
      toast.warning(t('savings_required_fields', 'Complete descripcion y monto'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/savings', {
        ...form,
        monto: parseFloat(form.monto),
        solicitud_id: form.solicitud_id ? parseInt(form.solicitud_id, 10) : null,
      });
      toast.success(t('savings_created', 'Ahorro registrado'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      fetchSavings();
      fetchKpis();
      fetchGoals();
    } catch {
      toast.error(t('savings_error_create', 'Error al registrar ahorro'));
    } finally {
      setSubmitting(false);
    }
  }, [form, t, toast, fetchSavings, fetchKpis, fetchGoals]);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const totalPages = Math.ceil(total / perPage);

  const fmtMoney = (val) =>
    (val || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t('savings_title', 'Cost Savings Tracker')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            size="small"
          >
            {t('savings_export', 'Exportar')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setModalOpen(true)}
            size="small"
          >
            {t('savings_register', 'Registrar Ahorro')}
          </Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <SavingsIcon fontSize="small" color="success" />
              <Typography variant="caption" color="text.secondary">
                {t('savings_ytd', 'Ahorro YTD')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {fmtMoney(kpis.ytd)}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <CalendarMonthIcon fontSize="small" color="info" />
              <Typography variant="caption" color="text.secondary">
                {t('savings_mtd', 'Ahorro MTD')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold" color="info.main">
              {fmtMoney(kpis.mtd)}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <TrendingUpIcon fontSize="small" color="success" />
              <Typography variant="caption" color="text.secondary">
                {t('savings_hard', 'Hard Savings')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold">
              {fmtMoney(kpis.hard)}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <AccountBalanceIcon fontSize="small" color="warning" />
              <Typography variant="caption" color="text.secondary">
                {t('savings_soft', 'Soft Savings')}
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold">
              {fmtMoney(kpis.soft)}
            </Typography>
          </Paper>
        </div>
      )}

      {/* Goals Progress */}
      {goals.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            {t('savings_goals', 'Metas de Ahorro')}
          </Typography>
          <div className="space-y-3">
            {goals.map((goal) => {
              const pct = goal.meta > 0 ? Math.min(100, (goal.actual / goal.meta) * 100) : 0;
              return (
                <div key={goal.id || goal.nombre}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{goal.nombre}</span>
                    <span className="text-gray-500">
                      {fmtMoney(goal.actual)} / {fmtMoney(goal.meta)} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color={pct >= 100 ? 'success' : pct >= 70 ? 'primary' : 'warning'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </div>
              );
            })}
          </div>
        </Paper>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden', mb: 2 }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('savings_date', 'Fecha')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('savings_description', 'Descripcion')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('savings_type', 'Tipo')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('savings_category', 'Categoria')}</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">{t('savings_amount', 'Monto')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">{t('savings_vendor', 'Proveedor')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <CircularProgress size={24} />
                </td>
              </tr>
            ) : savings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {t('savings_empty', 'Sin registros de ahorro')}
                </td>
              </tr>
            ) : (
              savings.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{s.descripcion}</td>
                  <td className="px-4 py-2">
                    <Chip
                      label={s.tipo}
                      size="small"
                      color={TIPO_COLORS[s.tipo] || 'default'}
                      variant="outlined"
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.categoria}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {fmtMoney(s.monto)}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{s.proveedor || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {total} {t('savings_records', 'registros')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="outlined" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common_prev', 'Anterior')}
            </Button>
            <Typography variant="body2">{page} / {totalPages}</Typography>
            <Button size="small" variant="outlined" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common_next', 'Siguiente')}
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Register Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('savings_register', 'Registrar Ahorro')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('savings_description', 'Descripcion')}
              value={form.descripcion}
              onChange={(e) => handleFormChange('descripcion', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('savings_type', 'Tipo')}</InputLabel>
                <Select
                  value={form.tipo}
                  onChange={(e) => handleFormChange('tipo', e.target.value)}
                  label={t('savings_type', 'Tipo')}
                >
                  {TIPOS_AHORRO.map((tp) => (
                    <MenuItem key={tp.value} value={tp.value}>{tp.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('savings_category', 'Categoria')}</InputLabel>
                <Select
                  value={form.categoria}
                  onChange={(e) => handleFormChange('categoria', e.target.value)}
                  label={t('savings_category', 'Categoria')}
                >
                  {CATEGORIAS.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('savings_amount', 'Monto')}
                type="number"
                value={form.monto}
                onChange={(e) => handleFormChange('monto', e.target.value)}
                fullWidth
                required
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                label={t('savings_solicitud', 'Solicitud ID')}
                type="number"
                value={form.solicitud_id}
                onChange={(e) => handleFormChange('solicitud_id', e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <TextField
              label={t('savings_vendor', 'Proveedor')}
              value={form.proveedor}
              onChange={(e) => handleFormChange('proveedor', e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t('savings_notes', 'Notas')}
              value={form.notas}
              onChange={(e) => handleFormChange('notas', e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} disabled={submitting}>
            {t('common_cancel', 'Cancelar')}
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <CircularProgress size={18} /> : t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
