import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'

export default function AdminRoles() {
  return (
    <AdminCrudTemplate
      title="Roles"
      resource="roles"
      idKey="id"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'nombre', label: 'Nombre del Rol' },
        { key: 'codigo', label: 'Código' },
        {
          key: 'permisos',
          label: 'Permisos',
          render: (row) => {
            const permisos = row.permisos || [];
            const permisosArray = typeof permisos === 'string' ? JSON.parse(permisos) : permisos;
            return (
              <div className="flex flex-wrap gap-1">
                {permisosArray.length > 0 ? (
                  permisosArray.slice(0, 3).map((permiso, idx) => (
                    <Badge key={idx} variant="neutral" className="text-xs">
                      {permiso}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-[var(--fg-muted)]">Sin permisos</span>
                )}
                {permisosArray.length > 3 && (
                  <Badge variant="neutral" className="text-xs">
                    +{permisosArray.length - 3}
                  </Badge>
                )}
              </div>
            );
          }
        },
        {
          key: 'activo',
          label: 'Estado',
          render: (row) => {
            const isActivo = row.activo === 1 || row.activo === true;
            return (
              <Badge variant={isActivo ? 'success' : 'neutral'} className="uppercase text-xs">
                {isActivo ? 'Activo' : 'Inactivo'}
              </Badge>
            );
          }
        }
      ]}
      fields={[
        {
          name: 'nombre',
          label: 'Nombre del Rol',
          required: true,
          placeholder: 'Ej: Aprobador de Solicitudes, Aprobador de Presupuestos',
          fullWidth: true
        },
        {
          name: 'codigo',
          label: 'Código',
          required: true,
          placeholder: 'Ej: aprobador_solicitudes, aprobador_presupuestos (minúsculas, sin espacios)',
          fullWidth: false
        },
        {
          name: 'descripcion',
          label: 'Descripción',
          type: 'textarea',
          placeholder: 'Descripción de las responsabilidades del rol',
          fullWidth: true
        },
        {
          name: 'nivel_autorizacion',
          label: 'Nivel de Autorización',
          type: 'select',
          options: [
            { value: '1', label: '1 - Básico (Solicitante)' },
            { value: '2', label: '2 - Intermedio (Aprobador)' },
            { value: '3', label: '3 - Avanzado (Planificador)' },
            { value: '4', label: '4 - Administrador' },
          ],
          defaultValue: '1',
          placeholder: 'Selecciona el nivel de autorización'
        },
        {
          name: 'activo',
          label: 'Activo',
          type: 'checkbox',
          defaultValue: 1,
          placeholder: 'Rol disponible para asignación'
        }
      ]}
    />
  )
}
