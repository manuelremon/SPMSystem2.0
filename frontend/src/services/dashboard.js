/**
 * Dashboard Service - API para sistema de dashboards editables
 */

import api from './api';

const BASE_URL = '/dashboards';

/**
 * Dashboard CRUD
 */
export const dashboardService = {
  /**
   * Lista todos los dashboards accesibles por el usuario
   */
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.grupo_id) queryParams.append('grupo_id', params.grupo_id);
    if (params.include_shared !== undefined) {
      queryParams.append('include_shared', params.include_shared);
    }
    const query = queryParams.toString();
    const response = await api.get(`${BASE_URL}${query ? `?${query}` : ''}`);
    return response.data;
  },

  /**
   * Obtiene un dashboard por UUID con todas sus hojas
   */
  get: async (uuid) => {
    const response = await api.get(`${BASE_URL}/${uuid}`);
    return response.data;
  },

  /**
   * Crea un nuevo dashboard
   */
  create: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  /**
   * Actualiza un dashboard
   */
  update: async (uuid, data) => {
    const response = await api.put(`${BASE_URL}/${uuid}`, data);
    return response.data;
  },

  /**
   * Elimina un dashboard
   */
  delete: async (uuid) => {
    const response = await api.delete(`${BASE_URL}/${uuid}`);
    return response.data;
  },

  /**
   * Toggle favorito
   */
  toggleFavorite: async (uuid) => {
    const response = await api.post(`${BASE_URL}/${uuid}/favorite`);
    return response.data;
  },

  /**
   * Exporta a Excel
   */
  exportExcel: async (uuid) => {
    const response = await api.post(
      `${BASE_URL}/${uuid}/export`,
      { formato: 'xlsx' },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

/**
 * Sheets (hojas de calculo)
 */
export const sheetService = {
  /**
   * Actualiza los datos de una hoja
   */
  update: async (sheetId, data) => {
    const response = await api.put(`${BASE_URL}/sheets/${sheetId}`, { data });
    return response.data;
  },

  /**
   * Agrega una nueva hoja
   */
  add: async (dashboardUuid, nombre) => {
    const response = await api.post(`${BASE_URL}/${dashboardUuid}/sheets`, { nombre });
    return response.data;
  },

  /**
   * Elimina una hoja
   */
  delete: async (sheetId) => {
    const response = await api.delete(`${BASE_URL}/sheets/${sheetId}`);
    return response.data;
  },
};

/**
 * Comparticion
 */
export const shareService = {
  /**
   * Crea un link de comparticion
   */
  create: async (dashboardUuid, options = {}) => {
    const response = await api.post(`${BASE_URL}/${dashboardUuid}/share`, options);
    return response.data;
  },

  /**
   * Lista los links de comparticion
   */
  list: async (dashboardUuid) => {
    const response = await api.get(`${BASE_URL}/${dashboardUuid}/shares`);
    return response.data;
  },

  /**
   * Revoca un link
   */
  revoke: async (shareId) => {
    const response = await api.delete(`${BASE_URL}/shares/${shareId}`);
    return response.data;
  },

  /**
   * Accede a un dashboard compartido
   */
  access: async (token, password = null) => {
    if (password) {
      const response = await api.post(`/shared/${token}`, { password });
      return response.data;
    }
    const response = await api.get(`/shared/${token}`);
    return response.data;
  },
};

/**
 * Fuentes de datos
 */
export const datasourceService = {
  /**
   * Agrega una fuente de datos
   */
  add: async (dashboardUuid, data) => {
    const response = await api.post(`${BASE_URL}/${dashboardUuid}/datasources`, data);
    return response.data;
  },

  /**
   * Elimina una fuente de datos
   */
  delete: async (datasourceId) => {
    const response = await api.delete(`${BASE_URL}/datasources/${datasourceId}`);
    return response.data;
  },
};

/**
 * Formulas SPM
 */
export const formulaService = {
  /**
   * Obtiene el catalogo de formulas
   */
  getCatalog: async () => {
    const response = await api.get('/dashboard-functions/catalog');
    return response.data;
  },

  /**
   * Ejecuta una formula
   */
  execute: async (formula, params = []) => {
    const response = await api.post('/dashboard-functions/execute', { formula, params });
    return response.data;
  },
};

/**
 * Grupos
 */
export const grupoService = {
  /**
   * Lista todos los grupos
   */
  list: async (includePublic = true) => {
    const response = await api.get(`/dashboard-grupos?include_public=${includePublic}`);
    return response.data;
  },

  /**
   * Crea un grupo
   */
  create: async (data) => {
    const response = await api.post('/dashboard-grupos', data);
    return response.data;
  },

  /**
   * Elimina un grupo
   */
  delete: async (grupoId) => {
    const response = await api.delete(`/dashboard-grupos/${grupoId}`);
    return response.data;
  },
};

/**
 * Permisos
 */
export const permisoService = {
  /**
   * Lista permisos de un dashboard
   */
  list: async (dashboardUuid) => {
    const response = await api.get(`${BASE_URL}/${dashboardUuid}/permisos`);
    return response.data;
  },

  /**
   * Otorga permiso
   */
  grant: async (dashboardUuid, usuarioId, permiso = 'view') => {
    const response = await api.post(`${BASE_URL}/${dashboardUuid}/permisos`, {
      usuario_id: usuarioId,
      permiso,
    });
    return response.data;
  },

  /**
   * Revoca permiso
   */
  revoke: async (dashboardUuid, usuarioId) => {
    const response = await api.delete(`${BASE_URL}/${dashboardUuid}/permisos/${usuarioId}`);
    return response.data;
  },
};

export default {
  dashboard: dashboardService,
  sheet: sheetService,
  share: shareService,
  datasource: datasourceService,
  formula: formulaService,
  grupo: grupoService,
  permiso: permisoService,
};
