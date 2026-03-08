/**
 * RFQDetail - Detalle de una RFQ con tabs
 *
 * Header con estado y acciones segun FSM.
 * Tabs: Items y Proveedores, Ofertas, Comparacion, Evaluacion.
 * Sprint 57
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublishIcon from '@mui/icons-material/Publish';
import GavelIcon from '@mui/icons-material/Gavel';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import BidComparisonMatrix from '../components/RFQ/BidComparisonMatrix';
import EvaluationCriteriaModal from '../components/RFQ/EvaluationCriteriaModal';
import AwardRFQModal from '../components/RFQ/AwardRFQModal';
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

export default function RFQDetail() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { id } = useParams();

  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [bids, setBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);

  const fetchRFQ = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/rfq/${id}`);
      if (res.data?.ok) {
        setRfq(res.data.rfq);
      }
    } catch {
      toast.error(t('rfq_error_cargar_detalle', 'Error al cargar detalle de RFQ'));
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  const fetchBids = useCallback(async () => {
    try {
      setBidsLoading(true);
      const res = await api.get(`/rfq/${id}/bids`);
      if (res.data?.ok) {
        setBids(res.data.bids || []);
      }
    } catch {
      setBids([]);
    } finally {
      setBidsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRFQ();
  }, [fetchRFQ]);

  useEffect(() => {
    if (currentTab === 1 || currentTab === 2) {
      fetchBids();
    }
  }, [currentTab, fetchBids]);

  const handleAction = useCallback(async (action) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/rfq/${id}/${action}`);
      if (res.data?.ok) {
        toast.success(t(`rfq_action_${action}_ok`, `Accion "${action}" ejecutada`));
        fetchRFQ();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rfq_error_accion', 'Error al ejecutar accion'));
    } finally {
      setActionLoading(false);
    }
  }, [id, fetchRFQ, t, toast]);

  const itemColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('rfq_material_codigo', 'Codigo'), width: 140 },
    { field: 'descripcion', headerName: t('rfq_item_descripcion', 'Descripcion'), flex: 2, minWidth: 200 },
    {
      field: 'cantidad',
      headerName: t('rfq_cantidad', 'Cantidad'),
      width: 100,
      type: 'numericColumn',
    },
    { field: 'unidad', headerName: t('rfq_unidad', 'Unidad'), width: 80 },
    { field: 'especificaciones', headerName: t('rfq_especificaciones', 'Especificaciones'), flex: 1 },
  ], [t]);

  const proveedorColumnDefs = useMemo(() => [
    { field: 'cuit', headerName: t('rfq_proveedor_cuit', 'CUIT'), width: 160 },
    { field: 'nombre', headerName: t('rfq_proveedor_nombre', 'Nombre'), flex: 2, minWidth: 200 },
    {
      field: 'estado_invitacion',
      headerName: t('rfq_estado_invitacion', 'Estado'),
      width: 130,
      cellRenderer: (params) => (
        <Chip
          label={params.value || 'invitado'}
          size="small"
          color={params.value === 'aceptado' ? 'success' : params.value === 'rechazado' ? 'error' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'fecha_invitacion',
      headerName: t('rfq_fecha_invitacion', 'Invitado'),
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return new Date(params.value).toLocaleDateString('es-AR');
      },
    },
  ], [t]);

  const bidColumnDefs = useMemo(() => [
    { field: 'proveedor_nombre', headerName: t('rfq_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    {
      field: 'monto_total',
      headerName: t('rfq_monto_total', 'Monto Total'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (params) => {
        if (params.value == null) return '-';
        return `USD ${Number(params.value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      },
    },
    {
      field: 'lead_time_dias',
      headerName: t('rfq_lead_time', 'Lead Time (dias)'),
      width: 130,
      type: 'numericColumn',
    },
    {
      field: 'fecha_oferta',
      headerName: t('rfq_fecha_oferta', 'Fecha Oferta'),
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return new Date(params.value).toLocaleDateString('es-AR');
      },
    },
    {
      field: 'estado',
      headerName: t('rfq_estado', 'Estado'),
      width: 120,
      cellRenderer: (params) => (
        <Chip label={params.value || 'recibida'} size="small" variant="outlined" />
      ),
    },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!rfq) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{t('rfq_no_encontrada', 'RFQ no encontrada')}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/procurement/rfq')} startIcon={<ArrowBackIcon />}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = rfq.estado || 'draft';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton onClick={() => navigate('/procurement/rfq')} aria-label={t('common_volver', 'Volver')}>
          <ArrowBackIcon />
        </IconButton>
        <ReceiptLongIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {rfq.numero_rfq || `RFQ #${id}`}
        </Typography>
        <Chip
          label={estado}
          color={ESTADO_COLORS[estado] || 'default'}
          size="small"
        />
      </Stack>

      {/* Info bar */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>{rfq.titulo}</Typography>
            {rfq.descripcion && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {rfq.descripcion}
              </Typography>
            )}
            <Stack direction="row" gap={2} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {t('rfq_fecha_creacion', 'Creada')}: {rfq.fecha_creacion ? new Date(rfq.fecha_creacion).toLocaleDateString('es-AR') : '-'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('rfq_fecha_cierre', 'Cierre Ofertas')}: {rfq.fecha_cierre_ofertas ? new Date(rfq.fecha_cierre_ofertas).toLocaleDateString('es-AR') : '-'}
              </Typography>
            </Stack>
          </Box>

          {/* Action buttons based on state */}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {estado === 'draft' && (
              <Button
                variant="contained"
                startIcon={actionLoading ? <CircularProgress size={16} /> : <PublishIcon />}
                onClick={() => handleAction('publish')}
                disabled={actionLoading}
              >
                {t('rfq_publicar', 'Publicar')}
              </Button>
            )}
            {estado === 'bidding' && (
              <Button
                variant="contained"
                color="warning"
                startIcon={actionLoading ? <CircularProgress size={16} /> : <AssessmentIcon />}
                onClick={() => handleAction('evaluate')}
                disabled={actionLoading}
              >
                {t('rfq_evaluar', 'Evaluar')}
              </Button>
            )}
            {estado === 'evaluation' && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<GavelIcon />}
                  onClick={() => setCriteriaOpen(true)}
                >
                  {t('rfq_config_criterios', 'Configurar Criterios')}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={actionLoading ? <CircularProgress size={16} /> : <EmojiEventsIcon />}
                  onClick={() => setAwardOpen(true)}
                  disabled={actionLoading}
                >
                  {t('rfq_adjudicar', 'Adjudicar')}
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, val) => setCurrentTab(val)}
        aria-label={t('rfq_tabs', 'Tabs de RFQ')}
      >
        <Tab label={t('rfq_tab_items', 'Items y Proveedores')} />
        <Tab label={t('rfq_tab_ofertas', 'Ofertas')} />
        <Tab label={t('rfq_tab_comparacion', 'Comparacion')} />
        <Tab label={t('rfq_tab_evaluacion', 'Evaluacion')} />
      </Tabs>

      {/* Tab 0: Items & Suppliers */}
      {currentTab === 0 && (
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('rfq_items', 'Items Solicitados')} ({rfq.items?.length || 0})
              </Typography>
            </Box>
            <SPMAgGrid
              columnDefs={itemColumnDefs}
              rowData={rfq.items || []}
              height={250}
              emptyMessage={t('rfq_sin_items', 'Sin items')}
              getRowId={(params) => String(params.data.id || params.data.material_codigo)}
            />
          </Paper>

          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('rfq_proveedores_invitados', 'Proveedores Invitados')} ({rfq.proveedores?.length || 0})
              </Typography>
            </Box>
            <SPMAgGrid
              columnDefs={proveedorColumnDefs}
              rowData={rfq.proveedores || []}
              height={250}
              emptyMessage={t('rfq_sin_proveedores', 'Sin proveedores invitados')}
              getRowId={(params) => String(params.data.id || params.data.cuit)}
            />
          </Paper>
        </Stack>
      )}

      {/* Tab 1: Bids */}
      {currentTab === 1 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('rfq_ofertas_recibidas', 'Ofertas Recibidas')} ({bids.length})
            </Typography>
          </Box>
          <SPMAgGrid
            columnDefs={bidColumnDefs}
            rowData={bids}
            loading={bidsLoading}
            height={400}
            enableQuickFilter={true}
            emptyMessage={t('rfq_sin_ofertas', 'No se han recibido ofertas')}
            getRowId={(params) => String(params.data.id || params.data.proveedor_nombre)}
          />
        </Paper>
      )}

      {/* Tab 2: Comparison */}
      {currentTab === 2 && (
        <BidComparisonMatrix rfqId={id} />
      )}

      {/* Tab 3: Evaluation */}
      {currentTab === 3 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {t('rfq_evaluacion_titulo', 'Evaluacion y Puntaje')}
          </Typography>
          {rfq.criterios ? (
            <Stack spacing={2}>
              <Alert severity="info">
                {t('rfq_criterios_configurados', 'Criterios configurados. Puede adjudicar desde el boton superior.')}
              </Alert>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label={t('rfq_criterios', 'Criterios de evaluacion')}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{t('rfq_criterio', 'Criterio')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">{t('rfq_peso', 'Peso (%)')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(rfq.criterios).map(([key, val]) => (
                      <TableRow key={key}>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</TableCell>
                        <TableCell align="right">{val}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ) : (
            <Alert severity="warning">
              {t('rfq_sin_criterios', 'No se han configurado criterios de evaluacion. Use el boton "Configurar Criterios" para definirlos.')}
            </Alert>
          )}
        </Paper>
      )}

      {/* Modals */}
      <EvaluationCriteriaModal
        open={criteriaOpen}
        onClose={() => setCriteriaOpen(false)}
        rfqId={id}
        onSaved={() => {
          setCriteriaOpen(false);
          fetchRFQ();
        }}
      />

      <AwardRFQModal
        open={awardOpen}
        onClose={() => setAwardOpen(false)}
        rfqId={id}
        items={rfq.items || []}
        bids={bids}
        onAwarded={() => {
          setAwardOpen(false);
          fetchRFQ();
        }}
      />
    </Box>
  );
}
