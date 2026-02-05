/**
 * CookieConsent Component
 *
 * Banner de consentimiento para analytics.
 * Cumple con GDPR/LGPD mostrando opciones claras.
 * Se muestra solo una vez hasta que el usuario decide.
 */

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { X, Shield, BarChart2 } from "../ui/Icons";
import { Button } from "../ui/Button";
import { useI18n } from "../../context/i18n";
import {
  wasConsentAsked,
  setAnalyticsConsent,
  hasAnalyticsConsent,
} from "../../utils/analytics";

export function CookieConsent({ className = "" }) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Mostrar solo si no se ha preguntado antes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!wasConsentAsked()) {
        setIsVisible(true);
      }
    }, 1500); // Delay para no interrumpir carga inicial

    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    setAnalyticsConsent(true);
    setIsVisible(false);
  };

  const handleDecline = () => {
    setAnalyticsConsent(false);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className={clsx(
        "fixed bottom-0 left-0 right-0 z-[100]",
        "p-4 md:p-6",
        "bg-white dark:bg-slate-800",
        "border-t border-slate-200 dark:border-slate-700",
        "shadow-[0_-4px_20px_rgba(0,0,0,0.1)]",
        "animate-slide-up",
        className
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          {/* Icono */}
          <div className="hidden md:flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Contenido */}
          <div className="flex-1 space-y-3">
            <div>
              <h2
                id="cookie-consent-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {t("cookies_title", "Tu privacidad es importante")}
              </h2>
              <p
                id="cookie-consent-description"
                className="text-sm text-slate-600 dark:text-slate-300 mt-1"
              >
                {t(
                  "cookies_description",
                  "Usamos cookies de analisis para mejorar tu experiencia. Estos datos son anonimos y nos ayudan a entender como se usa la aplicacion."
                )}
              </p>
            </div>

            {/* Detalles expandibles */}
            {showDetails && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-2 animate-fade-in">
                <div className="flex items-start gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {t("cookies_analytics_title", "Microsoft Clarity")}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        "cookies_analytics_desc",
                        "Analisis de uso anonimo: mapas de calor, grabacion de sesiones, metricas de navegacion."
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    "cookies_no_personal",
                    "No recopilamos datos personales identificables. Puedes cambiar tu preferencia en cualquier momento desde Ajustes."
                  )}
                </p>
              </div>
            )}

            {/* Toggle detalles */}
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
            >
              {showDetails
                ? t("cookies_hide_details", "Ocultar detalles")
                : t("cookies_show_details", "Ver detalles")}
            </button>
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecline}
              className="order-2 sm:order-1"
            >
              {t("cookies_decline", "Rechazar")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAccept}
              className="order-1 sm:order-2"
            >
              {t("cookies_accept", "Aceptar")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

CookieConsent.propTypes = {
  className: PropTypes.string,
};

CookieConsent.defaultProps = {
  className: "",
};

export default CookieConsent;
