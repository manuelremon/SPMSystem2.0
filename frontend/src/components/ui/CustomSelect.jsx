import React, { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { Check, ChevronDown } from "./Icons";
import clsx from "clsx";

/**
 * CustomSelect - Glass Morphism Style
 * Translucent dropdown with blur effect
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

          {/* Trigger Button - Glass style */}
          <Listbox.Button
            id={id}
            aria-label={ariaLabel}
            aria-required={required || undefined}
            className={clsx(
              // Glass base
              "relative w-full cursor-pointer",
              "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
              "rounded-xl",
              "px-4 py-3 pr-10 text-left",
              // Typography
              "text-sm text-slate-800 dark:text-slate-200",
              // Transitions
              "transition-all duration-200",
              // Focus
              "focus:outline-none",
              "focus:bg-white/70 dark:focus:bg-slate-700/70",
              // Disabled
              disabled && "opacity-50 cursor-not-allowed bg-white/30 dark:bg-slate-800/30",
              // Border - Always blue (or red for error)
              error
                ? "border border-red-400 ring-1 ring-red-100 dark:ring-red-900/30 focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/50"
                : "border border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900/30 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/50",
              // Hover
              !error && "hover:bg-white/60 dark:hover:bg-slate-700/60 hover:border-blue-400",
              // Open state
              open && !error && "ring-2 ring-blue-200 dark:ring-blue-800/50 border-blue-400 bg-white/70 dark:bg-slate-700/70"
            )}
          >
            <span
              className={clsx(
                "block truncate selected-text",
                !selectedOption && "text-slate-400 dark:text-slate-500"
              )}
            >
              {selectedOption?.label || placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown
                className={clsx(
                  "w-4 h-4 text-slate-500 dark:text-slate-400",
                  "transition-transform duration-200",
                  open && "rotate-180"
                )}
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>

          {/* Dropdown Options - Glass style */}
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              className={clsx(
                // Glass dropdown
                "absolute z-[9999] mt-2 w-full max-h-60 overflow-auto",
                "bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl",
                "border border-white/50 dark:border-slate-700/50",
                "rounded-xl",
                "shadow-glass",
                "focus:outline-none",
                "animate-menu-reveal origin-top"
              )}
            >
              {options.length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
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
                        "transition-all duration-200",
                        "animate-menu-item-reveal",
                        `menu-item-stagger-${Math.min(idx + 1, 7)}`,
                        option.disabled && "opacity-50 cursor-not-allowed",
                        active && "bg-blue-50/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
                        selected && !active && "text-blue-600 dark:text-blue-400",
                        !active && !selected && "text-slate-700 dark:text-slate-300"
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        {option.icon && (
                          <span className="text-blue-500 flex-shrink-0">
                            {option.icon}
                          </span>
                        )}
                        <span className="flex-1 truncate">{option.label}</span>
                        {selected && (
                          <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
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
