/**
 * ForecastSimulationPanel - Panel de simulación para Cold Start
 *
 * Permite generar predicciones sintéticas para materiales sin historial
 * basándose en parámetros manuales del usuario
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../../context/i18n';

// MUI Components
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';

// MUI Icons
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ScienceIcon from '@mui/icons-material/Science';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const VOLATILIDAD_OPTIONS = [
  { value: 'low', factor: 0.10 },
  { value: 'medium', factor: 0.30 },
  { value: 'high', factor: 0.50 },
];

const ForecastSimulationPanel = ({
  onSimulate,
  onCopyFromSimilar,
  materialCodigo = '',
  disabled = false,
}) => {
  const { t } = useI18n();

  // Estado de los inputs
  const [consumoMensual, setConsumoMensual] = useState('');
  const [volatilidad, setVolatilidad] = useState('medium');
  const [leadTime, setLeadTime] = useState('');

  // Validación
  const [errors, setErrors] = useState({});

  const validateInputs = useCallback(() => {
    const newErrors = {};

    if (!consumoMensual || parseFloat(consumoMensual) <= 0) {
      newErrors.consumoMensual = t('forecast_simulation_error_consumo', 'Ingresa un consumo válido mayor a 0');
    }

    if (!leadTime || parseInt(leadTime) <= 0) {
      newErrors.leadTime = t('forecast_simulation_error_leadtime', 'Ingresa un lead time válido mayor a 0');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [consumoMensual, leadTime, t]);

  const handleSimulate = useCallback(() => {
    if (!validateInputs()) return;

    const volatilityOption = VOLATILIDAD_OPTIONS.find(v => v.value === volatilidad);

    onSimulate({
      consumoMensual: parseFloat(consumoMensual),
      volatilidad: volatilityOption?.factor || 0.30,
      leadTime: parseInt(leadTime),
    });
  }, [consumoMensual, volatilidad, leadTime, validateInputs, onSimulate]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSimulate();
    }
  }, [handleSimulate]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        border: '2px dashed',
        borderColor: 'warning.light',
        borderRadius: 2,
        bgcolor: 'rgba(251, 191, 36, 0.04)',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'warning.light',
            color: 'warning.contrastText',
            display: 'flex',
          }}
        >
          <WarningAmberIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" gutterBottom>
            {t('forecast_simulation_titulo', 'Simulación de Material Nuevo')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('forecast_simulation_descripcion', 'No hay historial de consumo para este material. Define los parámetros para generar una predicción estimada.')}
          </Typography>
          {materialCodigo && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Material: <strong>{materialCodigo}</strong>
            </Typography>
          )}
        </Box>
      </Box>

      {/* Inputs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
          mb: 4,
        }}
      >
        {/* Consumo Mensual */}
        <Tooltip
          title={t('forecast_simulation_consumo_tooltip', 'Estimación del consumo promedio mensual esperado para este material')}
          placement="top"
          arrow
        >
          <TextField
            label={t('forecast_simulation_consumo', 'Consumo Mensual Estimado')}
            type="number"
            value={consumoMensual}
            onChange={(e) => setConsumoMensual(e.target.value)}
            onKeyDown={handleKeyDown}
            error={Boolean(errors.consumoMensual)}
            helperText={errors.consumoMensual}
            disabled={disabled}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption" color="text.secondary">unid/mes</Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Tooltip>

        {/* Volatilidad */}
        <Tooltip
          title={t('forecast_simulation_volatilidad_tooltip', 'Nivel de variación esperada en la demanda. Mayor volatilidad = bandas de confianza más amplias')}
          placement="top"
          arrow
        >
          <FormControl fullWidth size="small">
            <InputLabel>{t('forecast_simulation_volatilidad', 'Factor de Volatilidad')}</InputLabel>
            <Select
              value={volatilidad}
              onChange={(e) => setVolatilidad(e.target.value)}
              label={t('forecast_simulation_volatilidad', 'Factor de Volatilidad')}
              disabled={disabled}
            >
              <MenuItem value="low">
                {t('volatilidad_baja', 'Baja (±10%)')}
              </MenuItem>
              <MenuItem value="medium">
                {t('volatilidad_media', 'Media (±30%)')}
              </MenuItem>
              <MenuItem value="high">
                {t('volatilidad_alta', 'Alta (±50%)')}
              </MenuItem>
            </Select>
          </FormControl>
        </Tooltip>

        {/* Lead Time */}
        <Tooltip
          title={t('forecast_simulation_leadtime_tooltip', 'Tiempo promedio de entrega del proveedor. Se usa para calcular el stock de seguridad')}
          placement="top"
          arrow
        >
          <TextField
            label={t('forecast_simulation_leadtime', 'Lead Time del Proveedor')}
            type="number"
            value={leadTime}
            onChange={(e) => setLeadTime(e.target.value)}
            onKeyDown={handleKeyDown}
            error={Boolean(errors.leadTime)}
            helperText={errors.leadTime}
            disabled={disabled}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption" color="text.secondary">{t('common_dias', 'días')}</Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ min: 1, step: 1 }}
          />
        </Tooltip>
      </Box>

      {/* Info box */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          p: 2,
          mb: 3,
          bgcolor: 'info.lighter',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'info.light',
        }}
      >
        <InfoOutlinedIcon sx={{ color: 'info.main', fontSize: 20, mt: 0.25 }} />
        <Typography variant="caption" color="text.secondary">
          {t('forecast_simulation_info', 'La simulación genera 12 meses de predicciones basadas en los parámetros ingresados. Los resultados son estimativos y deben validarse con datos reales cuando estén disponibles.')}
        </Typography>
      </Box>

      {/* Botones */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="warning"
          onClick={handleSimulate}
          disabled={disabled || !consumoMensual || !leadTime}
          startIcon={<ScienceIcon />}
          sx={{
            bgcolor: 'warning.main',
            '&:hover': { bgcolor: 'warning.dark' },
          }}
        >
          {t('forecast_simulation_btn', 'Simular Escenario')}
        </Button>

        {onCopyFromSimilar && (
          <Button
            variant="outlined"
            color="inherit"
            onClick={onCopyFromSimilar}
            disabled={disabled}
            startIcon={<ContentCopyIcon />}
            sx={{ borderColor: 'divider' }}
          >
            {t('forecast_simulation_copiar', 'Copiar de Material Similar')}
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default ForecastSimulationPanel;
