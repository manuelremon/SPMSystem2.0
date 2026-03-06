import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'spm_dashboard_layout_v2';

/**
 * Dashboard categories with their contained cards.
 * Each category groups related sections with a visual header.
 */
export const DASHBOARD_CATEGORIES = [
  {
    id: 'command_center',
    label: 'Centro de Mando',
    icon: 'CommandCenter',
    color: '#1976d2',
    subtitle: 'Alertas prioritarias y accesos directos',
    cards: [
      { id: 'attention', label: 'Alertas', visible: true },
      { id: 'quick_actions', label: 'Acciones Rápidas', visible: true },
    ],
  },
  {
    id: 'request_management',
    label: 'Gestión de Solicitudes',
    icon: 'RequestManagement',
    color: '#7c3aed',
    subtitle: 'Seguimiento y control de solicitudes',
    cards: [
      { id: 'filters', label: 'Filtros', visible: true },
      { id: 'solicitudes', label: 'Tabla de Solicitudes', visible: true },
    ],
  },
  {
    id: 'performance',
    label: 'Indicadores de Rendimiento',
    icon: 'Performance',
    color: '#0891b2',
    subtitle: 'KPIs de solicitudes, proveedores, tiempos y presupuesto',
    cards: [
      { id: 'kpi_row1', label: 'Solicitudes y Proveedores', visible: true },
      { id: 'kpi_row2', label: 'Distribución, Tendencia y Presupuesto', visible: true },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario y Materiales',
    icon: 'Inventory',
    color: '#d97706',
    subtitle: 'Stock, materiales críticos y alertas MRP',
    cards: [
      { id: 'kpi_row3', label: 'Materiales y Stock', visible: true },
    ],
  },
  {
    id: 'advanced_metrics',
    label: 'Métricas Avanzadas',
    icon: 'AdvancedMetrics',
    color: '#059669',
    subtitle: 'Análisis operativo, táctico y estratégico',
    cards: [
      { id: 'kpi_row4', label: 'KPIs Avanzados (3 Tiers)', visible: true },
    ],
  },
  {
    id: 'operations',
    label: 'Operaciones Cross-Module',
    icon: 'Operations',
    color: '#6366f1',
    subtitle: 'Transporte, flota, calidad y MRP',
    cards: [
      { id: 'operations', label: 'Vista Operaciones', visible: true },
    ],
  },
];

// Flatten all cards for backwards compatibility
const ALL_DEFAULT_CARDS = DASHBOARD_CATEGORIES.flatMap(cat =>
  cat.cards.map(c => ({ ...c, category: cat.id }))
);

/**
 * Hook for managing dashboard card layout persistence.
 * Stores card order and visibility in localStorage.
 * Now with category-aware grouping.
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
        for (const def of ALL_DEFAULT_CARDS) {
          if (!existingIds.has(def.id)) {
            merged.push({ ...def });
          }
        }
        return merged;
      }
      // Try migrating from v1 format
      const v1Stored = localStorage.getItem('spm_dashboard_layout');
      if (v1Stored) {
        const v1Parsed = JSON.parse(v1Stored);
        // Map old cards to new format with categories
        const categoryMap = {};
        for (const cat of DASHBOARD_CATEGORIES) {
          for (const card of cat.cards) {
            categoryMap[card.id] = cat.id;
          }
        }
        const migrated = v1Parsed.map(c => ({
          ...c,
          category: categoryMap[c.id] || 'command_center',
        }));
        // Add any new cards not in v1
        const existingIds = new Set(migrated.map(c => c.id));
        for (const def of ALL_DEFAULT_CARDS) {
          if (!existingIds.has(def.id)) {
            migrated.push({ ...def });
          }
        }
        return migrated;
      }
    } catch {
      // Ignore parse errors
    }
    return ALL_DEFAULT_CARDS.map(c => ({ ...c }));
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
    setCards(ALL_DEFAULT_CARDS.map(c => ({ ...c })));
    setEditMode(false);
    // Also clear v1 key
    try { localStorage.removeItem('spm_dashboard_layout'); } catch { /* ignore */ }
  }, []);

  const isVisible = useCallback((cardId) => {
    const card = cards.find(c => c.id === cardId);
    return card ? card.visible : true;
  }, [cards]);

  const getOrderedVisibleIds = useCallback(() => {
    return cards.filter(c => c.visible).map(c => c.id);
  }, [cards]);

  /**
   * Returns cards grouped by category, maintaining card order within each category.
   * Categories with no visible cards are excluded.
   */
  const getCategorizedCards = useCallback(() => {
    return DASHBOARD_CATEGORIES.map(cat => {
      const categoryCards = cards.filter(c => c.category === cat.id);
      const visibleCards = categoryCards.filter(c => c.visible);
      return {
        ...cat,
        cards: categoryCards,
        visibleCards,
        hasVisible: visibleCards.length > 0,
      };
    }).filter(cat => cat.hasVisible);
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
    getCategorizedCards,
    categories: DASHBOARD_CATEGORIES,
  };
}
