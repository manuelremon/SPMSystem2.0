# Guía de Prueba - Agregar Materiales

## Requisitos Previos

- Servidor backend corriendo en `http://localhost:5001`
- Base de datos `spm.db` con tabla `materiales` poblada
- Frontend en `http://localhost:5001/agregar-materiales.html`

## Pruebas Funcionales

### Prueba 1: Búsqueda por Código SAP

**Pasos:**

1. Abre `http://localhost:5001/agregar-materiales.html`
2. En el campo "Código SAP", ingresa `100`
3. Deberías ver sugerencias en el dropdown con formato: `CÓDIGO - Descripción - $PRECIO`

**Resultado esperado:**
- ✅ Aparecen hasta 1000 resultados
- ✅ Cada sugerencia muestra: código, descripción y precio formateado en USD
- ✅ El dropdown se muestra con clase `.suggest`

**Ejemplo de salida:**
```
1000000006 - TUERCA M12 - $45.50
1000000007 - PERNO M10 - $32.25
1000000008 - ARANDELA PLANA - $5.75
```

---

### Prueba 2: Búsqueda por Descripción

**Pasos:**

1. Limpia el campo de código
2. En el campo "Descripción", ingresa `brida`
3. Deberías ver todas las bridas disponibles

**Resultado esperado:**
- ✅ Búsqueda case-insensitive
- ✅ Busca coincidencias parciales
- ✅ Retorna hasta 1000 resultados

**Ejemplo de salida:**
```
9000001234 - BRIDA ACERO INOX 1" - $125.00
9000001235 - BRIDA ACERO CARBON 1.5" - $89.99
9000001236 - BRIDA ALUMINIO 2" - $45.50
```

---

### Prueba 3: Seleccionar Material

**Pasos:**

1. Ingresa `100` en el campo Código SAP
2. Haz click en una de las sugerencias (ej: "1000000006")
3. Verifica que:
   - El campo se rellene con el código seleccionado
   - El dropdown se cierre
   - El botón "Ver descripción ampliada" se **habilite** (no esté gris)

**Resultado esperado:**
- ✅ Campo `#codeSearch` = `1000000006`
- ✅ `#suggestCode` tiene clase `hide`
- ✅ `#btnShowMaterialDetail` tiene `disabled = false`

---

### Prueba 4: Ver Descripción Ampliada

**Pasos:**

1. Con un material seleccionado, haz click en "Ver descripción ampliada"
2. Deberías ver un modal que muestra:
   - **Título:** `CÓDIGO - Descripción`
   - **Cuerpo:** La descripción completa (`descripcion_larga`)

**Resultado esperado:**
- ✅ Modal aparece con clase removida: `#materialDetailModal` sin `hide`
- ✅ `#materialDetailTitle` contiene el código y descripción
- ✅ `#materialDetailBody` contiene `descripcion_larga`
- ✅ Botón X cierra el modal
- ✅ Click fuera del modal también lo cierra

**Ejemplo de modal:**
```
┌────────────────────────────────────────┐
│ 1000000006 - TUERCA M12         ✕     │
├────────────────────────────────────────┤
│ Tuerca hexagonal de acero al carbono   │
│ con rosca M12x1.75. Clasificación      │
│ ISO 4032. Material 8.8. Cumple         │
│ especificaciones DIN 934.              │
└────────────────────────────────────────┘
```

---

### Prueba 5: Agregar Ítem al Carrito

**Pasos:**

1. Con material seleccionado, haz click en "Agregar ítem"
2. Verifica que:
   - El material aparezca en la tabla
   - Las columnas sean: Código | Descripción | Unidad | Precio unitario | Cantidad | Total
   - El total estimado se actualice

**Resultado esperado:**
- ✅ Nueva fila en `#tbl tbody`
- ✅ Cantidad inicial = 1
- ✅ Total = Precio × Cantidad
- ✅ Campo de búsqueda se limpia

**Ejemplo de tabla:**
```
Código | Descripción | Unidad | Precio | Cant | Total | Acción
─────────────────────────────────────────────────────────────
1000000006 | TUERCA M12 | UNI | $45.50 | 1 | $45.50 | Eliminar
```

---

### Prueba 6: Modificar Cantidad

**Pasos:**

1. En la tabla, en la columna "Cantidad", ingresa un nuevo número (ej: `5`)
2. Verifica que:
   - La columna "Total" se actualice inmediatamente
   - El total estimado se recalcule

**Resultado esperado:**
- ✅ Cantidad = 5
- ✅ Total = $45.50 × 5 = $227.50
- ✅ Total estimado al pie = $227.50

---

### Prueba 7: Eliminar Ítem

**Pasos:**

1. Haz click en "Eliminar" en cualquier fila
2. Verifica que:
   - La fila desaparezca
   - El total estimado se recalcule

**Resultado esperado:**
- ✅ Fila removida de la tabla
- ✅ Total actualizado

---

### Prueba 8: Múltiples Items

**Pasos:**

1. Agrega 3 materiales diferentes al carrito
2. Modifica cantidades en cada uno
3. Verifica el cálculo total

**Ejemplo:**
```
Material A: $50.00 × 2 = $100.00
Material B: $30.00 × 3 = $90.00
Material C: $25.00 × 1 = $25.00
─────────────────────────────────
Total Estimado: $215.00
```

**Resultado esperado:**
- ✅ Todos los items se muestran correctamente
- ✅ Total = 100 + 90 + 25 = $215.00

---

### Prueba 9: Validaciones

**Caso 1: Agregar material duplicado**
- Selecciona un material
- Haz click en "Agregar ítem"
- Selecciona el mismo material
- Haz click nuevamente en "Agregar ítem"
- **Esperado:** Toast mostrando "Este material ya está en el carrito"

**Caso 2: Botón deshabilitado sin selección**
- Abre la página
- Sin seleccionar material, intenta click en "Ver descripción ampliada"
- **Esperado:** Botón debe estar deshabilitado (gris)

**Caso 3: Cantidad mínima**
- Modifica cantidad a 0
- **Esperado:** Se debe establecer mínimo a 1

---

## Verificación de Caché

**Pasos:**

1. Ingresa `100` en el campo Código SAP (primer llamado)
2. Abre la consola del navegador (F12 → Console)
3. Verifica que haya una llamada XHR a `/api/materiales?codigo=100&limit=1000`
4. Limpia el campo y vuelve a ingresar `100`
5. Verifica que **NO haya un nuevo llamado** (caché local)

**Resultado esperado:**
- ✅ Solo una llamada a API para la misma búsqueda
- ✅ Las búsquedas subsecuentes vienen del caché local `materialSearchCache`

---

## Pruebas en Consola

Desde la consola del navegador (F12), puedes verificar:

```javascript
// Ver estado actual
console.log(window.materialPageState);

// Ver caché
console.log(materialSearchCache);

// Buscar manualmente
const results = await searchMaterialsByCode('100');
console.log(results);

// Ver localStorage (si se implementa persistencia)
console.log(localStorage.materialCart);
```

---

## Troubleshooting

### Problema: Las sugerencias no aparecen

**Solución:**
1. Verifica que la API esté funcionando: `curl http://localhost:5001/api/materiales?codigo=100`
2. Abre DevTools (F12) → Network para ver si hay errores
3. Verifica la consola para mensajes de error

### Problema: Modal no se abre

**Solución:**
1. Asegúrate de haber seleccionado un material
2. Verifica que el botón esté habilitado (`disabled = false`)
3. Revisa si hay errores en consola

### Problema: Total no se calcula

**Solución:**
1. Verifica que el campo de cantidad sea numérico
2. Revisa que `precio_usd` tenga valor en la BD
3. Abre DevTools para ver `window.materialPageState.items`

### Problema: Búsqueda lenta

**Solución:**
1. Verifica que la API tenga índices en la BD (ya están)
2. Si hay >100k materiales, el caché ayuda
3. Considera limitar a 100 resultados visibles si es muy lento

---

## Performance

Métrica esperada:
- **Búsqueda inicial:** <500ms (con API)
- **Búsqueda en caché:** <50ms (local)
- **Renderizar 1000 items:** <200ms
- **Total estimado de operación:** <1s

---

## Casos de Uso Reales

### Caso 1: Solicitud de repuestos para mantenimiento
```
1. Busca "TUERCA" → selecciona "TUERCA M12"
2. Agrega 10 unidades
3. Busca "PERNO" → selecciona "PERNO M10"
4. Agrega 5 unidades
5. Verifica total: $550.00
6. Envía solicitud
```

### Caso 2: Búsqueda de material específico
```
1. Conoce el código: ingresa "1000000006"
2. Selecciona el único resultado
3. Ve descripción ampliada para confirmar especificaciones
4. Agrega cantidad requerida
5. Finaliza
```

### Caso 3: Búsqueda por características
```
1. Busca "ACERO INOX" → ve todas las opciones de acero inoxidable
2. Compara precios viendo dropdown
3. Selecciona la más económica
4. Agrega al carrito
```

---

## Notas Finales

- El carrito es **temporal** (se pierde al recargar)
- Para persistencia, se necesaría guardar en API
- El caché se limpia al recargar la página
- Máximo 1000 resultados por búsqueda (limitar saturación del DOM)

---

**Documento de prueba completado**
**Última actualización:** 26 de octubre de 2025
