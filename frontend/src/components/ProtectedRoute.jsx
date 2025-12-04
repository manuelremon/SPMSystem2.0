import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Loading from './Loading'
import Layout from './Layout'

/**
 * Roles que tienen acceso total (MODO DIOS)
 * Usar igualdad exacta, no substring, para evitar falsos positivos
 */
const ADMIN_ROLES = new Set(['admin', 'administrador', 'administrator', 'superadmin'])

/**
 * Normaliza roles del usuario a un array de strings en minúsculas
 *
 * Soporta múltiples formatos del backend:
 * - JSON array: '["admin", "planner"]'
 * - String simple: "Admin"
 * - Comma-separated: "Admin,Planner"
 * - Semicolon-separated: "Admin;Planner"
 */
const normalizeRoles = (user) => {
  if (!user?.rol) return []

  const rolStr = String(user.rol).trim()
  if (!rolStr) return []

  let roles = []

  // Intentar parsear como JSON array
  if (rolStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(rolStr)
      roles = Array.isArray(parsed) ? parsed : [rolStr]
    } catch {
      roles = [rolStr]
    }
  }
  // Separar por coma o punto y coma
  else if (rolStr.includes(',') || rolStr.includes(';')) {
    roles = rolStr.split(/[,;]/)
  }
  // String simple
  else {
    roles = [rolStr]
  }

  // Normalizar: trim, lowercase, filtrar vacíos
  return roles
    .map(r => String(r).trim().toLowerCase())
    .filter(r => r.length > 0)
}

/**
 * Verifica si el usuario tiene rol de administrador (acceso total)
 */
const isUserAdmin = (normalizedRoles) => {
  return normalizedRoles.some(role => ADMIN_ROLES.has(role))
}

/**
 * Verifica si el usuario tiene alguno de los roles requeridos
 */
const hasRequiredRole = (userRoles, requiredRoles) => {
  const normalizedRequired = requiredRoles.map(r => r.toLowerCase().trim())
  return userRoles.some(userRole =>
    normalizedRequired.some(required =>
      userRole === required || userRole.includes(required)
    )
  )
}

export default function ProtectedRoute({ children, roles }) {
  const { user, isLoading, isAuthenticated } = useAuthStore()

  if (isLoading) {
    return <Loading />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Si se especifican roles requeridos, verificar autorización
  if (roles && roles.length > 0) {
    const userRoles = normalizeRoles(user)

    // Admin tiene acceso total
    if (isUserAdmin(userRoles)) {
      return <Layout>{children}</Layout>
    }

    // Verificar roles específicos
    if (!hasRequiredRole(userRoles, roles)) {
      // Redirigir a dashboard si no tiene permisos
      return <Navigate to="/dashboard" replace />
    }
  }

  return <Layout>{children}</Layout>
}
