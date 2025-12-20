import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "../ui/Button";
import {
  Package, MapPin, Check, Warehouse, Truck, RefreshCw, Layers,
  LayoutGrid, List, ChevronLeft, ChevronRight, ArrowLeftRight,
  DollarSign, AlertTriangle, CheckCircle, Plus, Minus, Sparkles
} from "../ui/Icons";
import { formatAlmacen } from "../../utils/formatters";

/**
 * Paso2DecisionAbastecimiento - Componente de selección MULTI-FUENTE
 *
 * Permite seleccionar múltiples fuentes de abastecimiento para un ítem,
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

  // Estado local para multi-selección del item actual
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
    // 2. Hay más items después del actual
    // 3. Hay al menos una fuente seleccionada (evitar avance con item vacío)
    if (
      itemCompleto &&
      !prevItemCompletoRef.current &&
      currentIdx < totalItems - 1 &&
      fuentesSeleccionadas.length > 0
    ) {
      // Delay más largo si usó "Aceptar Sugerido" para ver la selección
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

  // Reset de la ref cuando cambia el ítem actual
  useEffect(() => {
    prevItemCompletoRef.current = itemCompleto;
    setUsandoSugerido(false);
  }, [currentIdx]);

  // Filtrar opciones según el tipo seleccionado
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

    // Stock Local: mismo centro Y almacén
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

  // Verificar si una opción está seleccionada
  const isSelected = useCallback((opcionId) => {
    return fuentesSeleccionadas.some(f => f.opcion?.opcion_id === opcionId);
  }, [fuentesSeleccionadas]);

  // Toggle selección de una fuente
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

  // Actualizar cantidad de una fuente específica (sin límite estricto)
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

  // Seleccionar/deseleccionar una ubicación específica de stock
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

  // Verificar si una ubicación específica está seleccionada
  const isStockUbicacionSelected = useCallback((ubicacion, categoria) => {
    const opcionId = `stock_${categoria}_${ubicacion.centro}_${String(ubicacion.almacen || "").padStart(4, "0")}`;
    return fuentesSeleccionadas.some(f => f.opcion?.opcion_id === opcionId);
  }, [fuentesSeleccionadas]);

  // Contar cuántas ubicaciones de una categoría están seleccionadas
  const countSelectedInCategoria = useCallback((categoria) => {
    return fuentesSeleccionadas.filter(f => f.opcion?.categoria === categoria).length;
  }, [fuentesSeleccionadas]);

  // Función para aceptar automáticamente las opciones más convenientes
  const aceptarSugerido = useCallback(() => {
    if (dataOpciones.length === 0) return;

    let cantidadRestante = cantidadSolicitada;
    const nuevasFuentes = [];
    const opcionesUsadas = new Set();

    // Ordenar todas las opciones por conveniencia:
    // 1. Primero las recomendadas
    // 2. Luego por score de recomendación (mayor primero)
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
        notas: "Selección automática",
      });

      opcionesUsadas.add(opcion.opcion_id);
      cantidadRestante -= cantidadAsignar;
    }

    // Si aún falta cantidad y hay opciones con cantidad ilimitada (proveedores), usar la mejor
    if (cantidadRestante > 0) {
      const proveedorDisponible = opcionesOrdenadas.find(
        op => op.tipo === "proveedor" && !opcionesUsadas.has(op.opcion_id)
      );
      if (proveedorDisponible) {
        nuevasFuentes.push({
          opcion: proveedorDisponible,
          cantidad_asignada: cantidadRestante,
          notas: "Selección automática - completar faltante",
        });
      }
    }

    if (nuevasFuentes.length > 0) {
      // Marcar que se usó "Aceptar Sugerido" para delay más largo en auto-avance
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

  // Verificar si hay excedente en algún ítem
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

  // Manejar avance con verificación de excedente
  const handleNextWithCheck = useCallback(() => {
    if (tieneExcedente) {
      setShowExcedenteModal(true);
    } else {
      onNext?.();
    }
  }, [tieneExcedente, onNext]);

  // Validar completitud: todos los items deben tener decisión completa
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
    <div className="space-y-4">
          {/* Panel de asignación actual */}
          {fuentesSeleccionadas.length > 0 && (
            <div className="p-4 rounded-xl border-2 border-[var(--primary)] bg-[rgba(59,130,246,0.05)] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--primary)]" />
                  Fuentes Seleccionadas ({fuentesSeleccionadas.length})
                </p>
                <div className="flex items-center gap-2">
                  {excedente > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      Excede +{excedente} un.
                    </span>
                  ) : itemCompleto ? (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                      <CheckCircle className="w-4 h-4" />
                      Completo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      Faltan {faltante} un.
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de fuentes seleccionadas con cantidades */}
              <div className="space-y-2">
                {fuentesSeleccionadas.map((fuente, idx) => (
                  <FuenteSeleccionadaCard
                    key={fuente.opcion?.opcion_id || idx}
                    fuente={fuente}
                    onChangeCantidad={(val) => actualizarCantidad(fuente.opcion?.opcion_id, val)}
                    onRemove={() => toggleFuente(fuente.opcion)}
                  />
                ))}
              </div>

              {/* Resumen de cantidades */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div className="text-sm text-[var(--fg-muted)]">
                  <span className="font-bold text-[var(--fg)]">{totalAsignado}</span> de{" "}
                  <span className="font-bold text-[var(--fg)]">{cantidadSolicitada}</span> asignados
                </div>
                <div className="w-32 h-2 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, (totalAsignado / cantidadSolicitada) * 100)}%`,
                      backgroundColor: excedente > 0 ? "#f59e0b" : itemCompleto ? "var(--success)" : "var(--primary)"
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Barra de controles: Vista izq + Filtros centro + Navegación items derecha */}
          {dataOpciones.length > 0 && (
            <div className="relative flex items-center p-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)]">
              {/* Toggle Vista - Izquierda */}
              <div className="flex items-center gap-2 absolute left-3">
                <button
                  type="button"
                  onClick={() => setVistaTabla(false)}
                  title="Vista tarjetas"
                  className={`p-2 rounded-lg transition ${
                    !vistaTabla
                      ? "text-[var(--primary)] border-2 border-[var(--primary)] shadow-sm bg-[var(--card)]"
                      : "text-[var(--fg-muted)] border border-[var(--border)] bg-[var(--card)] hover:text-[var(--fg)]"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setVistaTabla(true)}
                  title="Vista tabla"
                  className={`p-2 rounded-lg transition ${
                    vistaTabla
                      ? "text-[var(--primary)] border-2 border-[var(--primary)] shadow-sm bg-[var(--card)]"
                      : "text-[var(--fg-muted)] border border-[var(--border)] bg-[var(--card)] hover:text-[var(--fg)]"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filtros por tipo - Centro */}
              <div className="flex flex-wrap justify-center gap-2 flex-1 px-24">
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
                    color="accent"
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
                    color="purple"
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
                <div className="w-px h-6 bg-[var(--border)] mx-1" />

                {/* Botón Aceptar Sugerido - Destacado al final */}
                <button
                  type="button"
                  onClick={aceptarSugerido}
                  disabled={dataOpciones.length === 0 || itemCompleto}
                  title={itemCompleto ? "Ítem ya completado" : "Aceptar opciones sugeridas por el sistema"}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition shadow-sm ${
                    itemCompleto
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 hover:shadow-md"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Aceptar Sugerido
                </button>
              </div>

              {/* Navegación entre ítems - Derecha */}
              {totalItems > 1 && (
                <div className="flex items-center gap-1 absolute right-3">
                  <button
                    type="button"
                    onClick={() => onChangeIdx?.(Math.max(0, currentIdx - 1))}
                    disabled={currentIdx === 0}
                    className={`p-1.5 rounded-md transition ${
                      currentIdx === 0
                        ? "text-[var(--fg-muted)] opacity-50 cursor-not-allowed"
                        : "text-[var(--fg)] hover:bg-[var(--bg-hover)] bg-[var(--card)] border border-[var(--border)]"
                    }`}
                    title="Ítem anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-sm font-bold text-[var(--fg)]">
                    Ítem {currentIdx + 1}/{totalItems}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeIdx?.(Math.min(totalItems - 1, currentIdx + 1))}
                    disabled={currentIdx >= totalItems - 1}
                    className={`p-1.5 rounded-md transition ${
                      currentIdx >= totalItems - 1
                        ? "text-[var(--fg-muted)] opacity-50 cursor-not-allowed"
                        : "text-[var(--fg)] hover:bg-[var(--bg-hover)] bg-[var(--card)] border border-[var(--border)]"
                    }`}
                    title="Siguiente ítem"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Opciones de abastecimiento */}
          <div>
            {loadingOpciones && dataOpciones.length === 0 ? (
              <div className="text-sm text-[var(--fg-muted)]">Cargando opciones...</div>
            ) : vistaTabla ? (
              <OpcionesTablaMulti
                opciones={opcionesFiltradas}
                fuentesSeleccionadas={fuentesSeleccionadas}
                onToggle={toggleFuente}
                isSelected={isSelected}
              />
            ) : (
              <div className="space-y-4">
                {/* Cards de Stock Categorizado */}
                {hayStockCategorizado && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Stock Local */}
                    {stockCategorizado.local.total > 0 && (
                      <StockCategoriaCard
                        categoria="local"
                        titulo="Stock Local"
                        subtitulo={`Centro ${centroSolicitud} / Almacén ${almacenSolicitud}`}
                        icono={Warehouse}
                        colorIcono="text-emerald-600"
                        colorBorde="border-emerald-300"
                        colorFondo="bg-emerald-50"
                        colorBadge="bg-emerald-100 text-emerald-700"
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
                        colorIcono="text-blue-600"
                        colorBorde="border-blue-300"
                        colorFondo="bg-blue-50"
                        colorBadge="bg-blue-100 text-blue-700"
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
                        colorIcono="text-amber-600"
                        colorBorde="border-amber-300"
                        colorFondo="bg-amber-50"
                        colorBadge="bg-amber-100 text-amber-700"
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
                  </div>
                )}

                {/* Fallback: Opciones de Stock del backend si no hay categorizado */}
                {!hayStockCategorizado && opcionesStock.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Warehouse className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-700">Stock Disponible</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {opcionesStock.map((op) => (
                        <OpcionCardMulti
                          key={op.opcion_id}
                          opcion={op}
                          selected={isSelected(op.opcion_id)}
                          onToggle={() => toggleFuente(op)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Proveedores Externos */}
                {opcionesNoStock.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Truck className="w-4 h-4 text-slate-600" />
                      <h4 className="text-sm font-bold text-slate-700">PROVEEDORES EXTERNOS</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {opcionesNoStock.map((op) => (
                        <OpcionCardMulti
                          key={op.opcion_id}
                          opcion={op}
                          selected={isSelected(op.opcion_id)}
                          onToggle={() => toggleFuente(op)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sin opciones */}
                {!hayStockCategorizado && opcionesStock.length === 0 && opcionesNoStock.length === 0 && (
                  <div className="p-6 text-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-soft)]">
                    <Package className="w-8 h-8 mx-auto text-[var(--fg-muted)] mb-2" />
                    <p className="text-sm font-medium text-[var(--fg)]">Sin opciones de abastecimiento</p>
                    <p className="text-xs text-[var(--fg-muted)] mt-1">No se encontró stock ni alternativas para este material</p>
                  </div>
                )}
              </div>
            )}
          </div>


      {/* Modal de confirmación de excedente */}
      {showExcedenteModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/50 p-6 space-y-4"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 grid place-items-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">
                  Cantidad excede lo solicitado
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Has asignado más unidades de las solicitadas en uno o más ítems.
                  Esto puede generar stock de reserva adicional.
                </p>
                <p className="text-sm text-slate-700 mt-2 font-medium">
                  ¿Deseas continuar con esta asignación?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowExcedenteModal(false)}
                type="button"
              >
                Revisar cantidades
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowExcedenteModal(false);
                  onNext?.();
                }}
                type="button"
              >
                Sí, continuar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Componente: Card de Categoría de Stock con ubicaciones seleccionables
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
    <div
      className={`rounded-xl border-2 transition shadow-sm overflow-hidden ${
        hasSelection
          ? "border-[var(--primary)] bg-[rgba(59,130,246,0.05)]"
          : `${colorBorde} ${colorFondo}`
      }`}
    >
      {/* Header - clickeable para expandir/colapsar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-white/50 transition"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icono className={`w-5 h-5 ${colorIcono}`} />
            <h4 className="text-sm font-bold text-slate-800">{titulo}</h4>
          </div>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                {selectedCount} sel.
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorBadge}`}>
              {total} un.
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-600">{subtitulo}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">
            {ubicaciones.length} ubicación{ubicaciones.length !== 1 ? "es" : ""}
          </span>
          <span className="text-xs text-blue-600 font-medium">
            {expanded ? "▲ Colapsar" : "▼ Ver ubicaciones"}
          </span>
        </div>
      </button>

      {/* Lista de ubicaciones expandida */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white/60 max-h-48 overflow-y-auto">
          {ubicaciones.map((u, idx) => {
            const isSelected = isUbicacionSelected(u);
            const esMismoCentro = String(u.centro || "") === centroSolicitud;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onToggleUbicacion(u)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition border-b border-slate-100 last:border-b-0 ${
                  isSelected
                    ? "bg-blue-50 hover:bg-blue-100"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                    isSelected
                      ? "bg-[var(--primary)] border-[var(--primary)]"
                      : "border-slate-300 bg-white"
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>

                  {/* Info ubicación */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">
                        {u.centro}/{String(u.almacen || "").padStart(4, "0")}
                      </span>
                      {esMismoCentro && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          MISMO CENTRO
                        </span>
                      )}
                    </div>
                    {u.nombre_almacen && (
                      <p className="text-xs text-slate-500">{u.nombre_almacen}</p>
                    )}
                  </div>
                </div>

                {/* Cantidad */}
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">{u.cantidad}</span>
                  <span className="text-xs text-slate-500 ml-1">un.</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Componente: Equivalencias Card (similar a StockCategoriaCard)
// =============================================================================

function EquivalenciasCard({ equivalencias, isSelected, onToggle, selectedCount }) {
  const [expanded, setExpanded] = useState(false);
  const hasSelection = selectedCount > 0;

  return (
    <div
      className={`rounded-xl border-2 transition shadow-sm overflow-hidden ${
        hasSelection
          ? "border-[var(--primary)] bg-[rgba(59,130,246,0.05)]"
          : "border-purple-300 bg-purple-50"
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-white/50 transition"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            <h4 className="text-sm font-bold text-slate-800">Mat. Equivalentes</h4>
          </div>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                {selectedCount} sel.
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
              {equivalencias.length} opciones
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-600">Materiales alternativos compatibles</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">
            {equivalencias.length} alternativa{equivalencias.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-purple-600 font-medium">
            {expanded ? "▲ Colapsar" : "▼ Ver opciones"}
          </span>
        </div>
      </button>

      {/* Lista expandida */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white/60 max-h-48 overflow-y-auto">
          {equivalencias.map((eq) => {
            const selected = isSelected(eq.opcion_id);
            return (
              <button
                key={eq.opcion_id}
                type="button"
                onClick={() => onToggle(eq)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition border-b border-slate-100 last:border-b-0 ${
                  selected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                    selected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-slate-300 bg-white"
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{eq.nombre}</p>
                    {eq.compatibilidad_pct != null && (
                      <p className="text-xs text-slate-500">{eq.compatibilidad_pct}% compatible</p>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">
                  {formatMonto(eq.precio_unitario || 0)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Componente: Filtro Button
// =============================================================================

function FilterButton({ active, onClick, icon: Icon, label, count, color }) {
  const colorMap = {
    primary: "var(--primary)",
    success: "var(--success)",
    info: "var(--info)",
    warning: "var(--warning)",
    accent: "var(--accent)",
    purple: "#a855f7",
  };
  const activeColor = colorMap[color] || colorMap.primary;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
        active
          ? "bg-[var(--card)] shadow-sm"
          : "bg-[var(--card)] text-[var(--fg-muted)] hover:text-[var(--fg)] border border-[var(--border)] hover:border-[var(--fg-muted)]"
      }`}
      style={active ? { color: activeColor, border: `2px solid ${activeColor}` } : {}}
    >
      <Icon className="w-4 h-4" />
      {label} ({count})
    </button>
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
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
      {/* Icono tipo */}
      <div className={`w-8 h-8 rounded-lg bg-[var(--bg-soft)] flex items-center justify-center shrink-0 ${tipoConfig.color}`}>
        <TipoIcon className="w-4 h-4" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--fg)] truncate">{opcion.nombre}</p>
        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <span className="uppercase">{opcion.tipo}</span>
          {opcion.precio_es_negociado && (
            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
              <DollarSign className="w-3 h-3" />
              Negociado
            </span>
          )}
          {opcion.cantidad_disponible && (
            <span>Disp: {opcion.cantidad_disponible}</span>
          )}
        </div>
      </div>

      {/* Cantidad editable */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChangeCantidad(Number(fuente.cantidad_asignada || 0) - 1)}
          className="w-8 h-8 rounded-md bg-[var(--bg-soft)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          value={fuente.cantidad_asignada || 0}
          onChange={(e) => onChangeCantidad(e.target.value)}
          min={0}
          className="w-16 h-7 px-2 text-center text-sm font-bold rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="button"
          onClick={() => onChangeCantidad(Number(fuente.cantidad_asignada || 0) + 1)}
          className="w-8 h-8 rounded-md bg-[var(--bg-soft)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Precio */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-[var(--fg)]">{formatMonto(opcion.precio_unitario || 0)}</p>
        <p className="text-xs text-[var(--fg-muted)]">
          Total: {formatMonto((opcion.precio_unitario || 0) * (fuente.cantidad_asignada || 0))}
        </p>
      </div>

      {/* Botón eliminar */}
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-md text-[var(--danger)] hover:bg-red-100 dark:hover:bg-red-900/30 transition"
        title="Quitar fuente"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// =============================================================================
// Componente: Opción Card Multi-selección (con checkbox)
// =============================================================================

function OpcionCardMulti({ opcion, selected, onToggle }) {
  const isRecomendada = opcion.is_recomendada === true;
  const tipoConfig = getTipoConfig(opcion.tipo);
  const TipoIcon = tipoConfig.icon;
  const tipoColor = tipoConfig.color;
  const esProveedor = opcion.tipo === "proveedor";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left p-3 rounded-xl border-2 transition shadow-sm ${
        selected
          ? "border-[var(--primary)] bg-[rgba(59,130,246,0.08)]"
          : isRecomendada
          ? "border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 hover:border-blue-500"
          : "border-slate-200 bg-white hover:border-[var(--primary)]"
      }`}
    >
      {esProveedor ? (
        /* === CARD COMPACTA PARA PROVEEDOR === */
        <>
          {/* Línea 1: Checkbox + PROVEEDOR: Nombre | Precio + badges */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
                selected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)] bg-transparent"
              }`}>
                {selected && <Check className="w-3 h-3 text-white" />}
              </div>
              <Truck className="w-4 h-4 text-[var(--info)] shrink-0" />
              <span className="text-sm font-black text-[var(--fg)] truncate">
                {opcion.nombre}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {opcion.precio_es_negociado && (
                <span className="px-1.5 py-0.5 rounded-full border border-green-500 text-green-600 text-[9px] font-bold flex items-center gap-0.5">
                  <DollarSign className="w-3 h-3" />
                  NEG
                </span>
              )}
              {isRecomendada && (
                <span className="px-1.5 py-0.5 rounded-full border-2 border-blue-500 text-blue-500 text-[9px] font-bold">
                  ⭐
                </span>
              )}
              <span className="text-sm font-bold text-[var(--fg)]">
                {formatMonto(opcion.precio_unitario || 0)}
              </span>
            </div>
          </div>

          {/* Línea 2: Plazo + Rating */}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
            <span>
              Plazo: <strong className="text-slate-900">{opcion.plazo_dias ?? "N/D"}</strong> días
            </span>
            {opcion.rating && (
              <span>
                Rating: <strong className="text-slate-900">{opcion.rating}/5</strong> ⭐
              </span>
            )}
          </div>
        </>
      ) : (
        /* === CARD NORMAL PARA OTROS TIPOS (stock, transferencia, equivalencia) === */
        <>
          {/* Header: Checkbox + Tipo + Badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                selected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)] bg-transparent"
              }`}>
                {selected && <Check className="w-3 h-3 text-white" />}
              </div>
              <TipoIcon className={`w-4 h-4 ${tipoColor}`} />
              <span className="text-xs uppercase font-bold tracking-[0.08em] text-slate-800">{opcion.tipo}</span>
            </div>
            <div className="flex items-center gap-2">
              {opcion.precio_es_negociado && (
                <span className="px-2 py-0.5 rounded-full border border-green-500 text-green-600 text-[9px] font-bold flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  NEGOCIADO
                </span>
              )}
              {isRecomendada && (
                <span className="px-2 py-0.5 rounded-full border-2 border-blue-500 text-blue-500 text-[10px] font-bold shadow-sm flex items-center gap-1 bg-[var(--card)]">
                  ⭐ MEJOR
                </span>
              )}
            </div>
          </div>

          {/* Nombre y precio */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-black text-[var(--fg)] leading-tight">{opcion.nombre}</p>
            <p className="text-sm font-bold text-[var(--fg)] shrink-0">{formatMonto(opcion.precio_unitario || 0)}</p>
          </div>

          {/* Info de transferencia */}
          {opcion.tipo === "transferencia" && opcion.centro_origen && (
            <p className="text-xs text-[var(--accent)] mt-1">
              Desde: {opcion.centro_origen} / {opcion.almacen_origen || "N/D"}
            </p>
          )}

          {/* Métricas en línea */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] mt-3 pt-3 border-t border-slate-300">
            <span className="text-slate-800">
              <strong className="text-slate-900">{opcion.cantidad_disponible ?? "N/D"}</strong> disponibles
            </span>
            <span className="text-slate-800">
              <strong className="text-slate-900">{opcion.plazo_dias ?? "N/D"}</strong> días
            </span>
            {opcion.compatibilidad_pct != null && (
              <span className="text-slate-800">
                <strong className="text-slate-900">{opcion.compatibilidad_pct}%</strong> compatible
              </span>
            )}
          </div>

          {opcion.observaciones && (
            <p className="text-[11px] text-slate-800 mt-2 italic">💡 {opcion.observaciones}</p>
          )}
        </>
      )}
    </button>
  );
}

// =============================================================================
// Componente: Opciones Tabla Multi-selección
// =============================================================================

function OpcionesTablaMulti({ opciones, fuentesSeleccionadas, onToggle, isSelected }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
            <th className="w-10 px-3 py-3 text-center"></th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Opción</th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--fg)]">Precio</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Plazo</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Disponible</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Puntuación</th>
          </tr>
        </thead>
        <tbody>
          {opciones.map((op) => {
            const isRecomendada = op.is_recomendada === true;
            const score = op.score_recomendacion || 0;
            const selected = isSelected(op.opcion_id);
            const tipoConfig = getTipoConfig(op.tipo);
            const TipoIcon = tipoConfig.icon;
            const tipoColor = tipoConfig.color;

            return (
              <tr
                key={op.opcion_id}
                className={`border-b border-[var(--border)] transition cursor-pointer ${
                  selected
                    ? "bg-[rgba(59,130,246,0.15)]"
                    : isRecomendada
                    ? "bg-[rgba(59,130,246,0.08)] hover:bg-[rgba(59,130,246,0.15)]"
                    : "hover:bg-[var(--bg-hover)]"
                }`}
                onClick={() => onToggle(op)}
              >
                <td className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(op)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 cursor-pointer accent-[var(--primary)] rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-[var(--bg-soft)] flex items-center justify-center shrink-0 ${tipoColor}`}>
                      <TipoIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[var(--fg)] truncate">{op.nombre}</p>
                        {op.precio_es_negociado && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded border border-green-500 text-green-600 text-[9px] font-bold">💲</span>
                        )}
                        {isRecomendada && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded border border-blue-500 text-blue-500 text-[9px] font-bold bg-[var(--card)]">⭐</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wide">{op.tipo}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-bold text-[var(--fg)]">{formatMonto(op.precio_unitario || 0)}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${op.plazo_dias <= 3 ? "text-green-600" : "text-[var(--fg)]"}`}>
                    {op.plazo_dias ?? "N/D"} d
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-medium text-[var(--fg)]">
                    {op.cantidad_disponible ?? op.cantidad_solicitada ?? "N/D"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {score > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="text-xs font-bold"
                        style={{ color: isRecomendada ? "var(--primary)" : "var(--fg)" }}
                      >
                        {score.toFixed(0)}
                      </span>
                      <div className="w-14 h-1 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${score}%`,
                            backgroundColor: isRecomendada ? "var(--primary)" : "var(--info)"
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--fg-muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {opciones.length === 0 && (
        <div className="p-6 text-center">
          <Package className="w-8 h-8 mx-auto text-[var(--fg-muted)] mb-2" />
          <p className="text-sm text-[var(--fg-muted)]">No hay opciones disponibles</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers y Componentes Auxiliares
// =============================================================================

function getTipoConfig(tipo) {
  const configs = {
    stock: { icon: Warehouse, color: "text-[var(--success)]" },
    transferencia: { icon: ArrowLeftRight, color: "text-[var(--accent)]" },
    proveedor: { icon: Truck, color: "text-[var(--info)]" },
    equivalencia: { icon: RefreshCw, color: "text-purple-500" },
    mix: { icon: Layers, color: "text-[var(--info)]" },
  };
  return configs[tipo] || { icon: Package, color: "text-[var(--fg-muted)]" };
}

function renderMrpBadge({ item, mostrarMrp, setMostrarMrp }) {
  const status = getMrpStatus(item);

  return (
    <div className="flex items-center gap-2">
      <Layers className="w-4 h-4 text-[var(--accent)]" />
      <div>
        <p className="text-xs text-[var(--fg-muted)]">MRP</p>
        {!status.planificado ? (
          <p className="text-sm font-bold text-[var(--danger)]">No planificado</p>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarMrp?.(!mostrarMrp)}
            className="text-sm font-bold text-[var(--fg)] hover:text-[var(--primary)] transition"
          >
            {status.warn ? (
              <span className="text-[var(--danger)]">⚠ Bajo punto pedido</span>
            ) : (
              <span className="text-[var(--success)]">Planificado</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function MrpDetalle({ item, solicitud, onClose }) {
  const status = getMrpStatus(item);
  const d = status.detalle;
  const total = status.total;

  return (
    <div className="mt-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--fg)]">Detalle MRP</p>
        <button type="button" className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {status.warn ? (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-300 text-red-800 text-sm font-semibold">
          Alerta: stock actual + pedidos ({total}) está por debajo del punto de pedido ({d.punto_pedido ?? "N/D"}). Revisar gestión MRP.
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MrpField label="Centro/Almacén" value={`${solicitud?.centro || "N/D"} / ${solicitud?.almacen_virtual || "N/D"}`} />
        <MrpField label="Stock de seguridad" value={d.stock_seguridad ?? "N/D"} />
        <MrpField label="Punto de pedido" value={d.punto_pedido ?? "N/D"} />
        <MrpField label="Stock máximo" value={d.stock_maximo ?? "N/D"} />
        <MrpField label="Stock actual (centro)" value={d.stock_actual ?? "N/D"} />
        <MrpField label="Pedidos en curso" value={d.pedidos_en_curso ?? "N/D"} />
        <MrpField label="Total stock + pedidos" value={total} />
      </div>
    </div>
  );
}

function MrpField({ label, value }) {
  return (
    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <p className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--fg)]">{value}</p>
    </div>
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
    return ["si", "sí", "true", "1", "planificado", "yes"].includes(normalized);
  }
  if (typeof val === "number") return val === 1;
  return false;
}

function formatMonto(val) {
  const num = Number(val || 0);
  return `USD ${num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
