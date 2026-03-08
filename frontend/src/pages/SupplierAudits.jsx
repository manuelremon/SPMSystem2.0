/**
 * SupplierAudits - Supplier audit management page
 *
 * Displays audits with KPI cards, filters (proveedor, estado, tipo),
 * SPMAgGrid table, create audit dialog, and a detail dialog with
 * hallazgos table and result registration.
 * Sprint 61
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const TIPO_AUDIT_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'on_site', label: 'En Sitio' },
  { value: 'remote', label: 'Remota' },
  { value: 'documentary', label: 'Documental' },
];

const ESTADO_AUDIT_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

const TIPO_COLORS = {
  on_site: 'info',
  remote: 'default',
  documentary: 'default',
};

const ESTADO_COLORS = {
  scheduled: 'default',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
};

const ESTADO_LABELS = {
  scheduled: 'Programada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const RESULTADO_COLORS = {
  pass: 'success',
  conditional_pass: 'warning',
  fail: 'error',
};

const RESULTADO_LABELS = {
  pass: 'Aprobada',
  conditional_pass: 'Aprobacion Condicional',
  fail: 'Rechazada',
};

const HALLAZGO_TIPO_COLORS = {
  critical: 'error',
  major: 'warning',
  minor: 'info',
  observation: 'default',
};

const HALLAZGO_ESTADO_COLORS = {
  open: 'error',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
};

const INITIAL_FORM = {
  proveedor_cuit: '',
  tipo: 'on_site',
  titulo: '',
  fecha_programada: '',
};

const INITIAL_RESULT_FORM = {
  resultado: 'pass',
  score: '',
  hallazgos: [],
};

export default function SupplierAudits() {
  const { t } = useI18n();
  const toast = useToast();

  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [filters, setFilters] = useState({
    proveedor_cuit: '',
    estado: '',
    tipo: '',
  });

  // Create audit dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Result dialog
  const [resultOpen, setResultOpen] = useState(false);
  const [resultForm, setResultForm] = useState(INITIAL_RESULT_FORM);
  const [resultSubmitting, setResultSubmitting] = useState(false);

  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: 1, per_page: 200 };
      if (filters.proveedor_cuit) params.proveedor_cuit = filters.proveedor_cuit;
      if (filters.estado) params.estado = filters.estado;
      if (filters.tipo) params.tipo = filters.tipo;
      const res = await api.get('/supplier-audit/audits', { params });
      if (res.data?.ok) {
        setAudits(res.data.audits || res.data.items || []);
      }
    } catch {
      toast.error(t('audit_sup_error_load', 'Error al cargar auditorias'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await api.get('/supplier-audit/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchAudits();
    fetchKPIs();
  }, [fetchAudits, fetchKPIs]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Create audit
  const handleCreate = useCallback(async () => {
    if (!form.proveedor_cuit.trim() || !form.titulo.trim()) {
      toast.warning(t('audit_sup_required', 'Complete proveedor y titulo'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/supplier-audit/audits', form);
      if (res.data?.ok) {
        toast.success(t('audit_sup_created', 'Auditoria creada'));
        setCreateOpen(false);
        setForm(INITIAL_FORM);
        fetchAudits();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('audit_sup_error_create', 'Error al crear auditoria'));
    } finally {
      setSubmitting(false);
    }
  }, [form, t, toast, fetchAudits, fetchKPIs]);

  // Fetch audit detail
  const handleRowClick = useCallback(async (row) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedAudit(null);
    try {
      const res = await api.get(`/supplier-audit/audits/${row.id}`);
      if (res.data?.ok) {
        setSelectedAudit(res.data.audit || res.data);
      }
    } catch {
      toast.error(t('audit_sup_error_detail', 'Error al cargar detalle'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, [t, toast]);

  // Register result
  const handleResultSubmit = useCallback(async () => {
    if (!selectedAudit) return;
    setResultSubmitting(true);
    try {
      const payload = {
        resultado: resultForm.resultado,
        score: resultForm.score ? parseFloat(resultForm.score) : null,
        hallazgos: resultForm.hallazgos,
      };
      const res = await api.put(`/supplier-audit/audits/${selectedAudit.id}/result`, payload);
      if (res.data?.ok) {
        toast.success(t('audit_sup_result_saved', 'Resultado registrado'));
        setResultOpen(false);
        setResultForm(INITIAL_RESULT_FORM);
        // Refresh detail
        const detailRes = await api.get(`/supplier-audit/audits/${selectedAudit.id}`);
        if (detailRes.data?.ok) {
          setSelectedAudit(detailRes.data.audit || detailRes.data);
        }
        fetchAudits();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('audit_sup_error_result', 'Error al registrar resultado'));
    } finally {
      setResultSubmitting(false);
    }
  }, [selectedAudit, resultForm, t, toast, fetchAudits, fetchKPIs]);

  // Resolve finding
  const handleResolveFinding = useCallback(async (findingId) => {
    try {
      const res = await api.put(`/supplier-audit/findings/${findingId}/resolve`);
      if (res.data?.ok) {
        toast.success(t('audit_sup_finding_resolved', 'Hallazgo resuelto'));
        // Refresh detail
        if (selectedAudit) {
          const detailRes = await api.get(`/supplier-audit/audits/${selectedAudit.id}`);
          if (detailRes.data?.ok) {
            setSelectedAudit(detailRes.data.audit || detailRes.data);
          }
        }
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('audit_sup_error_resolve', 'Error al resolver hallazgo'));
    }
  }, [selectedAudit, t, toast, fetchKPIs]);

  const columnDefs = useMemo(() => [
    { field: 'proveedor_cuit', headerName: t('audit_sup_proveedor', 'Proveedor CUIT'), flex: 1, minWidth: 140 },
    {
      field: 'tipo',
      headerName: t('audit_sup_tipo', 'Tipo'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={TIPO_AUDIT_OPTIONS.find((o) => o.value === p.value)?.label || p.value || '-'} color={TIPO_COLORS[p.value] || 'default'} variant="outlined" />
      ),
    },
    { field: 'titulo', headerName: t('audit_sup_titulo', 'Titulo'), flex: 2, minWidth: 180 },
    {
      field: 'fecha_programada',
      headerName: t('audit_sup_fecha', 'Fecha Programada'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'estado',
      headerName: t('audit_sup_estado', 'Estado'),
      width: 140,
      cellRenderer: (p) => (
        <Chip size="small" label={ESTADO_LABELS[p.value] || p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'resultado',
      headerName: t('audit_sup_resultado', 'Resultado'),
      width: 160,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={p.value ? (RESULTADO_LABELS[p.value] || p.value) : 'Pendiente'}
          color={p.value ? (RESULTADO_COLORS[p.value] || 'default') : 'default'}
        />
      ),
    },
    {
      field: 'score',
      headerName: t('audit_sup_score', 'Score'),
      width: 90,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? p.value : '-',
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <AssignmentIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('audit_sup_title', 'Auditorias de Proveedores')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          aria-label={t('audit_sup_new', 'Nueva Auditoria')}
        >
          {t('audit_sup_new', 'Nueva Auditoria')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('audit_sup_kpi_total', 'Total Auditorias')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{kpis.auditorias_total ?? 0}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('audit_sup_kpi_pass_rate', 'Tasa Aprobacion')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {kpis.pass_rate != null ? `${Number(kpis.pass_rate).toFixed(1)}%` : '-'}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('audit_sup_kpi_hallazgos', 'Hallazgos Abiertos')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>{kpis.hallazgos_abiertos ?? 0}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('audit_sup_kpi_certs', 'Certificaciones Activas')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>{kpis.certificaciones_activas ?? 0}</Typography>
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <TextField
            size="small"
            label={t('audit_sup_filter_proveedor', 'Proveedor CUIT')}
            value={filters.proveedor_cuit}
            onChange={(e) => handleFilterChange('proveedor_cuit', e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('audit_sup_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('audit_sup_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_AUDIT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('audit_sup_filter_tipo', 'Tipo')}</InputLabel>
            <Select
              value={filters.tipo}
              label={t('audit_sup_filter_tipo', 'Tipo')}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
            >
              {TIPO_AUDIT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('audit_sup_title', 'Auditorias de Proveedores')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={audits}
          loading={loading}
          height={480}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={handleRowClick}
          exportFileName="auditorias_proveedores"
          emptyMessage={t('audit_sup_empty', 'No hay auditorias registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create Audit Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AssignmentIcon color="primary" />
            <span>{t('audit_sup_new', 'Nueva Auditoria')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('audit_sup_field_proveedor', 'Proveedor CUIT')}
              value={form.proveedor_cuit}
              onChange={(e) => handleFormChange('proveedor_cuit', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>{t('audit_sup_field_tipo', 'Tipo')}</InputLabel>
              <Select
                value={form.tipo}
                onChange={(e) => handleFormChange('tipo', e.target.value)}
                label={t('audit_sup_field_tipo', 'Tipo')}
              >
                {TIPO_AUDIT_OPTIONS.filter((o) => o.value).map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('audit_sup_field_titulo', 'Titulo')}
              value={form.titulo}
              onChange={(e) => handleFormChange('titulo', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('audit_sup_field_fecha', 'Fecha Programada')}
              type="date"
              value={form.fecha_programada}
              onChange={(e) => handleFormChange('fecha_programada', e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.proveedor_cuit.trim() || !form.titulo.trim()}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" gap={1}>
              <AssignmentIcon color="primary" />
              <span>{t('audit_sup_detail', 'Detalle de Auditoria')}</span>
            </Stack>
            <IconButton onClick={() => setDetailOpen(false)} size="small" aria-label="close">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedAudit ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Audit info */}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">{t('audit_sup_titulo', 'Titulo')}</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedAudit.titulo}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">{t('audit_sup_proveedor', 'Proveedor CUIT')}</Typography>
                  <Typography variant="body1">{selectedAudit.proveedor_cuit}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('audit_sup_tipo', 'Tipo')}</Typography>
                  <Box>
                    <Chip size="small" label={TIPO_AUDIT_OPTIONS.find((o) => o.value === selectedAudit.tipo)?.label || selectedAudit.tipo} variant="outlined" />
                  </Box>
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('audit_sup_fecha', 'Fecha')}</Typography>
                  <Typography variant="body1">{formatDate(selectedAudit.fecha_programada)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('audit_sup_resultado', 'Resultado')}</Typography>
                  <Box>
                    <Chip
                      size="small"
                      label={selectedAudit.resultado ? (RESULTADO_LABELS[selectedAudit.resultado] || selectedAudit.resultado) : 'Pendiente'}
                      color={selectedAudit.resultado ? (RESULTADO_COLORS[selectedAudit.resultado] || 'default') : 'default'}
                    />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('audit_sup_score', 'Score')}</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedAudit.score ?? '-'}</Typography>
                </Box>
              </Stack>

              <Divider />

              {/* Hallazgos table */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('audit_sup_hallazgos', 'Hallazgos')} ({(selectedAudit.hallazgos || []).length})
              </Typography>
              {(selectedAudit.hallazgos || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('audit_sup_no_hallazgos', 'Sin hallazgos registrados')}
                </Typography>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border, #e0e0e0)' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>{t('audit_sup_h_tipo', 'Tipo')}</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>{t('audit_sup_h_desc', 'Descripcion')}</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>{t('audit_sup_h_area', 'Area')}</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>{t('audit_sup_h_estado', 'Estado')}</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>{t('audit_sup_h_accion', 'Accion Requerida')}</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>{t('audit_sup_h_acciones', 'Acciones')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedAudit.hallazgos || []).map((h) => (
                        <tr key={h.id} style={{ borderBottom: '1px solid var(--border, #e0e0e0)' }}>
                          <td style={{ padding: '8px' }}>
                            <Chip size="small" label={h.tipo || '-'} color={HALLAZGO_TIPO_COLORS[h.tipo] || 'default'} />
                          </td>
                          <td style={{ padding: '8px' }}>{h.descripcion}</td>
                          <td style={{ padding: '8px' }}>{h.area || '-'}</td>
                          <td style={{ padding: '8px' }}>
                            <Chip size="small" label={h.estado || '-'} color={HALLAZGO_ESTADO_COLORS[h.estado] || 'default'} />
                          </td>
                          <td style={{ padding: '8px' }}>{h.accion_requerida || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {h.estado !== 'resolved' && h.estado !== 'closed' && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleResolveFinding(h.id)}
                              >
                                {t('audit_sup_resolve', 'Resolver')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}

              {/* Action buttons */}
              <Stack direction="row" gap={1} justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => {
                    setResultForm(INITIAL_RESULT_FORM);
                    setResultOpen(true);
                  }}
                  aria-label={t('audit_sup_register_result', 'Registrar Resultado')}
                >
                  {t('audit_sup_register_result', 'Registrar Resultado')}
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Register Result Dialog */}
      <Dialog open={resultOpen} onClose={() => setResultOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <CheckCircleIcon color="primary" />
            <span>{t('audit_sup_register_result', 'Registrar Resultado')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('audit_sup_field_resultado', 'Resultado')}</InputLabel>
              <Select
                value={resultForm.resultado}
                onChange={(e) => setResultForm((prev) => ({ ...prev, resultado: e.target.value }))}
                label={t('audit_sup_field_resultado', 'Resultado')}
              >
                <MenuItem value="pass">{RESULTADO_LABELS.pass}</MenuItem>
                <MenuItem value="conditional_pass">{RESULTADO_LABELS.conditional_pass}</MenuItem>
                <MenuItem value="fail">{RESULTADO_LABELS.fail}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('audit_sup_field_score', 'Score (0-100)')}
              type="number"
              value={resultForm.score}
              onChange={(e) => setResultForm((prev) => ({ ...prev, score: e.target.value }))}
              fullWidth
              size="small"
              inputProps={{ min: 0, max: 100, step: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResultOpen(false)} disabled={resultSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleResultSubmit}
            disabled={resultSubmitting}
            startIcon={resultSubmitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
