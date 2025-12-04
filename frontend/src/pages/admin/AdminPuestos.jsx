import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'

export default function AdminPuestos() {
  return (
    <AdminCrudTemplate
      title="Puestos"
      resource="puestos"
      idKey="id"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'nombre', label: 'Nombre del Puesto' },
        { key: 'nivel_jerarquico', label: 'Nivel Jerárquico' },
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
          label: 'Nombre del Puesto',
          required: true,
          placeholder: 'Ej: Jefe de Sector, Gerente Regional, etc.',
          fullWidth: true
        },
        {
          name: 'nivel_jerarquico',
          label: 'Nivel Jerárquico',
          required: true,
          type: 'select',
          options: [
            { value: '1', label: '1 - Empleado/Operario' },
            { value: '2', label: '2 - Jefe/Supervisor' },
            { value: '3', label: '3 - Gerente Nivel 1' },
            { value: '4', label: '4 - Gerente Nivel 2' },
            { value: '5', label: '5 - Director' },
            { value: '6', label: '6 - Ejecutivo' },
          ],
          defaultValue: '1',
          placeholder: 'Selecciona el nivel jerárquico'
        },
        {
          name: 'descripcion',
          label: 'Descripción',
          type: 'textarea',
          placeholder: 'Descripción de las responsabilidades del puesto (opcional)',
          fullWidth: true
        },
        {
          name: 'activo',
          label: 'Activo',
          type: 'checkbox',
          defaultValue: 1,
          placeholder: 'Puesto disponible para asignación'
        }
      ]}
    />
  )
}
