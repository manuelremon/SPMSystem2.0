import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'

export default function AdminSectores() {
  return (
    <AdminCrudTemplate
      title="Sectores"
      resource="sectores"
      idKey="nombre"
      columns={[
        { key: 'nombre', label: 'Nombre del Sector' },
        {
          key: 'activo',
          label: 'Estado',
          render: (row) => {
            const isActivo = row.activo === 1 || row.activo === true;
            return (
              <Badge variant={isActivo ? 'success' : 'default'} className="uppercase text-[10px]">
                {isActivo ? 'Activo' : 'Inactivo'}
              </Badge>
            );
          }
        },
        { key: 'created_at', label: 'Creado' }
      ]}
      fields={[
        {
          name: 'nombre',
          label: 'Nombre del Sector',
          required: true,
          type: 'select',
          options: [
            { value: 'Almacenes', label: 'Almacenes' },
            { value: 'Compras', label: 'Compras' },
            { value: 'Mantenimiento', label: 'Mantenimiento' },
            { value: 'Planificación', label: 'Planificación' },
            { value: 'Operaciones', label: 'Operaciones' },
            { value: 'Logística', label: 'Logística' },
            { value: 'Producción', label: 'Producción' },
            { value: 'Calidad', label: 'Calidad' },
          ],
          placeholder: 'Selecciona el sector',
          fullWidth: true
        },
        {
          name: 'activo',
          label: 'Activo',
          type: 'checkbox',
          defaultValue: 1,
          placeholder: 'Sector disponible'
        }
      ]}
    />
  )
}
