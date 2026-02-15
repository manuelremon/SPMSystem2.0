/**
 * CertExpiryBadge - Color-coded badge showing days until certification expiry
 *
 * Renders a small filled Chip that changes color based on remaining days:
 *   Green (>90 days), Yellow (30-90), Red (<30), Black/error (expired).
 * Sprint 61
 */

import Chip from '@mui/material/Chip';

function getDaysRemaining(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const now = new Date();
  const expiry = new Date(fechaVencimiento);
  if (isNaN(expiry.getTime())) return null;
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function CertExpiryBadge({ fecha_vencimiento }) {
  const days = getDaysRemaining(fecha_vencimiento);

  if (days === null) {
    return <Chip label="N/D" size="small" variant="filled" />;
  }

  if (days < 0) {
    return (
      <Chip
        label="Vencida"
        size="small"
        variant="filled"
        color="error"
        sx={{ fontWeight: 600 }}
      />
    );
  }

  if (days < 30) {
    return (
      <Chip
        label={`${days} dias`}
        size="small"
        variant="filled"
        color="error"
        sx={{ fontWeight: 600 }}
      />
    );
  }

  if (days <= 90) {
    return (
      <Chip
        label={`${days} dias`}
        size="small"
        variant="filled"
        color="warning"
        sx={{ fontWeight: 600 }}
      />
    );
  }

  return (
    <Chip
      label={`${days} dias`}
      size="small"
      variant="filled"
      color="success"
      sx={{ fontWeight: 600 }}
    />
  );
}
