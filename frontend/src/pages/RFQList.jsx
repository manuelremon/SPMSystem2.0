/**
 * RFQList - Lista de Solicitudes de Cotizacion (RFQ)
 *
 * Muestra todas las RFQs con filtros por estado y busqueda.
 * Permite crear nuevas RFQs o crear desde solicitud existente.
 * Sprint 57
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { formatDate } from '../utils/formatters';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const ESTADO_COLORS = {
  draft: 'default',
  published: 'info',
  bidding: 'primary',
  evaluation: 'warning',
  awarded: 'success',
  cancelled: 'error',
  closed: 'default',
};

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicada' },
  { value: 'bidding', label: 'En Licitacion' },
  { value: 'evaluation', label: 'Evaluacion' },
  { value: 'awarded', label: 'Adjudicada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'closed', label: 'Cerrada' },
];

export default function RFQList() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [search, setSearch] = useState('');
  const [fromSolicitudOpen, setFromSolicitudOpen] = useState(false);
  const [solicitudId, setSolicitudId] = useState('');
  const [creatingFromSol, setCreatingFromSol] = useState(false);

  const fetchRFQs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (estadoFilter) params.estado = estadoFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/rfq', { params });
      if (res.data?.ok) {
        setRfqs(res.data.rfqs || []);
      }
    } catch {
      // toast/t excluded from deps to avoid infinite loop
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFilter, search]);

  useEffect(() => {
    fetchRFQs();
  }, [fetchRFQs]);

  const handleCreateFromSolicitud = useCallback(async () => {
    if (!solicitudId.trim()) {
      toast.warning(t('rfq_solicitud_requerida', 'Ingrese un ID de solicitud'));
      return;
    }
    setCreatingFromSol(true);
    try {
      const res = await api.post('/rfq/from-solicitud', { solicitud_id: solicitudId.trim() });
      if (res.data?.ok) {
        toast.success(t('rfq_creada_desde_solicitud', 'RFQ creada desde solicitud'));
        setFromSolicitudOpen(false);
        setSolicitudId('');
        navigate(`/procurement/rfq/${res.data.rfq_id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rfq_error_crear', 'Error al crear RFQ'));
    } finally {
      setCreatingFromSol(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId, navigate]);

  const columnDefs = useMemo(() => [
    {
      field: 'numero_rfq',
      headerName: t('rfq_numero', 'N. RFQ'),
      width: 130,
      minWidth: 110,
    },
    {
      field: 'titulo',
      headerName: t('rfq_titulo', 'Titulo'),
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'estado',
      headerName: t('rfq_estado', 'Estado'),
      width: 130,
      cellRenderer: (params) => (
        <Chip
          label={params.value || 'draft'}
          color={ESTADO_COLORS[params.value] || 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'fecha_creacion',
      headerName: t('rfq_fecha_creacion', 'Creada'),
      width: 130,
      valueFormatter: (params) => formatDate(params.value) || '',
    },
    {
      field: 'fecha_cierre_ofertas',
      headerName: t('rfq_fecha_cierre', 'Cierre Ofertas'),
      width: 140,
      valueFormatter: (params) => formatDate(params.value) || '-',
    },
    {
      field: 'num_proveedores',
      headerName: t('rfq_proveedores', 'Proveedores'),
      width: 120,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ?? 0,
    },
    {
      field: 'num_ofertas',
      headerName: t('rfq_ofertas', 'Ofertas'),
      width: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ?? 0,
    },
  ], [t]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: "text.disabled",
              "&:hover": {
                color: "text.secondary",
                bgcolor: "background.paper",
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
            {t('rfq_list_title', 'Solicitudes de Cotizacion (RFQ)')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            startIcon={<ContentPasteGoIcon />}
            onClick={() => setFromSolicitudOpen(true)}
            aria-label={t('rfq_crear_desde_solicitud', 'Crear desde Solicitud')}
          >
            {t('rfq_crear_desde_solicitud', 'Crear desde Solicitud')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/procurement/rfq/new')}
            aria-label={t('rfq_nueva', 'Nueva RFQ')}
          >
            {t('rfq_nueva', 'Nueva RFQ')}
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('rfq_filtro_estado', 'Estado')}</InputLabel>
            <Select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              label={t('rfq_filtro_estado', 'Estado')}
            >
              {ESTADOS.map((e) => (
                <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('rfq_buscar', 'Buscar')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            placeholder={t('rfq_buscar_placeholder', 'Titulo o numero...')}
          />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('rfq_list_title', 'Solicitudes de Cotizacion')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={rfqs}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/procurement/rfq/${row.id}`)}
          exportFileName="rfqs"
          emptyMessage={t('rfq_empty', 'No hay RFQs registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Dialog: Create from Solicitud */}
      <Dialog open={fromSolicitudOpen} onClose={() => setFromSolicitudOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('rfq_crear_desde_solicitud', 'Crear RFQ desde Solicitud')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('rfq_solicitud_id', 'ID de Solicitud')}
            value={solicitudId}
            onChange={(e) => setSolicitudId(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            placeholder="Ej: 123"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFromSolicitudOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleCreateFromSolicitud}
            disabled={creatingFromSol || !solicitudId.trim()}
            startIcon={creatingFromSol && <CircularProgress size={16} />}
          >
            {t('rfq_crear_btn', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
