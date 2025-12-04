# 🧪 Plan de Testing - PASO 2 Mejorado

**Fecha:** 3 de noviembre de 2025
**Ambiente:** http://127.0.0.1:5000/home
**Usuario:** Solicitante (crear solicitud)

---

## 📋 Checklist de Testing

### ✅ Test 1: Eliminar SECTION 2 (Confirmación Visual)
**Objetivo:** Verificar que SECTION 2 "Seleccionar y Agregar" ha sido eliminado

**Pasos:**
1. Navega a http://127.0.0.1:5000/home
2. Haz clic en "Crear Nueva Solicitud"
3. Completa Paso 1 (Información)
4. Haz clic en "Continuar" → Paso 2
5. **Verifica:** Solo hay 2 bloques visibles:
   - ✅ SECTION 1: "🔍 Buscar Material"
   - ✅ SECTION 2: "📋 Materiales Agregados"
   - ❌ NO debe haber bloque "➕ Seleccionar y Agregar"

**Resultado esperado:** SECCIÓN 2 no visible ✅

---

### ✅ Test 2: Búsqueda en SECTION 1
**Objetivo:** Verificar que la búsqueda filtra materiales

**Pasos:**
1. En SECTION 1, escribe en "Código SAP": `1000000006`
2. **Verifica:** Autocomplete muestra resultados
3. Limpia y escribe en "Descripción": `TORNILLO`
4. **Verifica:** Filtra materiales con TORNILLO en descripción
5. Cambia el filtro "Ordenar por" a "Precio (Menor)"
6. **Verifica:** Los resultados se reordenan

**Resultado esperado:** Búsqueda funciona, autocomplete aparece ✅

---

### ✅ Test 3: Modal Descripción Ampliada
**Objetivo:** Verificar que el modal se abre correctamente

**Pasos:**
1. En SECTION 1, busca un material (ej: SAP = `1000000006`)
2. Haz clic en el resultado de la búsqueda (autocomplete)
3. **Verifica:** Se abre modal "Descripción del Material" con:
   - ✅ Código SAP
   - ✅ Descripción Ampliada
   - ✅ Precio USD
   - ✅ Unidad (u., m, l, etc.)
   - ✅ Stock Disponible
   - ✅ Botones: [Cerrar] [➕ Agregar Material]

**Resultado esperado:** Modal muestra todos los detalles ✅

---

### ✅ Test 4: Agregar Material Desde Modal (P4 + P5)
**Objetivo:** Verificar que agregar material va directo a tabla con ± y unidad

**Pasos:**
1. En el modal abierto, haz clic en "➕ Agregar Material"
2. **Verifica:** Modal se cierra
3. **Verifica:** El material aparece en SECTION 2 (Tabla) con:
   - ✅ Nombre del material + SAP debajo
   - ✅ Cantidad editable con botones `-` y `+`
   - ✅ Precio + Unidad (u., m, l) debajo
   - ✅ Subtotal calculado
   - ✅ Botón eliminar (🗑️)
4. **Verifica:** El contador dice "1 Material Agregado"
5. **Verifica:** El TOTAL se actualiza correctamente

**Resultado esperado:** Material en tabla con cantidades editables ✅

---

### ✅ Test 5: Botones ± para Cantidad (P4)
**Objetivo:** Verificar que ± modifican la cantidad en tabla

**Pasos:**
1. En la tabla, localiza el material agregado (cantidad = 1 por defecto)
2. Haz clic en botón `+` (más) 3 veces
3. **Verifica:** La cantidad cambia a 4
4. **Verifica:** El subtotal se recalcula automáticamente
5. Haz clic en botón `-` (menos) 2 veces
6. **Verifica:** La cantidad baja a 2
7. Intenta clic en `-` cuando cantidad = 1
8. **Verifica:** No baja de 1 (validación de mínimo)
9. Haz clic directamente en el input numérico y escribe `10`
10. **Verifica:** El valor se actualiza a 10

**Resultado esperado:** Botones ± funcionan, cantidad no baja de 1 ✅

---

### ✅ Test 6: Mostrar Unidad de Medida (P5)
**Objetivo:** Verificar que la unidad se muestra correctamente

**Pasos:**
1. Agrega varios materiales con diferentes unidades
2. En la tabla, **verifica cada fila:**
   - ✅ SAP debajo del nombre (ej: "SAP: 1000000006")
   - ✅ Unidad debajo del precio (ej: "(u.)", "(m)", "(l)", "(kg)")
3. Agrega un material sin unidad especificada
4. **Verifica:** Muestre "(u.)" por defecto

**Resultado esperado:** Unidades visibles y correctas ✅

---

### ✅ Test 7: Eliminar Material
**Objetivo:** Verificar que el botón 🗑️ elimina materiales

**Pasos:**
1. En la tabla, haz clic en el botón 🗑️ de un material
2. **Verifica:** La fila desaparece
3. **Verifica:** El contador se actualiza (ej: de 3 a 2)
4. **Verifica:** El TOTAL se recalcula

**Resultado esperado:** Eliminación funciona ✅

---

### ✅ Test 8: Guardar Borrador (P9 - localStorage)
**Objetivo:** Verificar que `saveDraft()` guarda materiales en localStorage

**Pasos:**
1. Agrega varios materiales a la tabla
2. Haz clic en botón "💾 Guardar borrador"
3. **Verifica:** Mensaje de éxito aparece
4. Abre Developer Tools (F12) → Console
5. Ejecuta:
   ```javascript
   JSON.parse(localStorage.getItem('spm_draft_solicitud'))
   ```
6. **Verifica:** Muestra objeto con:
   - ✅ `centro`
   - ✅ `almacen`
   - ✅ `criticidad`
   - ✅ `fecha_necesidad`
   - ✅ `centro_costos`
   - ✅ `justificacion`
   - ✅ **`materiales`: [array de materiales agregados]** ← NUEVO
   - ✅ `timestamp`
7. Cierra el navegador completamente
8. Reabre http://127.0.0.1:5000/home
9. **Verifica:** El localStorage persiste (con dev tools)

**Resultado esperado:** localStorage guarda materiales ✅

---

### ✅ Test 9: Cálculos de Subtotal y Total
**Objetivo:** Verificar que los cálculos son correctos

**Pasos:**
1. Agrega material: Cantidad = 5, Precio = $2.00
2. **Verifica:** Subtotal = $10.00
3. Agrega material: Cantidad = 3, Precio = $1.50
4. **Verifica:** Subtotal = $4.50
5. **Verifica:** TOTAL = $14.50

**Resultado esperado:** Cálculos correctos ✅

---

### ✅ Test 10: Navegar Paso 3 (Revisar y Confirmar)
**Objetivo:** Verificar que los materiales aparecen en Paso 3

**Pasos:**
1. Completa Paso 2 con 3 materiales agregados
2. Haz clic en "➜ Continuar" (o similar)
3. **Verifica:** Paso 3 muestra tabla de revisión con todos los materiales
4. **Verifica:** TOTAL FINAL es correcto
5. **Verifica:** Botón "✓ Confirmar y Crear Solicitud" está disponible

**Resultado esperado:** Paso 3 muestra datos correctos ✅

---

### ✅ Test 11: Console Errors
**Objetivo:** Verificar que no hay errores de JavaScript

**Pasos:**
1. Abre Developer Tools (F12)
2. Ve a la pestaña "Console"
3. Realiza todos los tests anteriores
4. **Verifica:** NO hay mensajes de error rojo (🔴)
5. **Verifica:** Los logs son informativos (ej: "Material agregado")

**Resultado esperado:** Console limpia sin errores ✅

---

## 🐛 Posibles Problemas y Soluciones

| Problema | Síntoma | Solución |
|----------|---------|----------|
| SECTION 2 aún visible | Ves 3 bloques | Limpia cache (Ctrl+F5) |
| Cantidad no editable | No aparecen botones ± | Verifica updateMaterialsTable() en app.js |
| Unidad no muestra | No ves (u.), (m), etc | Verifica material.unit en agregatedMaterials |
| localStorage vacío | JSON.parse da null | Verifica saveDraft() guarda en línea correcta |
| Subtotal incorrecto | Matemática errónea | Verifica updateMaterialsTable() cálculo |
| Modal no abre | Click en resultado no funciona | Verifica showMaterialDescriptionFromSearch() |

---

## 📊 Resumen de Testing

| Test | Estado | Notas |
|------|--------|-------|
| 1. SECTION 2 eliminado | ⚠️ Pendiente | Verificar visualmente |
| 2. Búsqueda SECTION 1 | ⚠️ Pendiente | Filtros + Autocomplete |
| 3. Modal | ⚠️ Pendiente | Muestra detalles |
| 4. Agregar a tabla | ⚠️ Pendiente | ± y unidad visibles |
| 5. Botones ± (P4) | ⚠️ Pendiente | Edición de cantidad |
| 6. Unidad (P5) | ⚠️ Pendiente | SAP + Unidad |
| 7. Eliminar | ⚠️ Pendiente | Remove from table |
| 8. Guardar (P9) | ⚠️ Pendiente | localStorage |
| 9. Cálculos | ⚠️ Pendiente | Subtotal + Total |
| 10. Paso 3 | ⚠️ Pendiente | Review correcto |
| 11. Console | ⚠️ Pendiente | Sin errores |

---

## ✅ Validación Final

Cuando todos los tests pasen:
- [ ] Arquitectura de PASO 2 está correcta
- [ ] Flujo sin SECTION 2 funciona
- [ ] P4 (cantidad ±) operacional
- [ ] P5 (unidad) visible
- [ ] P9 (localStorage) persiste
- [ ] Sin errores de console
- [ ] UX mejorada y clara

**Próximo paso:** Si todos los tests pasan, marcar como **COMPLETADO** ✅
