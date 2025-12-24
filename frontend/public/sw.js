/**
 * Service Worker for Push Notifications
 * =====================================
 * Maneja notificaciones push en background.
 */

const SW_VERSION = '1.1.0';
const APP_NAME = 'SPM 2.0';

// Mapeo tipo -> icono
const NOTIFICATION_ICONS = {
  'solicitud_created': '/images/notifications/icon-solicitud.svg',
  'solicitud_submitted': '/images/notifications/icon-solicitud.svg',
  'solicitud_approved': '/images/notifications/icon-aprobacion.svg',
  'solicitud_rejected': '/images/notifications/icon-rechazo.svg',
  'solicitud_planned': '/images/notifications/icon-planificacion.svg',
  'solicitud_dispatched': '/images/notifications/icon-despacho.svg',
  'mensaje_nuevo': '/images/notifications/icon-mensaje.svg',
  'budget_alert': '/images/notifications/icon-presupuesto.svg',
  'mrp_alert': '/images/notifications/icon-alerta.svg',
  'sla_alert': '/images/notifications/icon-alerta.svg',
  'info': '/images/notifications/icon-info.svg',
  'success': '/images/notifications/icon-aprobacion.svg',
  'warning': '/images/notifications/icon-alerta.svg',
  'error': '/images/notifications/icon-rechazo.svg',
  'test': '/images/notifications/icon-info.svg',
  'default': '/images/notifications/icon-info.svg'
};

// Mapeo tipo -> acciones contextuales
const NOTIFICATION_ACTIONS = {
  'solicitud_created': [
    { action: 'view', title: 'Ver solicitud' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'solicitud_submitted': [
    { action: 'review', title: 'Revisar' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'solicitud_approved': [
    { action: 'view', title: 'Ver detalles' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'solicitud_rejected': [
    { action: 'view', title: 'Ver motivo' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'solicitud_planned': [
    { action: 'view', title: 'Ver plan' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'solicitud_dispatched': [
    { action: 'view', title: 'Ver despacho' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'mensaje_nuevo': [
    { action: 'reply', title: 'Responder' },
    { action: 'dismiss', title: 'Cerrar' }
  ],
  'default': [
    { action: 'open', title: 'Ver' },
    { action: 'dismiss', title: 'Cerrar' }
  ]
};

// Log helper
const log = (msg, ...args) => {
  console.log(`[SW ${SW_VERSION}] ${msg}`, ...args);
};

// Sanitizar texto removiendo HTML tags
const stripHtml = (text) => {
  if (!text) return text;
  // Remover tags HTML y decodificar entidades basicas
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
};

// Evento: Service Worker instalado
self.addEventListener('install', (event) => {
  log('Service Worker instalado');
  // Activar inmediatamente sin esperar
  self.skipWaiting();
});

// Evento: Service Worker activado
self.addEventListener('activate', (event) => {
  log('Service Worker activado');
  // Tomar control de todas las paginas inmediatamente
  event.waitUntil(clients.claim());
});

// Evento: Notificacion push recibida
self.addEventListener('push', (event) => {
  log('Push recibido:', event);

  let data = {
    title: APP_NAME,
    body: 'Nueva notificacion',
    tipo: 'default',
    url: '/',
    tag: 'default',
    data: {}
  };

  // Parsear datos del push
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
      log('Payload:', payload);
    } catch (e) {
      log('Error parseando payload:', e);
      data.body = event.data.text();
    }
  }

  // Sanitizar body para evitar HTML
  const cleanBody = stripHtml(data.body) || 'Nueva notificación';

  // Seleccionar icono y acciones segun tipo
  const tipo = data.tipo || 'default';
  const icon = NOTIFICATION_ICONS[tipo] || NOTIFICATION_ICONS['default'];
  const badge = '/images/notifications/badge-spm.svg';
  const actions = NOTIFICATION_ACTIONS[tipo] || NOTIFICATION_ACTIONS['default'];

  log('Tipo:', tipo, 'Icon:', icon);

  // Opciones de la notificacion
  const options = {
    body: cleanBody,
    icon: icon,
    badge: badge,
    tag: data.tag,
    renotify: true, // Notificar aunque ya exista una con el mismo tag
    requireInteraction: true, // Mantener visible hasta que el usuario interactue o expire
    vibrate: [200, 100, 200], // Patron de vibracion
    timestamp: Date.now(),
    data: {
      url: data.url,
      tipo: tipo,
      ...data.data
    },
    actions: actions
  };

  // Mostrar la notificacion y cerrarla automaticamente despues de 5 segundos
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        log('Notificacion mostrada');
        // Auto-cerrar despues de 5 segundos
        setTimeout(async () => {
          const notifications = await self.registration.getNotifications({ tag: data.tag });
          notifications.forEach(notification => notification.close());
          log('Notificacion auto-cerrada despues de 5s');
        }, 5000);
      })
      .catch(err => log('Error mostrando notificacion:', err))
  );
});

// Evento: Click en notificacion
self.addEventListener('notificationclick', (event) => {
  log('Click en notificacion:', event.action, event.notification.tag);

  // Cerrar la notificacion
  event.notification.close();

  // Si el usuario hizo click en "dismiss", no hacer nada mas
  if (event.action === 'dismiss') {
    return;
  }

  // Obtener la URL a abrir
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  // Intentar enfocar una ventana existente o abrir una nueva
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Buscar si ya hay una ventana abierta de la app
        for (const client of windowClients) {
          // Si ya esta en la URL correcta, enfocar
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }

        // Si hay alguna ventana de la app, navegar a la URL
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'navigate' in client) {
            return client.navigate(fullUrl).then(() => client.focus());
          }
        }

        // Si no hay ventanas, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
      .catch(err => log('Error manejando click:', err))
  );
});

// Evento: Notificacion cerrada
self.addEventListener('notificationclose', (event) => {
  log('Notificacion cerrada:', event.notification.tag);
});

// Evento: Push subscription cambio
self.addEventListener('pushsubscriptionchange', (event) => {
  log('Suscripcion push cambio');
  // Esto ocurre cuando la suscripcion expira o es revocada
  // Podriamos intentar re-suscribir aqui, pero es mejor
  // manejarlo desde el frontend
});

// Evento: Mensaje desde el frontend
self.addEventListener('message', (event) => {
  log('Mensaje recibido:', event.data);

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: SW_VERSION });
  }
});

log('Service Worker cargado');
