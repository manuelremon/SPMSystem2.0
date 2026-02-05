/**
 * DashboardToolbar - Barra de herramientas para el editor de dashboards
 *
 * Incluye: Guardar, Compartir, Exportar, Favorito, etc.
 */

import { useState } from 'react';
import { useI18n } from '../../context/i18n';
import Button from '../ui/Button';
import * as Icons from '../ui/Icons';

const SaveIcon = Icons.Save || (() => <span>💾</span>);
const ShareIcon = Icons.Share || (() => <span>🔗</span>);
const DownloadIcon = Icons.Download || (() => <span>📥</span>);
const StarIcon = Icons.Star || (() => <span>⭐</span>);
const StarFilledIcon = Icons.Star || (() => <span>★</span>);
const SettingsIcon = Icons.Settings || (() => <span>⚙️</span>);
const PlusIcon = Icons.Plus || (() => <span>+</span>);
const TrashIcon = Icons.Trash2 || (() => <span>🗑️</span>);

export default function DashboardToolbar({
  dashboardName = '',
  isFavorite = false,
  isSaving = false,
  hasChanges = false,
  canEdit = true,
  onSave,
  onShare,
  onExport,
  onToggleFavorite,
  onSettings,
  onAddSheet,
  onDelete,
  onNameChange,
}) {
  const { t } = useI18n();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(dashboardName);

  const handleNameSubmit = () => {
    if (editedName.trim() && editedName !== dashboardName) {
      onNameChange?.(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditedName(dashboardName);
      setIsEditingName(false);
    }
  };

  return (
    <div className="dashboard-toolbar flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      {/* Lado izquierdo: Nombre y favorito */}
      <div className="flex items-center gap-3">
        {isEditingName ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="text-lg font-semibold border-b-2 border-indigo-500 bg-transparent outline-none px-1"
            autoFocus
          />
        ) : (
          <h1
            className={`text-lg font-semibold ${canEdit ? 'cursor-pointer hover:text-indigo-600' : ''}`}
            onClick={() => canEdit && setIsEditingName(true)}
            title={canEdit ? t('dashboard_click_to_edit_name', 'Clic para editar nombre') : ''}
          >
            {dashboardName || t('dashboard_untitled', 'Sin titulo')}
          </h1>
        )}

        {onToggleFavorite && (
          <button
            onClick={onToggleFavorite}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title={isFavorite ? t('dashboard_remove_favorite', 'Quitar de favoritos') : t('dashboard_add_favorite', 'Agregar a favoritos')}
          >
            {isFavorite ? (
              <StarFilledIcon className="w-5 h-5 text-yellow-500" />
            ) : (
              <StarIcon className="w-5 h-5 text-gray-400 hover:text-yellow-500" />
            )}
          </button>
        )}

        {hasChanges && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {t('dashboard_unsaved_changes', 'Sin guardar')}
          </span>
        )}
      </div>

      {/* Lado derecho: Acciones */}
      <div className="flex items-center gap-2">
        {canEdit && onAddSheet && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddSheet}
            title={t('dashboard_add_sheet', 'Agregar hoja')}
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            {t('dashboard_sheet', 'Hoja')}
          </Button>
        )}

        {canEdit && onSave && (
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !hasChanges}
            title={t('dashboard_save', 'Guardar (Ctrl+S)')}
          >
            <SaveIcon className="w-4 h-4 mr-1" />
            {isSaving ? t('common_saving', 'Guardando...') : t('common_save', 'Guardar')}
          </Button>
        )}

        {onShare && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            title={t('dashboard_share', 'Compartir')}
          >
            <ShareIcon className="w-4 h-4 mr-1" />
            {t('common_share', 'Compartir')}
          </Button>
        )}

        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            title={t('dashboard_export_excel', 'Exportar a Excel')}
          >
            <DownloadIcon className="w-4 h-4 mr-1" />
            Excel
          </Button>
        )}

        {onSettings && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettings}
            title={t('dashboard_settings', 'Configuracion')}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        )}

        {canEdit && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            title={t('dashboard_delete', 'Eliminar dashboard')}
          >
            <TrashIcon className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
