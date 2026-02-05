/**
 * Analytics Utilities
 *
 * Abstraccion para tracking de eventos de usuario.
 * Soporta Microsoft Clarity y es extensible para otras herramientas.
 *
 * IMPORTANTE: Solo trackea si el usuario ha dado consentimiento.
 */

// Clave para almacenar consentimiento
const CONSENT_KEY = "spm-analytics-consent";

// ============================================
// CONSENTIMIENTO
// ============================================

/**
 * Verificar si el usuario ha dado consentimiento
 */
export function hasAnalyticsConsent() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONSENT_KEY) === "true";
}

/**
 * Establecer consentimiento del usuario
 */
export function setAnalyticsConsent(consent) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, consent ? "true" : "false");

  if (consent) {
    initAnalytics();
  } else {
    // Desactivar tracking si existe Clarity
    if (window.clarity) {
      window.clarity("stop");
    }
  }
}

/**
 * Verificar si el consentimiento ya fue solicitado
 */
export function wasConsentAsked() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONSENT_KEY) !== null;
}

// ============================================
// INICIALIZACION
// ============================================

/**
 * Inicializar analytics (llamar despues del consentimiento)
 */
export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  // Microsoft Clarity - Solo si esta configurado
  const clarityId = import.meta.env.VITE_CLARITY_ID;
  if (clarityId && !window.clarity) {
    loadClarity(clarityId);
  }
}

/**
 * Cargar script de Microsoft Clarity dinamicamente
 */
function loadClarity(projectId) {
  if (typeof window === "undefined") return;

  // Script de Clarity
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () {
      (c[a].q = c[a].q || []).push(arguments);
    };
    t = l.createElement(r);
    t.async = 1;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", projectId);
}

// ============================================
// TRACKING DE EVENTOS
// ============================================

/**
 * Trackear un evento personalizado
 *
 * @param {string} eventName - Nombre del evento
 * @param {Object} eventData - Datos adicionales
 */
export function trackEvent(eventName, eventData = {}) {
  if (!hasAnalyticsConsent()) return;

  // Microsoft Clarity custom events
  if (window.clarity) {
    window.clarity("set", eventName, JSON.stringify(eventData));
  }

  // Console en desarrollo
  if (import.meta.env.DEV) {
    console.log("[Analytics]", eventName, eventData);
  }
}

/**
 * Trackear vista de pagina
 */
export function trackPageView(pageName, data = {}) {
  trackEvent("page_view", {
    page: pageName,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Trackear envio de formulario
 */
export function trackFormSubmit(formName, success = true, data = {}) {
  trackEvent("form_submit", {
    form: formName,
    success,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Trackear busqueda
 */
export function trackSearch(query, resultsCount = 0, data = {}) {
  trackEvent("search", {
    query,
    results: resultsCount,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Trackear error
 */
export function trackError(errorType, errorMessage, data = {}) {
  trackEvent("error", {
    type: errorType,
    message: errorMessage,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Trackear completacion de tour
 */
export function trackTourComplete(tourId, stepsViewed, data = {}) {
  trackEvent("tour_complete", {
    tour: tourId,
    steps_viewed: stepsViewed,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Trackear click en elemento
 */
export function trackClick(elementName, data = {}) {
  trackEvent("click", {
    element: elementName,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Trackear tiempo en pagina
 */
export function trackTimeOnPage(pageName, durationMs, data = {}) {
  trackEvent("time_on_page", {
    page: pageName,
    duration_ms: durationMs,
    duration_formatted: formatDuration(durationMs),
    ...data,
  });
}

// ============================================
// IDENTIFICACION DE USUARIO
// ============================================

/**
 * Identificar usuario (anonimizado)
 * Solo para segmentacion, nunca datos personales
 */
export function identifyUser(userId, traits = {}) {
  if (!hasAnalyticsConsent()) return;

  // Microsoft Clarity user identification
  if (window.clarity) {
    window.clarity("identify", userId);

    // Set custom tags for segmentation
    if (traits.role) {
      window.clarity("set", "user_role", traits.role);
    }
    if (traits.center) {
      window.clarity("set", "user_center", traits.center);
    }
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Formatear duracion en formato legible
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

// ============================================
// HOOK PARA TRACKING AUTOMATICO DE PAGINAS
// ============================================

/**
 * Hook para trackear automaticamente cambios de pagina
 * Uso: usePageTracking() en App.jsx
 */
export function usePageTracking() {
  if (typeof window === "undefined") return;

  // Solo funciona si react-router esta disponible
  // El componente que use este hook debe importar useLocation
}

export default {
  hasAnalyticsConsent,
  setAnalyticsConsent,
  wasConsentAsked,
  initAnalytics,
  trackEvent,
  trackPageView,
  trackFormSubmit,
  trackSearch,
  trackError,
  trackTourComplete,
  trackClick,
  trackTimeOnPage,
  identifyUser,
};
