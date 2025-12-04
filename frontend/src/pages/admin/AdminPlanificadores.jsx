import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { admin } from '../../services/spm'

const parseAsignaciones = (text) => {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [centro, sector, almacen_virtual] = line.split(',').map((v) => v?.trim())
      return { centro, sector, almacen_virtual }
    })
}

export default function AdminPlanificadores() {
  return (
    <AdminCrudTemplate
      title="Planificadores"
      resource="planificadores"
      idKey="usuario_id"
      parseList={(data) => {
        const planners = data?.planificadores || []
        const asign = data?.asignaciones || []
        return planners.map((p) => {
          const rows = asign.filter((a) => a.planificador_id === p.usuario_id)
          return {
            ...p,
            asignaciones_text: rows.map((r) => `${r.centro || ''}, ${r.sector || ''}, ${r.almacen_virtual || ''}`).join('\n')
          }
        })
      }}
      fields={[
        { name: 'usuario_id', label: 'Usuario ID', required: true },
        { name: 'nombre', label: 'Nombre visible' },
        { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: 1, placeholder: 'Habilitado' },
        {
          name: 'asignaciones_text',
          label: 'Asignaciones (una por línea: centro,sector,almacen)',
          type: 'textarea',
          placeholder: '1008, SEC1, 0001'
        }
      ]}
      columns={[
        { key: 'usuario_id', label: 'Usuario' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No') },
        { key: 'asignaciones_text', label: 'Asignaciones' }
      ]}
      transformSubmit={(form) => ({
        usuario_id: form.usuario_id,
        nombre: form.nombre,
        activo: form.activo,
        asignaciones: parseAsignaciones(form.asignaciones_text)
      })}
      customUpdate={(id, payload) => admin.update('planificadores', id, payload)}
    />
  )
}
