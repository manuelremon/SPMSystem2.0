import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'
import { useI18n } from '../../context/i18n'

export default function AdminRoles() {
  const { t } = useI18n();

  return (
    <AdminCrudTemplate
      title={t("admin_roles", "Roles")}
      resource="roles"
      idKey="nombre"
      columns={[
        { key: 'nombre', label: t("admin_nombre_rol", "Nombre del Rol") },
        {
          key: 'activo',
          label: t("admin_estado", "Estado"),
          render: (row) => {
            const isActivo = row.activo === 1 || row.activo === true;
            return (
              <Badge variant={isActivo ? 'success' : 'default'} className="uppercase text-[10px]">
                {isActivo ? 'Activo' : 'Inactivo'}
              </Badge>
            );
          }
        },
        { key: 'created_at', label: t("admin_creado", "Creado") }
      ]}
      fields={[
        {
          name: 'nombre',
          label: t("admin_nombre_rol", "Nombre del Rol"),
          required: true,
          type: 'select',
          options: [
            { value: 'solicitante', label: 'Solicitante' },
            { value: 'aprobador_solicitudes', label: 'Aprobador de Solicitudes' },
            { value: 'aprobador_presupuestos', label: 'Aprobador de Presupuestos' },
            { value: 'planificador', label: 'Planificador' },
            { value: 'administrador', label: 'Administrador' },
          ],
          placeholder: t("admin_selecciona_rol", "Selecciona el rol"),
          fullWidth: true
        },
        {
          name: 'activo',
          label: t("admin_activo", "Activo"),
          type: 'checkbox',
          defaultValue: 1,
          placeholder: t("admin_rol_disponible", "Rol disponible para asignacion")
        }
      ]}
    />
  )
}
