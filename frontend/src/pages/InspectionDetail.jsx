/**
 * InspectionDetail - Detalle de inspeccion de calidad
 *
 * Header con info general, tabla editable de items inspeccionados,
 * boton guardar resultados y boton generar NCR si hay rechazos.
 * Sprint 58
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const RESULTADO_COLORS = {
  pass: 'success',
  fail: 'error',
  partial: 'warning',
  pending: 'default',
};

export default function InspectionDetail() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const navigate = useNavigate();
  const { id } = useParams();

  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [generatingNCR, setGeneratingNCR] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/quality/inspections/${id}`);
        if (cancelled) return;
        if (res.data?.ok) {
          setInspection(res.data.inspection);
          setItems(
            (res.data.inspection?.items || []).map((it) => ({
              ...it,
              cantidad_inspeccionada: it.cantidad_inspeccionada ?? it.cantidad ?? 0,
              cantidad_aprobada: it.cantidad_aprobada ?? 0,
              cantidad_rechazada: it.cantidad_rechazada ?? 0,
              resultado: it.resultado || 'pending',
              defectos: it.defectos || '',
            }))
          );
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('quality_error_cargar_detalle', 'Error al cargar detalle de inspeccion'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  }, []);

  const hasRejections = useMemo(
    () => items.some((it) => Number(it.cantidad_rechazada) > 0),
    [items]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        items: items.map((it) => ({
          id: it.id,
          cantidad_inspeccionada: Number(it.cantidad_inspeccionada) || 0,
          cantidad_aprobada: Number(it.cantidad_aprobada) || 0,
          cantidad_rechazada: Number(it.cantidad_rechazada) || 0,
          resultado: it.resultado,
          defectos: it.defectos?.trim() || '',
        })),
      };
      const res = await api.put(`/quality/inspections/${id}/results`, payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('quality_resultados_guardados', 'Resultados guardados'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('quality_error_guardar', 'Error al guardar resultados'));
    } finally {
      setSaving(false);
    }
  }, [id, items]);

  const handleGenerateNCR = useCallback(async () => {
    setGeneratingNCR(true);
    try {
      const res = await api.post(`/quality/inspections/${id}/ncr`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('quality_ncr_generado', 'NCR generado exitosamente'));
        navigate(`/quality/ncr/${res.data.ncr_id}`);
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('quality_error_ncr', 'Error al generar NCR'));
    } finally {
      setGeneratingNCR(false);
    }
  }, [id, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!inspection) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{t('quality_inspeccion_no_encontrada', 'Inspeccion no encontrada')}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/quality/inspections')} startIcon={<ArrowBackIcon />}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton onClick={() => navigate('/quality/inspections')} aria-label={t('common_volver', 'Volver')}>
          <ArrowBackIcon />
        </IconButton>
        <VerifiedIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {inspection.numero_inspeccion || `Inspeccion #${id}`}
        </Typography>
        <Chip
          label={inspection.resultado || 'pending'}
          color={RESULTADO_COLORS[inspection.resultado] || 'default'}
          size="small"
        />
      </Stack>

      {/* Info */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">{t('quality_tipo', 'Tipo')}</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{inspection.tipo || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('quality_fecha', 'Fecha')}</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {inspection.fecha ? new Date(inspection.fecha).toLocaleDateString('es-AR') : '-'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('quality_inspector', 'Inspector')}</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{inspection.inspector || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('quality_proveedor', 'Proveedor')}</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{inspection.proveedor_nombre || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('quality_recepcion_id', 'Recepcion')}</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{inspection.recepcion_id || '-'}</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Editable items table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('quality_items_inspeccion', 'Items de Inspeccion')} ({items.length})
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small" aria-label={t('quality_items_inspeccion', 'Items de Inspeccion')}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('quality_material', 'Material')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} width={110}>{t('quality_cant_inspeccionada', 'Inspeccionada')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} width={110}>{t('quality_cant_aprobada', 'Aprobada')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} width={110}>{t('quality_cant_rechazada', 'Rechazada')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} width={120}>{t('quality_resultado', 'Resultado')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('quality_defectos', 'Defectos')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id || idx}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.material_codigo || item.descripcion || '-'}
                    </Typography>
                    {item.material_codigo && item.descripcion && (
                      <Typography variant="caption" color="text.secondary">
                        {item.descripcion}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={item.cantidad_inspeccionada}
                      onChange={(e) => handleItemChange(idx, 'cantidad_inspeccionada', e.target.value)}
                      variant="standard"
                      inputProps={{ min: 0 }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={item.cantidad_aprobada}
                      onChange={(e) => handleItemChange(idx, 'cantidad_aprobada', e.target.value)}
                      variant="standard"
                      inputProps={{ min: 0 }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={item.cantidad_rechazada}
                      onChange={(e) => handleItemChange(idx, 'cantidad_rechazada', e.target.value)}
                      variant="standard"
                      inputProps={{ min: 0 }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={item.resultado}
                      onChange={(e) => handleItemChange(idx, 'resultado', e.target.value)}
                      variant="standard"
                      fullWidth
                    >
                      <MenuItem value="pending">{t('quality_pending', 'Pendiente')}</MenuItem>
                      <MenuItem value="pass">{t('quality_pass', 'Aprobado')}</MenuItem>
                      <MenuItem value="fail">{t('quality_fail', 'Rechazado')}</MenuItem>
                      <MenuItem value="partial">{t('quality_partial', 'Parcial')}</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={item.defectos}
                      onChange={(e) => handleItemChange(idx, 'defectos', e.target.value)}
                      variant="standard"
                      placeholder={t('quality_defectos_placeholder', 'Describir defectos...')}
                      fullWidth
                    />
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t('quality_sin_items', 'No hay items en esta inspeccion')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Actions */}
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        {hasRejections && (
          <Button
            variant="outlined"
            color="error"
            startIcon={generatingNCR ? <CircularProgress size={16} /> : <ReportProblemIcon />}
            onClick={handleGenerateNCR}
            disabled={generatingNCR}
          >
            {t('quality_generar_ncr', 'Generar NCR')}
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('quality_guardando', 'Guardando...') : t('quality_guardar_resultados', 'Guardar Resultados')}
        </Button>
      </Stack>
    </Box>
  );
}
