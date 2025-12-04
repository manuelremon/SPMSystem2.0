import AdminCrudTemplate from '../../components/AdminCrudTemplate'

export default function AdminMateriales() {
  return (
    <AdminCrudTemplate
      title="Materiales"
      resource="materiales"
      idKey="codigo"
      columns={[
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'unidad', label: 'Unidad' },
        { key: 'precio_usd', label: 'Precio USD' }
      ]}
      fields={[
        { name: 'codigo', label: 'Código SAP', required: true, placeholder: '1000000001' },
        { name: 'descripcion', label: 'Descripción', required: true, placeholder: 'Descripción breve del material' },
        { name: 'descripcion_larga', label: 'Descripción Larga', type: 'textarea', placeholder: 'Descripción detallada del material' },
        { name: 'unidad', label: 'Unidad de Medida', required: true, defaultValue: 'UNI', placeholder: 'UNI, KG, L, M, etc.' },
        { name: 'precio_usd', label: 'Precio (USD)', type: 'number', required: true, defaultValue: 0, placeholder: '0.00' }
      ]}
    />
  )
}
