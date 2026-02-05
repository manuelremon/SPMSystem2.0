/**
 * KeyboardShortcutsModal Component
 *
 * Modal que muestra todos los atajos de teclado disponibles
 * en la aplicacion. Se abre con la tecla "?".
 */

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { X, Keyboard } from "./Icons";
import { Button } from "./Button";
import { useI18n } from "../../context/i18n";
import { formatShortcut, APP_SHORTCUTS } from "../../hooks/useKeyboardShortcuts";

// Agrupar atajos por categoria
const SHORTCUT_CATEGORIES = [
  {
    id: "navigation",
    label: "Navegacion",
    shortcuts: [
      { key: "g+d", description: "Ir al Dashboard" },
      { key: "g+n", description: "Nueva solicitud" },
      { key: "g+m", description: "Mis solicitudes" },
      { key: "g+p", description: "Ir al planificador" },
    ],
  },
  {
    id: "search",
    label: "Busqueda",
    shortcuts: [
      { key: "ctrl+k", description: "Busqueda global" },
      { key: "/", description: "Enfocar busqueda" },
    ],
  },
  {
    id: "actions",
    label: "Acciones",
    shortcuts: [
      { key: "ctrl+s", description: "Guardar" },
      { key: "ctrl+enter", description: "Enviar formulario" },
      { key: "e", description: "Editar elemento seleccionado" },
    ],
  },
  {
    id: "lists",
    label: "Listas",
    shortcuts: [
      { key: "j", description: "Siguiente item" },
      { key: "k", description: "Item anterior" },
    ],
  },
  {
    id: "general",
    label: "General",
    shortcuts: [
      { key: "?", description: "Mostrar atajos de teclado" },
      { key: "Escape", description: "Cerrar modal/dialogo" },
    ],
  },
];

function ShortcutKey({ shortcut }) {
  const formatted = formatShortcut(shortcut);
  const keys = formatted.split(/(?=[A-Z+])|(\+)/g).filter(Boolean);

  return (
    <div className="flex items-center gap-1">
      {keys.map((key, index) => {
        if (key === "+") {
          return (
            <span key={index} className="text-slate-400">
              +
            </span>
          );
        }
        return (
          <kbd
            key={index}
            className={clsx(
              "inline-flex items-center justify-center",
              "min-w-[24px] h-6 px-1.5",
              "bg-slate-100 dark:bg-slate-700",
              "border border-slate-200 dark:border-slate-600",
              "rounded",
              "text-xs font-mono font-medium",
              "text-slate-700 dark:text-slate-300"
            )}
          >
            {key}
          </kbd>
        );
      })}
    </div>
  );
}

ShortcutKey.propTypes = {
  shortcut: PropTypes.string.isRequired,
};

export function KeyboardShortcutsModal({ isOpen, onClose }) {
  const { t } = useI18n();

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className={clsx(
          "fixed z-[101]",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-2xl max-h-[85vh]",
          "bg-white dark:bg-slate-800",
          "rounded-2xl shadow-2xl",
          "overflow-hidden",
          "animate-scale-in"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Keyboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2
              id="shortcuts-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              {t("shortcuts_title", "Atajos de Teclado")}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t("close", "Cerrar")}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.id}>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t(`shortcuts_cat_${category.id}`, category.label)}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {t(`shortcut_${shortcut.key.replace(/[+]/g, "_")}`, shortcut.description)}
                      </span>
                      <ShortcutKey shortcut={shortcut.key} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {t(
              "shortcuts_hint",
              "Presiona ? en cualquier momento para ver esta ayuda"
            )}
          </p>
        </div>
      </div>
    </>
  );
}

KeyboardShortcutsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default KeyboardShortcutsModal;
