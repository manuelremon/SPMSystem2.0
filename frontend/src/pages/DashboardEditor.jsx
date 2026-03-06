/**
 * DashboardEditor - Editor de dashboard con spreadsheet
 *
 * Pagina principal para editar un dashboard con Fortune Sheet.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../context/i18n';
import { dashboardService, shareService } from '../services/dashboard';

// MUI Components
import {
  Box,
  Alert,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

// Spreadsheet components
import {
  DashboardSpreadsheet,
  DashboardToolbar,
  ShareModal,
  DataSourcePanel,
} from '../components/spreadsheet';

import ConfirmModal from '../components/ui/ConfirmModal';

// Auto-save debounce (ms)
const AUTO_SAVE_DELAY = 3000;

export default function DashboardEditor() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();

  const {
    currentDashboard,
    isLoading,
    isSaving,
    hasChanges,
    error,
    fetchDashboard,
    updateDashboard,
    updateSheet,
    deleteDashboard,
    toggleFavorite,
    addSheet,
    addDatasource,
    removeDatasource,
    clearCurrentDashboard,
    setHasChanges,
    clearError,
  } = useDashboardStore();

  // Local state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shares, setShares] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [showDataSources, setShowDataSources] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Refs para auto-save
  const autoSaveTimer = useRef(null);
  const pendingData = useRef(null);

  // Permisos
  const isOwner = currentDashboard?.owner_id === user?.id_spm;
  const canEdit = isOwner || currentDashboard?.permiso === 'edit' || currentDashboard?.permiso === 'admin';

  // Cargar dashboard
  useEffect(() => {
    if (uuid) {
      fetchDashboard(uuid);
    }
    return () => {
      clearCurrentDashboard();
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [uuid, fetchDashboard, clearCurrentDashboard]);

  // Cargar shares cuando se abre el modal
  useEffect(() => {
    if (showShareModal && currentDashboard) {
      shareService.list(currentDashboard.uuid).then((res) => {
        setShares(res.shares || []);
      });
    }
  }, [showShareModal, currentDashboard]);

  // Handler de cambios en spreadsheet
  const handleSpreadsheetChange = useCallback(
    (data) => {
      if (!canEdit) return;

      setHasChanges(true);
      pendingData.current = data;

      // Auto-save con debounce
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }

      autoSaveTimer.current = setTimeout(() => {
        handleSave();
      }, AUTO_SAVE_DELAY);
    },
    [canEdit, setHasChanges]
  );

  // Guardar
  const handleSave = useCallback(async () => {
    if (!currentDashboard || !canEdit || !pendingData.current) return;

    try {
      // Guardar cada hoja
      const sheets = currentDashboard.sheets || [];
      for (let i = 0; i < sheets.length; i++) {
        const sheetData = pendingData.current[i];
        if (sheetData) {
          await updateSheet(sheets[i].id, sheetData);
        }
      }

      setSnackbar({
        open: true,
        message: t('dashboard_saved', 'Dashboard guardado'),
        severity: 'success',
      });
      pendingData.current = null;
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_save_error', 'Error al guardar'),
        severity: 'error',
      });
    }
  }, [currentDashboard, canEdit, updateSheet, t]);

  // Guardar manual (Ctrl+S o boton)
  const handleManualSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    handleSave();
  }, [handleSave]);

  // Compartir
  const handleCreateShare = async (options) => {
    try {
      const response = await shareService.create(currentDashboard.uuid, options);
      if (response.ok) {
        setShares([response.share, ...shares]);
        setSnackbar({
          open: true,
          message: t('dashboard_share_created', 'Link creado'),
          severity: 'success',
        });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_share_error', 'Error al crear link'),
        severity: 'error',
      });
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      await shareService.revoke(shareId);
      setShares(shares.filter((s) => s.id !== shareId));
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_share_revoke_error', 'Error al revocar'),
        severity: 'error',
      });
    }
  };

  // Exportar
  const handleExport = async () => {
    try {
      const blob = await dashboardService.exportExcel(currentDashboard.uuid);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDashboard.nombre}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_export_error', 'Error al exportar'),
        severity: 'error',
      });
    }
  };

  // Eliminar
  const handleDelete = async () => {
    try {
      await deleteDashboard(currentDashboard.uuid);
      navigate('/dashboards');
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_delete_error', 'Error al eliminar'),
        severity: 'error',
      });
    }
    setShowDeleteConfirm(false);
  };

  // Agregar hoja
  const handleAddSheet = async () => {
    if (!newSheetName.trim()) return;
    try {
      await addSheet(newSheetName);
      setShowAddSheet(false);
      setNewSheetName('');
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_add_sheet_error', 'Error al agregar hoja'),
        severity: 'error',
      });
    }
  };

  // Nombre del dashboard
  const handleNameChange = async (newName) => {
    try {
      await updateDashboard(currentDashboard.uuid, { nombre: newName });
    } catch (err) {
      setSnackbar({
        open: true,
        message: t('dashboard_update_error', 'Error al actualizar'),
        severity: 'error',
      });
    }
  };

  // Loading
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error o no encontrado
  if (error || !currentDashboard) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || t('dashboard_not_found', 'Dashboard no encontrado')}
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/dashboards')}>
          {t('common_back', 'Volver')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Toolbar */}
      <DashboardToolbar
        dashboardName={currentDashboard.nombre}
        isFavorite={currentDashboard.es_favorito}
        isSaving={isSaving}
        hasChanges={hasChanges}
        canEdit={canEdit}
        onSave={handleManualSave}
        onShare={() => setShowShareModal(true)}
        onExport={handleExport}
        onToggleFavorite={() => toggleFavorite(currentDashboard.uuid)}
        onSettings={() => setShowSettings(true)}
        onAddSheet={() => setShowAddSheet(true)}
        onDelete={isOwner ? () => setShowDeleteConfirm(true) : null}
        onNameChange={canEdit ? handleNameChange : null}
      />

      {/* Main content */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Spreadsheet */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <DashboardSpreadsheet
            sheets={currentDashboard.sheets}
            onSave={handleManualSave}
            onChange={handleSpreadsheetChange}
            readOnly={!canEdit}
            height="100%"
            showToolbar={canEdit}
            showFormulaBar={true}
            showSheetTabs={true}
          />
        </Box>

        {/* Data sources panel */}
        <DataSourcePanel
          datasources={currentDashboard.datasources || []}
          onAdd={(data) => addDatasource(data)}
          onRemove={(id) => removeDatasource(id)}
          isCollapsed={!showDataSources}
          onToggleCollapse={() => setShowDataSources(!showDataSources)}
        />
      </Box>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        dashboardUuid={currentDashboard.uuid}
        existingShares={shares}
        onCreateShare={handleCreateShare}
        onRevokeShare={handleRevokeShare}
      />

      {/* Add sheet dialog */}
      <Dialog open={showAddSheet} onClose={() => setShowAddSheet(false)}>
        <DialogTitle>{t('dashboard_add_sheet', 'Agregar hoja')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('dashboard_sheet_name', 'Nombre de la hoja')}
            value={newSheetName}
            onChange={(e) => setNewSheetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSheet()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddSheet(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleAddSheet} disabled={!newSheetName.trim()}>
            {t('common_add', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('dashboard_delete_confirm_title', 'Eliminar Dashboard')}
        message={t('dashboard_delete_confirm_message', 'Esta accion no se puede deshacer.')}
        confirmText={t('common_delete', 'Eliminar')}
        variant="danger"
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
