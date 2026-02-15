import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'spm_dashboard_layout';

const DEFAULT_CARDS = [
  { id: 'solicitudes', label: 'Solicitudes', visible: true },
  { id: 'filters', label: 'Filtros', visible: true },
  { id: 'kpi_row1', label: 'KPIs Principales', visible: true },
  { id: 'kpi_row2', label: 'Distribución y Tendencia', visible: true },
  { id: 'kpi_row3', label: 'Materiales y Stock', visible: true },
];

/**
 * Hook for managing dashboard card layout persistence.
 * Stores card order and visibility in localStorage.
 *
 * @returns {Object} Layout state and methods
 */
export function useDashboardLayout() {
  const [cards, setCards] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new cards added in future versions
        const existingIds = new Set(parsed.map(c => c.id));
        const merged = [...parsed];
        for (const def of DEFAULT_CARDS) {
          if (!existingIds.has(def.id)) {
            merged.push({ ...def });
          }
        }
        return merged;
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CARDS.map(c => ({ ...c }));
  });

  const [editMode, setEditMode] = useState(false);

  // Persist to localStorage whenever cards change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch {
      // Ignore storage errors
    }
  }, [cards]);

  const moveCard = useCallback((fromIndex, toIndex) => {
    setCards(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const toggleCard = useCallback((cardId) => {
    setCards(prev =>
      prev.map(c => c.id === cardId ? { ...c, visible: !c.visible } : c)
    );
  }, []);

  const resetLayout = useCallback(() => {
    setCards(DEFAULT_CARDS.map(c => ({ ...c })));
    setEditMode(false);
  }, []);

  const isVisible = useCallback((cardId) => {
    const card = cards.find(c => c.id === cardId);
    return card ? card.visible : true;
  }, [cards]);

  const getOrderedVisibleIds = useCallback(() => {
    return cards.filter(c => c.visible).map(c => c.id);
  }, [cards]);

  return {
    cards,
    editMode,
    setEditMode,
    moveCard,
    toggleCard,
    resetLayout,
    isVisible,
    getOrderedVisibleIds,
  };
}
