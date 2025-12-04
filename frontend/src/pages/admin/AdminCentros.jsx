import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { useI18n } from '../../context/i18n'

export default function AdminCentros() {
  const { t } = useI18n();

  return (
    <AdminCrudTemplate
      title={t("admin_centros", "Centros")}
      resource="centros"
      columns={[
        { key: 'id', label: t("admin_id", "ID") },
        { key: 'codigo', label: t("admin_codigo", "Código") },
        { key: 'nombre', label: t("admin_nombre", "Nombre") },
        { key: 'descripcion', label: t("admin_descripcion", "Descripción") },
        { key: 'activo', label: t("admin_activo", "Activo"), render: (r) => (r.activo ? t("admin_si", "Sí") : t("admin_no", "No")) }
      ]}
      fields={[
        { name: 'codigo', label: t("admin_codigo", "Código"), required: true },
        { name: 'nombre', label: t("admin_nombre", "Nombre") },
        { name: 'descripcion', label: t("admin_descripcion", "Descripción") },
        { name: 'notas', label: t("admin_notas", "Notas") },
        { name: 'activo', label: t("admin_activo", "Activo"), type: 'checkbox', defaultValue: 1, placeholder: t("admin_disponible", "Disponible") }
      ]}
    />
  )
}
