/**
 * ForecastPlaceholder - Panel de fallback para Cold Start
 *
 * Se muestra cuando hay menos de 3 registros historicos.
 * Permite generar predicciones manuales basadas en parametros del usuario.
 *
 * Formula de Stock de Seguridad:
 * SS = Z × sqrt(LT/30) × sigma_estimada
 * donde:
 * - Z = 1.65 (factor de servicio 95%)
 * - LT = Lead Time en dias
 * - sigma_estimada = Consumo × UncertaintyBuffer
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../../context/i18n';

// MUI Components
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';

// MUI Icons
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CalculateIcon from '@mui/icons-material/Calculate';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';

// Factor de servicio para 95% de confianza
const Z_FACTOR = 1.65;

/**
 * Calcula el Stock de Seguridad usando la formula heuristica
 * @param {number} consumption - Consumo mensual promedio
 * @param {number} leadTimeDays - Lead time en dias
 * @param {number} uncertaintyBuffer - Factor de incertidumbre (0-1)
 * @returns {number} Stock de seguridad calculado
 */
const calculateSafetyStock = (consumption, leadTimeDays, uncertaintyBuffer) => {
  const sigmaEstimada = consumption * uncertaintyBuffer;
  const safetyStock = Z_FACTOR * Math.sqrt(leadTimeDays / 30) * sigmaEstimada;
  return safetyStock;
};

/**
 * Genera array de 12 meses de predicciones planas
 * @param {number} avgMonthlyConsumption - Consumo mensual promedio
 * @param {number} leadTimeDays - Lead time en dias
 * @param {number} uncertaintyBuffer - Factor de incertidumbre
 * @returns {Array} Array de 12 predicciones
 */
const generatePredictions = (avgMonthlyConsumption, leadTimeDays, uncertaintyBuffer) => {
  const today = new Date();
  const predictions = [];

  const safetyStock = calculateSafetyStock(
    avgMonthlyConsumption,
    leadTimeDays,
    uncertaintyBuffer
  );

  for (let i = 1; i <= 12; i++) {
    const fecha = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const prediccion = avgMonthlyConsumption; // Prediccion plana

    predictions.push({
      fecha: fecha.toISOString().split('T')[0],
      prediccion: prediccion,
      cantidad_predicha: prediccion,
      limiteInferior: Math.max(0, prediccion - safetyStock),
      limiteSuperior: prediccion + safetyStock,
      limite_inferior: Math.max(0, prediccion - safetyStock),
      limite_superior: prediccion + safetyStock,
    });
  }

  return predictions;
};

const ForecastPlaceholder = ({
  historicalData = [],
  onGenerateForecast,
  materialCodigo = '',
  disabled = false,
}) => {
  const { t } = useI18n();

  // Solo renderizar si hay menos de 3 registros
  if (historicalData && historicalData.length >= 3) {
    return null;
  }

  // Estado del formulario
  const [avgMonthlyConsumption, setAvgMonthlyConsumption] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [uncertaintyBuffer, setUncertaintyBuffer] = useState('0.3');

  // Errores de validacion
  const [errors, setErrors] = useState({});

  // Validacion de inputs
  const validateInputs = useCallback(() => {
    const newErrors = {};

    if (!avgMonthlyConsumption || parseFloat(avgMonthlyConsumption) <= 0) {
      newErrors.avgMonthlyConsumption = t(
        'forecast_placeholder_error_consumption',
        'Ingresa un consumo promedio valido mayor a 0'
      );
    }

    if (!leadTime || parseInt(leadTime) <= 0) {
      newErrors.leadTime = t(
        'forecast_placeholder_error_leadtime',
        'Ingresa un lead time valido mayor a 0 dias'
      );
    }

    const buffer = parseFloat(uncertaintyBuffer);
    if (isNaN(buffer) || buffer < 0 || buffer > 1) {
      newErrors.uncertaintyBuffer = t(
        'forecast_placeholder_error_buffer',
        'El factor de incertidumbre debe estar entre 0 y 1'
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [avgMonthlyConsumption, leadTime, uncertaintyBuffer, t]);

  // Handler de submit
  const handleSubmit = useCallback(() => {
    if (!validateInputs()) return;

    const consumption = parseFloat(avgMonthlyConsumption);
    const lt = parseInt(leadTime);
    const buffer = parseFloat(uncertaintyBuffer);

    const predictions = generatePredictions(consumption, lt, buffer);

    // Calcular safety stock para incluir en metadata
    const safetyStock = calculateSafetyStock(consumption, lt, buffer);

    onGenerateForecast(predictions, {
      safetyStock,
      avgMonthlyConsumption: consumption,
      leadTime: lt,
      uncertaintyBuffer: buffer,
    });
  }, [avgMonthlyConsumption, leadTime, uncertaintyBuffer, validateInputs, onGenerateForecast]);

  // Handler para Enter key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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
      {/* Header con icono de advertencia */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              {t('forecast_placeholder_titulo', 'Datos Historicos Insuficientes')}
            </Typography>
            <Chip
              label={t('forecast_estimacion_manual', 'Estimacion Manual')}
              size="small"
              color="warning"
              variant="outlined"
              icon={<EditNoteIcon />}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(
              'forecast_placeholder_descripcion',
              'Este material tiene menos de 3 registros historicos. Ingresa parametros estimados para generar una proyeccion manual.'
            )}
          </Typography>
          {materialCodigo && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block' }}
            >
              Material: <strong>{materialCodigo}</strong>
            </Typography>
          )}
        </Box>
      </Box>

      {/* Formulario de inputs - 3 columnas */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
          mb: 4,
        }}
      >
        {/* AvgMonthlyConsumption */}
        <Tooltip
          title={t(
            'forecast_placeholder_consumption_tooltip',
            'Consumo promedio mensual estimado para este material. Base para la prediccion plana de 12 meses.'
          )}
          placement="top"
          arrow
        >
          <TextField
            label={t('forecast_placeholder_consumption', 'Consumo Mensual Promedio')}
            type="number"
            value={avgMonthlyConsumption}
            onChange={(e) => setAvgMonthlyConsumption(e.target.value)}
            onKeyDown={handleKeyDown}
            error={Boolean(errors.avgMonthlyConsumption)}
            helperText={errors.avgMonthlyConsumption}
            disabled={disabled}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption" color="text.secondary">
                    unid/mes
                  </Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Tooltip>

        {/* LeadTime */}
        <Tooltip
          title={t(
            'forecast_placeholder_leadtime_tooltip',
            'Tiempo promedio de entrega del proveedor en dias. Se usa para calcular el stock de seguridad con la formula SS = 1.65 x sqrt(LT/30) x sigma.'
          )}
          placement="top"
          arrow
        >
          <TextField
            label={t('forecast_placeholder_leadtime', 'Lead Time')}
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
                  <Typography variant="caption" color="text.secondary">
                    {t('common_dias', 'dias')}
                  </Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ min: 1, step: 1 }}
          />
        </Tooltip>

        {/* UncertaintyBuffer */}
        <Tooltip
          title={t(
            'forecast_placeholder_buffer_tooltip',
            'Factor de incertidumbre (0-1). Representa la desviacion estandar estimada como fraccion del consumo. Ejemplo: 0.3 = 30% de variabilidad esperada.'
          )}
          placement="top"
          arrow
        >
          <TextField
            label={t('forecast_placeholder_buffer', 'Factor de Incertidumbre')}
            type="number"
            value={uncertaintyBuffer}
            onChange={(e) => setUncertaintyBuffer(e.target.value)}
            onKeyDown={handleKeyDown}
            error={Boolean(errors.uncertaintyBuffer)}
            helperText={errors.uncertaintyBuffer}
            disabled={disabled}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption" color="text.secondary">
                    (0-1)
                  </Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ min: 0, max: 1, step: 0.05 }}
          />
        </Tooltip>
      </Box>

      {/* Caja informativa con formula */}
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
        <Box>
          <Typography variant="caption" color="text.secondary" component="div">
            {t(
              'forecast_placeholder_formula_info',
              'La prediccion genera 12 meses con valores planos. Los limites de confianza (95%) se calculan usando:'
            )}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: 'monospace', mt: 0.5, display: 'block', fontWeight: 500 }}
          >
            SS = 1.65 × √(LeadTime/30) × (Consumo × Factor)
          </Typography>
        </Box>
      </Box>

      {/* Boton de submit */}
      <Button
        variant="contained"
        color="warning"
        onClick={handleSubmit}
        disabled={disabled || !avgMonthlyConsumption || !leadTime}
        startIcon={<CalculateIcon />}
        sx={{
          bgcolor: 'warning.main',
          '&:hover': { bgcolor: 'warning.dark' },
        }}
      >
        {t('forecast_placeholder_btn', 'Generar Estimacion Manual')}
      </Button>
    </Paper>
  );
};

export default ForecastPlaceholder;
