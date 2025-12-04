import AdminCrudTemplate from '../../components/AdminCrudTemplate'

export default function AdminSectores() {
  return (
    <AdminCrudTemplate
      title="Sectores"
      resource="sectores"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No') }
      ]}
      fields={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'descripcion', label: 'Descripción' },
        { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: 1, placeholder: 'Disponible' }
      ]}
    />
  )
}
