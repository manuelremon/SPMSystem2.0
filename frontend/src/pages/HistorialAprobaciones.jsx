import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { useI18n } from "../context/i18n";

export default function HistorialAprobaciones() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title="HISTORIAL DE APROBACIONES"
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Aprobaciones", to: "/aprobaciones" },
          { label: "Historial" }
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("historial_title", "Historial de Aprobaciones")}</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="text-center py-12">
            <p className="text-[var(--fg-muted)]">
              {t("historial_coming_soon", "Vista de historial de aprobaciones próximamente...")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
