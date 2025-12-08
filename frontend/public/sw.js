/**
 * Service Worker for Push Notifications
 * =====================================
 * Maneja notificaciones push en background.
 */

const SW_VERSION = '1.0.0';
const APP_NAME = 'SPM 2.0';

// Log helper
const log = (msg, ...args) => {
  console.log(`[SW ${SW_VERSION}] ${msg}`, ...args);
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
    icon: '/images/Logo definitivo SPM.png',
    badge: '/images/Logo definitivo SPM.png',
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

  // Opciones de la notificacion
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    renotify: true, // Notificar aunque ya exista una con el mismo tag
    requireInteraction: false, // No requiere interaccion del usuario
    vibrate: [200, 100, 200], // Patron de vibracion
    timestamp: Date.now(),
    data: {
      url: data.url,
      ...data.data
    },
    actions: [
      {
        action: 'open',
        title: 'Ver'
      },
      {
        action: 'dismiss',
        title: 'Cerrar'
      }
    ]
  };

  // Mostrar la notificacion
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => log('Notificacion mostrada'))
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
