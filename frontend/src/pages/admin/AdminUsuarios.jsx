import { useEffect, useState } from 'react'
import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'
import { admin } from '../../services/spm'
import { User, Briefcase, Building2, Shield } from '../../components/ui/Icons'

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUsuarios = async () => {
      try {
        const res = await admin.list('usuarios')
        const data = Array.isArray(res.data) ? res.data : []
        setUsuarios(data)
      } catch (err) {
        console.error('Error cargando usuarios:', err)
      } finally {
        setLoading(false)
      }
    }
    loadUsuarios()
  }, [])

  // Convertir usuarios a opciones para selects (filtrados por posicion/puesto)
  const usuariosOptions = usuarios.map(u => ({
    value: u.id_spm,
    label: `${u.nombre} ${u.apellido} (${u.id_spm})`.trim(),
    posicion: u.posicion
  }))

  // Filtrar por posicion (usando valores del catalog_puestos)
  const jefesOptions = usuariosOptions.filter(u => u.posicion?.toLowerCase() === 'jefe')
  const gerentes1Options = usuariosOptions.filter(u => u.posicion?.toLowerCase() === 'gerente1')
  const gerentes2Options = usuariosOptions.filter(u => u.posicion?.toLowerCase() === 'gerente2')

  if (loading) {
    return <div className="p-6">Cargando...</div>
  }

  return (
    <AdminCrudTemplate
      title="Usuarios"
      resource="usuarios"
      idKey="id_spm"
      columns={[
        { key: 'id_spm', label: 'ID SPM' },
        {
          key: 'nombre',
          label: 'Nombre Completo',
          render: (row) => `${row.nombre} ${row.apellido}`.trim() || '-'
        },
        {
          key: 'roles',
          label: 'Roles',
          render: (row) => {
            const rolMap = {
              'administrador': { bg: '#dc2626', text: '#ffffff' },
              'admin': { bg: '#dc2626', text: '#ffffff' },
              'planificador': { bg: '#2563eb', text: '#ffffff' },
              'solicitante': { bg: '#16a34a', text: '#ffffff' },
              'aprobador_solicitudes': { bg: '#d97706', text: '#ffffff' },
              'aprobador_presupuestos': { bg: '#0891b2', text: '#ffffff' },
            };

            // Convertir roles a array si es string JSON
            let roles = row.roles || row.rol || [];
            if (typeof roles === 'string') {
              try {
                roles = JSON.parse(roles);
              } catch {
                roles = [roles];
              }
            }
            if (!Array.isArray(roles)) {
              roles = [roles];
            }

            return (
              <div className="flex flex-wrap gap-1">
                {roles.length > 0 ? (
                  roles.map((rol, idx) => {
                    const config = rolMap[rol?.toLowerCase()] || { bg: '#64748b', text: '#ffffff' };
                    return (
                      <Badge
                        key={idx}
                        style={{ backgroundColor: config.bg, color: config.text }}
                        className="uppercase text-xs font-semibold"
                      >
                        {rol}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500">Sin roles</span>
                )}
              </div>
            );
          }
        },
        { key: 'mail', label: 'Email' },
        { key: 'posicion', label: 'Puesto' },
        {
          key: 'sector',
          label: 'Sector',
          render: (row) => {
            const sectorMap = {
              '1': 'Almacenes',
              '2': 'Compras',
              '3': 'Mantenimiento',
              '4': 'Planificación',
              '5': 'Operaciones',
              '6': 'Logística',
              '7': 'Producción',
              '8': 'Calidad',
            };
            return sectorMap[row.sector] || row.sector || '-';
          }
        },
        { key: 'id_ypf', label: 'ID YPF' },
        {
          key: 'estado_registro',
          label: 'Estado',
          render: (row) => {
            const isActivo = row.estado_registro?.toLowerCase() === 'activo';
            return (
              <Badge
                variant={isActivo ? 'success' : 'neutral'}
                className="uppercase text-xs"
              >
                {row.estado_registro || 'Inactivo'}
              </Badge>
            );
          }
        }
      ]}
      fields={[
        // ═══════════════════════════════════════════════════════════════
        // SECCIÓN 1: INFORMACIÓN PERSONAL
        // ═══════════════════════════════════════════════════════════════
        {
          name: 'section_personal',
          type: 'section',
          label: 'Información Personal',
          description: 'Datos básicos de identificación del usuario',
          icon: User
        },
        {
          name: 'id_spm',
          label: 'ID SPM',
          required: true,
          placeholder: 'Ej: usuario123'
        },
        {
          name: 'nombre',
          label: 'Nombre',
          required: true,
          placeholder: 'Ej: Juan'
        },
        {
          name: 'apellido',
          label: 'Apellido',
          required: true,
          placeholder: 'Ej: Pérez'
        },
        {
          name: 'mail',
          label: 'Email Principal',
          required: true,
          type: 'email',
          placeholder: 'usuario@empresa.com'
        },
        {
          name: 'mail_respaldo',
          label: 'Email de Respaldo',
          type: 'email',
          placeholder: 'Email secundario de contacto'
        },
        {
          name: 'telefono',
          label: 'Teléfono',
          type: 'tel',
          placeholder: '+54 9 11 1234-5678'
        },

        // ═══════════════════════════════════════════════════════════════
        // SECCIÓN 2: INFORMACIÓN LABORAL
        // ═══════════════════════════════════════════════════════════════
        {
          name: 'section_laboral',
          type: 'section',
          label: 'Información Laboral',
          description: 'Posición, sector y permisos del usuario',
          icon: Briefcase
        },
        {
          name: 'posicion',
          label: 'Puesto',
          required: true,
          type: 'select',
          options: [
            { value: 'Planificador', label: 'Planificador' },
            { value: 'Jefe', label: 'Jefe' },
            { value: 'Gerente1', label: 'Gerente Nivel 1' },
            { value: 'Gerente2', label: 'Gerente Nivel 2' },
            { value: 'Director', label: 'Director' },
            { value: 'Supervisor', label: 'Supervisor' },
            { value: 'Analista', label: 'Analista' },
            { value: 'Coordinador', label: 'Coordinador' },
          ],
          defaultValue: 'Analista',
          placeholder: 'Selecciona el puesto'
        },
        {
          name: 'id_ypf',
          label: 'ID YPF',
          placeholder: 'Identificador YPF del usuario'
        },
        {
          name: 'sector',
          label: 'Sector',
          type: 'select',
          options: [
            { value: '1', label: 'Almacenes' },
            { value: '2', label: 'Compras' },
            { value: '3', label: 'Mantenimiento' },
            { value: '4', label: 'Planificación' },
            { value: '5', label: 'Operaciones' },
            { value: '6', label: 'Logística' },
            { value: '7', label: 'Producción' },
            { value: '8', label: 'Calidad' },
          ],
          placeholder: 'Selecciona un sector'
        },
        {
          name: 'roles',
          label: 'Roles del Sistema',
          required: true,
          type: 'checkbox-group',
          options: [
            {
              value: 'solicitante',
              label: 'Solicitante',
              description: 'Puede crear y gestionar solicitudes de materiales'
            },
            {
              value: 'aprobador_solicitudes',
              label: 'Aprobador de Solicitudes',
              description: 'Puede aprobar o rechazar solicitudes de materiales'
            },
            {
              value: 'aprobador_presupuestos',
              label: 'Aprobador de Presupuestos',
              description: 'Puede aprobar incorporaciones de presupuesto'
            },
            {
              value: 'planificador',
              label: 'Planificador',
              description: 'Puede planificar y gestionar el despacho de solicitudes'
            },
            {
              value: 'administrador',
              label: 'Administrador',
              description: 'Acceso completo al sistema'
            },
          ],
          placeholder: 'Un usuario puede tener múltiples roles según sus responsabilidades',
          defaultValue: ['solicitante'],
          fullWidth: true
        },

        // ═══════════════════════════════════════════════════════════════
        // SECCIÓN 3: ASIGNACIONES
        // ═══════════════════════════════════════════════════════════════
        {
          name: 'section_asignaciones',
          type: 'section',
          label: 'Asignaciones',
          description: 'Centros, almacenes y jerarquía organizacional',
          icon: Building2
        },
        {
          name: 'centros',
          label: 'Centros Autorizados',
          placeholder: 'Ej: 1008,1064,1100 (separados por comas)',
          fullWidth: true
        },
        {
          name: 'almacenes',
          label: 'Almacenes Autorizados',
          placeholder: 'Ej: ALM001,ALM002 (separados por comas)',
          fullWidth: true
        },
        {
          name: 'jefe',
          label: 'Jefe Directo',
          type: 'select',
          options: jefesOptions,
          placeholder: jefesOptions.length > 0 ? 'Selecciona el jefe directo' : 'No hay usuarios con puesto Jefe'
        },
        {
          name: 'gerente1',
          label: 'Gerente Nivel 1',
          type: 'select',
          options: gerentes1Options,
          placeholder: gerentes1Options.length > 0 ? 'Selecciona el gerente nivel 1' : 'No hay usuarios con puesto Gerente Nivel 1'
        },
        {
          name: 'gerente2',
          label: 'Gerente Nivel 2',
          type: 'select',
          options: gerentes2Options,
          placeholder: gerentes2Options.length > 0 ? 'Selecciona el gerente nivel 2' : 'No hay usuarios con puesto Gerente Nivel 2'
        },

        // ═══════════════════════════════════════════════════════════════
        // SECCIÓN 4: CONFIGURACIÓN DE CUENTA
        // ═══════════════════════════════════════════════════════════════
        {
          name: 'section_cuenta',
          type: 'section',
          label: 'Configuración de Cuenta',
          description: 'Estado y credenciales de acceso',
          icon: Shield
        },
        {
          name: 'estado_registro',
          label: 'Estado de la Cuenta',
          required: true,
          type: 'select',
          options: [
            { value: 'Activo', label: 'Activo' },
            { value: 'Inactivo', label: 'Inactivo' },
            { value: 'Suspendido', label: 'Suspendido' },
          ],
          defaultValue: 'Activo'
        },
        {
          name: 'contrasena',
          label: 'Contraseña',
          required: true,
          type: 'password',
          defaultValue: 'Temporal2024!',
          placeholder: 'Contraseña temporal (el usuario debe cambiarla)'
        }
      ]}
    />
  )
}
