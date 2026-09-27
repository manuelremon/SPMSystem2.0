/**
 * Dashboards - Lista de dashboards del usuario
 *
 * Vista principal para gestionar dashboards editables tipo spreadsheet.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../context/i18n';
import { formatDate } from '../utils/formatters';

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';

// MUI Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import TableChartIcon from '@mui/icons-material/TableChart';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import FolderIcon from '@mui/icons-material/Folder';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';

// Components
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function Dashboards() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    dashboards,
    grupos,
    isLoading,
    error,
    fetchDashboards,
    fetchGrupos,
    createDashboard,
    deleteDashboard,
    toggleFavorite,
    clearError,
  } = useDashboardStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [activeTab, setActiveTab] = useState(0); // 0: Mis dashboards, 1: Compartidos
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedDashboard, setSelectedDashboard] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    fetchDashboards();
    fetchGrupos();
  }, [fetchDashboards, fetchGrupos]);

  // Filtrar dashboards
  const filteredDashboards = dashboards.filter((d) => {
    const matchSearch =
      !searchTerm ||
      d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchGrupo = !selectedGrupo || d.grupo_id === selectedGrupo;

    const matchTab =
      activeTab === 0 ? d.owner_id === user?.id_spm : d.owner_id !== user?.id_spm;

    return matchSearch && matchGrupo && matchTab;
  });

  // Separar favoritos
  const favoritos = filteredDashboards.filter((d) => d.es_favorito);
  const otros = filteredDashboards.filter((d) => !d.es_favorito);

  // Handlers
  const handleCreate = async () => {
    if (!newDashboardName.trim()) return;

    try {
      const response = await createDashboard({
        nombre: newDashboardName,
        grupo_id: selectedGrupo,
      });
      if (response?.ok && response.dashboard) {
        navigate(`/dashboards/${response.dashboard.uuid}`);
      }
    } catch {
      // El store expone el error en `error`
    }
    setIsCreateOpen(false);
    setNewDashboardName('');
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDashboard(deleteConfirm);
    } catch {
      // El store expone el error en `error`
    }
    setDeleteConfirm(null);
  };

  const handleMenuClick = (event, dashboard) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedDashboard(dashboard);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedDashboard(null);
  };

  // Render dashboard card
  const renderDashboardCard = (dashboard) => {
    const isOwner = dashboard.owner_id === user?.id_spm;

    return (
      <Grid
        key={dashboard.uuid}
        size={{
          xs: 12,
          sm: 6,
          md: 4,
          lg: 3
        }}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 3,
            },
          }}
          onClick={() => navigate(`/dashboards/${dashboard.uuid}`)}
        >
          {/* Preview/Thumbnail */}
          <Box
            sx={{
              height: 120,
              bgcolor: dashboard.color || 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <TableChartIcon sx={{ fontSize: 48, color: 'white', opacity: 0.8 }} />

            {/* Badges */}
            <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.5 }}>
              {dashboard.es_publico && (
                <Chip
                  icon={<PublicIcon sx={{ fontSize: 14 }} />}
                  label={t('dashboard_public', 'Público')}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.9)', height: 20, fontSize: 11 }}
                />
              )}
            </Box>

            {/* Favorite */}
            <IconButton
              aria-label={t('dashboards_favorito', 'Marcar como favorito')}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                color: dashboard.es_favorito ? 'var(--warning-light)' : 'rgba(255,255,255,0.7)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(dashboard.uuid);
              }}
            >
              {dashboard.es_favorito ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Box>

          <CardContent sx={{ flexGrow: 1, pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {dashboard.nombre}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {dashboard.descripcion || t('dashboard_no_description', 'Sin descripción')}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              {dashboard.grupo && (
                <Chip
                  icon={<FolderIcon sx={{ fontSize: 14 }} />}
                  label={dashboard.grupo.nombre}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
            </Box>
          </CardContent>

          <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              {formatDate(dashboard.updated_at)}
            </Typography>
            <IconButton
              size="small"
              aria-label={t('common_acciones', 'Acciones')}
              onClick={(e) => handleMenuClick(e, dashboard)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </CardActions>
        </Card>
      </Grid>
    );
  };

  return (
    <PageLayout
      title={t('dashboards_title', 'Dashboards')}
      subtitle={t('dashboards_subtitle', 'Crea y gestiona hojas de cálculo interactivas')}
      actions={
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setIsCreateOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          {t('dashboards_btn_nuevo', 'Nuevo dashboard')}
        </Button>
      }
    >
      {/* Error */}
      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder={t('common_search', 'Buscar...')}
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: { xs: '100%', sm: 250 } }}
          />

          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ flexGrow: 1, minHeight: 36, maxWidth: '100%', '& .MuiTab-root': { textTransform: 'none' } }}
          >
            <Tab
              label={t('dashboards_mine', 'Mis dashboards')}
              sx={{ minHeight: 36, py: 0 }}
            />
            <Tab
              label={t('dashboards_shared', 'Compartidos conmigo')}
              sx={{ minHeight: 36, py: 0 }}
            />
          </Tabs>
        </Box>
      </Paper>

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Favoritos */}
      {!isLoading && favoritos.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon sx={{ color: 'var(--warning-light)' }} />
            {t('dashboards_favorites', 'Favoritos')}
          </Typography>
          <Grid container spacing={2}>
            {favoritos.map(renderDashboardCard)}
          </Grid>
        </Box>
      )}

      {/* Otros */}
      {!isLoading && otros.length > 0 && (
        <Box>
          {favoritos.length > 0 && (
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {t('dashboards_all', 'Todos los dashboards')}
            </Typography>
          )}
          <Grid container spacing={2}>
            {otros.map(renderDashboardCard)}
          </Grid>
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && filteredDashboards.length === 0 && (
        <Paper variant="outlined">
          <EmptyState
            icon={<TableChartIcon sx={{ fontSize: 32, color: 'text.disabled' }} />}
            title={
              searchTerm
                ? t('dashboards_no_results', 'No se encontraron dashboards')
                : activeTab === 0
                ? t('dashboards_empty', 'No tienes dashboards aún')
                : t('dashboards_no_shared', 'No hay dashboards compartidos contigo')
            }
            action={!searchTerm && activeTab === 0 ? t('dashboard_create_first', 'Crear tu primer dashboard') : undefined}
            onAction={!searchTerm && activeTab === 0 ? () => setIsCreateOpen(true) : undefined}
          />
        </Paper>
      )}

      {/* Menu contextual */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            navigate(`/dashboards/${selectedDashboard?.uuid}`);
            handleMenuClose();
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          {t('common_edit', 'Editar')}
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ShareIcon fontSize="small" sx={{ mr: 1 }} />
          {t('common_share', 'Compartir')}
        </MenuItem>
        {selectedDashboard?.owner_id === user?.id_spm && (
          <MenuItem
            onClick={() => {
              setDeleteConfirm(selectedDashboard?.uuid);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t('common_delete', 'Eliminar')}
          </MenuItem>
        )}
      </Menu>

      {/* Dialog crear */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('dashboards_crear_titulo', 'Crear dashboard')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('dashboard_name', 'Nombre del dashboard')}
            value={newDashboardName}
            onChange={(e) => setNewDashboardName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateOpen(false)} sx={{ textTransform: 'none' }}>{t('common_cancel', 'Cancelar')}</Button>
          <Button
            variant="contained"
            sx={{ textTransform: 'none' }}
            onClick={handleCreate}
            disabled={!newDashboardName.trim()}
          >
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm delete */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={t('dashboards_eliminar_titulo', 'Eliminar dashboard')}
        message={t('dashboard_delete_confirm_message', 'Esta accion no se puede deshacer. ¿Estas seguro?')}
        confirmText={t('common_delete', 'Eliminar')}
        variant="danger"
      />
    </PageLayout>
  );
}
