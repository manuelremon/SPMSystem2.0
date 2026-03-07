import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { useI18n } from '../../context/i18n'

export default function AdminMateriales() {
  const { t } = useI18n()
  return (
    <AdminCrudTemplate
      title={t('admin_mat_title', 'Materiales')}
      resource="materiales"
      idKey="codigo_material"
      columns={[
        { key: 'codigo_material', label: t('admin_mat_codigo', 'Código') },
        { key: 'descripcion', label: t('admin_mat_descripcion', 'Descripción') },
        { key: 'centro', label: t('admin_mat_centro', 'Centro') },
        { key: 'almacen', label: t('admin_mat_almacen', 'Almacén') },
        { key: 'sector', label: t('admin_mat_sector', 'Sector') }
      ]}
      fields={[
        { name: 'codigo_material', label: t('admin_mat_codigo_sap', 'Código SAP'), required: true, placeholder: '1000-0000001' },
        { name: 'descripcion', label: t('admin_mat_descripcion', 'Descripción'), required: true, placeholder: t('admin_mat_descripcion_placeholder', 'Descripción del material') },
        { name: 'centro', label: t('admin_mat_centro', 'Centro'), placeholder: '1001' },
        { name: 'almacen', label: t('admin_mat_almacen', 'Almacén'), placeholder: 'AA001' },
        { name: 'sector', label: t('admin_mat_sector', 'Sector'), placeholder: 'MANTENIMIENTO' }
      ]}
    />
  )
}
