/**
 * Procurement Service - SAP Requisitions and Purchase Orders
 * Endpoints para datos de procurement importados de ZM65
 */

import api from './api';

const BASE_URL = '/procurement';

export const procurementService = {
  // ==================== SOLPEDS ====================

  /**
   * Lista requisiciones SAP con filtros y paginacion
   * @param {Object} params - Parametros de filtro
   * @param {number} params.page - Pagina (default 1)
   * @param {number} params.per_page - Items por pagina (default 50)
   * @param {string} params.centro - Filtrar por centro
   * @param {string} params.material - Filtrar por codigo de material
   * @param {string} params.estado - Filtrar por estrategia_liberacion
   * @param {string} params.fecha_desde - Fecha creacion minima (YYYY-MM-DD)
   * @param {string} params.fecha_hasta - Fecha creacion maxima (YYYY-MM-DD)
   * @param {string} params.search - Busqueda en descripcion
   */
  getSolpeds: (params = {}) =>
    api.get(`${BASE_URL}/solpeds`, { params }),

  /**
   * Obtiene detalle de una requisicion
   * @param {number} solpedId - ID de la SOLPED
   */
  getSolpedDetail: (solpedId) =>
    api.get(`${BASE_URL}/solpeds/${solpedId}`),

  // ==================== PURCHASE ORDERS ====================

  /**
   * Lista ordenes de compra SAP
   * @param {Object} params - Parametros de filtro
   */
  getOrders: (params = {}) =>
    api.get(`${BASE_URL}/orders`, { params }),

  /**
   * Obtiene detalle de una orden de compra
   * @param {number} pedidoId - ID del pedido
   */
  getOrderDetail: (pedidoId) =>
    api.get(`${BASE_URL}/orders/${pedidoId}`),

  // ==================== KPIs ====================

  /**
   * Obtiene KPIs consolidados de procurement
   * @param {Object} params
   * @param {string} params.centro - Filtrar por centro
   * @param {string} params.periodo - 'mes', 'trimestre', 'anio'
   */
  getKPIs: (params = {}) =>
    api.get(`${BASE_URL}/kpis`, { params }),

  /**
   * Obtiene analisis de lead times
   * @param {Object} params
   * @param {string} params.centro - Filtrar por centro
   * @param {string} params.proveedor - Filtrar por proveedor
   * @param {string} params.group_by - 'proveedor', 'material', 'centro'
   */
  getLeadTimes: (params = {}) =>
    api.get(`${BASE_URL}/kpis/lead-times`, { params }),

  /**
   * Obtiene analisis de cumplimiento OTIF
   * @param {Object} params
   * @param {number} params.min_pedidos - Minimo de pedidos (default 5)
   */
  getCompliance: (params = {}) =>
    api.get(`${BASE_URL}/kpis/compliance`, { params }),

  /**
   * Obtiene analisis de costos
   * @param {Object} params
   * @param {string} params.material - Filtrar por material
   * @param {string} params.moneda - Filtrar por moneda
   * @param {number} params.min_transacciones - Minimo transacciones
   */
  getCosts: (params = {}) =>
    api.get(`${BASE_URL}/kpis/costs`, { params }),

  // ==================== RESUMEN ====================

  /**
   * Obtiene resumen por centro
   */
  getSummary: () =>
    api.get(`${BASE_URL}/summary`),

  /**
   * Obtiene pipeline de conversion
   */
  getPipeline: () =>
    api.get(`${BASE_URL}/pipeline`),

  // ==================== ANALYTICS ====================

  /**
   * Obtiene analytics consolidado del impacto de procurement
   * Incluye volumenes, lead times, OTIF, top proveedores, distribucion por centro
   */
  getAnalytics: () =>
    api.get(`${BASE_URL}/analytics`),

  // ==================== SCORECARD Y PRECIOS ====================

  /**
   * Obtiene scorecard de un proveedor
   * @param {string} proveedor - CUIT o nombre
   * @param {Object} params
   * @param {string} params.periodo - 'mes', 'trimestre', 'anio'
   */
  getScorecard: (proveedor, params = {}) =>
    api.get(`${BASE_URL}/scorecard/${encodeURIComponent(proveedor)}`, { params }),

  /**
   * Obtiene historial de precios de un material
   * @param {string} materialCodigo - Código del material
   * @param {Object} params
   * @param {string} params.centro - Filtrar por centro
   * @param {string} params.moneda - Filtrar por moneda
   * @param {number} params.limit - Máximo registros
   */
  getPriceHistory: (materialCodigo, params = {}) =>
    api.get(`${BASE_URL}/price-history/${encodeURIComponent(materialCodigo)}`, { params }),

  // ==================== IMPORTACION ====================

  /**
   * Importa archivo ZM65.xlsx
   * @param {File} file - Archivo Excel
   */
  importFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`${BASE_URL}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  /**
   * Obtiene historial de importaciones
   * @param {number} limit - Limite de registros
   */
  getImportHistory: (limit = 20) =>
    api.get(`${BASE_URL}/import/history`, { params: { limit } }),
};

export default procurementService;
