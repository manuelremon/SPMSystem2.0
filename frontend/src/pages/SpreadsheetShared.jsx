/**
 * DashboardShared - Vista publica de dashboard compartido
 *
 * Acceso sin autenticacion via token de comparticion.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { shareService } from '../services/dashboard';
import { useI18n } from '../context/i18n';

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';

import LockIcon from '@mui/icons-material/Lock';
import TableChartIcon from '@mui/icons-material/TableChart';

// Spreadsheet component
import { DashboardSpreadsheet } from '../components/spreadsheet';

export default function DashboardShared() {
  const { token } = useParams();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [permiso, setPermiso] = useState('view');

  // Cargar dashboard
  const loadDashboard = async (pwd = null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await shareService.access(token, pwd);

      if (response.error === 'PASSWORD_REQUIRED') {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      if (response.error) {
        setError(response.message || t('dashboard_share_invalid', 'Link invalido o expirado'));
        setLoading(false);
        return;
      }

      setDashboard(response.dashboard);
      setPermiso(response.permiso);
      setNeedsPassword(false);
    } catch (err) {
      if (err.response?.status === 401) {
        setNeedsPassword(true);
      } else {
        setError(
          err.response?.data?.message ||
          err.message ||
          t('dashboard_share_error', 'Error al cargar el dashboard')
        );
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token]);

  // Submit password
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password.trim()) {
      loadDashboard(password);
    }
  };

  // Loading
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'grey.100',
        }}
      >
        <CircularProgress size={48} />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          {t('common_loading', 'Cargando...')}
        </Typography>
      </Box>
    );
  }

  // Password required
  if (needsPassword) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'grey.100',
        }}
      >
        <Paper
          component="form"
          onSubmit={handlePasswordSubmit}
          sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}
        >
          <LockIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 1 }}>
            {t('dashboard_share_protected', 'Dashboard protegido')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {t('dashboard_share_enter_password', 'Ingresa la password para acceder')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            type="password"
            label={t('common_password', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="off"
            sx={{ mb: 2 }}
          />

          <Button
            fullWidth
            variant="contained"
            type="submit"
            disabled={!password.trim()}
          >
            {t('common_access', 'Acceder')}
          </Button>
        </Paper>
      </Box>
    );
  }

  // Error
  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'grey.100',
        }}
      >
        <Paper sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography color="text.secondary">
            {t('dashboard_share_expired_hint', 'El link puede haber expirado o sido revocado.')}
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Dashboard view
  if (!dashboard) {
    return null;
  }

  const canEdit = permiso === 'edit' || permiso === 'admin';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <TableChartIcon sx={{ color: dashboard.color || 'primary.main' }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6">{dashboard.nombre}</Typography>
          {dashboard.descripcion && (
            <Typography variant="body2" color="text.secondary">
              {dashboard.descripcion}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {canEdit
            ? t('dashboard_share_can_edit', 'Puedes editar')
            : t('dashboard_share_view_only', 'Solo lectura')}
        </Typography>
      </Paper>

      {/* Spreadsheet */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <DashboardSpreadsheet
          sheets={dashboard.sheets}
          readOnly={!canEdit}
          height="100%"
          showToolbar={canEdit}
          showFormulaBar={true}
          showSheetTabs={true}
        />
      </Box>

      {/* Footer */}
      <Paper
        elevation={0}
        sx={{
          px: 3,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t('dashboard_share_powered_by', 'Powered by')} SPM v3.0
        </Typography>
      </Paper>
    </Box>
  );
}
