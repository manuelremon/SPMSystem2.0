# 🧪 TESTING EN VIVO - Paso 2 Mejorado

## 🎯 Objetivo
Validar que los cambios funcionan correctamente en el navegador real.

---

## ✅ TEST 1: Verificar que SECTION 2 fue Eliminado

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. En el navegador, haz clic en **"Crear Nueva Solicitud"** (o similar)
2. Completa el PASO 1 (Información básica):
   - Centro: Selecciona cualquiera
   - Sector: Se llena automático
   - Almacén: Selecciona cualquiera
   - Criticidad: Selecciona Normal o Alta
   - Fecha: Selecciona una fecha futura
   - Costos: Escribe algo como "CC001"
   - Justificación: Escribe una justificación de prueba
3. Haz clic en **"➜ Continuar"**
4. **VERIFICA:** En PASO 2, debes ver:
   - ✅ Un bloque de BÚSQUEDA (🔍 Buscar Material)
   - ✅ Un bloque de TABLA (📋 Materiales Agregados)
   - ❌ **NO debe haber** bloque "➕ Seleccionar y Agregar"

### Resultado Esperado:
```
✅ SOLO 2 bloques visibles
❌ SECTION 2 COMPLETAMENTE ELIMINADA
```

### 🔴 Si SECTION 2 aún está visible:
- Limpia cache: **Ctrl + F5** (o Cmd + Shift + R en Mac)
- Recarga: **Ctrl + R**
- Intenta incógnito: **Ctrl + Shift + N**

---

## ✅ TEST 2: Búsqueda en SECTION 1

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. En el bloque BÚSQUEDA, escribe en el campo **"Código SAP"**: `1000000001`
2. **VERIFICA:**
   - ✅ Autocomplete muestra resultados
   - ✅ Ves descripción del material

3. Limpia y escribe en **"Descripción"**: `TORNILLO`
4. **VERIFICA:**
   - ✅ Filtra materiales con "TORNILLO" en el nombre

5. Prueba **"Ordenar por"**: Cambia a "💰 Precio (Menor)"
6. **VERIFICA:**
   - ✅ Los resultados se reordenan por precio

### Resultado Esperado:
```
✅ Búsqueda filtra por SAP
✅ Búsqueda filtra por Descripción
✅ Autocomplete funciona
✅ Ordenamiento funciona
```

---

## ✅ TEST 3: Modal de Descripción Ampliada

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. En el bloque BÚSQUEDA, busca un material
2. Espera a que aparezca en autocomplete
3. **Haz clic en el resultado** de la autocomplete
4. **VERIFICA:** Se abre un MODAL con:
   - ✅ Título: "Código SAP - Descripción"
   - ✅ Código SAP
   - ✅ Descripción Ampliada
   - ✅ Precio USD
   - ✅ Unidad (u., m, l, kg, etc.)
   - ✅ Stock Disponible
   - ✅ Botones: **[Cerrar]** y **[➕ Agregar Material]**

5. Haz clic en el botón **"Cerrar"** para cerrar el modal
6. **VERIFICA:** El modal desaparece

### Resultado Esperado:
```
✅ Modal se abre al hacer clic
✅ Muestra todos los detalles
✅ Botón cerrar funciona
```

---

## ✅ TEST 4: Agregar Material Desde Modal (P4 + P5 + TABLA)

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Abre el modal de un material (ver TEST 3)
2. Haz clic en **"➕ Agregar Material"**
3. **VERIFICA:**
   - ✅ El modal se cierra
   - ✅ Aparece un mensaje de éxito (toast)
   - ✅ El material aparece en la TABLA (SECTION 2)

4. En la tabla, **VERIFICA la estructura del material:**
   - ✅ **Nombre del material** (ej: "TORNILLO M8")
   - ✅ **SAP debajo** (ej: "SAP: 1000000001")
   - ✅ **Cantidad** con botones `-` y `+` (ej: **[−] 1 [+]**)
   - ✅ **Precio** (ej: "$0.15")
   - ✅ **Unidad debajo** (ej: "(u.)" o "(m)" o "(l)")
   - ✅ **Subtotal** (ej: "$0.15")
   - ✅ **Botón eliminar** (🗑️)

5. **VERIFICA el contador:** Dice "1 Material Agregado"
6. **VERIFICA el TOTAL:** Muestra el subtotal correcto

### Resultado Esperado:
```
✅ Material va directo a tabla
✅ SAP visible debajo del nombre (P5)
✅ Botones ± visibles (P4)
✅ Unidad visible debajo del precio (P5)
✅ Contador y total actualizados
```

---

## ✅ TEST 5: Botones ± para Editar Cantidad (P4)

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Agrega un material a la tabla (ver TEST 4)
2. La cantidad por defecto debe ser **1**
3. Haz clic en el botón **`+`** (más) **3 veces**
4. **VERIFICA:**
   - ✅ La cantidad sube a 4
   - ✅ El subtotal se recalcula automáticamente
   - ✅ El TOTAL se actualiza

5. Haz clic en el botón **`−`** (menos) **2 veces**
6. **VERIFICA:**
   - ✅ La cantidad baja a 2
   - ✅ El subtotal se recalcula

7. Haz clic en **`−`** cuando cantidad = 1
8. **VERIFICA:**
   - ✅ La cantidad NO baja de 1 (validación)
   - ✅ Ves un mensaje de error (opcional)

9. **Edición manual:** Haz clic en el input numérico y escribe `15`
10. **VERIFICA:**
    - ✅ La cantidad cambia a 15
    - ✅ El subtotal se recalcula

### Resultado Esperado:
```
✅ Botón + incrementa cantidad
✅ Botón - decrementa cantidad
✅ Mínimo 1 (no baja más)
✅ Input editable manualmente
✅ Subtotal se recalcula en tiempo real
```

---

## ✅ TEST 6: Mostrar Unidad de Medida (P5)

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Agrega **3 materiales diferentes** a la tabla
2. Busca un material que tenga unidad en **"u."** (unidades)
3. Busca un material que tenga unidad en **"m"** (metros)
4. Busca un material que tenga unidad en **"l"** (litros)
5. **VERIFICA** en cada fila:
   - ✅ **Arriba:** Nombre del material + SAP
   - ✅ **Abajo (en la columna de precio):** La unidad
   - ✅ Ej: "$0.15 (u.)" o "$2.00 (m)" o "$1.50 (l)"

### Resultado Esperado:
```
✅ Unidad (u.) visible
✅ Unidad (m) visible
✅ Unidad (l) visible
✅ Todas las unidades se muestran junto al precio
```

---

## ✅ TEST 7: Eliminar Material

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Agrega 2 materiales a la tabla
2. **VERIFICA:** Contador dice "2 Materiales Agregados"
3. Haz clic en el botón **🗑️ Eliminar** del primer material
4. **VERIFICA:**
   - ✅ La fila desaparece
   - ✅ Contador baja a "1 Material Agregado"
   - ✅ El TOTAL se recalcula

5. Haz clic en **🗑️ Eliminar** del último material
6. **VERIFICA:**
   - ✅ La tabla muestra "Sin materiales agregados"
   - ✅ Contador dice "0"
   - ✅ TOTAL = "$0.00"

### Resultado Esperado:
```
✅ Botón eliminar quita la fila
✅ Contador se actualiza
✅ TOTAL se recalcula
✅ Tabla vacía muestra mensaje
```

---

## ✅ TEST 8: Guardar Borrador en localStorage (P9)

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Completa PASO 1 con información básica
2. Agrega **3 materiales** a la tabla en PASO 2
3. Haz clic en el botón **"💾 Guardar borrador"**
4. **VERIFICA:**
   - ✅ Aparece mensaje de éxito
   - ✅ Te redirige a "Mis Solicitudes" (después de 1.5 segundos)

5. **Abre Developer Tools:** Presiona **F12**
6. Ve a la pestaña **"Console"**
7. Ejecuta este comando:
   ```javascript
   JSON.parse(localStorage.getItem('spm_draft_solicitud'))
   ```
8. **VERIFICA:** Se muestra un objeto con:
   - ✅ `centro`: (objeto con id, sector, etc.)
   - ✅ `almacen`: (objeto con id, etc.)
   - ✅ `criticidad`: (ej: "Normal")
   - ✅ `fecha_necesidad`: (fecha)
   - ✅ `centro_costos`: (ej: "CC001")
   - ✅ `justificacion`: (texto)
   - ✅ **`materiales`: [array]** ← NUEVO (P9)
   - ✅ `timestamp`: (fecha ISO)

9. **En el array de materiales, verifica cada uno tiene:**
   - ✅ `material`: (nombre)
   - ✅ `codigo_sap`: (SAP)
   - ✅ `quantity`: (cantidad)
   - ✅ `price`: (precio)
   - ✅ `unit`: (unidad)
   - ✅ `subtotal`: (cantidad × precio)

### Resultado Esperado:
```
✅ localStorage['spm_draft_solicitud'] existe
✅ Contiene todos los datos básicos
✅ Contiene ARRAY de materiales agregados (P9)
✅ Cada material tiene cantidad, precio, unidad
```

---

## ✅ TEST 9: Persistencia de Borrador (localStorage)

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Completa TEST 8 (guardar borrador)
2. **Cierra completamente el navegador** (no solo la pestaña)
3. Reabre el navegador en http://127.0.0.1:5000/home
4. **Abre Developer Tools:** Presiona **F12**
5. Ve a **"Console"** y ejecuta:
   ```javascript
   localStorage.getItem('spm_draft_solicitud')
   ```
6. **VERIFICA:**
   - ✅ Los datos AÚN están en localStorage
   - ✅ No se han perdido al cerrar navegador

### Resultado Esperado:
```
✅ localStorage persiste después de cerrar navegador
✅ Datos del borrador están disponibles para recuperar
```

---

## ✅ TEST 10: Cálculos de Subtotal y Total

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Limpia la tabla (elimina todos los materiales)
2. Agrega material A:
   - Cantidad: **5**
   - Precio: **$2.00**
   - **Subtotal debe ser:** $10.00

3. **VERIFICA:** Subtotal = $10.00

4. Agrega material B:
   - Cantidad: **3**
   - Precio: **$1.50**
   - **Subtotal debe ser:** $4.50

5. **VERIFICA:** Subtotal = $4.50

6. **VERIFICA el TOTAL general:**
   - Debe ser: $10.00 + $4.50 = **$14.50**

7. Cambia cantidad de A a 10
8. **VERIFICA:**
   - Material A subtotal: $20.00
   - TOTAL: $20.00 + $4.50 = **$24.50**

### Resultado Esperado:
```
✅ Subtotal = Cantidad × Precio
✅ TOTAL = Suma de todos los subtotales
✅ Cálculos en tiempo real
```

---

## ✅ TEST 11: Continuar a Paso 3 (Revisar y Confirmar)

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Completa PASO 2 con **al menos 2 materiales**
2. Haz clic en el botón **"➜ Continuar"** (o similar)
3. **VERIFICA:** Entras a PASO 3 (Revisar Solicitud)
4. **VERIFICA que aparezca:**
   - ✅ Información de la solicitud (Centro, Almacén, etc.)
   - ✅ **Tabla de materiales** con todos los que agregaste
   - ✅ **TOTAL FINAL** correcto

5. Vuelve atrás (botón **"← Anterior"**)
6. **VERIFICA:**
   - ✅ PASO 2 mantiene todos los materiales
   - ✅ Los datos no se perdieron

### Resultado Esperado:
```
✅ Paso 3 muestra tabla de materiales
✅ TOTAL es correcto
✅ Navegación back/forward preserva datos
```

---

## ✅ TEST 12: Console Sin Errores

**Estado:** ⏳ PENDIENTE

### Instrucciones:
1. Abre **Developer Tools:** **F12**
2. Ve a la pestaña **"Console"**
3. Realiza TODOS los tests anteriores
4. **VERIFICA:**
   - ✅ NO hay mensajes de error (🔴 rojo)
   - ✅ Los logs son informativos (azules)
   - ✅ Puedes ver "Material agregado" en azul

### Resultado Esperado:
```
✅ Console limpia
✅ Sin errores de JavaScript
✅ Logs informativos solamente
```

---

## 📊 Resumen de Testing

| # | Test | Estado | Notas |
|---|------|--------|-------|
| 1 | SECTION 2 eliminado | ⏳ | ❌ NO debe estar visible |
| 2 | Búsqueda | ⏳ | ✅ Autocomplete + filtros |
| 3 | Modal | ⏳ | ✅ Detalles del material |
| 4 | Agregar a tabla | ⏳ | ✅ P4 + P5 |
| 5 | Botones ± | ⏳ | ✅ Editar cantidad |
| 6 | Unidad (P5) | ⏳ | ✅ (u.), (m), (l) |
| 7 | Eliminar | ⏳ | ✅ Remove from table |
| 8 | Guardar borrador | ⏳ | ✅ localStorage |
| 9 | Persistencia | ⏳ | ✅ Después de cerrar |
| 10 | Cálculos | ⏳ | ✅ Subtotal + Total |
| 11 | Paso 3 | ⏳ | ✅ Review correcto |
| 12 | Console | ⏳ | ✅ Sin errores |

---

## 🎯 Criterio de Éxito

**Para que la sesión sea EXITOSA, necesitamos:**
- ✅ 11 de 11 tests pasando (100%)
- ✅ Console sin errores
- ✅ localStorage funcionando
- ✅ Cálculos correctos
- ✅ UX clara y fluida

---

## 📝 Notas

1. Si algún test falla, reporta:
   - ¿Qué esperabas?
   - ¿Qué sucedió en realidad?
   - ¿Hay error en console?

2. Si todo funciona, confirma con: **"✅ TODOS LOS TESTS PASARON"**

3. El servidor está en: http://127.0.0.1:5000
   - Terminal ID: `ae8001aa-a9e6-40f6-95f1-9c8516e837c5`
   - Estado: ✅ CORRIENDO

---

**¡Listo! Comienza el testing cuando estés preparado.** 🚀
