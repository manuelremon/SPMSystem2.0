import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { useI18n } from '../../context/i18n'

export default function AdminMateriales() {
  const { t } = useI18n()
  return (
    <AdminCrudTemplate
      title={t('admin_mat_title', 'Materiales')}
      resource="materiales"
      idKey="codigo"
      columns={[
        { key: 'codigo', label: t('admin_mat_codigo', 'Código') },
        { key: 'descripcion', label: t('admin_mat_descripcion', 'Descripción') },
        { key: 'unidad', label: t('admin_mat_unidad', 'Unidad') },
        { key: 'precio_usd', label: t('admin_mat_precio_usd', 'Precio USD') }
      ]}
      fields={[
        { name: 'codigo', label: t('admin_mat_codigo_sap', 'Código SAP'), required: true, placeholder: '1000000001' },
        { name: 'descripcion', label: t('admin_mat_descripcion', 'Descripción'), required: true, placeholder: t('admin_mat_descripcion_placeholder', 'Descripción breve del material') },
        { name: 'descripcion_larga', label: t('admin_mat_descripcion_larga', 'Descripción Larga'), type: 'textarea', placeholder: t('admin_mat_descripcion_larga_placeholder', 'Descripción detallada del material') },
        { name: 'unidad', label: t('admin_mat_unidad_medida', 'Unidad de Medida'), required: true, defaultValue: 'UNI', placeholder: 'UNI, KG, L, M, etc.' },
        { name: 'precio_usd', label: t('admin_mat_precio_label', 'Precio (USD)'), type: 'number', required: true, defaultValue: 0, placeholder: '0.00' }
      ]}
    />
  )
}
