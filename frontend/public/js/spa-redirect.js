// GitHub Pages SPA redirect handler
(function() {
  var redirect = sessionStorage.getItem('redirect');
  if (redirect) {
    sessionStorage.removeItem('redirect');
    window.history.replaceState(null, null, redirect);
  }
})();
