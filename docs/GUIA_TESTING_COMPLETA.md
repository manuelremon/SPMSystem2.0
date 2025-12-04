# 🧪 GUÍA DE TESTING - PROPUESTAS 1, 2, 3, 8

**Fecha:** 3 de noviembre de 2025
**Objetivo:** Verificar que todas las propuestas funcionan correctamente
**Duración estimada:** 15-20 minutos
**Herramientas:** Navegador (Chrome/Firefox/Edge)

---

## ✅ LISTA DE VERIFICACIÓN

### Antes de Empezar

- [ ] Abrir http://127.0.0.1:5000
- [ ] Ir a paso "Agregar Materiales"
- [ ] Abrir DevTools (F12) - Pestaña Console
- [ ] Verificar: Sin errores en consola

---

## 📋 PROPUESTA 1: TABLA DE MATERIALES

### Test 1.1: Tabla Visible

**Pasos:**
1. Ir a "Agregar Materiales"
2. Buscar en la página: "📋 Materiales Agregados"
3. Debe haber una tabla con encabezados

**Resultado esperado:**
```
✅ Tabla visible
✅ Encabezados: Material | Cantidad | Precio Unit. | Subtotal | Acciones
✅ Contador: "Materiales Agregados (0)"
✅ Mensaje: "Sin materiales agregados"
```

**Verifica:** [ ]

---

### Test 1.2: Agregar Material a la Tabla

**Pasos:**
1. En campo "Material": Escribir "TORNILLO"
2. En campo "Cantidad": Escribir "10"
3. En campo "Precio": Escribir "0.50"
4. Click en botón "➕ Agregar"

**Resultado esperado:**
```
✅ Toast: "✅ Material agregado: TORNILLO"
✅ Tabla se actualiza con 1 fila
✅ Fila muestra: TORNILLO | 10 | 0.50 | 5.00 | 🗑️
✅ Contador: "Materiales Agregados (1)"
✅ Total: "$5.00" (verde)
```

**Verifica:** [ ]

---

### Test 1.3: Agregar Segundo Material

**Pasos:**
1. Material: "CABLE"
2. Cantidad: "5"
3. Precio: "2.00"
4. Click "➕ Agregar"

**Resultado esperado:**
```
✅ Nueva fila en tabla
✅ Tabla ahora tiene 2 filas
✅ Contador: "Materiales Agregados (2)"
✅ Total actualizado: "$15.00" (5 + 10)
✅ Ambas filas visible y correctas
```

**Verifica:** [ ]

---

### Test 1.4: Eliminar Material (Botón 🗑️)

**Pasos:**
1. Click en botón "🗑️" de la primera fila (TORNILLO)
2. Verificar tabla

**Resultado esperado:**
```
✅ Fila desaparece
✅ Contador: "Materiales Agregados (1)"
✅ Solo CABLE queda
✅ Total: "$10.00"
✅ Toast: "Material eliminado"
```

**Verifica:** [ ]

---

### Test 1.5: Limpiar Todo

**Pasos:**
1. Click en botón "🔄 Limpiar Todo"
2. Verificar tabla

**Resultado esperado:**
```
✅ Tabla vacía
✅ Mensaje: "Sin materiales agregados"
✅ Contador: "Materiales Agregados (0)"
✅ Total: "$0.00"
✅ Toast: "Todos los materiales han sido removidos"
```

**Verifica:** [ ]

---

## 🎨 PROPUESTA 2: MODAL DESCRIPCIÓN AMPLIADA

### Test 2.1: Abrir Modal

**Pasos:**
1. En búsqueda, escribir: "1000000006" (SAP)
2. O escribir: "TORNILLO" (Descripción)
3. Click en botón "📋 Ampliada"

**Resultado esperado:**
```
✅ Modal aparece con animación (slideIn)
✅ Fondo oscuro (overlay) visible
✅ Modal tiene header azul con "✕" para cerrar
✅ Se ve contenido
```

**Verifica:** [ ]

---

### Test 2.2: Contenido del Modal

**Pasos:**
1. Modal abierto (de Test 2.1)
2. Verificar las 5 secciones

**Resultado esperado:**
```
✅ SECCIÓN 1: Información Básica
   - Código: (valor)
   - Unidad: (valor)

✅ SECCIÓN 2: Descripción Ampliada
   - Texto completo del material

✅ SECCIÓN 3: Precio
   - Precio en USD

✅ SECCIÓN 4: Stock Disponible
   - Disponible, Reservado, Entrante, Almacén

✅ SECCIÓN 5: Historial de Precios
   - (Template listo para futuro)

✅ FOOTER:
   - Botón "Cerrar"
   - Botón "➕ Agregar Material"
```

**Verifica:** [ ]

---

### Test 2.3: Agregar Material desde Modal

**Pasos:**
1. Modal abierto con material válido
2. Click en botón "➕ Agregar Material"

**Resultado esperado:**
```
✅ Modal se cierra automáticamente
✅ Campos del formulario se llenan:
   - Material: (código - nombre)
   - Precio: (precio del catálogo)
✅ Tabla se actualiza (si clickea Agregar después)
✅ Toast: "Material agregado desde modal"
```

**Verifica:** [ ]

---

### Test 2.4: Cerrar Modal

**Pasos:**
1. Modal abierto
2. Click en botón "✕" (arriba a la derecha)
3. O click fuera del modal (overlay)

**Resultado esperado:**
```
✅ Modal desaparece con animación
✅ Fondo se vuelve normal
✅ Overlay desaparece
✅ Formulario sigue funcionando
```

**Verifica:** [ ]

---

## 🔍 PROPUESTA 3: BÚSQUEDA MEJORADA

### Test 3.1: Dropdown de Categorías

**Pasos:**
1. Ver campo "Categoría" en búsqueda
2. Click en dropdown

**Resultado esperado:**
```
✅ Dropdown se abre
✅ Primera opción: "Todas"
✅ Otras opciones: Categorías reales (Eléctrico, Ferretería, etc.)
✅ Orden: Alfabético
✅ Mínimo 5 categorías visibles
```

**Verifica:** [ ]

---

### Test 3.2: Filtrar por Categoría

**Pasos:**
1. Seleccionar: "Ferretería"
2. Escribir en búsqueda: "TORNILLO"
3. Ver resultados

**Resultado esperado:**
```
✅ Datalist actualizado
✅ Solo muestra TORNILLOS de Ferretería
✅ Contador: "Resultados: X" (verde)
✅ No incluye tornillos de otras categorías
```

**Verifica:** [ ]

---

### Test 3.3: Ordenamiento por Precio

**Pasos:**
1. Búsqueda: "TORNILLO"
2. Seleccionar: "💰 Precio (Menor)"
3. Ver orden en datalist

**Resultado esperado:**
```
✅ Resultados ordenados: Menor a Mayor precio
✅ Primer resultado: Más barato
✅ Último resultado: Más caro
✅ Cambiar a "Precio (Mayor)" invierte orden
```

**Verifica:** [ ]

---

### Test 3.4: Ordenamiento por Nombre

**Pasos:**
1. Búsqueda: "CABLE"
2. Seleccionar: "🔤 Nombre (A-Z)"
3. Ver orden

**Resultado esperado:**
```
✅ Resultados ordenados alfabéticamente
✅ CABLE AZUL antes que CABLE ROJO
✅ Cambiar a (Z-A) invierte orden
```

**Verifica:** [ ]

---

### Test 3.5: Contador de Resultados

**Pasos:**
1. Búsqueda vacía
2. Ver contador: "Resultados: 0"

**Pasos:**
3. Escribir: "TORNILLO"
4. Ver contador actualizado

**Resultado esperado:**
```
✅ Sin búsqueda: "Resultados: 0" (ROJO)
✅ Con búsqueda: "Resultados: 127" (VERDE)
✅ Sin resultados: "Resultados: 0" (ROJO)
✅ Se actualiza en tiempo real
```

**Verifica:** [ ]

---

### Test 3.6: Búsquedas Recientes

**Pasos:**
1. Hacer búsqueda 1: "TORNILLO"
2. Hacer búsqueda 2: "CABLE"
3. Hacer búsqueda 3: "SENSOR"
4. Limpiar campos
5. Click en input de búsqueda (vacío)

**Resultado esperado:**
```
✅ Aparece: "🕒 Búsquedas Recientes"
✅ Muestra: SENSOR, CABLE, TORNILLO (en ese orden)
✅ Botones son clickeables
✅ Al escribir algo: Sugerencias desaparecen
```

**Verifica:** [ ]

---

### Test 3.7: Aplicar Búsqueda Reciente

**Pasos:**
1. Ver sugerencias (de Test 3.6)
2. Click en "CABLE"

**Resultado esperado:**
```
✅ Campo se rellena con "CABLE"
✅ Sugerencias desaparecen
✅ Datalist se actualiza con resultados
✅ Contador muestra cantidad
```

**Verifica:** [ ]

---

### Test 3.8: Botón Limpiar

**Pasos:**
1. Filtrar: Categoría = "Eléctrico"
2. Buscar: "CABLE"
3. Ordenar: "Precio (Menor)"
4. Click en botón "✕ Limpiar"

**Resultado esperado:**
```
✅ SAP: Vacío
✅ Categoría: "Todas"
✅ Descripción: Vacío
✅ Ordenamiento: "Relevancia"
✅ Contador: "Resultados: 0"
✅ Sugerencias: Reaparecen
```

**Verifica:** [ ]

---

## ✅ PROPUESTA 8: VALIDACIÓN VISUAL

### Test 8.1: Indicadores Iniciales

**Pasos:**
1. Ir a "Agregar Materiales"
2. Ver campos: Material, Cantidad, Precio

**Resultado esperado:**
```
✅ Material: Indicador oculto (⏳)
✅ Cantidad: Indicador oculto (⏳)
✅ Precio: Indicador oculto (⏳)
✅ Botón "➕ Agregar": DESHABILITADO (gris)
✅ Cursor: not-allowed
```

**Verifica:** [ ]

---

### Test 8.2: Validar Material - Vacío

**Pasos:**
1. Click en campo Material
2. Escribir: "" (vacío)
3. Click fuera (blur)

**Resultado esperado:**
```
✅ Indicador: 🔴 (ROJO)
✅ Borde: ROJO (#fca5a5)
✅ Fondo: Rojo claro (#fef2f2)
✅ Error: "Selecciona un material"
✅ Botón: DESHABILITADO
```

**Verifica:** [ ]

---

### Test 8.3: Validar Material - Válido

**Pasos:**
1. Campo Material: Escribir "TORNILLO M6"
2. Click fuera

**Resultado esperado:**
```
✅ Indicador: ✅ (VERDE)
✅ Borde: VERDE (#86efac)
✅ Fondo: Verde claro (#f0fdf4)
✅ Error: Desaparece
✅ Botón: Sigue deshabilitado (faltan otros)
```

**Verifica:** [ ]

---

### Test 8.4: Validar Cantidad - Errores

**Pasos:**
1. Campo Cantidad: Escribir "0"
2. Click fuera

**Resultado esperado:**
```
✅ Indicador: 🔴 (ROJO)
✅ Error: "Debe ser mayor a 0"
```

**Pasos:**
3. Escribir "-5"
4. Click fuera

**Resultado esperado:**
```
✅ Indicador: 🔴 (ROJO)
✅ Error: "No puede ser negativo"
```

**Pasos:**
5. Escribir "5.5"
6. Click fuera

**Resultado esperado:**
```
✅ Indicador: ⚠️ (AMARILLO)
✅ Error: "Debe ser número entero"
```

**Verifica:** [ ]

---

### Test 8.5: Validar Cantidad - Válida

**Pasos:**
1. Campo Cantidad: Escribir "10"
2. Click fuera

**Resultado esperado:**
```
✅ Indicador: ✅ (VERDE)
✅ Borde: VERDE
✅ Error: Desaparece
✅ Botón: Sigue deshabilitado (falta precio)
```

**Verifica:** [ ]

---

### Test 8.6: Validar Precio - Errores

**Pasos:**
1. Campo Precio: Escribir "-5"
2. Click fuera

**Resultado esperado:**
```
✅ Indicador: 🔴 (ROJO)
✅ Error: "No puede ser negativo"
```

**Pasos:**
3. Escribir "0"
4. Click fuera

**Resultado esperado:**
```
✅ Indicador: ⚠️ (AMARILLO)
✅ Error: "¿Sin costo?"
```

**Pasos:**
5. Escribir "150000"
6. Click fuera

**Resultado esperado:**
```
✅ Indicador: ⚠️ (AMARILLO)
✅ Error: "Precio muy alto"
```

**Verifica:** [ ]

---

### Test 8.7: Validar Precio - Válida

**Pasos:**
1. Campo Precio: Escribir "0.50"
2. Click fuera

**Resultado esperado:**
```
✅ Indicador: ✅ (VERDE)
✅ Error: Desaparece
```

**Verifica:** [ ]

---

### Test 8.8: Botón Habilitado Cuando TODO es Válido

**Pasos:**
1. Material: "TORNILLO M6" (✅)
2. Cantidad: "10" (✅)
3. Precio: "0.50" (✅)

**Resultado esperado:**
```
✅ Botón "➕ Agregar": HABILITADO (verde)
✅ Cursor: pointer (clickeable)
✅ Click en botón → Material se agrega a tabla
```

**Verifica:** [ ]

---

### Test 8.9: Botón Deshabilitado Si Un Campo Inválido

**Pasos:**
1. Material: "TORNILLO" (✅)
2. Cantidad: "5" (✅)
3. Precio: "0" (⚠️ - Válido pero warning)
4. Cantidad: Cambiar a "-1" (🔴)

**Resultado esperado:**
```
✅ Botón vuelve DESHABILITADO (gris)
✅ No se puede clickear
```

**Verifica:** [ ]

---

### Test 8.10: Validación en Tiempo Real (oninput)

**Pasos:**
1. Material: Escribir letra por letra: "T" → "TO" → "TOR"...
2. Ver indicador cambiar en tiempo real

**Resultado esperado:**
```
✅ "T": 🔴 (demasiado corto)
✅ "TO": 🔴 (demasiado corto)
✅ "TOR": ✅ (válido - 3 caracteres)
✅ Cambios visibles sin click fuera
```

**Verifica:** [ ]

---

## 🔗 INTEGRACIÓN: TODAS JUNTAS

### Test 9.1: Flujo Completo

**Pasos:**
1. **BÚSQUEDA (P3):** Escribir "TORNILLO"
2. **MODAL (P2):** Click en "📋 Ampliada"
3. **MODAL:** Ver detalles, click "➕ Agregar"
4. **VALIDACIÓN (P8):** Ver campos validados automáticamente
5. **TABLA (P1):** Ver material en tabla
6. **CONTADOR:** Ver actualizado

**Resultado esperado:**
```
✅ Todo funciona sin errores
✅ Flujo es fluido
✅ Sin parpadeos o inconsistencias
✅ Console: Sin errores
```

**Verifica:** [ ]

---

### Test 9.2: Múltiples Materiales

**Pasos:**
1. Agregar TORNILLO (cantidad 10, precio 0.50)
2. Agregar CABLE (cantidad 5, precio 2.00)
3. Agregar SENSOR (cantidad 3, precio 5.00)
4. Ver tabla completa

**Resultado esperado:**
```
✅ Tabla tiene 3 filas
✅ Contador: "3 materiales"
✅ Total: $30.50 (10*0.50 + 5*2.00 + 3*5.00)
✅ Subtotales correctos
✅ Sin errores de cálculo
```

**Verifica:** [ ]

---

### Test 9.3: Console Check

**Pasos:**
1. Abrir DevTools (F12)
2. Pestaña Console
3. Hacer algunos flujos
4. Ver console

**Resultado esperado:**
```
✅ Sin errores (rojo)
✅ Sin warnings críticos (naranja)
✅ Mensajes informativos OK
✅ Sin undefined references
```

**Verifica:** [ ]

---

## 📱 RESPONSIVE CHECK

### Test 10.1: Desktop (1920x1080)

**Pasos:**
1. Abrir en navegador normal
2. Maximizar

**Resultado esperado:**
```
✅ Todos los campos visibles
✅ Tabla no necesita scroll horizontal
✅ Botones accesibles
✅ Modal centrado
```

**Verifica:** [ ]

---

### Test 10.2: Tablet (768px)

**Pasos:**
1. DevTools: Emular tablet
2. Ver layout

**Resultado esperado:**
```
✅ Grid adaptado
✅ Campos legibles
✅ Tabla en vertical (si necesario)
✅ No hay overflow
```

**Verifica:** [ ]

---

### Test 10.3: Mobile (375px)

**Pasos:**
1. DevTools: Emular mobile
2. Ver layout

**Resultado esperado:**
```
✅ Stack vertical
✅ Campos ocupan 100% ancho
✅ Tabla scrollable horizontal (si necesario)
✅ Accesible en mobile
```

**Verifica:** [ ]

---

## 🎯 RESUMEN DE VERIFICACIÓN

### Propuesta 1 - Tabla
- [ ] Test 1.1: Tabla visible
- [ ] Test 1.2: Agregar material
- [ ] Test 1.3: Agregar segundo
- [ ] Test 1.4: Eliminar
- [ ] Test 1.5: Limpiar todo

**Status:** ✅ / ⚠️ / ❌

---

### Propuesta 2 - Modal
- [ ] Test 2.1: Abrir modal
- [ ] Test 2.2: Contenido correcto
- [ ] Test 2.3: Agregar desde modal
- [ ] Test 2.4: Cerrar modal

**Status:** ✅ / ⚠️ / ❌

---

### Propuesta 3 - Búsqueda
- [ ] Test 3.1: Categorías
- [ ] Test 3.2: Filtrar por categoría
- [ ] Test 3.3: Ordenar por precio
- [ ] Test 3.4: Ordenar por nombre
- [ ] Test 3.5: Contador
- [ ] Test 3.6: Búsquedas recientes
- [ ] Test 3.7: Aplicar sugerencia
- [ ] Test 3.8: Limpiar

**Status:** ✅ / ⚠️ / ❌

---

### Propuesta 8 - Validación
- [ ] Test 8.1: Indicadores iniciales
- [ ] Test 8.2: Validar material vacío
- [ ] Test 8.3: Validar material válido
- [ ] Test 8.4: Validar cantidad errores
- [ ] Test 8.5: Validar cantidad válida
- [ ] Test 8.6: Validar precio errores
- [ ] Test 8.7: Validar precio válida
- [ ] Test 8.8: Botón habilitado
- [ ] Test 8.9: Botón deshabilitado
- [ ] Test 8.10: Validación en tiempo real

**Status:** ✅ / ⚠️ / ❌

---

### Integración
- [ ] Test 9.1: Flujo completo
- [ ] Test 9.2: Múltiples materiales
- [ ] Test 9.3: Console clean

**Status:** ✅ / ⚠️ / ❌

---

### Responsive
- [ ] Test 10.1: Desktop
- [ ] Test 10.2: Tablet
- [ ] Test 10.3: Mobile

**Status:** ✅ / ⚠️ / ❌

---

## 📊 RESULTADO FINAL

**Propuesta 1 (Tabla):** ✅ / ⚠️ / ❌
**Propuesta 2 (Modal):** ✅ / ⚠️ / ❌
**Propuesta 3 (Búsqueda):** ✅ / ⚠️ / ❌
**Propuesta 8 (Validación):** ✅ / ⚠️ / ❌
**Integración:** ✅ / ⚠️ / ❌
**Responsive:** ✅ / ⚠️ / ❌

---

**CONCLUSIÓN:** Si todos los tests pasan ✅ → **LISTO PARA PRODUCCIÓN**

---

**Generado:** 3 de noviembre de 2025
