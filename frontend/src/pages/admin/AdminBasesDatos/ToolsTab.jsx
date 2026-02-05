/**
 * ToolsTab - Herramientas de administracion de BD
 */

import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ListIcon from "@mui/icons-material/List";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import ShieldIcon from "@mui/icons-material/Shield";
import StorageIcon from "@mui/icons-material/Storage";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import HistoryIcon from "@mui/icons-material/History";
import PeopleIcon from "@mui/icons-material/People";
import UploadIcon from "@mui/icons-material/Upload";
import { useI18n } from "../../../context/i18n";

/* ─────────────────────────────────────────────────────────────
   Reusable Tool Card
───────────────────────────────────────────────────────────── */
function ToolCard({ icon: Icon, iconColor, title, chipLabel, chipColor, description, disabled, children }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        opacity: disabled ? 0.55 : 1,
        transition: 'border-color 0.2s',
        '&:hover': disabled ? {} : { borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ px: 2.5, py: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon sx={{ fontSize: 20, color: iconColor }} />
          <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </Typography>
          <Chip
            label={chipLabel}
            size="small"
            color={chipColor}
            sx={{ ml: 'auto', height: 20, fontSize: '0.625rem', fontWeight: 700 }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {description}
        </Typography>
      </Box>
      <Box sx={{ p: 2.5 }}>
        {children}
      </Box>
    </Paper>
  );
}

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

  const loadingIcon = <CircularProgress size={14} color="inherit" />;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* DB Selector */}
      <FormControl sx={{ maxWidth: 280 }} size="small">
        <InputLabel id="tools-db-label">{t("db_select", "Base de datos")}</InputLabel>
        <Select
          labelId="tools-db-label"
          value={selectedDb}
          onChange={(e) => onDbChange(e.target.value)}
          label={t("db_select", "Base de datos")}
        >
          {databases.map((db) => (
            <MenuItem key={db.name} value={db.name}>
              {db.name} ({db.type === "postgresql" ? "PostgreSQL" : "SQLite"})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Tools Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
          gap: 3,
        }}
      >
        {/* Optimizar */}
        <ToolCard
          icon={FlashOnIcon}
          iconColor="warning.main"
          title="Optimizar"
          chipLabel="All DBs"
          chipColor="success"
          description={isPostgres ? "VACUUM ANALYZE" : "Indices + ANALYZE + VACUUM"}
        >
          <Button
            variant="contained"
            size="small"
            onClick={() => onRunOperation("optimize", "BD optimizada")}
            disabled={operationLoading}
            fullWidth
            startIcon={operationLoading ? loadingIcon : <FlashOnIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Ejecutar Optimizacion
          </Button>
        </ToolCard>

        {/* VACUUM */}
        <ToolCard
          icon={StorageIcon}
          iconColor="info.main"
          title="VACUUM"
          chipLabel="All DBs"
          chipColor="success"
          description="Compactar y liberar espacio"
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => onRunOperation("vacuum", "VACUUM completado")}
            disabled={operationLoading}
            fullWidth
            startIcon={operationLoading ? loadingIcon : <StorageIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Ejecutar VACUUM
          </Button>
        </ToolCard>

        {/* ANALYZE */}
        <ToolCard
          icon={AccessTimeIcon}
          iconColor="success.main"
          title="ANALYZE"
          chipLabel="All DBs"
          chipColor="success"
          description="Actualizar estadisticas de tablas"
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => onRunOperation("analyze", "ANALYZE completado")}
            disabled={operationLoading}
            fullWidth
            startIcon={operationLoading ? loadingIcon : <AccessTimeIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Ejecutar ANALYZE
          </Button>
        </ToolCard>

        {/* Crear Indices */}
        <ToolCard
          icon={ListIcon}
          iconColor="primary.main"
          title="Crear Indices"
          chipLabel="SQLite"
          chipColor="warning"
          description="Indices recomendados para rendimiento"
          disabled={isPostgres}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => onRunOperation("create-indexes", "Indices creados")}
            disabled={operationLoading || isPostgres}
            fullWidth
            startIcon={operationLoading ? loadingIcon : <ListIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Crear Indices
          </Button>
          {isPostgres && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1 }}>
              No disponible para PostgreSQL
            </Typography>
          )}
        </ToolCard>

        {/* Verificar Integridad */}
        <ToolCard
          icon={ShieldIcon}
          iconColor="error.main"
          title="Verificar Integridad"
          chipLabel="All DBs"
          chipColor="success"
          description={isPostgres ? "Indices invalidos y fragmentacion" : "PRAGMA integrity_check"}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={onIntegrityCheck}
            disabled={operationLoading}
            fullWidth
            startIcon={operationLoading ? loadingIcon : <ShieldIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Verificar
          </Button>
          {integrityResult && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 1,
                bgcolor: integrityResult.integrity_ok ? "success.lighter" : "error.lighter",
                border: 1,
                borderColor: integrityResult.integrity_ok ? "success.light" : "error.light",
              }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                {integrityResult.integrity_ok ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                ) : (
                  <CancelIcon sx={{ fontSize: 18, color: "error.main" }} />
                )}
                <Typography variant="caption" fontWeight={600}>
                  {integrityResult.integrity_ok ? "BD Integra" : "Problemas detectados"}
                </Typography>
              </Stack>
              {integrityResult.foreign_key_issues > 0 && (
                <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
                  {integrityResult.foreign_key_issues} problemas de FK
                </Typography>
              )}
              {integrityResult.bloated_tables?.length > 0 && (
                <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
                  {integrityResult.bloated_tables.length} tablas con fragmentacion
                </Typography>
              )}
            </Box>
          )}
        </ToolCard>

        {/* Descargar Backup */}
        <ToolCard
          icon={DownloadIcon}
          iconColor="info.main"
          title="Backup"
          chipLabel="SQLite"
          chipColor="warning"
          description="Descargar copia de la BD"
          disabled={isPostgres}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={onDownloadDatabase}
            disabled={isPostgres}
            fullWidth
            startIcon={<DownloadIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Descargar {selectedDb}.db
          </Button>
          {isPostgres && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1 }}>
              Use pg_dump para PostgreSQL
            </Typography>
          )}
        </ToolCard>

        {/* Estadisticas de Tabla */}
        <ToolCard
          icon={BarChartIcon}
          iconColor="primary.main"
          title="Estadisticas"
          chipLabel="All DBs"
          chipColor="success"
          description="Ver tamano, filas e indices de una tabla"
        >
          <Stack direction="row" gap={1}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <Select
                value={selectedTable || ""}
                onChange={(e) => onTableChange(e.target.value)}
                displayEmpty
                sx={{ fontSize: '0.8125rem' }}
              >
                <MenuItem value="">Seleccionar tabla...</MenuItem>
                {tables.map((t) => (
                  <MenuItem key={t.name} value={t.name}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              onClick={() => selectedTable && onLoadTableStats(selectedTable)}
              disabled={operationLoading || !selectedTable}
              sx={{ minWidth: 40 }}
            >
              <BarChartIcon fontSize="small" />
            </Button>
          </Stack>
        </ToolCard>

        {/* Audit Logs */}
        <ToolCard
          icon={HistoryIcon}
          iconColor="warning.main"
          title="Audit Log"
          chipLabel="All DBs"
          chipColor="success"
          description="Ver historial de operaciones CRUD"
        >
          <Button
            variant="outlined"
            size="small"
            onClick={onLoadAuditLogs}
            disabled={operationLoading}
            fullWidth
            startIcon={<HistoryIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Ver Ultimos 7 dias
          </Button>
        </ToolCard>

        {/* Conexiones Activas */}
        <ToolCard
          icon={PeopleIcon}
          iconColor="info.main"
          title="Conexiones"
          chipLabel="PostgreSQL"
          chipColor="info"
          description="Ver conexiones activas"
          disabled={!isPostgres}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={onLoadConnections}
            disabled={operationLoading || !isPostgres}
            fullWidth
            startIcon={operationLoading ? loadingIcon : <PeopleIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Ver Conexiones
          </Button>
          {!isPostgres && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1 }}>
              Solo disponible para PostgreSQL
            </Typography>
          )}
        </ToolCard>

        {/* Pool Stats */}
        <ToolCard
          icon={ShowChartIcon}
          iconColor="success.main"
          title="Pool Stats"
          chipLabel="All DBs"
          chipColor="success"
          description="Estadisticas del pool de conexiones"
        >
          {poolStats ? (
            <Stack spacing={1}>
              {Object.entries(poolStats).map(([pool, stats]) => (
                <Box key={pool} sx={{ p: 1.5, bgcolor: "grey.50", borderRadius: 1, border: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight={600}>
                    {pool}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Activas: {stats.active || 0} | Idle: {stats.idle || 0}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Cargando...
            </Typography>
          )}
        </ToolCard>

        {/* Importar Datos Temporales */}
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            borderColor: 'warning.light',
          }}
        >
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(237, 108, 2, 0.06)', borderBottom: 1, borderColor: 'warning.light' }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <UploadIcon sx={{ fontSize: 18, color: "warning.main" }} />
              <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Datos Temporales
              </Typography>
              <Chip
                label="MRP/Forecast"
                size="small"
                color="warning"
                sx={{ ml: 'auto', height: 20, fontSize: '0.625rem', fontWeight: 700 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Importar Excel para operar MRP y Forecast con datos temporales
            </Typography>
          </Box>
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Permite trabajar con datos importados desde Excel sin afectar las bases de datos del sistema.
            </Typography>
            <Button
              variant="contained"
              size="small"
              color="warning"
              onClick={onOpenImportModal}
              disabled={tempModeActive}
              fullWidth
              startIcon={<UploadIcon />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {tempModeActive ? "Modo Temporal Activo" : "Importar Excel"}
            </Button>
            {tempModeActive && (
              <Typography variant="caption" color="warning.main" sx={{ textAlign: "center" }}>
                Desactive el modo temporal desde el banner superior
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>

      {isProduction && (
        <Alert severity="info" icon={<WarningAmberIcon />}>
          PostgreSQL en produccion: Algunas operaciones requieren permisos adecuados.
        </Alert>
      )}
    </Box>
  );
}
