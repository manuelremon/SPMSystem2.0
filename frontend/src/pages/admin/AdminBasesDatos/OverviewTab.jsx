/**
 * OverviewTab - Vista general de bases de datos
 */

import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { useI18n } from "../../../context/i18n";
import {
  Database,
  RefreshCcw,
  HardDrive,
  ICON_COLORS,
} from "../../../components/ui/Icons";
import { formatSize } from "./useAdminDatabase";

export function OverviewTab({
  loading,
  databases,
  poolStats,
  onRefresh,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onRefresh} disabled={loading}>
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("common_actualizar", "Actualizar")}
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {databases.map((db) => (
            <Card key={db.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className={`w-5 h-5 ${ICON_COLORS.primary}`} />
                    <CardTitle className="text-sm font-semibold uppercase">{db.name}</CardTitle>
                  </div>
                  <Badge variant={db.status === "online" ? "success" : "danger"}>
                    {db.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">Tipo</span>
                  <span className="font-mono">{db.type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">Tamano</span>
                  <span className="font-mono">{formatSize(db.size_mb)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">Tablas</span>
                  <span className="font-mono">{db.tables}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">Registros</span>
                  <span className="font-mono">{db.records?.toLocaleString() || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">Latencia</span>
                  <span className="font-mono">{db.latency_ms} ms</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pool Stats */}
      {poolStats && Object.keys(poolStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className={`w-5 h-5 ${ICON_COLORS.secondary}`} />
              {t("db_pool_stats", "Pool de Conexiones")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(poolStats).map(([name, stats]) => (
                <div key={name} className="p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
                  <p className="text-sm font-medium text-[var(--fg)]">{name}</p>
                  <div className="mt-2 space-y-1 text-xs text-[var(--fg-muted)]">
                    <p>Creadas: {stats.created || 0}</p>
                    <p>Reutilizadas: {stats.reused || 0}</p>
                    <p>Expiradas: {stats.expired || 0}</p>
                    <p>Errores: {stats.errors || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
