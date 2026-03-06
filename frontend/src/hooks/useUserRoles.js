import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';

/**
 * Reusable hook for role-based access checks.
 * Extracts role parsing logic from HeaderNav.jsx for use across components.
 */
export function useUserRoles() {
  const user = useAuthStore(s => s.user);

  const getUserRoles = useCallback(() => {
    if (!user?.rol) return [];
    const rolStr = String(user.rol);
    if (rolStr.startsWith('[')) {
      try {
        const parsed = JSON.parse(rolStr);
        return Array.isArray(parsed) ? parsed : [rolStr];
      } catch {
        return [rolStr];
      }
    }
    return [rolStr];
  }, [user?.rol]);

  const hasRole = useCallback((targetRole) => {
    const roles = getUserRoles();
    return roles.some(r => String(r).toLowerCase().includes(targetRole.toLowerCase()));
  }, [getUserRoles]);

  return useMemo(() => ({
    hasRole,
    isAdmin: hasRole('admin'),
    isPlanner: hasRole('planificador'),
    isCoordinador: hasRole('coordinador'),
    isJefe: hasRole('jefe'),
    isUsuario: !hasRole('admin') && !hasRole('planificador') && !hasRole('coordinador') && !hasRole('jefe'),
    isBudgetApprover: hasRole('aprobador presupuestos') || hasRole('aprobador_presupuestos') || hasRole('aprobador de presupuesto'),
    isRequestApprover: hasRole('aprobador solicitudes') || hasRole('aprobador_solicitudes'),
    isGerente: hasRole('gerente'),
    canApprove: hasRole('admin') || hasRole('jefe') || hasRole('coordinador') || hasRole('aprobador solicitudes') || hasRole('aprobador_solicitudes') || hasRole('gerente'),
    canSeePlanner: hasRole('planificador') || hasRole('admin'),
    canSeeBudget: hasRole('admin') || hasRole('jefe') || hasRole('coordinador') || hasRole('aprobador presupuestos') || hasRole('aprobador_presupuestos') || hasRole('aprobador de presupuesto'),
  }), [hasRole]);
}
