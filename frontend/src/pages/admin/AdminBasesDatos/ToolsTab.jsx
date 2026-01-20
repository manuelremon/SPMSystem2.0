/**
 * ToolsTab - Herramientas de administracion de BD
 */

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Select } from "../../../components/ui/Select";
import { useI18n } from "../../../context/i18n";
import {
  RefreshCcw,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  List,
  Zap,
  Shield,
  HardDrive,
  Clock,
  BarChart2,
  Activity,
  History,
  Users,
  Upload,
  ICON_COLORS,
} from "../../../components/ui/Icons";

export function ToolsTab({
  databases,
  selectedDb,
  onDbChange,
  tables,
  selectedTable,
  onTableChange,
  isPostgres,
  isProduction,
  operationLoading,
  integrityResult,
  poolStats,
  tempModeActive,
  onRunOperation,
  onIntegrityCheck,
  onDownloadDatabase,
  onLoadTableStats,
  onLoadAuditLogs,
  onLoadConnections,
  onOpenImportModal,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-48">
          <Select
            value={selectedDb}
            onChange={(e) => onDbChange(e.target.value)}
            label={t("db_select", "Base de datos")}
          >
            {databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.name} ({db.type === "postgresql" ? "PostgreSQL" : "SQLite"})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Optimizar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${ICON_COLORS.warning}`} />
              Optimizar
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>
              {isPostgres ? "VACUUM ANALYZE" : "Indices + ANALYZE + VACUUM"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => onRunOperation("optimize", "BD optimizada")}
              disabled={operationLoading}
              className="w-full"
            >
              {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Ejecutar Optimizacion
            </Button>
          </CardContent>
        </Card>

        {/* VACUUM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className={`w-5 h-5 ${ICON_COLORS.info}`} />
              VACUUM
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>Compactar y liberar espacio</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => onRunOperation("vacuum", "VACUUM completado")}
              disabled={operationLoading}
              className="w-full"
            >
              {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              Ejecutar VACUUM
            </Button>
          </CardContent>
        </Card>

        {/* ANALYZE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${ICON_COLORS.success}`} />
              ANALYZE
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>Actualizar estadisticas de tablas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => onRunOperation("analyze", "ANALYZE completado")}
              disabled={operationLoading}
              className="w-full"
            >
              {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Ejecutar ANALYZE
            </Button>
          </CardContent>
        </Card>

        {/* Crear Indices */}
        <Card className={isPostgres ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className={`w-5 h-5 ${ICON_COLORS.primary}`} />
              Crear Indices
              <Badge variant="warning" className="ml-auto text-xs">SQLite</Badge>
            </CardTitle>
            <CardDescription>Indices recomendados para rendimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => onRunOperation("create-indexes", "Indices creados")}
              disabled={operationLoading || isPostgres}
              className="w-full"
            >
              {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
              Crear Indices
            </Button>
            {isPostgres && <p className="text-xs text-amber-600 mt-2">No disponible para PostgreSQL</p>}
          </CardContent>
        </Card>

        {/* Verificar Integridad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${ICON_COLORS.danger}`} />
              Verificar Integridad
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>
              {isPostgres ? "Indices invalidos y fragmentacion" : "PRAGMA integrity_check"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="secondary"
              onClick={onIntegrityCheck}
              disabled={operationLoading}
              className="w-full"
            >
              {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Verificar
            </Button>
            {integrityResult && (
              <div className={`p-3 rounded-lg ${integrityResult.integrity_ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} border`}>
                <div className="flex items-center gap-2">
                  {integrityResult.integrity_ok ? (
                    <CheckCircle className={`w-5 h-5 ${ICON_COLORS.success}`} />
                  ) : (
                    <XCircle className={`w-5 h-5 ${ICON_COLORS.danger}`} />
                  )}
                  <span className="font-medium">
                    {integrityResult.integrity_ok ? "BD Integra" : "Problemas detectados"}
                  </span>
                </div>
                {integrityResult.foreign_key_issues > 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    {integrityResult.foreign_key_issues} problemas de FK
                  </p>
                )}
                {integrityResult.bloated_tables?.length > 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    {integrityResult.bloated_tables.length} tablas con fragmentacion
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Descargar Backup */}
        <Card className={isPostgres ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className={`w-5 h-5 ${ICON_COLORS.info}`} />
              Backup
              <Badge variant="warning" className="ml-auto text-xs">SQLite</Badge>
            </CardTitle>
            <CardDescription>Descargar copia de la BD</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={onDownloadDatabase}
              disabled={isPostgres}
              className="w-full"
            >
              <Download className="w-4 h-4" />
              Descargar {selectedDb}.db
            </Button>
            {isPostgres && <p className="text-xs text-amber-600 mt-2">Use pg_dump para PostgreSQL</p>}
          </CardContent>
        </Card>

        {/* Estadisticas de Tabla */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className={`w-5 h-5 ${ICON_COLORS.primary}`} />
              Estadisticas
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>Ver tamaño, filas e indices de una tabla</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Select
                value={selectedTable || ""}
                onChange={(e) => onTableChange(e.target.value)}
                className="flex-1"
              >
                <option value="">Seleccionar tabla...</option>
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </Select>
              <Button
                variant="secondary"
                onClick={() => selectedTable && onLoadTableStats(selectedTable)}
                disabled={operationLoading || !selectedTable}
              >
                <BarChart2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className={`w-5 h-5 ${ICON_COLORS.warning}`} />
              Audit Log
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>Ver historial de operaciones CRUD</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={onLoadAuditLogs}
              disabled={operationLoading}
              className="w-full"
            >
              <History className="w-4 h-4" />
              Ver Ultimos 7 dias
            </Button>
          </CardContent>
        </Card>

        {/* Conexiones Activas */}
        <Card className={!isPostgres ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className={`w-5 h-5 ${ICON_COLORS.info}`} />
              Conexiones
              <Badge variant="info" className="ml-auto text-xs">PostgreSQL</Badge>
            </CardTitle>
            <CardDescription>Ver conexiones activas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={onLoadConnections}
              disabled={operationLoading || !isPostgres}
              className="w-full"
            >
              {operationLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Ver Conexiones
            </Button>
            {!isPostgres && <p className="text-xs text-amber-600 mt-2">Solo disponible para PostgreSQL</p>}
          </CardContent>
        </Card>

        {/* Pool Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className={`w-5 h-5 ${ICON_COLORS.success}`} />
              Pool Stats
              <Badge variant="success" className="ml-auto text-xs">All DBs</Badge>
            </CardTitle>
            <CardDescription>Estadisticas del pool de conexiones</CardDescription>
          </CardHeader>
          <CardContent>
            {poolStats ? (
              <div className="space-y-2 text-sm">
                {Object.entries(poolStats).map(([pool, stats]) => (
                  <div key={pool} className="p-2 bg-[var(--bg-soft)] rounded">
                    <p className="font-medium">{pool}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      Activas: {stats.active || 0} | Idle: {stats.idle || 0}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">Cargando...</p>
            )}
          </CardContent>
        </Card>

        {/* Importar Datos Temporales */}
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              Datos Temporales
              <Badge variant="warning" className="ml-auto text-xs">MRP/Forecast</Badge>
            </CardTitle>
            <CardDescription>
              Importar Excel para operar MRP y Forecast con datos temporales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-[var(--fg-muted)]">
              Permite trabajar con datos importados desde Excel sin afectar las bases de datos del sistema.
              Ideal para pruebas y analisis.
            </p>
            <Button
              onClick={onOpenImportModal}
              className="w-full bg-amber-500 hover:bg-amber-600"
              disabled={tempModeActive}
            >
              <Upload className="w-4 h-4" />
              {tempModeActive ? "Modo Temporal Activo" : "Importar Excel"}
            </Button>
            {tempModeActive && (
              <p className="text-xs text-amber-600 text-center">
                Desactive el modo temporal desde el banner superior para importar nuevos datos
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {isProduction && (
        <Alert variant="info" className="mt-4">
          <AlertTriangle className="w-4 h-4" />
          PostgreSQL en produccion: Algunas operaciones (VACUUM, Optimize) funcionan pero requieren permisos adecuados.
        </Alert>
      )}
    </div>
  );
}
