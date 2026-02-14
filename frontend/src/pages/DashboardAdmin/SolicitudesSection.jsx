import { memo } from "react";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/Tabs";
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * SolicitudesSection - Collapsible table of solicitudes with tabs
 */
function SolicitudesSection({
  t,
  loading,
  stats,
  solicitudesCollapsed,
  setSolicitudesCollapsed,
  activeTab,
  handleTabChange,
  tabs,
  currentData,
  columnDefs,
  navigate,
  tableTitle,
}) {
  return (
    <Paper elevation={0} sx={{ overflow: 'hidden', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      {/* Header con boton de colapsar/expandir y crear solicitud */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
        <Button
          onClick={() => setSolicitudesCollapsed(!solicitudesCollapsed)}
          aria-expanded={!solicitudesCollapsed}
          aria-label={solicitudesCollapsed ? t('dash_expand_solicitudes', 'Expandir solicitudes') : t('dash_collapse_solicitudes', 'Contraer solicitudes')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textAlign: 'left',
            '&:hover': { bgcolor: 'grey.50' },
            borderRadius: 1,
            px: 1,
            py: 0.5,
            ml: -1,
            zIndex: 10,
            textTransform: 'none',
            color: 'text.primary',
          }}
        >
          {solicitudesCollapsed ? (
            <ChevronRightIcon sx={{ width: 20, height: 20, color: 'grey.500' }} />
          ) : (
            <ExpandMoreIcon sx={{ width: 20, height: 20, color: 'grey.500' }} />
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'grey.700' }}>
            Solicitudes
          </Typography>
          <Typography variant="caption" sx={{ color: 'grey.500', ml: 0.5 }}>
            {loading ? 'Cargando...' : `(${stats.todas} total)`}
          </Typography>
        </Button>
      </Box>

      {/* Contenido colapsable */}
      <Box
        sx={{
          transition: 'all 0.3s ease-in-out',
          transformOrigin: 'top left',
          maxHeight: solicitudesCollapsed ? 0 : 2000,
          opacity: solicitudesCollapsed ? 0 : 1,
          transform: solicitudesCollapsed ? 'scaleY(0)' : 'scaleY(1)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 0 }}>
          {/* Header con tabs */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'grey.100' }}>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    sx={tab.isAction ? { color: 'var(--primary)', fontWeight: 600 } : undefined}
                  >
                    {tab.isAction ? tab.label : `${tab.label} (${tab.count})`}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Box>

          {/* Tabla */}
          <Box sx={{ p: 2 }} aria-live="polite">
            {loading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : currentData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ width: 48, height: 48, color: 'success.main', mx: 'auto', mb: 2, opacity: 0.6 }} />
                <Typography variant="body2" sx={{ color: 'grey.500' }}>
                  {activeTab === "pendientes"
                    ? t("dash_no_pending", "No hay solicitudes pendientes de revision")
                    : t("dash_no_requests_category", "No hay solicitudes en esta categoria")}
                </Typography>
              </Box>
            ) : (
              <SPMAgGrid
                columnDefs={columnDefs}
                rowData={currentData}
                emptyMessage={t("dash_no_requests", "No hay solicitudes")}
                onRowClick={(row) => navigate(`/solicitudes/${row.id}`)}
                height={500}
                enableQuickFilter={true}
                exportFileName="dashboard_admin"
              />
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

export default memo(SolicitudesSection);
