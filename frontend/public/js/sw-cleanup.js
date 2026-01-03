// Clear any old service workers and caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) caches.delete(name);
  });
}
