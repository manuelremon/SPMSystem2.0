import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
} from "@mui/material";
import InventoryIcon from "@mui/icons-material/Inventory";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import { useI18n } from "../../context/i18n";

export default function Paso3RevisionFinal({ items = [], decisiones = {} }) {
  const { t } = useI18n();
  // Agrupar fuentes por tipo: stock vs compra + calcular costos
  const { stockRows, compraRows, costoStock, costoCompra, costoTotal } = useMemo(() => {
    const stock = [];
    const compra = [];
    let totalStock = 0;
    let totalCompra = 0;

    Object.entries(decisiones).forEach(([idx, decision]) => {
      const item = items.find((it) => Number(it.idx) === Number(idx)) || {};

      decision.fuentes?.forEach((fuente) => {
        const tipo = fuente.opcion?.tipo;

        const cantidadSolicitada = Number(item.cantidad || 0);
        const cantidadAsignada = Number(fuente.cantidad_asignada || 0);
        const precioUnitario = Number(fuente.opcion?.precio_unitario || item.precio_unitario || 0);
        const costoFuente = cantidadAsignada * precioUnitario;
        const porcentaje = cantidadSolicitada > 0
          ? Math.round((cantidadAsignada / cantidadSolicitada) * 100)
          : 0;

        if (tipo === "stock" || tipo === "transferencia") {
          totalStock += costoFuente;
          stock.push({
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidadSolicitada,
            cantidadAsignada,
            precioUnitario,
            costo: costoFuente,
            porcentaje,
            centro: fuente.opcion?.centro_origen || fuente.opcion?.centro,
            almacen: fuente.opcion?.almacen_origen || fuente.opcion?.almacen,
            nombre_almacen: fuente.opcion?.nombre_almacen,
            plazo: fuente.opcion?.plazo_dias,
          });
        } else if (tipo === "proveedor" || tipo === "equivalencia") {
          totalCompra += costoFuente;
          compra.push({
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidadSolicitada,
            cantidadAsignada,
            precioUnitario,
            costo: costoFuente,
            porcentaje,
            proveedor: fuente.opcion?.nombre_proveedor || fuente.opcion?.nombre,
            plazo: fuente.opcion?.plazo_dias,
            esEquivalencia: tipo === "equivalencia",
            esNegociado: fuente.opcion?.precio_es_negociado,
          });
        }
      });
    });

    return {
      stockRows: stock,
      compraRows: compra,
      costoStock: totalStock,
      costoCompra: totalCompra,
      costoTotal: totalStock + totalCompra,
    };
  }, [decisiones, items]);

  return (
    <Stack spacing={3}>
      {/* Seccion Stock */}
      {stockRows.length > 0 && (
        <Box>
          <SectionHeader
            icon={InventoryIcon}
            title={t('planner_desde_stock', 'DESDE STOCK')}
            variant="success"
          />
          <Box sx={{ mt: 1.5 }}>
            <StockTable rows={stockRows} />
          </Box>
        </Box>
      )}

      {/* Seccion Compra */}
      {compraRows.length > 0 && (
        <Box>
          <SectionHeader
            icon={ShoppingCartIcon}
            title={t('planner_por_compra', 'POR COMPRA')}
            variant="info"
          />
          <Box sx={{ mt: 1.5 }}>
            <CompraTable rows={compraRows} />
          </Box>
        </Box>
      )}

      {/* Estado vacio */}
      {stockRows.length === 0 && compraRows.length === 0 && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography color="text.secondary">
            {t('planner_sin_decisiones', 'No hay decisiones de abastecimiento registradas.')}
          </Typography>
        </Box>
      )}

      {/* G4: Sumario de Costos */}
      {(stockRows.length > 0 || compraRows.length > 0) && (
        <Box sx={{ mt: 4 }}>
          <SectionHeader
            icon={AttachMoneyIcon}
            title={t('planner_resumen_costos', 'RESUMEN DE COSTOS')}
            variant="warning"
          />
          <Paper
            elevation={0}
            sx={{
              mt: 1.5,
              p: 2,
              borderRadius: 4,
              backgroundColor: "var(--card)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 2,
              }}
            >
              {/* Costo Stock */}
              <Box
                sx={{
                  textAlign: "center",
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--fg-muted)",
                    mb: 0.5,
                  }}
                >
                  {t('planner_desde_stock', 'Desde Stock')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--success)",
                  }}
                >
                  ${costoStock.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "var(--fg-muted)",
                    mt: 0.5,
                  }}
                >
                  {stockRows.length} {t('planner_lineas', 'líneas')}
                </Typography>
              </Box>

              {/* Costo Compra */}
              <Box
                sx={{
                  textAlign: "center",
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--fg-muted)",
                    mb: 0.5,
                  }}
                >
                  {t('planner_por_compra', 'Por Compra')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--info)",
                  }}
                >
                  ${costoCompra.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "var(--fg-muted)",
                    mt: 0.5,
                  }}
                >
                  {compraRows.length} {t('planner_lineas', 'líneas')}
                </Typography>
              </Box>

              {/* Costo Total */}
              <Box
                sx={{
                  textAlign: "center",
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: "rgba(139, 92, 246, 0.08)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--fg-muted)",
                    mb: 0.5,
                  }}
                >
                  {t('planner_costo_total', 'Costo Total')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  ${costoTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "var(--fg-muted)",
                    mt: 0.5,
                  }}
                >
                  {stockRows.length + compraRows.length} {t('planner_lineas', 'líneas')}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
    </Stack>
  );
}

function SectionHeader({ icon: Icon, title, variant }) {
  const variantStyles = {
    success: {
      bg: "rgba(16, 185, 129, 0.12)",
      text: "var(--success)",
    },
    info: {
      bg: "rgba(59, 130, 246, 0.12)",
      text: "var(--info)",
    },
    warning: {
      bg: "rgba(139, 92, 246, 0.12)",
      text: "var(--primary)",
    },
  };

  const style = variantStyles[variant] || variantStyles.info;

  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box
        sx={{
          p: 1,
          borderRadius: 2,
          backgroundColor: style.bg,
          color: style.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--fg)",
        }}
      >
        {title}
      </Typography>
    </Stack>
  );
}

function StockTable({ rows }) {
  const { t } = useI18n();
  const headerCellSx = {
    px: 2,
    py: 1.75,
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--fg-muted)",
    backgroundColor: "var(--bg-soft)",
    borderBottom: "1px solid var(--border)",
  };

  const bodyCellSx = {
    px: 2,
    py: 1.75,
    color: "var(--fg)",
  };

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 4,
        backgroundColor: "var(--card)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headerCellSx, textAlign: "center" }}>{t('planner_codigo_sap', 'Código SAP')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "center" }}>{t('common_descripcion', 'Descripción')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "right" }}>{t('planner_solicitado', 'Solicitado')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "right" }}>{t('planner_asignado', 'Asignado')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "center" }}>{t('planner_ubicacion', 'Ubicación')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "right" }}>{t('planner_plazo', 'Plazo')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              sx={{
                "&:last-child td": { borderBottom: "none" },
                "& td": { borderBottom: "1px solid var(--border)" },
              }}
            >
              <TableCell sx={{ ...bodyCellSx, fontFamily: "monospace" }}>{row.codigo}</TableCell>
              <TableCell sx={bodyCellSx}>{row.descripcion}</TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right", color: "var(--fg-muted)" }}>
                {row.cantidadSolicitada}
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                  <Typography component="span" sx={{ fontWeight: 600, color: "var(--fg)" }}>
                    {row.cantidadAsignada}
                  </Typography>
                  <Chip
                    label={`${row.porcentaje}%`}
                    size="small"
                    sx={{
                      height: "auto",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      px: 0.5,
                      py: 0.25,
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      color: "var(--success)",
                      "& .MuiChip-label": { px: 1, py: 0.25 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, color: "var(--fg-muted)" }}>
                <Box>
                  {row.centro} / Alm {String(row.almacen || "").padStart(4, "0")}
                  {row.nombre_almacen && (
                    <Typography
                      component="span"
                      sx={{
                        display: "block",
                        fontSize: "0.75rem",
                        color: "var(--fg-muted)",
                        opacity: 0.7,
                      }}
                    >
                      {row.nombre_almacen}
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right", color: "var(--fg-muted)" }}>
                {row.plazo ? `${row.plazo} ${t('planner_dias', 'días')}` : t('planner_inmediato', 'Inmediato')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CompraTable({ rows }) {
  const { t } = useI18n();
  const headerCellSx = {
    px: 2,
    py: 1.75,
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--fg-muted)",
    backgroundColor: "var(--bg-soft)",
    borderBottom: "1px solid var(--border)",
  };

  const bodyCellSx = {
    px: 2,
    py: 1.75,
    color: "var(--fg)",
  };

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 4,
        backgroundColor: "var(--card)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headerCellSx, textAlign: "center" }}>{t('planner_codigo_sap', 'Código SAP')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "center" }}>{t('common_descripcion', 'Descripción')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "right" }}>{t('planner_solicitado', 'Solicitado')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "right" }}>{t('planner_asignado', 'Asignado')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "center" }}>{t('common_proveedor', 'Proveedor')}</TableCell>
            <TableCell sx={{ ...headerCellSx, textAlign: "right" }}>{t('planner_plazo', 'Plazo')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              sx={{
                "&:last-child td": { borderBottom: "none" },
                "& td": { borderBottom: "1px solid var(--border)" },
              }}
            >
              <TableCell sx={{ ...bodyCellSx, fontFamily: "monospace" }}>{row.codigo}</TableCell>
              <TableCell sx={bodyCellSx}>{row.descripcion}</TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right", color: "var(--fg-muted)" }}>
                {row.cantidadSolicitada}
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                  <Typography component="span" sx={{ fontWeight: 600, color: "var(--fg)" }}>
                    {row.cantidadAsignada}
                  </Typography>
                  <Chip
                    label={`${row.porcentaje}%`}
                    size="small"
                    sx={{
                      height: "auto",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      px: 0.5,
                      py: 0.25,
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      color: "var(--info)",
                      "& .MuiChip-label": { px: 1, py: 0.25 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell sx={bodyCellSx}>{row.proveedor || "N/D"}</TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right", color: "var(--fg-muted)" }}>
                {row.plazo ? `${row.plazo} dias` : "N/D"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
