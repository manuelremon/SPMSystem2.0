/**
 * PasswordStrengthIndicator Component
 *
 * Indicador visual de fortaleza de contrasena con barra
 * de 6 segmentos y criterios individuales.
 *
 * WCAG 2.1 AA: Usa colores Y texto para indicar estado.
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { CheckCircle2, X } from "./Icons";
import { useI18n } from "../../context/i18n";

// Configuracion de niveles de fortaleza
const STRENGTH_LEVELS = {
  0: { label: "", color: "bg-slate-200", textColor: "text-slate-400", segments: 0 },
  1: { label: "Muy debil", color: "bg-red-500", textColor: "text-red-600", segments: 1 },
  2: { label: "Debil", color: "bg-orange-500", textColor: "text-orange-600", segments: 2 },
  3: { label: "Aceptable", color: "bg-yellow-500", textColor: "text-yellow-600", segments: 3 },
  4: { label: "Buena", color: "bg-lime-500", textColor: "text-lime-600", segments: 4 },
  5: { label: "Fuerte", color: "bg-green-500", textColor: "text-green-600", segments: 5 },
  6: { label: "Muy fuerte", color: "bg-emerald-500", textColor: "text-emerald-600", segments: 6 },
};

/**
 * Calcula la fortaleza de una contrasena
 */
function calculateStrength(password) {
  if (!password) return { level: 0, checks: {} };

  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'`~]/.test(password),
    longLength: password.length >= 12,
  };

  let level = 0;
  if (checks.length) level += 1;
  if (checks.lowercase) level += 1;
  if (checks.uppercase) level += 1;
  if (checks.numbers) level += 1;
  if (checks.symbols) level += 1;
  if (checks.longLength) level += 1;

  return { level, checks };
}

/**
 * Componente de segmento individual de la barra
 */
function StrengthSegment({ active, color, index }) {
  return (
    <div
      className={clsx(
        "h-1.5 rounded-full transition-all duration-300",
        active ? color : "bg-slate-200"
      )}
      style={{ transitionDelay: `${index * 50}ms` }}
      role="presentation"
    />
  );
}

StrengthSegment.propTypes = {
  active: PropTypes.bool.isRequired,
  color: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
};

/**
 * Componente de criterio individual
 */
function StrengthCriterion({ met, label }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 text-xs transition-colors duration-200",
        met ? "text-emerald-600" : "text-slate-400"
      )}
    >
      {met ? (
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      ) : (
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}

StrengthCriterion.propTypes = {
  met: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
};

/**
 * PasswordStrengthIndicator Component
 *
 * @param {string} password - La contrasena a evaluar
 * @param {boolean} showCriteria - Mostrar lista de criterios individuales
 * @param {boolean} showLabel - Mostrar etiqueta de nivel (Debil, Fuerte, etc.)
 * @param {string} className - Clases CSS adicionales
 */
export function PasswordStrengthIndicator({
  password = "",
  showCriteria = true,
  showLabel = true,
  className = "",
}) {
  const { t } = useI18n();

  const { level, checks } = useMemo(
    () => calculateStrength(password),
    [password]
  );

  const strengthConfig = STRENGTH_LEVELS[level];

  // Si no hay password, no mostrar nada
  if (!password) {
    return null;
  }

  return (
    <div
      className={clsx("space-y-2", className)}
      role="region"
      aria-label={t("password_strength", "Fortaleza de la contrasena")}
    >
      {/* Barra de segmentos */}
      <div className="space-y-1.5">
        <div
          className="grid grid-cols-6 gap-1"
          role="progressbar"
          aria-valuenow={level}
          aria-valuemin={0}
          aria-valuemax={6}
          aria-valuetext={strengthConfig.label}
        >
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <StrengthSegment
              key={index}
              active={index < strengthConfig.segments}
              color={strengthConfig.color}
              index={index}
            />
          ))}
        </div>

        {/* Label de nivel */}
        {showLabel && level > 0 && (
          <p
            className={clsx(
              "text-xs font-medium transition-colors duration-200",
              strengthConfig.textColor
            )}
          >
            {t(`password_${strengthConfig.label.toLowerCase().replace(" ", "_")}`, strengthConfig.label)}
          </p>
        )}
      </div>

      {/* Lista de criterios */}
      {showCriteria && (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1"
          aria-label={t("password_requirements", "Requisitos de contrasena")}
        >
          <StrengthCriterion
            met={checks.length}
            label={t("password_min_8", "8+ caracteres")}
          />
          <StrengthCriterion
            met={checks.lowercase}
            label={t("password_lowercase", "Minusculas")}
          />
          <StrengthCriterion
            met={checks.uppercase}
            label={t("password_uppercase", "Mayusculas")}
          />
          <StrengthCriterion
            met={checks.numbers}
            label={t("password_numbers", "Numeros")}
          />
          <StrengthCriterion
            met={checks.symbols}
            label={t("password_symbols", "Simbolos")}
          />
          <StrengthCriterion
            met={checks.longLength}
            label={t("password_min_12", "12+ caracteres")}
          />
        </div>
      )}
    </div>
  );
}

PasswordStrengthIndicator.propTypes = {
  password: PropTypes.string,
  showCriteria: PropTypes.bool,
  showLabel: PropTypes.bool,
  className: PropTypes.string,
};

PasswordStrengthIndicator.defaultProps = {
  password: "",
  showCriteria: true,
  showLabel: true,
  className: "",
};

export default PasswordStrengthIndicator;
