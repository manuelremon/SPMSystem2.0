/**
 * ConsignmentPrograms - Lista de programas de inventario en consignación
 *
 * KPI cards + AG-Grid de programas con estados + create button
 * Sprint 83
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';

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
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PendingActionsIcon from '@mui/icons-material/PendingActions';

import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  active: 'success',
  suspended: 'warning',
  terminated: 'error',
};

export default function ConsignmentPrograms() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    total_consigned_value: 0,
    month_consumption: 0,
    pending_reconciliations: 0,
  });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    proveedor_cuit: '',
    nombre: '',
    descripcion: '',
    periodo_reconciliacion: 'mensual',
    porcentaje_margen: '',
  });

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/consignment/programs', {
        params: { per_page: 100 },
      });
      if (res.data?.ok) {
        setPrograms(res.data.items || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_load', 'Error al cargar programas'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await api.get('/consignment/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || {});
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    fetchKpis();
  }, [fetchPrograms, fetchKpis]);

  const handleRowClick = useCallback((rowData) => {
    const programaId = rowData.id;
    navigate(`/consignment/${programaId}`);
  }, [navigate]);

  const handleCreateOpen = useCallback(() => {
    setFormData({
      proveedor_cuit: '',
      nombre: '',
      descripcion: '',
      periodo_reconciliacion: 'mensual',
      porcentaje_margen: '',
    });
    setCreateOpen(true);
  }, []);

  const handleCreateClose = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formData.proveedor_cuit.trim() || !formData.nombre.trim()) {
      toast.warning(t('consign_fill_required', 'Complete los campos requeridos'));
      return;
    }

    setCreating(true);
    try {
      const payload = {
        proveedor_cuit: formData.proveedor_cuit.trim(),
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || undefined,
        periodo_reconciliacion: formData.periodo_reconciliacion,
        porcentaje_margen: formData.porcentaje_margen ? parseFloat(formData.porcentaje_margen) : undefined,
      };

      const res = await api.post('/consignment/programs', payload);
      if (res.data?.ok) {
        toast.success(t('consign_created', 'Programa creado exitosamente'));
        setCreateOpen(false);
        fetchPrograms();
        fetchKpis();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_create', 'Error al crear programa'));
    } finally {
      setCreating(false);
    }
  }, [formData, t, toast, fetchPrograms, fetchKpis]);

  const columnDefs = useMemo(() => [
    {
      headerName: t('consign_col_id', 'ID'),
      field: 'id',
      width: 80,
      sortable: true,
    },
    {
      headerName: t('consign_col_nombre', 'Nombre'),
      field: 'nombre',
      flex: 1,
      sortable: true,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: t('consign_col_proveedor', 'Proveedor'),
      field: 'proveedor_nombre',
      flex: 1,
      sortable: true,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: t('consign_col_estado', 'Estado'),
      field: 'estado',
      width: 140,
      sortable: true,
      filter: 'agSetColumnFilter',
      cellRenderer: (params) => {
        if (!params.value) return '';
        return (
          <Chip
            label={t(`consign_estado_${params.value}`, params.value)}
            color={ESTADO_COLORS[params.value] || 'default'}
            size="small"
          />
        );
      },
    },
    {
      headerName: t('consign_col_periodo', 'Periodo'),
      field: 'periodo_reconciliacion',
      width: 140,
      sortable: true,
    },
    {
      headerName: t('consign_col_margen', 'Margen %'),
      field: 'porcentaje_margen',
      width: 120,
      sortable: true,
      valueFormatter: (params) => {
        if (params.value == null) return '-';
        return `${params.value.toFixed(2)}%`;
      },
    },
    {
      headerName: t('consign_col_created', 'Creado'),
      field: 'created_at',
      width: 180,
      sortable: true,
      valueFormatter: (params) => formatDateTime(params.value),
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" gap={1}>
          <InventoryIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('consign_title', 'Inventario en Consignación')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateOpen}
        >
          {t('consign_new_program', 'Nuevo Programa')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <InventoryIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  {t('consign_kpi_value', 'Valor en Consignación')}
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {formatCurrency(kpis.total_consigned_value)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <TrendingUpIcon sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  {t('consign_kpi_month', 'Consumo del Mes')}
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {formatCurrency(kpis.month_consumption)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <PendingActionsIcon sx={{ color: 'warning.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  {t('consign_kpi_pending', 'Reconciliaciones Pendientes')}
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {kpis.pending_reconciliations}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Programs Grid */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <SPMAgGrid
            rowData={programs}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
            }}
            pagination={true}
            paginationPageSize={20}
            onRowClick={handleRowClick}
            rowStyle={{ cursor: 'pointer' }}
            emptyMessage={t('consign_no_programs', 'No hay programas')}
            height={500}
            exportFileName="consignment-programs"
          />
        )}
      </Paper>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <span>{t('consign_create_title', 'Crear Programa de Consignación')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('consign_field_cuit', 'CUIT Proveedor')}
              value={formData.proveedor_cuit}
              onChange={(e) => handleFieldChange('proveedor_cuit', e.target.value)}
              fullWidth
              size="small"
              required
              placeholder="20-12345678-9"
            />
            <TextField
              label={t('consign_field_nombre', 'Nombre del Programa')}
              value={formData.nombre}
              onChange={(e) => handleFieldChange('nombre', e.target.value)}
              fullWidth
              size="small"
              required
              placeholder="Programa Consignación 2026"
            />
            <TextField
              label={t('consign_field_descripcion', 'Descripción')}
              value={formData.descripcion}
              onChange={(e) => handleFieldChange('descripcion', e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
            <TextField
              select
              label={t('consign_field_periodo', 'Periodo de Reconciliación')}
              value={formData.periodo_reconciliacion}
              onChange={(e) => handleFieldChange('periodo_reconciliacion', e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="mensual">{t('consign_periodo_mensual', 'Mensual')}</MenuItem>
              <MenuItem value="quincenal">{t('consign_periodo_quincenal', 'Quincenal')}</MenuItem>
            </TextField>
            <TextField
              label={t('consign_field_margen', 'Porcentaje Margen (%)')}
              value={formData.porcentaje_margen}
              onChange={(e) => handleFieldChange('porcentaje_margen', e.target.value)}
              fullWidth
              size="small"
              type="number"
              placeholder="5.0"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCreateClose} disabled={creating}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('consign_create_btn', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
