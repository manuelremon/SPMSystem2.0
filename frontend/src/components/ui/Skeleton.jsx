/**
 * Skeleton Component - MUI Skeleton
 * Placeholders de carga profesionales con estilo MUI
 */

import React from "react";
import PropTypes from "prop-types";
import MuiSkeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

// Mapeo de variantes legacy a MUI
const variantMap = {
  text: 'text',
  circular: 'circular',
  rectangular: 'rectangular',
  rounded: 'rounded',
  card: 'rounded',
  avatar: 'circular',
  'avatar-sm': 'circular',
  'avatar-lg': 'circular',
  button: 'rounded',
  input: 'rounded',
  badge: 'rounded',
  icon: 'rounded',
};

// Tamaños por defecto para cada variante
const defaultSizes = {
  text: { width: '100%', height: 16 },
  circular: { width: 40, height: 40 },
  rectangular: { width: '100%', height: 100 },
  rounded: { width: '100%', height: 100 },
  card: { width: '100%', height: 200 },
  avatar: { width: 40, height: 40 },
  'avatar-sm': { width: 32, height: 32 },
  'avatar-lg': { width: 56, height: 56 },
  button: { width: 96, height: 40 },
  input: { width: '100%', height: 48 },
  badge: { width: 64, height: 24 },
  icon: { width: 20, height: 20 },
};

/**
 * Skeleton - Placeholder de carga con MUI Skeleton
 *
 * @param {string} variant - Tipo: 'text' | 'circular' | 'rectangular' | 'rounded' | 'card' | 'avatar' | etc.
 * @param {string|number} width - Ancho personalizado
 * @param {string|number} height - Alto personalizado
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {number} count - Número de skeletons a renderizar
 * @param {string} animation - Animación: 'pulse' | 'wave' | false
 * @param {object} sx - Estilos MUI adicionales
 */
export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  count = 1,
  animation = "wave",
  sx,
  ...props
}) {
  const muiVariant = variantMap[variant] || 'text';
  const defaults = defaultSizes[variant] || defaultSizes.text;

  const skeletonProps = {
    variant: muiVariant,
    width: width || defaults.width,
    height: height || defaults.height,
    animation,
    className,
    sx: {
      borderRadius: muiVariant === 'rounded' ? '8px' : undefined,
      ...sx,
    },
    ...props,
  };

  if (count === 1) {
    return <MuiSkeleton {...skeletonProps} />;
  }

  return (
    <Stack spacing={1}>
      {Array.from({ length: count }, (_, i) => (
        <MuiSkeleton key={i} {...skeletonProps} />
      ))}
    </Stack>
  );
}

/**
 * TableSkeleton - Skeleton pre-configurado para tablas
 */
export function TableSkeleton({ rows = 5, columns = 4, sx }) {
  return (
    <Box sx={{ p: 2, ...sx }} role="status" aria-label="Cargando tabla...">
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          pb: 1,
          borderBottom: 1,
          borderColor: 'divider',
          mb: 1,
        }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <MuiSkeleton
            key={i}
            variant="text"
            width={`${100 / columns}%`}
            height={12}
          />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{ display: 'flex', gap: 2, py: 1 }}
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <MuiSkeleton
              key={colIndex}
              variant="text"
              width={`${100 / columns}%`}
              height={16}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * CardSkeleton - Skeleton pre-configurado para cards
 */
export function CardSkeleton({ showImage = false, lines = 3, sx }) {
  return (
    <Box
      sx={{
        p: 3,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        ...sx,
      }}
      role="status"
      aria-label="Cargando..."
    >
      {showImage && (
        <MuiSkeleton
          variant="rounded"
          width="100%"
          height={150}
          sx={{ mb: 2 }}
        />
      )}
      <MuiSkeleton variant="text" width="60%" height={24} sx={{ mb: 2 }} />
      <Stack spacing={1}>
        {Array.from({ length: lines }, (_, i) => (
          <MuiSkeleton
            key={i}
            variant="text"
            width={i === lines - 1 ? '80%' : '100%'}
            height={16}
          />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * StatCardSkeleton - Skeleton pre-configurado para stat cards
 */
export function StatCardSkeleton({ sx }) {
  return (
    <Box
      sx={{
        p: 3,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        ...sx,
      }}
      role="status"
      aria-label="Cargando..."
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack spacing={1}>
          <MuiSkeleton variant="text" width={80} height={12} />
          <MuiSkeleton variant="text" width={60} height={28} />
        </Stack>
        <MuiSkeleton variant="circular" width={48} height={48} />
      </Box>
    </Box>
  );
}

/**
 * FormSkeleton - Skeleton pre-configurado para formularios
 */
export function FormSkeleton({ fields = 4, sx }) {
  return (
    <Stack spacing={3} sx={sx} role="status" aria-label="Cargando formulario...">
      {Array.from({ length: fields }, (_, i) => (
        <Stack key={i} spacing={1}>
          <MuiSkeleton variant="text" width={100} height={14} />
          <MuiSkeleton variant="rounded" width="100%" height={44} />
        </Stack>
      ))}
      <Box sx={{ display: 'flex', gap: 1.5, pt: 2 }}>
        <MuiSkeleton variant="rounded" width={100} height={40} />
        <MuiSkeleton variant="rounded" width={80} height={40} />
      </Box>
    </Stack>
  );
}

// PropTypes
Skeleton.propTypes = {
  variant: PropTypes.oneOf([
    'text', 'circular', 'rectangular', 'rounded', 'card',
    'avatar', 'avatar-sm', 'avatar-lg', 'button', 'input', 'badge', 'icon'
  ]),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  count: PropTypes.number,
  animation: PropTypes.oneOf(['pulse', 'wave', false]),
  sx: PropTypes.object,
};

TableSkeleton.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
  sx: PropTypes.object,
};

CardSkeleton.propTypes = {
  showImage: PropTypes.bool,
  lines: PropTypes.number,
  sx: PropTypes.object,
};

StatCardSkeleton.propTypes = {
  sx: PropTypes.object,
};

FormSkeleton.propTypes = {
  fields: PropTypes.number,
  sx: PropTypes.object,
};

export default Skeleton;
