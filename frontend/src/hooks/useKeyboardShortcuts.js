/**
 * useKeyboardShortcuts Hook
 *
 * Hook para registrar y manejar atajos de teclado globales.
 * Incluye soporte para combinaciones con Ctrl/Cmd, Shift, Alt.
 */

import { useEffect, useCallback, useMemo } from "react";

// Detectar si estamos en Mac
const isMac = typeof navigator !== "undefined"
  ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
  : false;

/**
 * Parsear una combinacion de teclas
 * Formato: "ctrl+k", "shift+/", "cmd+shift+p"
 */
function parseShortcut(shortcut) {
  const parts = shortcut.toLowerCase().split("+");
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes("ctrl") || parts.includes("cmd"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    meta: parts.includes("meta") || parts.includes("cmd"),
  };
}

/**
 * Verificar si un evento coincide con un shortcut
 */
function matchesShortcut(event, shortcut) {
  const parsed = parseShortcut(shortcut);

  // Normalizar la tecla del evento
  const eventKey = event.key.toLowerCase();

  // Verificar tecla principal
  if (eventKey !== parsed.key && event.code.toLowerCase() !== `key${parsed.key}`) {
    // Casos especiales
    if (parsed.key === "/" && eventKey !== "/") return false;
    if (parsed.key === "?" && !event.shiftKey) return false;
    if (parsed.key !== eventKey) return false;
  }

  // Verificar modificadores
  // En Mac, Cmd se mapea a metaKey; en otros, Ctrl se mapea a ctrlKey
  const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

  if (parsed.ctrl && !ctrlOrCmd) return false;
  if (parsed.shift && !event.shiftKey) return false;
  if (parsed.alt && !event.altKey) return false;

  return true;
}

/**
 * @param {Object} shortcuts - Mapa de atajos: { "ctrl+k": callback }
 * @param {Object} options - Opciones
 * @param {boolean} options.enabled - Habilitar/deshabilitar (default: true)
 * @param {boolean} options.preventDefault - Prevenir default en match (default: true)
 * @param {string[]} options.ignoreInputs - Tipos de input a ignorar
 */
export function useKeyboardShortcuts(shortcuts = {}, options = {}) {
  const {
    enabled = true,
    preventDefault = true,
    ignoreInputs = ["input", "textarea", "select"],
  } = options;

  // Memoizar shortcuts para evitar re-renders
  const shortcutEntries = useMemo(
    () => Object.entries(shortcuts),
    [shortcuts]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (!enabled) return;

      // Ignorar si el focus esta en un input (a menos que sea un shortcut con modificador)
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName?.toLowerCase();
      const isEditable = activeElement?.isContentEditable;

      if (
        (ignoreInputs.includes(tagName) || isEditable) &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }

      // Buscar shortcut que coincida
      for (const [shortcut, callback] of shortcutEntries) {
        if (matchesShortcut(event, shortcut)) {
          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          callback(event);
          return;
        }
      }
    },
    [enabled, shortcutEntries, preventDefault, ignoreInputs]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Formatear shortcut para mostrar al usuario
 */
export function formatShortcut(shortcut) {
  const symbols = isMac
    ? { ctrl: "⌘", shift: "⇧", alt: "⌥", meta: "⌘" }
    : { ctrl: "Ctrl", shift: "Shift", alt: "Alt", meta: "Win" };

  return shortcut
    .split("+")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "ctrl" || lower === "cmd") return symbols.ctrl;
      if (lower === "shift") return symbols.shift;
      if (lower === "alt") return symbols.alt;
      if (lower === "meta") return symbols.meta;
      // Capitalizar tecla
      return part.toUpperCase();
    })
    .join(isMac ? "" : "+");
}

/**
 * Lista de atajos de la aplicacion
 */
export const APP_SHORTCUTS = {
  // Navegacion
  "g+d": { description: "Ir al Dashboard", action: "navigate", path: "/dashboard" },
  "g+n": { description: "Nueva solicitud", action: "navigate", path: "/solicitudes/nueva" },
  "g+m": { description: "Mis solicitudes", action: "navigate", path: "/mis-solicitudes" },
  "g+p": { description: "Ir al planificador", action: "navigate", path: "/planificador" },

  // Busqueda
  "ctrl+k": { description: "Busqueda global", action: "search" },
  "/": { description: "Enfocar busqueda", action: "focusSearch" },

  // Ayuda
  "?": { description: "Mostrar atajos", action: "showShortcuts" },
  "shift+/": { description: "Mostrar atajos", action: "showShortcuts" },

  // Navegacion rapida
  "j": { description: "Siguiente item", action: "nextItem" },
  "k": { description: "Item anterior", action: "prevItem" },

  // Acciones
  "e": { description: "Editar", action: "edit" },
  "ctrl+s": { description: "Guardar", action: "save" },
  "ctrl+enter": { description: "Enviar formulario", action: "submit" },

  // Modal/Dialog
  "Escape": { description: "Cerrar modal", action: "closeModal" },
};

export default useKeyboardShortcuts;
