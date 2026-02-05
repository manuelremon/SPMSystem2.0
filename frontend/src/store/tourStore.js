/**
 * Tour Store - Zustand
 *
 * Estado global para el sistema de tour guiado (onboarding).
 * Maneja el estado del tour activo, paso actual, y persistencia.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Definicion de tours disponibles
export const TOURS = {
  // Tour de bienvenida para nuevos usuarios
  welcome: {
    id: "welcome",
    name: "Bienvenida a SPM",
    steps: [
      {
        id: "welcome-1",
        target: '[data-tour="dashboard"]',
        title: "Panel Principal",
        content: "Este es tu panel de control. Aqui veras un resumen de tu actividad y solicitudes pendientes.",
        placement: "bottom",
      },
      {
        id: "welcome-2",
        target: '[data-tour="notifications"]',
        title: "Notificaciones",
        content: "Aqui recibiras alertas sobre cambios en tus solicitudes y mensajes importantes.",
        placement: "right",
      },
      {
        id: "welcome-3",
        target: '[data-tour="new-request"]',
        title: "Nueva Solicitud",
        content: "Crea una nueva solicitud de materiales desde aqui.",
        placement: "right",
      },
      {
        id: "welcome-4",
        target: '[data-tour="sidebar-toggle"]',
        title: "Menu Lateral",
        content: "Puedes expandir o colapsar el menu lateral para tener mas espacio.",
        placement: "right",
      },
      {
        id: "welcome-5",
        target: '[data-tour="chat-button"]',
        title: "Asistente Vertex IA",
        content: "Nuestro asistente de IA puede ayudarte con dudas y tareas comunes.",
        placement: "left",
      },
    ],
  },

  // Tour de solicitudes
  solicitudes: {
    id: "solicitudes",
    name: "Crear Solicitudes",
    steps: [
      {
        id: "solicitud-1",
        target: '[data-tour="material-search"]',
        title: "Buscar Materiales",
        content: "Busca materiales por codigo SAP, descripcion o palabras clave.",
        placement: "bottom",
      },
      {
        id: "solicitud-2",
        target: '[data-tour="material-cart"]',
        title: "Carrito de Materiales",
        content: "Los materiales seleccionados aparecen aqui. Ajusta las cantidades antes de enviar.",
        placement: "left",
      },
      {
        id: "solicitud-3",
        target: '[data-tour="submit-request"]',
        title: "Enviar Solicitud",
        content: "Una vez revisados los materiales, envia tu solicitud para aprobacion.",
        placement: "top",
      },
    ],
  },

  // Tour del planificador
  planner: {
    id: "planner",
    name: "Panel del Planificador",
    steps: [
      {
        id: "planner-1",
        target: '[data-tour="planner-list"]',
        title: "Lista de Solicitudes",
        content: "Aqui veras todas las solicitudes aprobadas pendientes de planificacion.",
        placement: "right",
      },
      {
        id: "planner-2",
        target: '[data-tour="planner-actions"]',
        title: "Acciones de Planificacion",
        content: "Selecciona una solicitud para ver opciones de tratamiento.",
        placement: "bottom",
      },
      {
        id: "planner-3",
        target: '[data-tour="mrp-alerts"]',
        title: "Alertas MRP",
        content: "Consulta alertas de reorden y stock bajo desde el panel MRP.",
        placement: "right",
      },
    ],
  },
};

// Estado inicial
const initialState = {
  // Tour actualmente en ejecucion
  activeTour: null,
  // Indice del paso actual
  currentStepIndex: 0,
  // Si el tour esta visible
  isVisible: false,
  // Tours completados por el usuario
  completedTours: [],
  // Tours omitidos por el usuario
  skippedTours: [],
  // Preferencia de no mostrar tours automaticos
  disableAutoTours: false,
};

export const useTourStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Iniciar un tour especifico
       */
      startTour: (tourId) => {
        const tour = TOURS[tourId];
        if (!tour) {
          console.warn(`Tour "${tourId}" no encontrado`);
          return;
        }

        set({
          activeTour: tour,
          currentStepIndex: 0,
          isVisible: true,
        });
      },

      /**
       * Ir al siguiente paso
       */
      nextStep: () => {
        const { activeTour, currentStepIndex } = get();
        if (!activeTour) return;

        const nextIndex = currentStepIndex + 1;
        if (nextIndex < activeTour.steps.length) {
          set({ currentStepIndex: nextIndex });
        } else {
          // Tour completado
          get().completeTour();
        }
      },

      /**
       * Ir al paso anterior
       */
      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 });
        }
      },

      /**
       * Ir a un paso especifico
       */
      goToStep: (index) => {
        const { activeTour } = get();
        if (!activeTour) return;

        if (index >= 0 && index < activeTour.steps.length) {
          set({ currentStepIndex: index });
        }
      },

      /**
       * Completar el tour actual
       */
      completeTour: () => {
        const { activeTour, completedTours } = get();
        if (!activeTour) return;

        const updatedCompleted = [...new Set([...completedTours, activeTour.id])];

        set({
          activeTour: null,
          currentStepIndex: 0,
          isVisible: false,
          completedTours: updatedCompleted,
        });
      },

      /**
       * Omitir/saltar el tour actual
       */
      skipTour: () => {
        const { activeTour, skippedTours } = get();
        if (!activeTour) return;

        const updatedSkipped = [...new Set([...skippedTours, activeTour.id])];

        set({
          activeTour: null,
          currentStepIndex: 0,
          isVisible: false,
          skippedTours: updatedSkipped,
        });
      },

      /**
       * Cerrar el tour sin marcarlo como completado ni omitido
       */
      closeTour: () => {
        set({
          activeTour: null,
          currentStepIndex: 0,
          isVisible: false,
        });
      },

      /**
       * Verificar si un tour ya fue completado
       */
      isTourCompleted: (tourId) => {
        return get().completedTours.includes(tourId);
      },

      /**
       * Verificar si un tour fue omitido
       */
      isTourSkipped: (tourId) => {
        return get().skippedTours.includes(tourId);
      },

      /**
       * Verificar si se debe mostrar un tour automatico
       */
      shouldShowAutoTour: (tourId) => {
        const { completedTours, skippedTours, disableAutoTours } = get();
        if (disableAutoTours) return false;
        return !completedTours.includes(tourId) && !skippedTours.includes(tourId);
      },

      /**
       * Resetear el estado de un tour especifico
       */
      resetTour: (tourId) => {
        const { completedTours, skippedTours } = get();
        set({
          completedTours: completedTours.filter((id) => id !== tourId),
          skippedTours: skippedTours.filter((id) => id !== tourId),
        });
      },

      /**
       * Resetear todos los tours
       */
      resetAllTours: () => {
        set({
          completedTours: [],
          skippedTours: [],
        });
      },

      /**
       * Toggle de tours automaticos
       */
      toggleAutoTours: (enabled) => {
        set({ disableAutoTours: !enabled });
      },

      /**
       * Obtener el paso actual
       */
      getCurrentStep: () => {
        const { activeTour, currentStepIndex } = get();
        if (!activeTour) return null;
        return activeTour.steps[currentStepIndex] || null;
      },

      /**
       * Obtener progreso del tour actual
       */
      getProgress: () => {
        const { activeTour, currentStepIndex } = get();
        if (!activeTour) return { current: 0, total: 0, percentage: 0 };

        const total = activeTour.steps.length;
        const current = currentStepIndex + 1;
        const percentage = Math.round((current / total) * 100);

        return { current, total, percentage };
      },
    }),
    {
      name: "spm-tour-storage",
      partialize: (state) => ({
        completedTours: state.completedTours,
        skippedTours: state.skippedTours,
        disableAutoTours: state.disableAutoTours,
      }),
    }
  )
);

export default useTourStore;
