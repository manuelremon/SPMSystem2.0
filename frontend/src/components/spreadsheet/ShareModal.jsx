/**
 * ShareModal - Modal para configurar comparticion de dashboard
 */

import { useState } from 'react';
import { useI18n } from '../../context/i18n';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import * as Icons from '../ui/Icons';

const CopyIcon = Icons.Copy || (() => <span>📋</span>);
const CheckIcon = Icons.Check || (() => <span>✓</span>);
const TrashIcon = Icons.Trash2 || (() => <span>🗑️</span>);
const LinkIcon = Icons.Link || (() => <span>🔗</span>);

export default function ShareModal({
  isOpen,
  onClose,
  dashboardUuid,
  existingShares = [],
  onCreateShare,
  onRevokeShare,
}) {
  const { t } = useI18n();
  const [permiso, setPermiso] = useState('view');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [maxAccesos, setMaxAccesos] = useState('');
  const [expiraEn, setExpiraEn] = useState('');
  const [nota, setNota] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreateShare({
        permiso,
        password: usePassword ? password : null,
        max_accesos: maxAccesos ? parseInt(maxAccesos) : null,
        expira_en: expiraEn || null,
        nota: nota || null,
      });
      // Reset form
      setPermiso('view');
      setPassword('');
      setUsePassword(false);
      setMaxAccesos('');
      setExpiraEn('');
      setNota('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (token) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const permisoOptions = [
    { value: 'view', label: t('dashboard_share_view', 'Solo lectura') },
    { value: 'edit', label: t('dashboard_share_edit', 'Puede editar') },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard_share_title', 'Compartir Dashboard')}
      size="lg"
    >
      <div className="space-y-6">
        {/* Crear nuevo link */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            {t('dashboard_share_new_link', 'Crear nuevo link')}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('dashboard_share_permission', 'Permiso')}
              </label>
              <Select
                value={permiso}
                onChange={(e) => setPermiso(e.target.value)}
                options={permisoOptions}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('dashboard_share_max_access', 'Accesos maximos')}
              </label>
              <Input
                type="number"
                value={maxAccesos}
                onChange={(e) => setMaxAccesos(e.target.value)}
                placeholder={t('dashboard_share_unlimited', 'Ilimitado')}
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('dashboard_share_expires', 'Expira en')}
              </label>
              <Input
                type="datetime-local"
                value={expiraEn}
                onChange={(e) => setExpiraEn(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {t('dashboard_share_note', 'Nota (opcional)')}
              </label>
              <Input
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder={t('dashboard_share_note_placeholder', 'Ej: Para equipo de ventas')}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t('dashboard_share_require_password', 'Requerir password')}
            </label>
            {usePassword && (
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('dashboard_share_password', 'Password')}
                className="mt-2"
                autoComplete="new-password"
              />
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={isCreating}
            className="mt-4 w-full"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            {isCreating
              ? t('common_creating', 'Creando...')
              : t('dashboard_share_create_link', 'Crear link')}
          </Button>
        </div>

        {/* Links existentes */}
        {existingShares.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {t('dashboard_share_existing', 'Links existentes')} ({existingShares.length})
            </h3>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {existingShares.map((share) => (
                <div
                  key={share.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    share.es_valido ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded truncate max-w-[200px]">
                        {share.token}
                      </code>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          share.permiso === 'edit'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {share.permiso === 'edit' ? t('common_edit', 'Editar') : t('common_view', 'Ver')}
                      </span>
                      {share.tiene_password && (
                        <span className="text-xs text-gray-500">🔒</span>
                      )}
                      {!share.es_valido && (
                        <span className="text-xs text-red-600">
                          {share.esta_expirado
                            ? t('dashboard_share_expired', 'Expirado')
                            : t('dashboard_share_revoked', 'Revocado')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {share.accesos_actuales || 0}
                      {share.max_accesos ? `/${share.max_accesos}` : ''} {t('common_accesses', 'accesos')}
                      {share.nota && <span className="ml-2">• {share.nota}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleCopyLink(share.token)}
                      className="p-2 rounded hover:bg-gray-100"
                      title={t('common_copy_link', 'Copiar link')}
                    >
                      {copiedToken === share.token ? (
                        <CheckIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <CopyIcon className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    {share.es_valido && (
                      <button
                        onClick={() => onRevokeShare(share.id)}
                        className="p-2 rounded hover:bg-red-50"
                        title={t('dashboard_share_revoke', 'Revocar link')}
                      >
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
