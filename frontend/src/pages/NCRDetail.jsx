/**
 * NCRDetail - Detalle de No-Conformidad (NCR)
 *
 * Header con severidad y estado badges, info cards, FSM action buttons,
 * assignment dropdown, notas/accion correctiva, boton crear CAPA, timeline.
 * Sprint 59
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import BuildIcon from '@mui/icons-material/Build';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const SEVERIDAD_COLORS = {
  critical: 'error',
  major: 'warning',
  minor: 'default',
};

const ESTADO_COLORS = {
  open: 'error',
  investigating: 'warning',
  resolved: 'info',
  closed: 'success',
  cancelled: 'default',
};

export default function NCRDetail() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const navigate = useNavigate();
  const { id } = useParams();

  const [ncr, setNcr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingCAPA, setCreatingCAPA] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Editable fields
  const [asignarA, setAsignarA] = useState('');
  const [notas, setNotas] = useState('');
  const [accionCorrectiva, setAccionCorrectiva] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/quality/ncr/${id}`);
        if (cancelled) return;
        if (res.data?.ok) {
          const data = res.data.ncr;
          setNcr(data);
          setAsignarA(data.asignar_a || '');
          setNotas(data.notas || '');
          setAccionCorrectiva(data.accion_correctiva || '');
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('ncr_error_cargar_detalle', 'Error al cargar detalle de NCR'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  const handleAction = useCallback(async (action) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/quality/ncr/${id}/${action}`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current(`ncr_action_${action}_ok`, `Accion "${action}" ejecutada`));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('ncr_error_accion', 'Error al ejecutar accion'));
    } finally {
      setActionLoading(false);
    }
  }, [id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.put(`/quality/ncr/${id}`, {
        asignar_a: asignarA.trim() || null,
        notas: notas.trim(),
        accion_correctiva: accionCorrectiva.trim(),
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('ncr_guardado', 'NCR actualizado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('ncr_error_guardar', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }, [id, asignarA, notas, accionCorrectiva]);

  const handleCreateCAPA = useCallback(async () => {
    setCreatingCAPA(true);
    try {
      const res = await api.post(`/quality/ncr/${id}/capa`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('ncr_capa_creado', 'CAPA creado exitosamente'));
        navigate(`/quality/capa/${res.data.capa_id}`);
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('ncr_error_capa', 'Error al crear CAPA'));
    } finally {
      setCreatingCAPA(false);
    }
  }, [id, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ncr) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{t('ncr_no_encontrado', 'NCR no encontrado')}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/quality/ncr')} startIcon={<ArrowBackIcon />}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = ncr.estado || 'open';
  const historial = ncr.historial || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <IconButton onClick={() => navigate('/quality/ncr')} aria-label={t('common_volver', 'Volver')}>
          <ArrowBackIcon />
        </IconButton>
        <ReportProblemIcon sx={{ color: 'error.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {ncr.numero_ncr || `NCR #${id}`}
        </Typography>
        <Chip
          label={ncr.severidad || 'minor'}
          color={SEVERIDAD_COLORS[ncr.severidad] || 'default'}
          size="small"
        />
        <Chip
          label={estado}
          color={ESTADO_COLORS[estado] || 'default'}
          size="small"
          variant="outlined"
        />
      </Stack>

      {/* Info cards */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">{t('ncr_material', 'Material')}</Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{ncr.material_codigo || '-'}</Typography>
          <Typography variant="body2" color="text.secondary">{ncr.material_descripcion || ''}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">{t('ncr_proveedor', 'Proveedor')}</Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{ncr.proveedor_nombre || '-'}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">{t('ncr_cantidad', 'Cantidad Afectada')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{ncr.cantidad_afectada ?? 0}</Typography>
        </Paper>
      </Stack>

      {/* Description */}
      {ncr.descripcion && (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">{t('ncr_descripcion', 'Descripcion')}</Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }}>{ncr.descripcion}</Typography>
        </Paper>
      )}

      {/* FSM Actions + editable fields */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          {t('ncr_acciones', 'Acciones y Seguimiento')}
        </Typography>

        {/* State transition buttons */}
        <Stack direction="row" gap={1} sx={{ mb: 3 }} flexWrap="wrap">
          {estado === 'open' && (
            <Button
              variant="contained"
              color="warning"
              startIcon={actionLoading ? <CircularProgress size={16} /> : <SearchIcon />}
              onClick={() => handleAction('investigate')}
              disabled={actionLoading}
            >
              {t('ncr_investigar', 'Investigar')}
            </Button>
          )}
          {estado === 'investigating' && (
            <Button
              variant="contained"
              color="info"
              startIcon={actionLoading ? <CircularProgress size={16} /> : <CheckCircleIcon />}
              onClick={() => handleAction('resolve')}
              disabled={actionLoading}
            >
              {t('ncr_resolver', 'Resolver')}
            </Button>
          )}
          {(estado === 'resolved' || estado === 'investigating') && (
            <Button
              variant="contained"
              color="success"
              startIcon={actionLoading ? <CircularProgress size={16} /> : <LockIcon />}
              onClick={() => handleAction('close')}
              disabled={actionLoading}
            >
              {t('ncr_cerrar', 'Cerrar')}
            </Button>
          )}
          {(estado === 'open' || estado === 'investigating') && (
            <Button
              variant="outlined"
              color="error"
              startIcon={creatingCAPA ? <CircularProgress size={16} /> : <BuildIcon />}
              onClick={handleCreateCAPA}
              disabled={creatingCAPA}
            >
              {t('ncr_crear_capa', 'Crear CAPA')}
            </Button>
          )}
        </Stack>

        <Stack spacing={2.5}>
          <TextField
            label={t('ncr_asignar_a', 'Asignar a')}
            value={asignarA}
            onChange={(e) => setAsignarA(e.target.value)}
            fullWidth
            placeholder={t('ncr_asignar_placeholder', 'Nombre o ID del responsable')}
          />
          <TextField
            label={t('ncr_notas', 'Notas')}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label={t('ncr_accion_correctiva', 'Accion Correctiva')}
            value={accionCorrectiva}
            onChange={(e) => setAccionCorrectiva(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('ncr_guardando', 'Guardando...') : t('ncr_guardar', 'Guardar Cambios')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Timeline */}
      {historial.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {t('ncr_timeline', 'Historial')}
          </Typography>
          <Box sx={{ position: 'relative', pl: 3 }}>
            <Box sx={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, bgcolor: 'divider' }} />
            {historial.map((entry, idx) => {
              const dotColor =
                entry.accion === 'close' ? 'success.main' :
                entry.accion === 'resolve' ? 'info.main' :
                entry.accion === 'investigate' ? 'warning.main' : 'grey.400';
              return (
                <Box key={idx} sx={{ position: 'relative', mb: 2.5 }}>
                  <Box sx={{ position: 'absolute', left: -19, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: dotColor, border: '2px solid white' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {entry.accion || entry.estado_nuevo || '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.fecha ? new Date(entry.fecha).toLocaleString('es-AR') : ''}
                    {entry.usuario ? ` - ${entry.usuario}` : ''}
                  </Typography>
                  {entry.comentario && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {entry.comentario}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
