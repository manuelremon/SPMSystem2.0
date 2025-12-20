/**
 * Push Notification Toggle Component
 * ===================================
 * Componente para habilitar/deshabilitar push notifications.
 * Incluye manejo de permisos y feedback visual.
 */

import { useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, AlertCircle, CheckCircle } from './Icons';
import usePushNotifications from '../../hooks/usePushNotifications';
import { useI18n } from '../../context/i18n';

/**
 * Toggle compacto para usar en headers o sidebars
 */
export const PushNotificationToggle = ({ className = '' }) => {
  const { t } = useI18n();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    needsPermission,
    isDenied
  } = usePushNotifications();

  const [showTooltip, setShowTooltip] = useState(false);

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // No soportado
  if (!isSupported) {
    return null;
  }

  // Permiso denegado permanentemente
  if (isDenied) {
    return (
      <div
        className={`relative inline-flex items-center ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          disabled
          className="p-2 text-[var(--fg-muted)] opacity-50 cursor-not-allowed"
          title={t('push_denied', 'Notificaciones bloqueadas en tu navegador')}
        >
          <BellOff className="w-5 h-5" />
        </button>
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-[var(--fg-strong)] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
            {t('push_denied_hint', 'Habilita notificaciones en la configuracion del navegador')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`
          p-2 rounded-lg transition-all
          ${isSubscribed
            ? 'text-[var(--success)] bg-[var(--success)]/10 hover:bg-[var(--success)]/20'
            : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]'
          }
          ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        `}
        title={isSubscribed
          ? t('push_disable', 'Desactivar notificaciones')
          : t('push_enable', 'Activar notificaciones')
        }
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isSubscribed ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
      </button>

      {showTooltip && !isLoading && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-[var(--fg-strong)] text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
          {isSubscribed
            ? t('push_active', 'Notificaciones activas')
            : needsPermission
              ? t('push_request', 'Habilitar notificaciones push')
              : t('push_inactive', 'Notificaciones desactivadas')
          }
        </div>
      )}
    </div>
  );
};

/**
 * Banner para solicitar permisos (para usar en Mi Cuenta o Settings)
 */
export const PushNotificationBanner = ({ onClose }) => {
  const { t } = useI18n();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    needsPermission,
    isDenied
  } = usePushNotifications();

  const [testSent, setTestSent] = useState(false);

  if (!isSupported) {
    return (
      <div className="p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[var(--fg-strong)]">
              {t('push_not_supported_title', 'Navegador no compatible')}
            </p>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              {t('push_not_supported', 'Tu navegador no soporta notificaciones push. Prueba con Chrome, Firefox, Edge o Safari.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg">
        <div className="flex items-start gap-3">
          <BellOff className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[var(--fg-strong)]">
              {t('push_blocked_title', 'Notificaciones bloqueadas')}
            </p>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              {t('push_blocked', 'Has bloqueado las notificaciones. Para habilitarlas, accede a la configuracion de tu navegador.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      // Enviar notificacion de bienvenida
      setTimeout(() => {
        sendTestNotification();
      }, 1000);
    }
  };

  const handleTest = async () => {
    await sendTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className={`p-4 rounded-lg border ${
      isSubscribed
        ? 'bg-[var(--success)]/5 border-[var(--success)]/20'
        : 'bg-[var(--bg-soft)] border-[var(--border)]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {isSubscribed ? (
            <CheckCircle className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
          ) : (
            <Bell className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-medium text-[var(--fg-strong)]">
              {isSubscribed
                ? t('push_enabled_title', 'Notificaciones activas')
                : t('push_disabled_title', 'Notificaciones push')
              }
            </p>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              {isSubscribed
                ? t('push_enabled_desc', 'Recibiras notificaciones aunque la app este cerrada.')
                : t('push_disabled_desc', 'Recibe notificaciones de solicitudes, aprobaciones y mensajes importantes.')
              }
            </p>
            {error && (
              <p className="text-sm text-[var(--danger)] mt-2">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isSubscribed && (
            <button
              onClick={handleTest}
              disabled={isLoading || testSent}
              className="px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)] rounded transition-colors disabled:opacity-50"
            >
              {testSent ? t('push_test_sent', 'Enviado!') : t('push_test', 'Probar')}
            </button>
          )}

          <button
            onClick={isSubscribed ? unsubscribe : handleSubscribe}
            disabled={isLoading}
            className={`
              px-4 py-1.5 text-sm font-medium rounded transition-colors
              ${isSubscribed
                ? 'text-[var(--danger)] hover:bg-[var(--danger)]/10'
                : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]'
              }
              ${isLoading ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSubscribed ? (
              t('push_deactivate', 'Desactivar')
            ) : (
              t('push_activate', 'Activar')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationToggle;
