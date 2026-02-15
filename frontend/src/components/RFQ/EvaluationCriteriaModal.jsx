/**
 * EvaluationCriteriaModal - Configurar criterios de evaluacion para RFQ
 *
 * 4 sliders (Precio, Lead Time, Calidad, Terminos Pago) de 0-100.
 * Validacion en tiempo real: la suma debe ser exactamente 100%.
 * Sprint 57
 */

import { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import GavelIcon from '@mui/icons-material/Gavel';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';

const CRITERIA_DEFAULTS = {
  precio: 40,
  lead_time: 25,
  calidad: 20,
  terminos_pago: 15,
};

const CRITERIA_LABELS = {
  precio: 'Precio',
  lead_time: 'Lead Time',
  calidad: 'Calidad',
  terminos_pago: 'Terminos de Pago',
};

export default function EvaluationCriteriaModal({ open, onClose, rfqId, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();

  const [criteria, setCriteria] = useState({ ...CRITERIA_DEFAULTS });
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => Object.values(criteria).reduce((sum, v) => sum + v, 0),
    [criteria]
  );

  const isValid = total === 100;

  const handleChange = useCallback((key, value) => {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!isValid) {
      toast.warning(t('rfq_criterios_suma_100', 'La suma de los criterios debe ser 100%'));
      return;
    }

    setSaving(true);
    try {
      const res = await api.post(`/rfq/${rfqId}/criteria`, { criterios: criteria });
      if (res.data?.ok) {
        toast.success(t('rfq_criterios_guardados', 'Criterios guardados'));
        onSaved?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rfq_error_criterios', 'Error al guardar criterios'));
    } finally {
      setSaving(false);
    }
  }, [criteria, isValid, rfqId, onSaved, t, toast]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="criteria-dialog-title">
      <DialogTitle id="criteria-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <GavelIcon color="primary" />
          <span>{t('rfq_criterios_titulo', 'Criterios de Evaluacion')}</span>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label={t('common_cerrar', 'Cerrar')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity={isValid ? 'success' : 'warning'}>
            {isValid
              ? t('rfq_criterios_ok', 'Los criterios suman 100%. Puede guardar.')
              : t('rfq_criterios_invalido', `La suma actual es ${total}%. Debe ser exactamente 100%.`)}
          </Alert>

          {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
            <Box key={key}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t(`rfq_criterio_${key}`, label)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, color: 'primary.main' }}
                >
                  {criteria[key]}%
                </Typography>
              </Stack>
              <Slider
                value={criteria[key]}
                onChange={(_, val) => handleChange(key, val)}
                min={0}
                max={100}
                step={5}
                aria-label={t(`rfq_criterio_${key}`, label)}
                marks={[
                  { value: 0, label: '0' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                ]}
              />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common_cancelar', 'Cancelar')}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !isValid}
          startIcon={saving && <CircularProgress size={16} />}
        >
          {t('rfq_guardar_criterios', 'Guardar Criterios')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
