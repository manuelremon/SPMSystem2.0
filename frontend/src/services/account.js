import api from './api'

const authHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const getProfile = () => api.get('/mi-cuenta', { headers: authHeaders() })

export const getProfileChanges = () =>
  api.get('/mi-cuenta/solicitudes-cambio-perfil', { headers: authHeaders() })

export const updatePassword = (payload) =>
  api.put('/mi-cuenta/password', payload, { headers: authHeaders() })

export const updateContact = (payload) =>
  api.put('/mi-cuenta/contacto', payload, { headers: authHeaders() })

export const requestProfileChange = (payload) =>
  api.post('/mi-cuenta/solicitud-cambio-perfil', payload, { headers: authHeaders() })

export const cancelProfileRequest = (requestId) =>
  api.post(`/mi-cuenta/solicitudes-cambio-perfil/${requestId}/cancelar`, {}, { headers: authHeaders() })

export const sendMessageToAdmin = (requestId, payload) =>
  api.post(`/mi-cuenta/solicitudes-cambio-perfil/${requestId}/mensaje`, payload, { headers: authHeaders() })

export const catalogs = {
  sectores: () => api.get('/catalogos/sectores', { headers: authHeaders() }),
  centros: () => api.get('/catalogos/centros', { headers: authHeaders() }),
  almacenes: () => api.get('/catalogos/almacenes', { headers: authHeaders() }),
  usuarios: () => api.get('/catalogos/usuarios', { headers: authHeaders() }),
}
