import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { useI18n } from '../../context/i18n'

export default function AdminAlmacenes() {
  const { t } = useI18n();

  return (
    <AdminCrudTemplate
      title={t("admin_almacenes", "Almacenes")}
      resource="almacenes"
      columns={[
        { key: 'id', label: t("admin_id", "ID") },
        { key: 'codigo', label: t("admin_codigo", "Código") },
        { key: 'nombre', label: t("admin_nombre", "Nombre") },
        { key: 'centro_codigo', label: t("common_centro", "Centro") },
        { key: 'activo', label: t("admin_activo", "Activo"), render: (r) => (r.activo ? t("admin_si", "Sí") : t("admin_no", "No")) }
      ]}
      fields={[
        { name: 'codigo', label: t("admin_codigo", "Código"), required: true },
        { name: 'nombre', label: t("admin_nombre", "Nombre") },
        { name: 'centro_codigo', label: t("admin_centro_codigo", "Centro Código") },
        { name: 'descripcion', label: t("admin_descripcion", "Descripción") },
        { name: 'activo', label: t("admin_activo", "Activo"), type: 'checkbox', defaultValue: 1, placeholder: t("admin_disponible", "Disponible") }
      ]}
    />
  )
}
