import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { Badge } from '../../components/ui/Badge'
import { useI18n } from '../../context/i18n'

export default function AdminCentros() {
  const { t } = useI18n();

  return (
    <AdminCrudTemplate
      title={t("admin_centros", "Centros")}
      resource="centros"
      idKey="codigo"
      columns={[
        { key: 'codigo', label: t("admin_codigo", "Código") },
        { key: 'nombre', label: t("admin_nombre", "Nombre") },
        {
          key: 'activo',
          label: t("admin_activo", "Estado"),
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
        { name: 'codigo', label: t("admin_codigo", "Código"), required: true, placeholder: 'Ej: AA107' },
        { name: 'nombre', label: t("admin_nombre", "Nombre"), placeholder: 'Nombre descriptivo del centro' },
        { name: 'activo', label: t("admin_activo", "Activo"), type: 'checkbox', defaultValue: 1, placeholder: t("admin_disponible", "Disponible") }
      ]}
    />
  )
}
