import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  IconButton,
  Chip,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Checkbox,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Tooltip,
} from "@mui/material";
import {
  Package, MapPin, Check, Warehouse, Truck, RefreshCw, Layers,
  LayoutGrid, List, ChevronLeft, ChevronRight, ArrowLeftRight,
  DollarSign, AlertTriangle, CheckCircle, Plus, Minus, Sparkles, X
} from "../ui/Icons";
import { formatAlmacen } from "../../utils/formatters";

/**
 * Paso2DecisionAbastecimiento - Componente de seleccion MULTI-FUENTE
 *
 * Permite seleccionar multiples fuentes de abastecimiento para un item,
 * asignando cantidades editables a cada fuente seleccionada.
 *
 * Props:
 *   - decisiones: { [idx]: { fuentes: [{ opcion, cantidad_asignada }, ...], comentario } }
 *   - onSelectDecision: (idx, decisionMultiFuente) => void
 */
export default function Paso2DecisionAbastecimiento({
  solicitud,
  analisis,
  items = [],
  totalItems = 0,
  currentIdx = 0,
  onChangeIdx,
  opciones = {},
  decisiones = {},
  onSelectDecision,
  onFetchOpciones,
  loadingOpciones,
  onPrev,
  onNext,
}) {
  const itemActual = items[currentIdx] || {};
  const dataOpciones = opciones[currentIdx]?.opciones || [];
  const cantidadSolicitada = Number(itemActual.cantidad || 0);

  // Estado local para multi-seleccion del item actual
  const decisionActual = decisiones[currentIdx] || { fuentes: [], comentario: "" };
  const [fuentesSeleccionadas, setFuentesSeleccionadas] = useState([]);
  const [comentario, setComentario] = useState("");

  // Sincronizar estado local con decisiones externas
  useEffect(() => {
    setFuentesSeleccionadas(decisionActual.fuentes || []);
    setComentario(decisionActual.comentario || "");
  }, [currentIdx, decisionActual.fuentes?.length]);

  const progress = totalItems > 0 ? ((currentIdx + 1) / totalItems) * 100 : 0;
  const [vistaTabla, setVistaTabla] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [showExcedenteModal, setShowExcedenteModal] = useState(false);

  // Calcular totales
  const totalAsignado = fuentesSeleccionadas.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
  const faltante = Math.max(0, cantidadSolicitada - totalAsignado);
  const excedente = Math.max(0, totalAsignado - cantidadSolicitada);
  const itemCompleto = totalAsignado >= cantidadSolicitada;

  // Ref para evitar auto-avance en el montaje inicial
  const prevItemCompletoRef = useRef(false);
  const autoAdvanceTimerRef = useRef(null);
  const [usandoSugerido, setUsandoSugerido] = useState(false);

  // Auto-avance al siguiente material cuando se completa la cantidad
  useEffect(() => {
    // Limpiar timer anterior si existe
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // Solo avanzar si:
    // 1. El item acaba de completarse (no estaba completo antes)
    // 2. Hay mas items despues del actual
    // 3. Hay al menos una fuente seleccionada (evitar avance con item vacio)
    if (
      itemCompleto &&
      !prevItemCompletoRef.current &&
      currentIdx < totalItems - 1 &&
      fuentesSeleccionadas.length > 0
    ) {
      // Delay mas largo si uso "Aceptar Sugerido" para ver la seleccion
      const delayMs = usandoSugerido ? 2000 : 500;
      autoAdvanceTimerRef.current = setTimeout(() => {
        onChangeIdx?.(currentIdx + 1);
        setUsandoSugerido(false);
      }, delayMs);
    }

    // Actualizar referencia
    prevItemCompletoRef.current = itemCompleto;

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [itemCompleto, currentIdx, totalItems, fuentesSeleccionadas.length, onChangeIdx, usandoSugerido]);

  // Reset de la ref cuando cambia el item actual
  useEffect(() => {
    prevItemCompletoRef.current = itemCompleto;
    setUsandoSugerido(false);
  }, [currentIdx]);

  // Filtrar opciones segun el tipo seleccionado
  const opcionesFiltradas = useMemo(() => {
    if (filtroTipo === "todos") return dataOpciones;
    return dataOpciones.filter((op) => op.tipo === filtroTipo);
  }, [dataOpciones, filtroTipo]);

  // Datos de la solicitud
  const centroSolicitud = solicitud?.centro || "";
  const almacenSolicitud = solicitud?.almacen_virtual || solicitud?.almacen || "";
  const almacenesDisponibles = ["0100", "9999"];

  // Categorizar stock en 3 grupos (combinar itemActual.detalle_stock + opciones del backend)
  const stockCategorizado = useMemo(() => {
    // Recolectar todo el detalle_stock disponible
    let detalle = [...(itemActual?.detalle_stock || [])];

    // Agregar opciones de stock y transferencia del backend
    dataOpciones.forEach((op) => {
      if (op.tipo === "stock" || op.tipo === "transferencia") {
        // Si tiene detalle_stock como array, agregar cada entrada
        if (Array.isArray(op.detalle_stock)) {
          op.detalle_stock.forEach((d) => {
            const yaExiste = detalle.some(
              (existing) =>
                String(existing.centro || "") === String(d.centro || "") &&
                String(existing.almacen || "") === String(d.almacen || "")
            );
            if (!yaExiste) {
              detalle.push(d);
            }
          });
        }
        // Si no tiene detalle_stock pero tiene centro_origen/almacen_origen, crear entrada
        else if (op.centro_origen && op.cantidad_disponible > 0) {
          const centro = String(op.centro_origen || "");
          const almacen = String(op.almacen_origen || "").padStart(4, "0");
          const yaExiste = detalle.some(
            (existing) =>
              String(existing.centro || "") === centro &&
              String(existing.almacen || "").padStart(4, "0") === almacen
          );
          if (!yaExiste) {
            detalle.push({
              centro: centro,
              almacen: almacen,
              cantidad: op.cantidad_disponible,
              nombre_almacen: op.nombre || `Centro ${centro}`,
            });
          }
        }
      }
    });

    // Stock Local: mismo centro Y almacen
    const stockLocal = detalle.filter((d) => {
      const centro = String(d.centro || "");
      const almacen = String(d.almacen || "").padStart(4, "0");
      return centro === centroSolicitud && almacen === almacenSolicitud;
    });
    const totalLocal = stockLocal.reduce((sum, d) => sum + Number(d.cantidad || 0), 0);

    // Stock Interno Disponible: almacenes 0100/9999 (excepto local)
    const stockDisponible = detalle.filter((d) => {
      const centro = String(d.centro || "");
      const almacen = String(d.almacen || "").padStart(4, "0");
      const esLocal = centro === centroSolicitud && almacen === almacenSolicitud;
      return !esLocal && almacenesDisponibles.includes(almacen);
    });
    // Ordenar: primero mismo centro
    stockDisponible.sort((a, b) => {
      const aEsMismoCentro = String(a.centro || "") === centroSolicitud ? 0 : 1;
      const bEsMismoCentro = String(b.centro || "") === centroSolicitud ? 0 : 1;
      return aEsMismoCentro - bEsMismoCentro;
    });
    const totalDisponible = stockDisponible.reduce((sum, d) => sum + Number(d.cantidad || 0), 0);

    // Stock Interno No Disponible: otros almacenes
    const stockNoDisponible = detalle.filter((d) => {
      const centro = String(d.centro || "");
      const almacen = String(d.almacen || "").padStart(4, "0");
      const esLocal = centro === centroSolicitud && almacen === almacenSolicitud;
      return !esLocal && !almacenesDisponibles.includes(almacen);
    });
    // Ordenar: primero mismo centro
    stockNoDisponible.sort((a, b) => {
      const aEsMismoCentro = String(a.centro || "") === centroSolicitud ? 0 : 1;
      const bEsMismoCentro = String(b.centro || "") === centroSolicitud ? 0 : 1;
      return aEsMismoCentro - bEsMismoCentro;
    });
    const totalNoDisponible = stockNoDisponible.reduce((sum, d) => sum + Number(d.cantidad || 0), 0);

    return {
      local: { items: stockLocal, total: totalLocal },
      disponible: { items: stockDisponible, total: totalDisponible },
      noDisponible: { items: stockNoDisponible, total: totalNoDisponible },
    };
  }, [itemActual?.detalle_stock, dataOpciones, centroSolicitud, almacenSolicitud]);

  // Filtrar opciones NO-stock (proveedor, equivalencia)
  const opcionesNoStock = useMemo(() => {
    return opcionesFiltradas.filter((op) => op.tipo !== "stock" && op.tipo !== "transferencia");
  }, [opcionesFiltradas]);

  // Filtrar opciones de stock del backend (para mostrar como fallback)
  const opcionesStock = useMemo(() => {
    return opcionesFiltradas.filter((op) => op.tipo === "stock" || op.tipo === "transferencia");
  }, [opcionesFiltradas]);

  // Filtrar opciones de equivalencias
  const opcionesEquivalencias = useMemo(() => {
    return dataOpciones.filter((op) => op.tipo === "equivalencia");
  }, [dataOpciones]);

  // Filtrar opciones de proveedores (sin equivalencias)
  const opcionesProveedores = useMemo(() => {
    return opcionesFiltradas.filter((op) => op.tipo === "proveedor");
  }, [opcionesFiltradas]);

  // Determinar si hay stock categorizado
  const hayStockCategorizado =
    stockCategorizado.local.total > 0 ||
    stockCategorizado.disponible.total > 0 ||
    stockCategorizado.noDisponible.total > 0;

  // Contar opciones por tipo (incluyendo transferencia)
  const conteoTipos = useMemo(() => {
    const conteo = {
      todos: dataOpciones.length,
      stock: 0,
      transferencia: 0,
      proveedor: 0,
      equivalencia: 0,
      mix: 0,
    };
    dataOpciones.forEach((op) => {
      const tipo = op.tipo || "otros";
      if (conteo[tipo] !== undefined) {
        conteo[tipo]++;
      }
    });
    return conteo;
  }, [dataOpciones]);

  useEffect(() => {
    if (currentIdx != null) {
      onFetchOpciones?.(currentIdx);
    }
  }, [currentIdx, onFetchOpciones]);

  // Verificar si una opcion esta seleccionada
  const isSelected = useCallback((opcionId) => {
    return fuentesSeleccionadas.some(f => f.opcion?.opcion_id === opcionId);
  }, [fuentesSeleccionadas]);

  // Toggle seleccion de una fuente
  const toggleFuente = useCallback((opcion) => {
    setFuentesSeleccionadas(prev => {
      const existe = prev.find(f => f.opcion?.opcion_id === opcion.opcion_id);
      let nuevaLista;

      if (existe) {
        // Deseleccionar
        nuevaLista = prev.filter(f => f.opcion?.opcion_id !== opcion.opcion_id);
      } else {
        // Seleccionar con cantidad inicial (lo que falta o disponible)
        const cantidadDisponible = opcion.cantidad_disponible || cantidadSolicitada;
        const cantidadActual = prev.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
        const cantidadFaltante = Math.max(0, cantidadSolicitada - cantidadActual);
        const cantidadInicial = Math.min(cantidadFaltante, cantidadDisponible);

        nuevaLista = [...prev, {
          opcion,
          cantidad_asignada: cantidadInicial > 0 ? cantidadInicial : cantidadDisponible,
          notas: ""
        }];
      }

      // Propagar cambio hacia arriba
      const decisionMultiFuente = {
        fuentes: nuevaLista,
        comentario,
        cantidad_solicitada: cantidadSolicitada,
      };
      onSelectDecision?.(currentIdx, decisionMultiFuente);

      return nuevaLista;
    });
  }, [cantidadSolicitada, comentario, currentIdx, onSelectDecision]);

  // Actualizar cantidad de una fuente especifica (sin limite estricto)
  const actualizarCantidad = useCallback((opcionId, nuevaCantidad) => {
    setFuentesSeleccionadas(prev => {
      const cantidadValidada = Math.max(0, Number(nuevaCantidad) || 0);

      const nuevaLista = prev.map(f => {
        if (f.opcion?.opcion_id === opcionId) {
          return { ...f, cantidad_asignada: cantidadValidada };
        }
        return f;
      });

      // Propagar cambio
      const decisionMultiFuente = {
        fuentes: nuevaLista,
        comentario,
        cantidad_solicitada: cantidadSolicitada,
      };
      onSelectDecision?.(currentIdx, decisionMultiFuente);

      return nuevaLista;
    });
  }, [comentario, cantidadSolicitada, currentIdx, onSelectDecision]);

  // Actualizar comentario
  const actualizarComentario = useCallback((nuevoComentario) => {
    setComentario(nuevoComentario);
    const decisionMultiFuente = {
      fuentes: fuentesSeleccionadas,
      comentario: nuevoComentario,
      cantidad_solicitada: cantidadSolicitada,
    };
    onSelectDecision?.(currentIdx, decisionMultiFuente);
  }, [fuentesSeleccionadas, cantidadSolicitada, currentIdx, onSelectDecision]);

  // Seleccionar/deseleccionar una ubicacion especifica de stock
  const toggleStockUbicacion = useCallback((ubicacion, categoria) => {
    const opcionId = `stock_${categoria}_${ubicacion.centro}_${String(ubicacion.almacen || "").padStart(4, "0")}`;
    const cantidadDisponible = Number(ubicacion.cantidad || 0);

    setFuentesSeleccionadas(prev => {
      const existe = prev.find(f => f.opcion?.opcion_id === opcionId);
      let nuevaLista;

      if (existe) {
        // Deseleccionar
        nuevaLista = prev.filter(f => f.opcion?.opcion_id !== opcionId);
      } else {
        // Seleccionar con cantidad inicial
        const cantidadActual = prev.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
        const cantidadFaltante = Math.max(0, cantidadSolicitada - cantidadActual);
        const cantidadInicial = Math.min(cantidadFaltante, cantidadDisponible) || Math.min(cantidadSolicitada, cantidadDisponible);

        const nombreCategoria = categoria === "local" ? "Stock Local" :
                                categoria === "disponible" ? "Stock Disponible" :
                                "Stock No Disponible";

        nuevaLista = [...prev, {
          opcion: {
            opcion_id: opcionId,
            tipo: "stock",
            nombre: `${nombreCategoria} - ${ubicacion.centro}/${String(ubicacion.almacen || "").padStart(4, "0")}`,
            cantidad_disponible: cantidadDisponible,
            centro: ubicacion.centro,
            almacen: ubicacion.almacen,
            nombre_almacen: ubicacion.nombre_almacen,
            categoria: categoria,
          },
          cantidad_asignada: cantidadInicial > 0 ? cantidadInicial : 1,
          notas: "",
        }];
      }

      // Propagar cambio hacia arriba
      const decisionMultiFuente = {
        fuentes: nuevaLista,
        comentario,
        cantidad_solicitada: cantidadSolicitada,
      };
      onSelectDecision?.(currentIdx, decisionMultiFuente);

      return nuevaLista;
    });
  }, [cantidadSolicitada, comentario, currentIdx, onSelectDecision]);

  // Verificar si una ubicacion especifica esta seleccionada
  const isStockUbicacionSelected = useCallback((ubicacion, categoria) => {
    const opcionId = `stock_${categoria}_${ubicacion.centro}_${String(ubicacion.almacen || "").padStart(4, "0")}`;
    return fuentesSeleccionadas.some(f => f.opcion?.opcion_id === opcionId);
  }, [fuentesSeleccionadas]);

  // Contar cuantas ubicaciones de una categoria estan seleccionadas
  const countSelectedInCategoria = useCallback((categoria) => {
    return fuentesSeleccionadas.filter(f => f.opcion?.categoria === categoria).length;
  }, [fuentesSeleccionadas]);

  // Funcion para aceptar automaticamente las opciones mas convenientes
  const aceptarSugerido = useCallback(() => {
    if (dataOpciones.length === 0) return;

    let cantidadRestante = cantidadSolicitada;
    const nuevasFuentes = [];
    const opcionesUsadas = new Set();

    // Ordenar todas las opciones por conveniencia:
    // 1. Primero las recomendadas
    // 2. Luego por score de recomendacion (mayor primero)
    // 3. Luego por tipo: stock > transferencia > proveedor > equivalencia
    // 4. Finalmente por precio (menor primero)
    const prioridadTipo = { stock: 1, transferencia: 2, proveedor: 3, equivalencia: 4 };

    const opcionesOrdenadas = [...dataOpciones].sort((a, b) => {
      // Primero las recomendadas
      if (a.is_recomendada && !b.is_recomendada) return -1;
      if (!a.is_recomendada && b.is_recomendada) return 1;

      // Luego por score
      const scoreA = a.score_recomendacion || 0;
      const scoreB = b.score_recomendacion || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;

      // Luego por tipo (stock primero)
      const tipoA = prioridadTipo[a.tipo] || 5;
      const tipoB = prioridadTipo[b.tipo] || 5;
      if (tipoA !== tipoB) return tipoA - tipoB;

      // Finalmente por precio (menor primero)
      const precioA = a.precio_unitario || 0;
      const precioB = b.precio_unitario || 0;
      return precioA - precioB;
    });

    // Seleccionar opciones hasta completar la cantidad solicitada
    for (const opcion of opcionesOrdenadas) {
      if (cantidadRestante <= 0) break;
      if (opcionesUsadas.has(opcion.opcion_id)) continue;

      const cantidadDisponible = opcion.cantidad_disponible || cantidadSolicitada;
      if (cantidadDisponible <= 0) continue;

      const cantidadAsignar = Math.min(cantidadRestante, cantidadDisponible);

      nuevasFuentes.push({
        opcion,
        cantidad_asignada: cantidadAsignar,
        notas: "Seleccion automatica",
      });

      opcionesUsadas.add(opcion.opcion_id);
      cantidadRestante -= cantidadAsignar;
    }

    // Si aun falta cantidad y hay opciones con cantidad ilimitada (proveedores), usar la mejor
    if (cantidadRestante > 0) {
      const proveedorDisponible = opcionesOrdenadas.find(
        op => op.tipo === "proveedor" && !opcionesUsadas.has(op.opcion_id)
      );
      if (proveedorDisponible) {
        nuevasFuentes.push({
          opcion: proveedorDisponible,
          cantidad_asignada: cantidadRestante,
          notas: "Seleccion automatica - completar faltante",
        });
      }
    }

    if (nuevasFuentes.length > 0) {
      // Marcar que se uso "Aceptar Sugerido" para delay mas largo en auto-avance
      setUsandoSugerido(true);
      setFuentesSeleccionadas(nuevasFuentes);

      // Propagar cambio hacia arriba
      const decisionMultiFuente = {
        fuentes: nuevasFuentes,
        comentario,
        cantidad_solicitada: cantidadSolicitada,
      };
      onSelectDecision?.(currentIdx, decisionMultiFuente);
    }
  }, [dataOpciones, cantidadSolicitada, comentario, currentIdx, onSelectDecision]);

  // Verificar si hay excedente en algun item
  const tieneExcedente = useMemo(() => {
    for (let i = 0; i < totalItems; i++) {
      const dec = decisiones[i];
      if (!dec || !dec.fuentes) continue;
      const asignado = dec.fuentes.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
      const solicitado = Number(items[i]?.cantidad || 0);
      if (asignado > solicitado) return true;
    }
    return false;
  }, [decisiones, items, totalItems]);

  // Manejar avance con verificacion de excedente
  const handleNextWithCheck = useCallback(() => {
    if (tieneExcedente) {
      setShowExcedenteModal(true);
    } else {
      onNext?.();
    }
  }, [tieneExcedente, onNext]);

  // Validar completitud: todos los items deben tener decision completa
  const itemsPendientes = useMemo(() => {
    let pendientes = 0;
    for (let i = 0; i < totalItems; i++) {
      const dec = decisiones[i];
      if (!dec || !dec.fuentes || dec.fuentes.length === 0) {
        pendientes++;
      } else {
        const total = dec.fuentes.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
        const requerido = Number(items[i]?.cantidad || 0);
        if (total < requerido) pendientes++;
      }
    }
    return pendientes;
  }, [decisiones, items, totalItems]);

  const puedeAvanzar = itemsPendientes === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Panel de asignacion actual */}
      {fuentesSeleccionadas.length > 0 && (
        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            border: 2,
            borderColor: 'primary.main',
            bgcolor: 'rgba(25, 118, 210, 0.04)',
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Layers sx={{ width: 18, height: 18, color: 'primary.main' }} />
                <Typography variant="subtitle2" fontWeight="bold">
                  Fuentes Seleccionadas ({fuentesSeleccionadas.length})
                </Typography>
              </Stack>
              <Box>
                {excedente > 0 ? (
                  <Chip
                    size="small"
                    icon={<AlertTriangle sx={{ width: 16, height: 16 }} />}
                    label={`Excede +${excedente} un.`}
                    sx={{ bgcolor: 'warning.light', color: 'warning.dark', fontWeight: 'bold' }}
                  />
                ) : itemCompleto ? (
                  <Chip
                    size="small"
                    icon={<CheckCircle sx={{ width: 16, height: 16 }} />}
                    label="Completo"
                    sx={{ bgcolor: 'success.light', color: 'success.dark', fontWeight: 'bold' }}
                  />
                ) : (
                  <Chip
                    size="small"
                    icon={<AlertTriangle sx={{ width: 16, height: 16 }} />}
                    label={`Faltan ${faltante} un.`}
                    sx={{ bgcolor: 'grey.200', color: 'text.secondary', fontWeight: 'bold' }}
                  />
                )}
              </Box>
            </Stack>

            {/* Lista de fuentes seleccionadas con cantidades */}
            <Stack spacing={1}>
              {fuentesSeleccionadas.map((fuente, idx) => (
                <FuenteSeleccionadaCard
                  key={fuente.opcion?.opcion_id || idx}
                  fuente={fuente}
                  onChangeCantidad={(val) => actualizarCantidad(fuente.opcion?.opcion_id, val)}
                  onRemove={() => toggleFuente(fuente.opcion)}
                />
              ))}
            </Stack>

            {/* Resumen de cantidades */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}
            >
              <Typography variant="body2" color="text.secondary">
                <Box component="span" fontWeight="bold" color="text.primary">{totalAsignado}</Box> de{" "}
                <Box component="span" fontWeight="bold" color="text.primary">{cantidadSolicitada}</Box> asignados
              </Typography>
              <Box sx={{ width: 128, height: 8, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: `${Math.min(100, (totalAsignado / cantidadSolicitada) * 100)}%`,
                    bgcolor: excedente > 0 ? 'warning.main' : itemCompleto ? 'success.main' : 'primary.main',
                    transition: 'all 0.3s',
                  }}
                />
              </Box>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Barra de controles: Vista izq + Filtros centro + Navegacion items derecha */}
      {dataOpciones.length > 0 && (
        <Paper sx={{ p: 1.5, borderRadius: 2, position: 'relative' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* Toggle Vista - Izquierda */}
            <Stack direction="row" spacing={1}>
              <Tooltip title="Vista tarjetas">
                <IconButton
                  size="small"
                  onClick={() => setVistaTabla(false)}
                  sx={{
                    border: 2,
                    borderColor: !vistaTabla ? 'primary.main' : 'divider',
                    color: !vistaTabla ? 'primary.main' : 'text.secondary',
                    bgcolor: 'background.paper',
                  }}
                >
                  <LayoutGrid sx={{ width: 18, height: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Vista tabla">
                <IconButton
                  size="small"
                  onClick={() => setVistaTabla(true)}
                  sx={{
                    border: 2,
                    borderColor: vistaTabla ? 'primary.main' : 'divider',
                    color: vistaTabla ? 'primary.main' : 'text.secondary',
                    bgcolor: 'background.paper',
                  }}
                >
                  <List sx={{ width: 18, height: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Filtros por tipo - Centro */}
            <Stack direction="row" flexWrap="wrap" justifyContent="center" spacing={1} sx={{ flex: 1, px: 2 }}>
              <FilterButton
                active={filtroTipo === "todos"}
                onClick={() => setFiltroTipo("todos")}
                icon={Layers}
                label="Todas"
                count={conteoTipos.todos}
                color="primary"
              />
              {conteoTipos.stock > 0 && (
                <FilterButton
                  active={filtroTipo === "stock"}
                  onClick={() => setFiltroTipo("stock")}
                  icon={Warehouse}
                  label="Stock"
                  count={conteoTipos.stock}
                  color="success"
                />
              )}
              {conteoTipos.transferencia > 0 && (
                <FilterButton
                  active={filtroTipo === "transferencia"}
                  onClick={() => setFiltroTipo("transferencia")}
                  icon={ArrowLeftRight}
                  label="Transfer."
                  count={conteoTipos.transferencia}
                  color="secondary"
                />
              )}
              {conteoTipos.proveedor > 0 && (
                <FilterButton
                  active={filtroTipo === "proveedor"}
                  onClick={() => setFiltroTipo("proveedor")}
                  icon={Truck}
                  label="Proveedor"
                  count={conteoTipos.proveedor}
                  color="info"
                />
              )}
              {conteoTipos.equivalencia > 0 && (
                <FilterButton
                  active={filtroTipo === "equivalencia"}
                  onClick={() => setFiltroTipo("equivalencia")}
                  icon={RefreshCw}
                  label="Equiv."
                  count={conteoTipos.equivalencia}
                  color="secondary"
                />
              )}
              {conteoTipos.mix > 0 && (
                <FilterButton
                  active={filtroTipo === "mix"}
                  onClick={() => setFiltroTipo("mix")}
                  icon={Layers}
                  label="Mix"
                  count={conteoTipos.mix}
                  color="info"
                />
              )}

              {/* Separador visual */}
              <Box sx={{ width: 1, height: 24, bgcolor: 'divider', mx: 0.5 }} />

              {/* Boton Aceptar Sugerido - Destacado al final */}
              <Button
                size="small"
                variant="contained"
                onClick={aceptarSugerido}
                disabled={dataOpciones.length === 0 || itemCompleto}
                startIcon={<Sparkles sx={{ width: 16, height: 16 }} />}
                sx={{
                  background: itemCompleto
                    ? undefined
                    : 'linear-gradient(45deg, #10b981 30%, #14b8a6 90%)',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  px: 2,
                }}
              >
                Aceptar Sugerido
              </Button>
            </Stack>

            {/* Navegacion entre items - Derecha */}
            {totalItems > 1 && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => onChangeIdx?.(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                >
                  <ChevronLeft sx={{ width: 18, height: 18 }} />
                </IconButton>
                <Typography variant="body2" fontWeight="bold" sx={{ px: 1 }}>
                  Item {currentIdx + 1}/{totalItems}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => onChangeIdx?.(Math.min(totalItems - 1, currentIdx + 1))}
                  disabled={currentIdx >= totalItems - 1}
                >
                  <ChevronRight sx={{ width: 18, height: 18 }} />
                </IconButton>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {/* Opciones de abastecimiento */}
      <Box>
        {loadingOpciones && dataOpciones.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Cargando opciones...</Typography>
        ) : vistaTabla ? (
          <OpcionesTablaMulti
            opciones={opcionesFiltradas}
            fuentesSeleccionadas={fuentesSeleccionadas}
            onToggle={toggleFuente}
            isSelected={isSelected}
          />
        ) : (
          <Stack spacing={2}>
            {/* Cards de Stock Categorizado */}
            {hayStockCategorizado && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                  gap: 2,
                }}
              >
                {/* Stock Local */}
                {stockCategorizado.local.total > 0 && (
                  <StockCategoriaCard
                    categoria="local"
                    titulo="Stock Local"
                    subtitulo={`Centro ${centroSolicitud} / Almacen ${almacenSolicitud}`}
                    icono={Warehouse}
                    colorIcono="success.main"
                    colorBorde="success.light"
                    colorFondo="success.lighter"
                    colorBadge={{ bgcolor: 'success.light', color: 'success.dark' }}
                    total={stockCategorizado.local.total}
                    ubicaciones={stockCategorizado.local.items}
                    selectedCount={countSelectedInCategoria("local")}
                    isUbicacionSelected={(u) => isStockUbicacionSelected(u, "local")}
                    onToggleUbicacion={(u) => toggleStockUbicacion(u, "local")}
                    centroSolicitud={centroSolicitud}
                  />
                )}

                {/* Stock Interno Disponible */}
                {stockCategorizado.disponible.total > 0 && (
                  <StockCategoriaCard
                    categoria="disponible"
                    titulo="Stock Interno Disponible"
                    subtitulo="Almacenes 0100 y 9999"
                    icono={Package}
                    colorIcono="info.main"
                    colorBorde="info.light"
                    colorFondo="info.lighter"
                    colorBadge={{ bgcolor: 'info.light', color: 'info.dark' }}
                    total={stockCategorizado.disponible.total}
                    ubicaciones={stockCategorizado.disponible.items}
                    selectedCount={countSelectedInCategoria("disponible")}
                    isUbicacionSelected={(u) => isStockUbicacionSelected(u, "disponible")}
                    onToggleUbicacion={(u) => toggleStockUbicacion(u, "disponible")}
                    centroSolicitud={centroSolicitud}
                  />
                )}

                {/* Stock Interno No Disponible */}
                {stockCategorizado.noDisponible.total > 0 && (
                  <StockCategoriaCard
                    categoria="noDisponible"
                    titulo="Stock No Disponible"
                    subtitulo="Requiere consulta"
                    icono={MapPin}
                    colorIcono="warning.main"
                    colorBorde="warning.light"
                    colorFondo="warning.lighter"
                    colorBadge={{ bgcolor: 'warning.light', color: 'warning.dark' }}
                    total={stockCategorizado.noDisponible.total}
                    ubicaciones={stockCategorizado.noDisponible.items}
                    selectedCount={countSelectedInCategoria("noDisponible")}
                    isUbicacionSelected={(u) => isStockUbicacionSelected(u, "noDisponible")}
                    onToggleUbicacion={(u) => toggleStockUbicacion(u, "noDisponible")}
                    centroSolicitud={centroSolicitud}
                  />
                )}

                {/* Materiales Equivalentes */}
                {opcionesEquivalencias.length > 0 && (
                  <EquivalenciasCard
                    equivalencias={opcionesEquivalencias}
                    isSelected={isSelected}
                    onToggle={toggleFuente}
                    selectedCount={fuentesSeleccionadas.filter(f => f.opcion?.tipo === "equivalencia").length}
                  />
                )}
              </Box>
            )}

            {/* Fallback: Opciones de Stock del backend si no hay categorizado */}
            {!hayStockCategorizado && opcionesStock.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5, mb: 1 }}>
                  <Warehouse sx={{ width: 18, height: 18, color: 'success.main' }} />
                  <Typography variant="subtitle2" fontWeight="bold">Stock Disponible</Typography>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  {opcionesStock.map((op) => (
                    <OpcionCardMulti
                      key={op.opcion_id}
                      opcion={op}
                      selected={isSelected(op.opcion_id)}
                      onToggle={() => toggleFuente(op)}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Proveedores Externos */}
            {opcionesNoStock.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5, mb: 1 }}>
                  <Truck sx={{ width: 18, height: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" fontWeight="bold">PROVEEDORES EXTERNOS</Typography>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  {opcionesNoStock.map((op) => (
                    <OpcionCardMulti
                      key={op.opcion_id}
                      opcion={op}
                      selected={isSelected(op.opcion_id)}
                      onToggle={() => toggleFuente(op)}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Sin opciones */}
            {!hayStockCategorizado && opcionesStock.length === 0 && opcionesNoStock.length === 0 && (
              <Paper
                sx={{
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 3,
                  border: 2,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                }}
              >
                <Package sx={{ width: 32, height: 32, mx: 'auto', color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" fontWeight="medium">Sin opciones de abastecimiento</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  No se encontro stock ni alternativas para este material
                </Typography>
              </Paper>
            )}
          </Stack>
        )}
      </Box>

      {/* Modal de confirmacion de excedente */}
      <Dialog
        open={showExcedenteModal}
        onClose={() => setShowExcedenteModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'warning.light',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle sx={{ width: 24, height: 24, color: 'warning.main' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Cantidad excede lo solicitado
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Has asignado mas unidades de las solicitadas en uno o mas items.
            Esto puede generar stock de reserva adicional.
          </Typography>
          <Typography variant="body2" fontWeight="medium" sx={{ mt: 2 }}>
            Deseas continuar con esta asignacion?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="text"
            onClick={() => setShowExcedenteModal(false)}
          >
            Revisar cantidades
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowExcedenteModal(false);
              onNext?.();
            }}
          >
            Si, continuar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// =============================================================================
// Componente: Card de Categoria de Stock con ubicaciones seleccionables
// =============================================================================

function StockCategoriaCard({
  categoria,
  titulo,
  subtitulo,
  icono: Icono,
  colorIcono,
  colorBorde,
  colorFondo,
  colorBadge,
  total,
  ubicaciones,
  selectedCount,
  isUbicacionSelected,
  onToggleUbicacion,
  centroSolicitud,
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSelection = selectedCount > 0;

  return (
    <Paper
      sx={{
        borderRadius: 3,
        border: 2,
        borderColor: hasSelection ? 'primary.main' : colorBorde,
        bgcolor: hasSelection ? 'rgba(25, 118, 210, 0.04)' : colorFondo,
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
    >
      {/* Header - clickeable para expandir/colapsar */}
      <Box
        component="button"
        onClick={() => setExpanded(!expanded)}
        sx={{
          width: '100%',
          textAlign: 'left',
          p: 2,
          bgcolor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Icono sx={{ width: 20, height: 20, color: colorIcono }} />
            <Typography variant="subtitle2" fontWeight="bold">{titulo}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            {hasSelection && (
              <Chip
                size="small"
                label={`${selectedCount} sel.`}
                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 'bold', height: 22 }}
              />
            )}
            <Chip
              size="small"
              label={`${total} un.`}
              sx={{ ...colorBadge, fontWeight: 'bold', height: 22 }}
            />
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary">{subtitulo}</Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {ubicaciones.length} ubicacion{ubicaciones.length !== 1 ? "es" : ""}
          </Typography>
          <Typography variant="caption" color="primary.main" fontWeight="medium">
            {expanded ? "Colapsar" : "Ver ubicaciones"}
          </Typography>
        </Stack>
      </Box>

      {/* Lista de ubicaciones expandida */}
      <Collapse in={expanded}>
        <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', maxHeight: 192, overflowY: 'auto' }}>
          {ubicaciones.map((u, idx) => {
            const isSelected = isUbicacionSelected(u);
            const esMismoCentro = String(u.centro || "") === centroSolicitud;

            return (
              <Box
                key={idx}
                component="button"
                onClick={() => onToggleUbicacion(u)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1.5,
                  textAlign: 'left',
                  bgcolor: isSelected ? 'primary.lighter' : 'transparent',
                  border: 'none',
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: isSelected ? 'primary.light' : 'grey.100' },
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    size="small"
                    sx={{ p: 0 }}
                  />

                  {/* Info ubicacion */}
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight="semibold">
                        {u.centro}/{String(u.almacen || "").padStart(4, "0")}
                      </Typography>
                      {esMismoCentro && (
                        <Chip
                          size="small"
                          label="MISMO CENTRO"
                          sx={{
                            height: 18,
                            fontSize: '0.625rem',
                            fontWeight: 'bold',
                            bgcolor: 'success.light',
                            color: 'success.dark',
                          }}
                        />
                      )}
                    </Stack>
                    {u.nombre_almacen && (
                      <Typography variant="caption" color="text.secondary">{u.nombre_almacen}</Typography>
                    )}
                  </Box>
                </Stack>

                {/* Cantidad */}
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight="bold">{u.cantidad}</Typography>
                  <Typography variant="caption" color="text.secondary">un.</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}

// =============================================================================
// Componente: Equivalencias Card (similar a StockCategoriaCard)
// =============================================================================

function EquivalenciasCard({ equivalencias, isSelected, onToggle, selectedCount }) {
  const [expanded, setExpanded] = useState(false);
  const hasSelection = selectedCount > 0;

  return (
    <Paper
      sx={{
        borderRadius: 3,
        border: 2,
        borderColor: hasSelection ? 'primary.main' : 'secondary.light',
        bgcolor: hasSelection ? 'rgba(25, 118, 210, 0.04)' : 'secondary.lighter',
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <Box
        component="button"
        onClick={() => setExpanded(!expanded)}
        sx={{
          width: '100%',
          textAlign: 'left',
          p: 2,
          bgcolor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <RefreshCw sx={{ width: 20, height: 20, color: 'secondary.main' }} />
            <Typography variant="subtitle2" fontWeight="bold">Mat. Equivalentes</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            {hasSelection && (
              <Chip
                size="small"
                label={`${selectedCount} sel.`}
                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 'bold', height: 22 }}
              />
            )}
            <Chip
              size="small"
              label={`${equivalencias.length} opciones`}
              sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', fontWeight: 'bold', height: 22 }}
            />
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary">Materiales alternativos compatibles</Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {equivalencias.length} alternativa{equivalencias.length !== 1 ? "s" : ""}
          </Typography>
          <Typography variant="caption" color="secondary.main" fontWeight="medium">
            {expanded ? "Colapsar" : "Ver opciones"}
          </Typography>
        </Stack>
      </Box>

      {/* Lista expandida */}
      <Collapse in={expanded}>
        <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', maxHeight: 192, overflowY: 'auto' }}>
          {equivalencias.map((eq) => {
            const selected = isSelected(eq.opcion_id);
            return (
              <Box
                key={eq.opcion_id}
                component="button"
                onClick={() => onToggle(eq)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1.5,
                  textAlign: 'left',
                  bgcolor: selected ? 'primary.lighter' : 'transparent',
                  border: 'none',
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: selected ? 'primary.light' : 'grey.100' },
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="medium" noWrap>{eq.nombre}</Typography>
                    {eq.compatibilidad_pct != null && (
                      <Typography variant="caption" color="text.secondary">{eq.compatibilidad_pct}% compatible</Typography>
                    )}
                  </Box>
                </Stack>
                <Typography variant="body2" fontWeight="bold" sx={{ flexShrink: 0 }}>
                  {formatMonto(eq.precio_unitario || 0)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}

// =============================================================================
// Componente: Filtro Button
// =============================================================================

function FilterButton({ active, onClick, icon: Icon, label, count, color }) {
  const colorMap = {
    primary: 'primary.main',
    success: 'success.main',
    info: 'info.main',
    warning: 'warning.main',
    secondary: 'secondary.main',
  };
  const activeColor = colorMap[color] || colorMap.primary;

  return (
    <Button
      size="small"
      variant={active ? "outlined" : "text"}
      onClick={onClick}
      startIcon={<Icon sx={{ width: 16, height: 16 }} />}
      sx={{
        fontWeight: 'semibold',
        fontSize: '0.75rem',
        color: active ? activeColor : 'text.secondary',
        borderColor: active ? activeColor : 'transparent',
        borderWidth: active ? 2 : 1,
        '&:hover': {
          color: activeColor,
          borderColor: activeColor,
        },
      }}
    >
      {label} ({count})
    </Button>
  );
}

// =============================================================================
// Componente: Fuente Seleccionada Card (con cantidad editable)
// =============================================================================

function FuenteSeleccionadaCard({ fuente, onChangeCantidad, onRemove }) {
  const opcion = fuente.opcion || {};
  const tipoConfig = getTipoConfig(opcion.tipo);
  const TipoIcon = tipoConfig.icon;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        {/* Icono tipo */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 2,
            bgcolor: 'grey.100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: tipoConfig.color,
          }}
        >
          <TipoIcon sx={{ width: 18, height: 18 }} />
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight="semibold" noWrap>{opcion.nombre}</Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase">
              {opcion.tipo}
            </Typography>
            {opcion.precio_es_negociado && (
              <Stack direction="row" alignItems="center" spacing={0.25}>
                <DollarSign sx={{ width: 12, height: 12, color: 'success.main' }} />
                <Typography variant="caption" color="success.main">Negociado</Typography>
              </Stack>
            )}
            {opcion.cantidad_disponible && (
              <Typography variant="caption" color="text.secondary">Disp: {opcion.cantidad_disponible}</Typography>
            )}
          </Stack>
        </Box>

        {/* Cantidad editable */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton
            size="small"
            onClick={() => onChangeCantidad(Number(fuente.cantidad_asignada || 0) - 1)}
            sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
          >
            <Minus sx={{ width: 16, height: 16 }} />
          </IconButton>
          <TextField
            type="number"
            value={fuente.cantidad_asignada || 0}
            onChange={(e) => onChangeCantidad(e.target.value)}
            inputProps={{ min: 0, style: { textAlign: 'center', fontWeight: 'bold' } }}
            size="small"
            sx={{ width: 64, '& .MuiInputBase-input': { py: 0.5 } }}
          />
          <IconButton
            size="small"
            onClick={() => onChangeCantidad(Number(fuente.cantidad_asignada || 0) + 1)}
            sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
          >
            <Plus sx={{ width: 16, height: 16 }} />
          </IconButton>
        </Stack>

        {/* Precio */}
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography variant="body2" fontWeight="bold">{formatMonto(opcion.precio_unitario || 0)}</Typography>
          <Typography variant="caption" color="text.secondary">
            Total: {formatMonto((opcion.precio_unitario || 0) * (fuente.cantidad_asignada || 0))}
          </Typography>
        </Box>

        {/* Boton eliminar */}
        <IconButton
          size="small"
          onClick={onRemove}
          sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.lighter' } }}
        >
          <X sx={{ width: 16, height: 16 }} />
        </IconButton>
      </Stack>
    </Paper>
  );
}

// =============================================================================
// Componente: Opcion Card Multi-seleccion (con checkbox)
// =============================================================================

function OpcionCardMulti({ opcion, selected, onToggle }) {
  const isRecomendada = opcion.is_recomendada === true;
  const tipoConfig = getTipoConfig(opcion.tipo);
  const TipoIcon = tipoConfig.icon;
  const esProveedor = opcion.tipo === "proveedor";

  return (
    <Paper
      component="button"
      onClick={onToggle}
      sx={{
        textAlign: 'left',
        p: 1.5,
        borderRadius: 3,
        border: 2,
        borderColor: selected
          ? 'primary.main'
          : isRecomendada
          ? 'primary.light'
          : 'divider',
        bgcolor: selected
          ? 'rgba(25, 118, 210, 0.06)'
          : isRecomendada
          ? 'primary.lighter'
          : 'background.paper',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
        },
      }}
    >
      {esProveedor ? (
        /* === CARD COMPACTA PARA PROVEEDOR === */
        <>
          {/* Linea 1: Checkbox + PROVEEDOR: Nombre | Precio + badges */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
              <Truck sx={{ width: 16, height: 16, color: 'info.main', flexShrink: 0 }} />
              <Typography variant="body2" fontWeight="bold" noWrap>
                {opcion.nombre}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
              {opcion.precio_es_negociado && (
                <Chip
                  size="small"
                  icon={<DollarSign sx={{ width: 12, height: 12 }} />}
                  label="NEG"
                  sx={{ height: 20, fontSize: '0.625rem', fontWeight: 'bold', borderColor: 'success.main', color: 'success.main' }}
                  variant="outlined"
                />
              )}
              {isRecomendada && (
                <Chip
                  size="small"
                  label="*"
                  sx={{ height: 20, fontSize: '0.625rem', fontWeight: 'bold', borderColor: 'primary.main', color: 'primary.main' }}
                  variant="outlined"
                />
              )}
              <Typography variant="body2" fontWeight="bold">
                {formatMonto(opcion.precio_unitario || 0)}
              </Typography>
            </Stack>
          </Stack>

          {/* Linea 2: Plazo + Rating */}
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Plazo: <Box component="span" fontWeight="bold" color="text.primary">{opcion.plazo_dias ?? "N/D"}</Box> dias
            </Typography>
            {opcion.rating && (
              <Typography variant="caption" color="text.secondary">
                Rating: <Box component="span" fontWeight="bold" color="text.primary">{opcion.rating}/5</Box>
              </Typography>
            )}
          </Stack>
        </>
      ) : (
        /* === CARD NORMAL PARA OTROS TIPOS (stock, transferencia, equivalencia) === */
        <>
          {/* Header: Checkbox + Tipo + Badge */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
              <TipoIcon sx={{ width: 16, height: 16, color: tipoConfig.color }} />
              <Typography variant="caption" textTransform="uppercase" fontWeight="bold" letterSpacing={0.5}>
                {opcion.tipo}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              {opcion.precio_es_negociado && (
                <Chip
                  size="small"
                  icon={<DollarSign sx={{ width: 12, height: 12 }} />}
                  label="NEGOCIADO"
                  sx={{ height: 20, fontSize: '0.5625rem', fontWeight: 'bold', borderColor: 'success.main', color: 'success.main' }}
                  variant="outlined"
                />
              )}
              {isRecomendada && (
                <Chip
                  size="small"
                  label="* MEJOR"
                  sx={{ height: 20, fontSize: '0.625rem', fontWeight: 'bold', borderColor: 'primary.main', color: 'primary.main', bgcolor: 'background.paper' }}
                  variant="outlined"
                />
              )}
            </Stack>
          </Stack>

          {/* Nombre y precio */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
            <Typography variant="body1" fontWeight="bold" sx={{ lineHeight: 1.3 }}>{opcion.nombre}</Typography>
            <Typography variant="body2" fontWeight="bold" sx={{ flexShrink: 0 }}>{formatMonto(opcion.precio_unitario || 0)}</Typography>
          </Stack>

          {/* Info de transferencia */}
          {opcion.tipo === "transferencia" && opcion.centro_origen && (
            <Typography variant="caption" color="secondary.main" sx={{ mt: 0.5, display: 'block' }}>
              Desde: {opcion.centro_origen} / {opcion.almacen_origen || "N/D"}
            </Typography>
          )}

          {/* Metricas en linea */}
          <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight="bold" color="text.primary">{opcion.cantidad_disponible ?? "N/D"}</Box> disponibles
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight="bold" color="text.primary">{opcion.plazo_dias ?? "N/D"}</Box> dias
            </Typography>
            {opcion.compatibilidad_pct != null && (
              <Typography variant="caption" color="text.secondary">
                <Box component="span" fontWeight="bold" color="text.primary">{opcion.compatibilidad_pct}%</Box> compatible
              </Typography>
            )}
          </Stack>

          {opcion.observaciones && (
            <Typography variant="caption" color="text.secondary" fontStyle="italic" sx={{ mt: 1, display: 'block' }}>
              {opcion.observaciones}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
}

// =============================================================================
// Componente: Opciones Tabla Multi-seleccion
// =============================================================================

function OpcionesTablaMulti({ opciones, fuentesSeleccionadas, onToggle, isSelected }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell padding="checkbox" sx={{ width: 40 }} />
            <TableCell sx={{ fontWeight: 'semibold' }}>Opcion</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'semibold' }}>Precio</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'semibold' }}>Plazo</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'semibold' }}>Disponible</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'semibold' }}>Puntuacion</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {opciones.map((op) => {
            const isRecomendada = op.is_recomendada === true;
            const score = op.score_recomendacion || 0;
            const selected = isSelected(op.opcion_id);
            const tipoConfig = getTipoConfig(op.tipo);
            const TipoIcon = tipoConfig.icon;

            return (
              <TableRow
                key={op.opcion_id}
                hover
                onClick={() => onToggle(op)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: selected
                    ? 'rgba(25, 118, 210, 0.12)'
                    : isRecomendada
                    ? 'rgba(25, 118, 210, 0.06)'
                    : 'transparent',
                }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggle(op)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: tipoConfig.color,
                      }}
                    >
                      <TipoIcon sx={{ width: 16, height: 16 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight="semibold" noWrap>{op.nombre}</Typography>
                        {op.precio_es_negociado && (
                          <Chip size="small" label="$" sx={{ height: 18, fontSize: '0.625rem', fontWeight: 'bold', borderColor: 'success.main', color: 'success.main' }} variant="outlined" />
                        )}
                        {isRecomendada && (
                          <Chip size="small" label="*" sx={{ height: 18, fontSize: '0.625rem', fontWeight: 'bold', borderColor: 'primary.main', color: 'primary.main', bgcolor: 'background.paper' }} variant="outlined" />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                        {op.tipo}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold">{formatMonto(op.precio_unitario || 0)}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight="medium" color={op.plazo_dias <= 3 ? 'success.main' : 'text.primary'}>
                    {op.plazo_dias ?? "N/D"} d
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight="medium">
                    {op.cantidad_disponible ?? op.cantidad_solicitada ?? "N/D"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {score > 0 ? (
                    <Stack alignItems="center" spacing={0.5}>
                      <Typography
                        variant="caption"
                        fontWeight="bold"
                        color={isRecomendada ? 'primary.main' : 'text.primary'}
                      >
                        {score.toFixed(0)}
                      </Typography>
                      <Box sx={{ width: 56, height: 4, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${score}%`,
                            bgcolor: isRecomendada ? 'primary.main' : 'info.main',
                          }}
                        />
                      </Box>
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {opciones.length === 0 && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Package sx={{ width: 32, height: 32, mx: 'auto', color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No hay opciones disponibles</Typography>
        </Box>
      )}
    </Paper>
  );
}

// =============================================================================
// Helpers y Componentes Auxiliares
// =============================================================================

function getTipoConfig(tipo) {
  const configs = {
    stock: { icon: Warehouse, color: 'success.main' },
    transferencia: { icon: ArrowLeftRight, color: 'secondary.main' },
    proveedor: { icon: Truck, color: 'info.main' },
    equivalencia: { icon: RefreshCw, color: 'secondary.main' },
    mix: { icon: Layers, color: 'info.main' },
  };
  return configs[tipo] || { icon: Package, color: 'text.secondary' };
}

function renderMrpBadge({ item, mostrarMrp, setMostrarMrp }) {
  const status = getMrpStatus(item);

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Layers sx={{ width: 16, height: 16, color: 'secondary.main' }} />
      <Box>
        <Typography variant="caption" color="text.secondary">MRP</Typography>
        {!status.planificado ? (
          <Typography variant="body2" fontWeight="bold" color="error.main">No planificado</Typography>
        ) : (
          <Box
            component="button"
            onClick={() => setMostrarMrp?.(!mostrarMrp)}
            sx={{ bgcolor: 'transparent', border: 'none', cursor: 'pointer', p: 0 }}
          >
            {status.warn ? (
              <Typography variant="body2" fontWeight="bold" color="error.main">Bajo punto pedido</Typography>
            ) : (
              <Typography variant="body2" fontWeight="bold" color="success.main">Planificado</Typography>
            )}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function MrpDetalle({ item, solicitud, onClose }) {
  const status = getMrpStatus(item);
  const d = status.detalle;
  const total = status.total;

  return (
    <Paper sx={{ mt: 1.5, p: 2, borderRadius: 3, bgcolor: 'grey.50' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" fontWeight="bold">Detalle MRP</Typography>
          <Button size="small" variant="text" onClick={onClose}>Cerrar</Button>
        </Stack>
        {status.warn && (
          <Paper sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'error.lighter', border: 1, borderColor: 'error.light' }}>
            <Typography variant="body2" fontWeight="semibold" color="error.dark">
              Alerta: stock actual + pedidos ({total}) esta por debajo del punto de pedido ({d.punto_pedido ?? "N/D"}). Revisar gestion MRP.
            </Typography>
          </Paper>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          <MrpField label="Centro/Almacen" value={`${solicitud?.centro || "N/D"} / ${solicitud?.almacen_virtual || "N/D"}`} />
          <MrpField label="Stock de seguridad" value={d.stock_seguridad ?? "N/D"} />
          <MrpField label="Punto de pedido" value={d.punto_pedido ?? "N/D"} />
          <MrpField label="Stock maximo" value={d.stock_maximo ?? "N/D"} />
          <MrpField label="Stock actual (centro)" value={d.stock_actual ?? "N/D"} />
          <MrpField label="Pedidos en curso" value={d.pedidos_en_curso ?? "N/D"} />
          <MrpField label="Total stock + pedidos" value={total} />
        </Box>
      </Stack>
    </Paper>
  );
}

function MrpField({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography variant="caption" textTransform="uppercase" fontWeight="bold" letterSpacing={0.5} color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="semibold">{value}</Typography>
    </Paper>
  );
}

function getMrpStatus(item) {
  const detalle = item?.mrp_detalle || item?.mrp || {};
  const planificado =
    isTrueish(item?.mrp_planificado) ||
    isTrueish(detalle.planificado) ||
    isTrueish(detalle.estado) ||
    Object.keys(detalle).length > 0;
  const stockActual = Number(detalle.stock_actual || 0);
  const pedidos = Number(detalle.pedidos_en_curso || 0);
  const punto = Number(detalle.punto_pedido || 0);
  const warn = planificado && punto > 0 && stockActual + pedidos < punto;
  return {
    planificado,
    warn,
    detalle,
    total: stockActual + pedidos,
  };
}

function isMrpPlanificado(item) {
  return getMrpStatus(item).planificado;
}

function isTrueish(val) {
  if (val === true) return true;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    return ["si", "si", "true", "1", "planificado", "yes"].includes(normalized);
  }
  if (typeof val === "number") return val === 1;
  return false;
}

function formatMonto(val) {
  const num = Number(val || 0);
  return `USD ${num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
