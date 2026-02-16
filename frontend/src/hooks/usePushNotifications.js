/**
 * Hook para Push Notifications
 * ============================
 * Maneja el registro del Service Worker, permisos y suscripción push.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

// FIX 3.5: Flag para debug - desactivar en producción
const DEBUG_PUSH = false;

// Estados posibles de permisos
const PERMISSION_STATES = {
  DEFAULT: 'default',      // No se ha pedido permiso
  GRANTED: 'granted',      // Permiso concedido
  DENIED: 'denied',        // Permiso denegado
  UNSUPPORTED: 'unsupported' // Navegador no soporta push
};

/**
 * Verifica si el navegador soporta Push Notifications
 */
const isPushSupported = () => {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

/**
 * Convierte una clave VAPID de base64url a Uint8Array
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Hook principal para Push Notifications
 */
export const usePushNotifications = () => {
  const [permission, setPermission] = useState(PERMISSION_STATES.DEFAULT);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [swRegistration, setSwRegistration] = useState(null);

  const vapidKeyRef = useRef(null);
  const subscriptionRef = useRef(null);

  /**
   * Inicializa el estado de permisos y Service Worker
   */
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setError(null);

      // Verificar soporte
      if (!isPushSupported()) {
        setPermission(PERMISSION_STATES.UNSUPPORTED);
        setIsLoading(false);
        return;
      }

      // Obtener estado actual de permisos
      setPermission(Notification.permission);

      try {
        // Registrar Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        DEBUG_PUSH && console.log('[Push] Service Worker registrado:', registration.scope);
        setSwRegistration(registration);

        // Esperar a que el SW esté activo
        if (registration.installing) {
          await new Promise((resolve) => {
            registration.installing.addEventListener('statechange', (e) => {
              if (e.target.state === 'activated') resolve();
            });
          });
        }

        // Verificar suscripción existente
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          DEBUG_PUSH && console.log('[Push] Suscripción existente encontrada');
          subscriptionRef.current = subscription;
          setIsSubscribed(true);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  /**
   * Obtiene la clave VAPID del servidor
   */
  const getVapidKey = useCallback(async () => {
    if (vapidKeyRef.current) {
      return vapidKeyRef.current;
    }

    try {
      const response = await api.get('/push/vapid-key');
      if (response.data?.ok && response.data?.publicKey) {
        vapidKeyRef.current = response.data.publicKey;
        return vapidKeyRef.current;
      }
      throw new Error('No se pudo obtener la clave VAPID');
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Solicita permiso de notificaciones
   */
  const requestPermission = useCallback(async () => {
    if (!isPushSupported()) {
      return PERMISSION_STATES.UNSUPPORTED;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (err) {
      setError(err.message);
      return PERMISSION_STATES.DENIED;
    }
  }, []);

  /**
   * Suscribe al usuario a push notifications
   */
  const subscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Verificar soporte
      if (!isPushSupported()) {
        throw new Error('Push notifications no soportadas');
      }

      // Verificar/solicitar permiso
      let currentPermission = Notification.permission;
      if (currentPermission === PERMISSION_STATES.DEFAULT) {
        currentPermission = await requestPermission();
      }

      if (currentPermission !== PERMISSION_STATES.GRANTED) {
        throw new Error('Permiso de notificaciones denegado');
      }

      // Verificar Service Worker
      if (!swRegistration) {
        throw new Error('Service Worker no registrado');
      }

      // Obtener clave VAPID
      const vapidKey = await getVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Crear suscripción push
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      DEBUG_PUSH && console.log('[Push] Suscripción creada:', subscription.endpoint);
      subscriptionRef.current = subscription;

      // Enviar suscripción al servidor
      const subscriptionData = subscription.toJSON();
      const response = await api.post('/push/subscribe', {
        endpoint: subscriptionData.endpoint,
        keys: {
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth
        }
      });

      if (!response.data?.ok) {
        throw new Error(response.data?.error || 'Error registrando suscripción');
      }

      setIsSubscribed(true);
      DEBUG_PUSH && console.log('[Push] Suscripción registrada en servidor');
      return true;

    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration, requestPermission, getVapidKey]);

  /**
   * Cancela la suscripción push
   */
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (subscriptionRef.current) {
        // Cancelar suscripción en el navegador
        await subscriptionRef.current.unsubscribe();

        // Notificar al servidor
        await api.post('/push/unsubscribe', {
          endpoint: subscriptionRef.current.endpoint
        });

        subscriptionRef.current = null;
        setIsSubscribed(false);
        DEBUG_PUSH && console.log('[Push] Suscripción cancelada');
        return true;
      }
      return false;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Envía una notificación de prueba
   */
  const sendTestNotification = useCallback(async () => {
    try {
      const response = await api.post('/push/test', {
        title: 'Notificación de prueba',
        body: 'Si ves esto, las push notifications funcionan correctamente!'
      });
      return response.data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  /**
   * Verifica el estado de suscripción en el servidor
   */
  const checkServerStatus = useCallback(async () => {
    try {
      const response = await api.get('/push/status');
      return response.data;
    } catch (err) {
      return null;
    }
  }, []);

  return {
    // Estados
    permission,
    isSubscribed,
    isLoading,
    error,
    isSupported: isPushSupported(),

    // Acciones
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    checkServerStatus,

    // Helpers
    canSubscribe: isPushSupported() && permission !== PERMISSION_STATES.DENIED,
    needsPermission: permission === PERMISSION_STATES.DEFAULT,
    isDenied: permission === PERMISSION_STATES.DENIED,
    isGranted: permission === PERMISSION_STATES.GRANTED
  };
};

export default usePushNotifications;
