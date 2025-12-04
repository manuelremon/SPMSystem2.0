# 📋 Cambios: Rediseño Arquitectura PASO 2 - Agregar Materiales

**Fecha:** 3 de noviembre de 2025
**Sesión:** Rediseño Flujo de Solicitud
**Estado:** ✅ COMPLETADO

---

## 🎯 Objetivos Alcanzados

### ✅ OPCIÓN A: Eliminar SECTION 2 (Redundante)
- **Antes:** 3 bloques (Búsqueda → Selección → Tabla)
- **Ahora:** 2 bloques (Búsqueda → Tabla directa)
- **Cambio:** El usuario busca, hace clic en resultado, ve modal, agrega a tabla
- **Beneficio:** Flujo más limpio, menos clics, menos confusión

### ✅ OPCIÓN B: Agregar Mejoras (P4 + P5 + P9)

#### **P4: Cantidad con Botones ± (IMPLEMENTADA)**
- ✅ Botones `-` y `+` en cada fila de la tabla
- ✅ Input numérico editable manualmente
- ✅ Validación: cantidad mínima = 1
- ✅ Funciones:
  - `incrementQuantity(index)` - suma 1
  - `decrementQuantity(index)` - resta 1 (min 1)
  - `updateQuantity(index, value)` - edita manualmente

#### **P5: Unidad de Medida (IMPLEMENTADA)**
- ✅ Muestra SAP y nombre del material (arriba)
- ✅ Muestra unidad (u., m, l, kg, etc.) junto al precio (abajo)
- ✅ Campo adicional en estructura: `unit`
- ✅ Obtenido de: `material.unidad` (desde catálogo)

#### **P9: Guardar Borradores (MEJORADA)**
- ✅ Guarda información básica + **todos los materiales agregados**
- ✅ Usa `localStorage['spm_draft_solicitud']` para persistencia local
- ✅ Estructura guardada:
  ```json
  {
    "centro": "...",
    "almacen": "...",
    "criticidad": "...",
    "fecha_necesidad": "...",
    "centro_costos": "...",
    "justificacion": "...",
    "materiales": [...array de agregatedMaterials],
    "timestamp": "2025-11-03T..."
  }
  ```
- ✅ Función: `saveDraft()` (en home.html)

---

## 🔧 Cambios en Código

### home.html

#### 1. **Eliminación de SECTION 2**
- **Líneas eliminadas:** ~1676-1728 (52 líneas)
- **Elementos removidos:**
  - `<div> Seleccionar y Agregar</div>`
  - `#materialSelect` (input de búsqueda de material)
  - `#materialQuantity` (input de cantidad)
  - `#materialPrice` (input de precio)
  - `#btnAddMaterial` (botón agregar)
  - Validaciones visuales asociadas

#### 2. **Mejorada SECTION 1**
- **Línea ~1610:** Agregada instrucción clara
  ```
  "Busca el material por código SAP o descripción, luego haz clic en el resultado
   para ver detalles y agregarlo a tu solicitud"
  ```
- **Beneficio:** Usuario entiende el flujo nuevo

#### 3. **Mejorada SECTION 3 (Tabla)**
- **Columnas actualizadas:**
  - Material (+ SAP abajo)
  - Cantidad ± (con botones)
  - Precio Unit. (+ unidad abajo)
  - Subtotal
  - Acciones (eliminar)

#### 4. **Función saveDraft() mejorada**
- Ahora guarda `agregatedMaterials` en localStorage
- Clave: `spm_draft_solicitud`
- Permite recuperar borrador en próxima sesión

### app.js

#### 1. **Función addMaterialFromModal() rediseñada**
```javascript
// ANTES: Llenaba campos intermedios, luego llamaba addMaterialToList()
// AHORA: Agrega DIRECTAMENTE al array agregatedMaterials
```

- Cambio: Ahora almacena estructura completa con unidad
  ```javascript
  {
    material: material.descripcion,
    codigo_sap: material.codigo,
    quantity: 1,
    price: material.precio_usd || 0,
    unit: material.unidad || 'u.',
    subtotal: material.precio_usd || 0
  }
  ```

#### 2. **Función updateMaterialsTable() completamente reescrita**
- Ahora renderiza:
  - SAP debajo del material
  - Botones ± para cantidad
  - Input numérico editable
  - Unidad debajo del precio
- **Antes:** Solo mostraba datos estáticos
- **Ahora:** Interfaz interactiva para editar

#### 3. **Nuevas funciones (P4)**
```javascript
function incrementQuantity(index)  // Botón +
function decrementQuantity(index)  // Botón -
function updateQuantity(index, value)  // Edición manual
```

---

## 🏗️ Arquitectura Final de PASO 2

```
┌─ FORM STEP 2: AGREGAR MATERIALES ──────────────────────────┐
│                                                              │
│ ┌─ SECTION 1: BÚSQUEDA ──────────────────────────────────┐  │
│ │                                                        │  │
│ │ Instrucción: "Busca por SAP o descripción..."         │  │
│ │ [SAP] [Categoría] [Descripción] [Ordenar]            │  │
│ │                                                        │  │
│ │ Resultado de búsqueda CLICKEABLE → Abre Modal        │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ MODAL: DESCRIPCIÓN AMPLIADA ─────────────────────────┐  │
│ │                                                        │  │
│ │ • Código SAP                                           │  │
│ │ • Descripción Ampliada                                 │  │
│ │ • Precio USD                                           │  │
│ │ • Unidad de Medida                                     │  │
│ │ • Stock Disponible                                     │  │
│ │ [Cerrar] [➕ Agregar Material]                         │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                           ↓ (clic agregar)                   │
│ ┌─ SECTION 3: TABLA DE MATERIALES ──────────────────────┐  │
│ │                                                        │  │
│ │ Material   | Cantidad ± | Precio+Unit | Subtotal | ❌ │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ SAP XXXXX  | [◀ 5 ▶]   | $0.15(u.)  | $0.75   | 🗑️ │  │
│ │                                                        │  │
│ │ TOTAL: $0.75                           [Limpiar]     │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                           ↓ (continuar)                      │
│ └─ PASO 3: REVISAR Y CONFIRMAR ─────────────────────────┐  │
│                                                          │  │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 Comparativa Antes/Después

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Bloques** | 3 (Búsqueda, Selección, Tabla) | 2 (Búsqueda, Tabla) |
| **Flujo** | Buscar → Completar formulario → Agregar → Tabla | Buscar → Click → Modal → Agregar → Tabla |
| **Clics** | 6-8 clics por material | 3-4 clics por material |
| **Cantidad editable** | En SECTION 2 antes de agregar | En tabla después de agregar |
| **Edición de cantidad** | No editable después | ✅ Editable con ± |
| **Unidad visible** | No | ✅ SAP + Unidad |
| **Borradores** | Solo datos básicos | ✅ Incluye materiales agregados |

---

## ⚙️ Funcionalidades Nuevas

### 1. **Botones ± en Tabla**
```html
<button onclick="decrementQuantity(0)">−</button>
<input value="5" onchange="updateQuantity(0, this.value)">
<button onclick="incrementQuantity(0)">+</button>
```

### 2. **Mostrar Unidad de Medida**
```javascript
// Estructura mejorada de cada material
{
  material: "TORNILLO M8",
  codigo_sap: "1000000001",
  quantity: 10,
  price: 0.15,
  unit: "u.",  // ← NUEVO
  subtotal: 1.50
}
```

### 3. **Persistencia en localStorage**
```javascript
localStorage.setItem('spm_draft_solicitud', JSON.stringify({
  ...formData,
  materiales: agregatedMaterials,  // ← NUEVO
  timestamp: new Date().toISOString()
}));
```

---

## 🧪 Testing Checklist

- [ ] Búsqueda filtra correctamente por SAP/Descripción
- [ ] Hacer clic en resultado abre modal
- [ ] Modal muestra: SAP, descripción, precio, unidad, stock
- [ ] Botón "Agregar Material" en modal va a tabla
- [ ] Tabla muestra SAP + nombre + unidad + precio + cantidad
- [ ] Botón `-` decrementa cantidad (mín 1)
- [ ] Botón `+` incrementa cantidad
- [ ] Input editable actualiza cantidad
- [ ] Subtotal se recalcula automáticamente
- [ ] Botón eliminar quita fila
- [ ] Guardar borrador guarda en localStorage
- [ ] TOTAL se actualiza correctamente

---

## 📝 Notas Importantes

1. **No se implementó P6 ni P7**
   - P6 (Descuentos): No aplica, usuario no compra, solo solicita
   - P7 (Proveedores): No aplica, planificador maneja eso

2. **SECTION 2 se eliminó completamente**
   - No hay entrada de datos intermediaria
   - Flujo más directo

3. **localStorage para borradores**
   - Permite recuperar solicitud si se cierra navegador
   - En próxima sesión se podría cargar automáticamente
   - Código para cargar existe en comentarios

4. **Estructura de agregatedMaterials**
   - Ahora incluye SAP, unit, y campo adicional
   - Compatible con API backend

---

## ✅ Estado Final

**PASO 2 está completamente rediseñado:**
- ✅ Arquitectura más limpia (2 bloques en lugar de 3)
- ✅ Flujo más intuitivo (click → modal → tabla)
- ✅ UX mejorada (edición fácil de cantidades)
- ✅ Información visible (SAP + unidad + precio)
- ✅ Persistencia (borradores guardados)

**Próximo:** Testing en navegador para validar funcionalidad completa.
