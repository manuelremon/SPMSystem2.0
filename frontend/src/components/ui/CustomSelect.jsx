import React, { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

/**
 * CustomSelect - Select estilizado con dropdown animado
 * Usa Headless UI Listbox para accesibilidad completa
 *
 * @param {string} value - Valor seleccionado
 * @param {function} onChange - Callback (value) => void
 * @param {Array} options - [{value, label, icon?, disabled?}]
 * @param {string} placeholder - Texto cuando no hay selección
 * @param {boolean} disabled - Deshabilitar select
 * @param {boolean} error - Estado de error visual
 * @param {boolean} required - Campo requerido (visual)
 * @param {string} className - Clases adicionales
 * @param {string} name - Nombre del campo para formularios
 * @param {string} id - ID del elemento
 */
export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  disabled = false,
  error = false,
  required = false,
  className = "",
  name,
  id,
  "aria-label": ariaLabel,
}) {
  const selectedOption = options.find((opt) => opt.value === value);

  // Handler que simula el evento de un input nativo para compatibilidad con onChange(e)
  const handleChange = (newValue) => {
    if (typeof onChange === "function") {
      // Si el onChange espera un evento sintético (e.target.name, e.target.value)
      // creamos uno falso para mantener compatibilidad
      const syntheticEvent = {
        target: {
          name: name,
          value: newValue,
        },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <Listbox value={value} onChange={handleChange} disabled={disabled}>
      {({ open }) => (
        <div className={clsx("relative", className)}>
          {/* Hidden input for form submission */}
          {name && <input type="hidden" name={name} value={value || ""} />}

          {/* Trigger Button */}
          <Listbox.Button
            id={id}
            aria-label={ariaLabel}
            aria-required={required || undefined}
            className={clsx(
              "relative w-full cursor-pointer rounded-[var(--radius-md)]",
              "px-4 py-3 pr-10 text-left",
              "bg-[var(--input-bg)] text-sm text-[var(--fg)]",
              "border transition-all duration-[var(--transition-fast)]",
              "focus:outline-none focus:ring-2",
              disabled && "opacity-50 cursor-not-allowed bg-[var(--bg-soft)]",
              error
                ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/20"
                : clsx(
                    "border-[var(--border-strong)]",
                    "focus:ring-[var(--primary)] focus:border-[var(--primary)]",
                    "hover:border-[var(--border-hover)]"
                  ),
              open && !error && "ring-2 ring-[var(--primary)] border-[var(--primary)]"
            )}
          >
            <span
              className={clsx(
                "block truncate",
                !selectedOption && "text-[var(--fg-subtle)]"
              )}
            >
              {selectedOption?.label || placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown
                className={clsx(
                  "w-4 h-4 text-[var(--fg-muted)]",
                  "transition-transform duration-200",
                  open && "rotate-180"
                )}
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>

          {/* Dropdown Options */}
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              className={clsx(
                "absolute z-50 mt-2 w-full max-h-60 overflow-auto",
                "bg-[var(--card)] border border-[var(--border)]",
                "rounded-xl shadow-strong",
                "focus:outline-none",
                "animate-menu-reveal origin-top"
              )}
            >
              {options.length === 0 ? (
                <li className="px-4 py-3 text-sm text-[var(--fg-muted)] text-center">
                  No hay opciones disponibles
                </li>
              ) : (
                options.map((option, idx) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={({ active, selected }) =>
                      clsx(
                        "relative cursor-pointer select-none",
                        "flex items-center gap-3 px-4 py-3",
                        "text-sm font-medium",
                        "transition-all duration-150",
                        "animate-menu-item-reveal",
                        `menu-item-stagger-${Math.min(idx + 1, 7)}`,
                        option.disabled && "opacity-50 cursor-not-allowed",
                        active && "bg-white/10 text-[var(--primary)]",
                        selected && !active && "text-[var(--primary)]",
                        !active && !selected && "text-white/90"
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        {option.icon && (
                          <span className="text-[var(--primary)] flex-shrink-0">
                            {option.icon}
                          </span>
                        )}
                        <span className="flex-1 truncate">{option.label}</span>
                        {selected && (
                          <Check className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))
              )}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  );
}

CustomSelect.displayName = "CustomSelect";
export default CustomSelect;
