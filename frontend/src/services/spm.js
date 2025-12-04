import api from './api'

export const solicitudes = {
  listar: (params = {}) => api.get('/solicitudes', { params }),
  obtener: (id) => api.get(`/solicitudes/${id}`),
  crear: (payload) => api.post('/solicitudes', payload),
  crearConArchivos: (formData) => api.post('/solicitudes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  guardarBorrador: (id, items, total) =>
    api.patch(`/solicitudes/${id}/draft`, { items, total_monto: total }),
  finalizar: (id, payload) => api.put(`/solicitudes/${id}/enviar`, payload),
  aprobar: (id) => api.put(`/solicitudes/${id}/aprobar`),
  rechazar: (id, motivo) => api.put(`/solicitudes/${id}/rechazar`, { motivo }),
  eliminar: (id) => api.delete(`/solicitudes/${id}`),
}

export const materiales = {
  listar: (q) => api.get('/materiales', { params: q }),
  buscar: ({ codigo = '', descripcion = '', limit = 500 } = {}) =>
    api.get('/materiales', { params: { codigo, descripcion, limit } }),
  detalle: (codigo, params = {}) => api.get(`/materiales/${codigo}/detalle`, { params }),
}

export const planner = {
  stats: () => api.get('/planificador/dashboard'),
  listar: (params={}) => api.get('/planificador/solicitudes', { params }),
  aceptar: (id) => api.post(`/planificador/solicitudes/${id}/aceptar`),
  finalizar: (id) => api.post(`/planificador/solicitudes/${id}/finalizar`),
  guardarItems: (id, payload) => api.patch(`/planificador/solicitudes/${id}/items`, payload),
}

export const admin = {
  list: (resource) => api.get(`/admin/${resource}`),
  create: (resource, payload) => api.post(`/admin/${resource}`, payload),
  update: (resource, id, payload) => api.put(`/admin/${resource}/${id}`, payload),
  remove: (resource, id) => api.delete(`/admin/${resource}/${id}`),
  updatePresupuesto: (centro, sector, payload) => api.put(`/admin/presupuestos/${centro}/${sector}`, payload),
  deletePresupuesto: (centro, sector) => api.delete(`/admin/presupuestos/${centro}/${sector}`),
  estado: () => api.get('/admin/estado'),
  metricas: () => api.get('/admin/metricas'),
}

export const budget = {
  // Budget Update Requests
  listar: (params = {}) => api.get('/budget-requests', { params }),
  obtener: (id) => api.get(`/budget-requests/${id}`),
  crear: (payload) => api.post('/budget-requests', payload),
  aprobar: (id, comentario = '') => api.post(`/budget-requests/${id}/aprobar`, { comentario }),
  rechazar: (id, motivo) => api.post(`/budget-requests/${id}/rechazar`, { motivo }),
  pendientes: () => api.get('/budget-requests/pendientes'),
  // Budget info
  getInfo: (centro, sector) => api.get(`/presupuesto/${centro}/${sector}`),
  getLedger: (params = {}) => api.get('/presupuesto-ledger', { params }),
}
