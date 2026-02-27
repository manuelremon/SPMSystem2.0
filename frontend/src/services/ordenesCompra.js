/**
 * Ordenes de Compra Service - Internal Purchase Orders
 * Endpoints para gestion de ordenes de compra internas (/api/ordenes-compra)
 */

import api from './api';

const BASE_URL = '/ordenes-compra';

export const ordenesCompraService = {
  /**
   * Lista ordenes de compra con filtros y paginacion
   * @param {Object} params
   * @param {number} params.page - Pagina (default 1)
   * @param {number} params.per_page - Items por pagina (default 20, max 100)
   * @param {string} params.estado - Filtrar por estado
   * @param {string} params.centro - Filtrar por centro
   * @param {string} params.proveedor - Filtrar por CUIT o nombre
   * @param {number} params.contrato_id - Filtrar por contrato
   */
  list: (params = {}) =>
    api.get(BASE_URL, { params }),

  /**
   * Obtiene detalle de una orden con items e historial
   * @param {number} id - ID de la orden
   */
  getById: (id) =>
    api.get(`${BASE_URL}/${id}`),

  /**
   * Crea nueva orden de compra
   * @param {Object} data
   * @param {number} data.solicitud_id - ID solicitud origen (opcional)
   * @param {string} data.proveedor_cuit - CUIT del proveedor
   * @param {string} data.proveedor_nombre - Razon social
   * @param {string} data.centro - Centro de costo
   * @param {Array} data.items - Items de la orden
   * @param {string} data.notas - Notas (opcional)
   * @param {string} data.moneda - Moneda (default ARS)
   */
  create: (data) =>
    api.post(BASE_URL, data),

  /**
   * Cambia estado de una orden
   * @param {number} id - ID de la orden
   * @param {string} estado - Nuevo estado
   * @param {string} razon - Razon del cambio (requerido para cancelacion)
   */
  changeStatus: (id, estado, razon = '') =>
    api.put(`${BASE_URL}/${id}/estado`, { estado, razon }),

  /**
   * Registra recepcion de mercaderia
   * @param {number} id - ID de la orden
   * @param {Object} data
   * @param {Array} data.items - Items recibidos
   * @param {string} data.notas - Notas generales (opcional)
   */
  registerReceipt: (id, data) =>
    api.post(`${BASE_URL}/${id}/recepcion`, data),

  /**
   * Genera OC desde una solicitud existente
   * @param {Object} data
   * @param {number} data.solicitud_id - ID de la solicitud
   * @param {string} data.proveedor_cuit - CUIT del proveedor
   * @param {string} data.proveedor_nombre - Razon social
   */
  createFromSolicitud: (data) =>
    api.post(`${BASE_URL}/desde-solicitud`, data),

  /**
   * Obtiene estadisticas de ordenes
   * @param {Object} params
   * @param {string} params.centro - Filtrar por centro (opcional)
   */
  getStats: (params = {}) =>
    api.get(`${BASE_URL}/estadisticas`, { params }),

  /**
   * Descarga PDF de una orden
   * @param {number} id - ID de la orden
   */
  getPdf: (id) =>
    api.get(`${BASE_URL}/${id}/pdf`, { responseType: 'blob' }),
};

export default ordenesCompraService;
