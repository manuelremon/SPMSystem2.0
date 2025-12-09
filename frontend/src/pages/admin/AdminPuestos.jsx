import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'

export default function AdminPuestos() {
  return (
    <AdminCrudTemplate
      title="Puestos"
      resource="puestos"
      idKey="nombre"
      columns={[
        { key: 'nombre', label: 'Nombre del Puesto' },
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
        },
        { key: 'created_at', label: 'Creado' }
      ]}
      fields={[
        {
          name: 'nombre',
          label: 'Nombre del Puesto',
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
          placeholder: 'Selecciona el puesto',
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
