// Auto-recuperacion de chunks obsoletos tras un deploy.
//
// Cuando se despliega un build nuevo, los chunks lazy cambian de hash. Un navegador
// con un Service Worker viejo (o el index.html cacheado) puede quedar pidiendo hashes
// que ya no existen en el servidor -> nginx devuelve index.html (MIME text/html) y la
// carga del modulo dinamico falla con "Failed to fetch dynamically imported module".
//
// Este handler detecta ese fallo, limpia SW + caches y recarga UNA sola vez para que
// el usuario obtenga el index.html nuevo (con los hashes correctos) sin ver la pantalla rota.

const RELOAD_FLAG = 'spm:chunk-reload-attempted'

// Reconoce el fallo tipico de carga de chunk dinamico entre distintos navegadores.
function isChunkLoadError(message) {
  if (!message) return false
  const msg = String(message)
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    /Loading chunk \d+ failed/.test(msg) ||
    msg.includes('Loading CSS chunk')
  )
}

async function purgeAndReload() {
  // Guard: recargar solo una vez por sesion para no entrar en bucle si el fallo
  // no se debe a un chunk obsoleto (p.ej. servidor caido).
  if (sessionStorage.getItem(RELOAD_FLAG)) return
  sessionStorage.setItem(RELOAD_FLAG, '1')

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
  } catch (_) {
    // ignore
  }

  try {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch (_) {
    // ignore
  }

  // Recarga forzada al servidor (el SW ya no intercepta).
  window.location.reload()
}

export function installChunkReloadHandler() {
  // Si la carga llega a buen puerto, limpiamos el flag para permitir una futura
  // auto-recuperacion en un deploy posterior.
  window.addEventListener('load', () => {
    sessionStorage.removeItem(RELOAD_FLAG)
  })

  // Evento especifico de Vite para fallos de preload de chunks.
  window.addEventListener('vite:preloadError', (event) => {
    event?.preventDefault?.()
    purgeAndReload()
  })

  // Red de seguridad: promesas rechazadas (import() devuelve una promesa).
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event?.reason?.message || event?.reason)) {
      purgeAndReload()
    }
  })

  // Red de seguridad: errores sincronos de carga de script/estilo.
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event?.message)) {
      purgeAndReload()
    }
  })
}
