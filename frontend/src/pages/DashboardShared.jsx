import { Typography, Box } from "@mui/material";
import StatusBadge from "../components/ui/StatusBadge";
import { formatCurrency, formatAlmacen, formatDate } from "../utils/formatters";
import { withSpmAlignments } from "../utils/tableAlignments";
import { getCriticidadConfig } from "../utils/styleConfig";

/**
 * Componentes y utilidades compartidas entre todos los dashboards
 * Solo se exportan las funciones esenciales utilizadas
 */

// Configuración de columnas de tabla estándar para solicitudes
export function getTableColumns(t) {
  return withSpmAlignments([
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => (
        <Typography
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            color: "slate.700",
          }}
        >
          {row.id}
        </Typography>
      ),
    },
    {
      key: "solicitante",
      header: t("dash_table_solicitante", "Solicitante"),
      render: (row) => {
        const nombre = [row.solicitante_nombre, row.solicitante_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              color: "text.secondary",
              fontWeight: 500,
            }}
          >
            {nombre || "-"}
          </Typography>
        );
      },
    },
    {
      key: "fecha_creacion",
      header: t("dash_table_fecha", "Fecha"),
      sortAccessor: (row) => new Date(row.created_at).getTime() || 0,
      render: (row) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDate(row.created_at)}
        </Typography>
      ),
    },
    {
      key: "estado",
      header: t("dash_table_estado", "Estado"),
      render: (row) => {
        const aprobadorNombre = [row.aprobador_nombre, row.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;

        return (
          <StatusBadge
            estado={row.estado || row.status || "Desconocido"}
            showIcon={false}
            tooltipInfo={{
              aprobador: aprobadorNombre,
              planificador: plannerNombre,
              fechaAprobacion: row.updated_at,
              fechaEnvio: row.created_at,
            }}
          />
        );
      },
    },
    {
      key: "criticidad",
      header: "Criticidad",
      render: (row) => {
        const criticidad = row.criticidad || "Normal";
        const config = getCriticidadConfig(criticidad);
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: config.color,
            }}
          >
            {config.label}
          </Typography>
        );
      },
    },
    {
      key: "items",
      header: "Items",
      render: (row) => {
        const items = row.items || [];
        return (
          <Typography
            component="span"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {items.length}
          </Typography>
        );
      },
    },
    {
      key: "monto",
      header: "Monto",
      className: "text-right",
      minWidth: 120,
      render: (row) => (
        <Box
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            textAlign: "right",
            display: "block",
            whiteSpace: "nowrap",
          }}
        >
          {formatCurrency(row.total_monto || 0)}
        </Box>
      ),
    },
    {
      key: "sector",
      header: "Sector",
      render: (row) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {row.sector_nombre || row.sector || "-"}
        </Typography>
      ),
    },
    {
      key: "centro",
      header: "Centro",
      render: (row) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {row.centro || "-"}
        </Typography>
      ),
    },
    {
      key: "almacen",
      header: "Almacén",
      render: (row) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {formatAlmacen(row.almacen_virtual)}
        </Typography>
      ),
    },
    {
      key: "planificador",
      header: "Planificador",
      render: (row) => {
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              color: "text.secondary",
            }}
          >
            {plannerNombre || "-"}
          </Typography>
        );
      },
    },
  ]);
}

// Configuración de columnas AG Grid para solicitudes
export function getTableColumnsAgGrid(t) {
  return [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      flex: 0,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            color: "slate.700",
          }}
        >
          {params.data?.id}
        </Typography>
      ),
    },
    {
      field: "solicitante",
      headerName: t("dash_table_solicitante", "Solicitante"),
      minWidth: 150,
      valueGetter: (params) => {
        const row = params.data;
        return [row?.solicitante_nombre, row?.solicitante_apellido]
          .filter(Boolean).join(" ").trim() || "-";
      },
      cellRenderer: (params) => {
        const nombre = [params.data?.solicitante_nombre, params.data?.solicitante_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              color: "text.secondary",
              fontWeight: 500,
            }}
          >
            {nombre || "-"}
          </Typography>
        );
      },
    },
    {
      field: "created_at",
      headerName: t("dash_table_fecha", "Fecha"),
      minWidth: 100,
      valueGetter: (params) => params.data?.created_at ? new Date(params.data.created_at).getTime() : 0,
      valueFormatter: (params) => formatDate(params.data?.created_at),
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDate(params.data?.created_at)}
        </Typography>
      ),
    },
    {
      field: "estado",
      headerName: t("dash_table_estado", "Estado"),
      minWidth: 120,
      cellRenderer: (params) => {
        const row = params.data;
        const aprobadorNombre = [row?.aprobador_nombre, row?.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [row?.planner_nombre, row?.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;

        return (
          <StatusBadge
            estado={row?.estado || row?.status || "Desconocido"}
            showIcon={false}
            tooltipInfo={{
              aprobador: aprobadorNombre,
              planificador: plannerNombre,
              fechaAprobacion: row?.updated_at,
              fechaEnvio: row?.created_at,
            }}
          />
        );
      },
    },
    {
      field: "criticidad",
      headerName: "Criticidad",
      minWidth: 100,
      cellRenderer: (params) => {
        const criticidad = params.data?.criticidad || "Normal";
        const config = getCriticidadConfig(criticidad);
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: config.color,
            }}
          >
            {config.label}
          </Typography>
        );
      },
    },
    {
      field: "items",
      headerName: "Items",
      width: 80,
      flex: 0,
      valueGetter: (params) => (params.data?.items || []).length,
      cellRenderer: (params) => {
        const items = params.data?.items || [];
        return (
          <Typography
            component="span"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {items.length}
          </Typography>
        );
      },
    },
    {
      field: "total_monto",
      headerName: "Monto",
      minWidth: 120,
      type: "numericColumn",
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) => formatCurrency(params.data?.total_monto || 0),
      cellRenderer: (params) => (
        <Box
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            display: "block",
            whiteSpace: "nowrap",
          }}
        >
          {formatCurrency(params.data?.total_monto || 0)}
        </Box>
      ),
    },
    {
      field: "sector_nombre",
      headerName: "Sector",
      minWidth: 120,
      valueGetter: (params) => params.data?.sector_nombre || params.data?.sector || "-",
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.data?.sector_nombre || params.data?.sector || "-"}
        </Typography>
      ),
    },
    {
      field: "centro",
      headerName: "Centro",
      minWidth: 100,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.data?.centro || "-"}
        </Typography>
      ),
    },
    {
      field: "almacen_virtual",
      headerName: "Almacén",
      minWidth: 100,
      valueGetter: (params) => formatAlmacen(params.data?.almacen_virtual),
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {formatAlmacen(params.data?.almacen_virtual)}
        </Typography>
      ),
    },
    {
      field: "planificador",
      headerName: "Planificador",
      minWidth: 140,
      valueGetter: (params) => {
        return [params.data?.planner_nombre, params.data?.planner_apellido]
          .filter(Boolean).join(" ").trim() || "-";
      },
      cellRenderer: (params) => {
        const plannerNombre = [params.data?.planner_nombre, params.data?.planner_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              color: "text.secondary",
            }}
          >
            {plannerNombre || "-"}
          </Typography>
        );
      },
    },
  ];
}
