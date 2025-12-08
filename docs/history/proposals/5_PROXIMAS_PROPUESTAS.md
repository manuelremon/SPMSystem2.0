# 📊 5 PRÓXIMAS PROPUESTAS - SESIÓN FASE 5

**Sesión:** 3 de noviembre de 2025
**Propuestas Completadas:** 1, 2, 3, 8 (40% del plan)
**Propuestas Pendientes:** 4, 5, 6, 7, 9, 10
**Próximas a Presentar:** 5 propuestas seleccionadas

---

## 🚀 PROPUESTA 4: CANTIDAD RÁPIDA (Quick Quantity Input)

**Descripción:** Permitir al usuario cambiar la cantidad rápidamente sin reescribir todo.

### 📋 Problema que Resuelve
- Usuario agrega 1 TORNILLO, luego quiere agregar 10 más del mismo
- Debe buscar de nuevo, escribir cantidad de nuevo
- **Solución:** Agregar botones +/- o campo "Agregar más"

### 🎯 Funcionalidad

```
Cuando hay material seleccionado:

FORMA ACTUAL:
Material: [TORNILLO M6]
Cantidad: [1]
Precio: [0.50]
         [➕ Agregar]

NUEVA FORMA (Con PROPUESTA 4):
Material: [TORNILLO M6]
Cantidad: [-]  [1]  [+]  ← Botones para cambiar rápido
Precio: [0.50]
         [➕ Agregar Rápido] ← Texto mejorado

Si ya está en tabla:
         [↑ Aumentar esta fila]
         [Agregar como nuevo]
```

### 📱 Especificaciones Técnicas

**HTML Changes:**
```html
<div style="display: flex; align-items: center; gap: 6px;">
  <button type="button" onclick="decreaseQuantity();">−</button>
  <input type="number" id="materialQuantity" value="1" min="1">
  <button type="button" onclick="increaseQuantity();">+</button>
</div>
```

**JavaScript Functions:**
```javascript
window.increaseQuantity = function() {
  const input = document.getElementById('materialQuantity');
  input.value = parseInt(input.value || 1) + 1;
  validateQuantityField();
}

window.decreaseQuantity = function() {
  const input = document.getElementById('materialQuantity');
  let val = parseInt(input.value || 1) - 1;
  if (val < 1) val = 1;
  input.value = val;
  validateQuantityField();
}

window.quickAddMaterial = function() {
  // Verificar si material ya existe en tabla
  const material = document.getElementById('materialSelect').value;
  const existingRow = findMaterialInTable(material);

  if (existingRow) {
    // Sugerir: ¿Aumentar esta fila o agregar como nuevo?
    const choice = confirm(`${material} ya está en tabla.\n¿Aumentar cantidad o agregar como nuevo?`);
    if (choice) {
      increaseMaterialQuantity(existingRow);
    } else {
      addMaterialToList();
    }
  } else {
    addMaterialToList();
  }
}
```

### 🎨 UI Changes
- Botones +/- flanqueando campo cantidad
- Cambia número en tiempo real
- Validación en tiempo real

### ⏱️ Estimado
- **Tiempo:** 20-25 minutos
- **Líneas JavaScript:** +30 líneas
- **Líneas HTML:** +5 líneas
- **Complejidad:** 🟢 Baja

### 📊 Impacto UX
- ✅ Reducir 50% de clicks para cantidades múltiples
- ✅ Más intuitivo (estándar web)
- ✅ Mejor mobile UX

---

## 💰 PROPUESTA 5: UNIDAD DE MEDIDA INTELIGENTE

**Descripción:** Mostrar y cambiar unidad de medida (Pieza, Caja, Rollo, Metro, etc.)

### 📋 Problema que Resuelve
- Tornillos se compran por pieza (u.)
- Cable se compra por metro (m)
- Pintura se compra por litro (l)
- Sistema debe detectar automáticamente

### 🎯 Funcionalidad

```
NUEVA INTERFAZ:

Material: [TORNILLO M6 (u.)]  ← Unidad se muestra
Cantidad: [-] [10] [+]
Precio: [0.50 €/u.]          ← Precio incluye unidad

Precio Total: 5.00 € (10 u. × 0.50 €/u.)
```

### 📱 Especificaciones Técnicas

**Datos en Base de Datos (simular):**
```javascript
{
  id: 1,
  codigo: "TOR-M6",
  nombre: "TORNILLO M6",
  unidad: "u.",           // NEW
  precio: 0.50,
  precioUnitario: 0.50,   // NEW - precio por unidad
  cantidad: 1,
  descuento: 0            // Preparación para P6
}
```

**HTML Changes:**
```html
<div class="form-field">
  <label>Material</label>
  <input type="text" id="materialSelect" list="materialsList">
  <small id="materialUnit" style="color: #6b7280;">
    Unidad: <strong>u.</strong>
  </small>
</div>

<div class="form-field">
  <label>Precio</label>
  <input type="number" id="materialPrice" readonly value="0.50">
  <small id="pricePerUnit" style="color: #6b7280;">
    $0.50/<strong id="unitLabel">u.</strong>
  </small>
</div>
```

**JavaScript:**
```javascript
window.loadMaterialUnit = function(materialCode) {
  // Buscar material en catálogo
  const material = window.allMateriales.find(m => m.codigo === materialCode);
  if (material) {
    document.getElementById('materialUnit').innerHTML =
      `Unidad: <strong>${material.unidad || 'u.'}</strong>`;
    document.getElementById('unitLabel').textContent =
      material.unidad || 'u.';
    document.getElementById('materialPrice').value = material.precio;
  }
}

window.calculateSubtotal = function() {
  const qty = parseFloat(document.getElementById('materialQuantity').value) || 0;
  const price = parseFloat(document.getElementById('materialPrice').value) || 0;
  const subtotal = qty * price;

  const material = getCurrentMaterial();
  const unit = material?.unidad || 'u.';

  const display = `${qty} ${unit} × $${price}/${unit} = $${subtotal.toFixed(2)}`;
  document.getElementById('subtotalDisplay').textContent = display;
}
```

### 🎨 UI Changes
- Mostrar unidad junto al material
- Mostrar "€ por unidad" en precio
- Cálculo subtotal con unidades

### ⏱️ Estimado
- **Tiempo:** 25-30 minutos
- **Líneas JavaScript:** +40 líneas
- **Líneas HTML:** +10 líneas
- **Complejidad:** 🟡 Media

### 📊 Impacto UX
- ✅ Más información útil
- ✅ Menos errores de cálculo
- ✅ Mejor claridad de precios

---

## 🏷️ PROPUESTA 6: DESCUENTOS POR VOLUMEN

**Descripción:** Aplicar descuentos automáticos según cantidad comprada.

### 📋 Problema que Resuelve
- Comprar 1 TORNILLO = $0.50
- Comprar 100 TORNILLOS = Debería costar menos (por volumen)
- Necesitar tabla de descuentos automática

### 🎯 Funcionalidad

```
EJEMPLO DE DESCUENTOS:

Tornillos M6:
- 1-9: $0.50 (sin descuento)
- 10-49: $0.45 (−10%)
- 50-99: $0.40 (−20%)
- 100+: $0.35 (−30%)

INTERFAZ:

Material: [TORNILLO M6]
Cantidad: [-] [50] [+]
Precio Base: $0.50
Descuento: -20% (aplica desde 50 unidades)
Precio Final: $0.40 × 50 = $20.00
               ↑
             Automático
```

### 📱 Especificaciones Técnicas

**Datos de Descuentos:**
```javascript
{
  codigo: "TOR-M6",
  descuentos: [
    { desde: 10, hasta: 49, descuento: 10 },    // -10%
    { desde: 50, hasta: 99, descuento: 20 },    // -20%
    { desde: 100, hasta: 999, descuento: 30 }   // -30%
  ]
}
```

**JavaScript:**
```javascript
window.calculateDiscount = function() {
  const material = getCurrentMaterial();
  const qty = parseInt(document.getElementById('materialQuantity').value) || 0;
  const basePrice = material.precio;

  if (!material.descuentos) {
    updatePriceDisplay(basePrice, 0);
    return;
  }

  // Buscar descuento aplicable
  const discount = material.descuentos.find(d =>
    qty >= d.desde && qty <= d.hasta
  ) || { descuento: 0 };

  const finalPrice = basePrice * (1 - discount.descuento / 100);

  updatePriceDisplay(finalPrice, discount.descuento);
}

window.updatePriceDisplay = function(price, discount) {
  document.getElementById('materialPrice').value = price.toFixed(2);

  if (discount > 0) {
    document.getElementById('discountLabel').textContent =
      `−${discount}%`;
    document.getElementById('discountLabel').style.color = '#10b981';
    document.getElementById('discountLabel').style.display = 'block';
  } else {
    document.getElementById('discountLabel').style.display = 'none';
  }
}
```

### 🎨 UI Changes
- Badge "−20%" en verde cuando hay descuento
- Mostrar "Precio Base" vs "Precio Final"
- Resaltar ahorro

### ⏱️ Estimado
- **Tiempo:** 30-35 minutos
- **Líneas JavaScript:** +50 líneas
- **Líneas HTML:** +15 líneas
- **Líneas Data:** +20 descuentos de ejemplo
- **Complejidad:** 🟠 Media-Alta

### 📊 Impacto UX
- ✅ Incentivar compras mayores
- ✅ Mostrar ahorros reales
- ✅ Decisiones de compra mejor informadas

---

## 👥 PROPUESTA 7: PROVEEDORES ALTERNATIVOS

**Descripción:** Mostrar múltiples proveedores del mismo material con precios diferentes.

### 📋 Problema que Resuelve
- Tornillos M6 disponibles de 3 proveedores
- Precios diferentes: $0.50, $0.48, $0.52
- Usuario debe elegir mejor opción

### 🎯 Funcionalidad

```
Material: [TORNILLO M6 ▼]

PROVEEDORES DISPONIBLES:
┌─────────────────────────────┐
│ Proveedor A: $0.50 (Stock: 500)  │
│ Proveedor B: $0.48 (Stock: 100)  ✓ MEJOR PRECIO
│ Proveedor C: $0.52 (Stock: 1000) │
└─────────────────────────────┘

Seleccionado: Proveedor B
Precio: $0.48 × 10 = $4.80
Entrega: 2-3 días hábiles
```

### 📱 Especificaciones Técnicas

**Datos de Proveedores:**
```javascript
{
  codigo: "TOR-M6",
  nombre: "TORNILLO M6",
  proveedores: [
    {
      id: 1,
      nombre: "Proveedor A",
      precio: 0.50,
      stock: 500,
      plazo: "2-3 días",
      confiabilidad: 0.95
    },
    {
      id: 2,
      nombre: "Proveedor B",
      precio: 0.48,
      stock: 100,
      plazo: "3-4 días",
      confiabilidad: 0.92
    }
  ]
}
```

**HTML:**
```html
<div id="suppliersDropdown" style="display: none; border: 1px solid #e5e7eb; padding: 12px; margin-top: 8px; border-radius: 6px;">
  <label style="font-weight: 600; display: block; margin-bottom: 8px;">Proveedores disponibles:</label>
  <div id="suppliersList" style="display: flex; flex-direction: column; gap: 8px;"></div>
</div>
```

**JavaScript:**
```javascript
window.showSuppliers = function(materialCode) {
  const material = window.allMateriales.find(m => m.codigo === materialCode);

  if (!material.proveedores || material.proveedores.length <= 1) {
    document.getElementById('suppliersDropdown').style.display = 'none';
    return;
  }

  const html = material.proveedores.map((prov, idx) => `
    <button type="button" onclick="selectSupplier(${idx});"
            style="text-align: left; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; background: ${idx === 0 ? '#f0fdf4' : 'white'}; cursor: pointer;">
      <strong>${prov.nombre}</strong>: $${prov.precio}
      ${prov.precio === Math.min(...material.proveedores.map(p => p.precio)) ? '✓ MEJOR' : ''}
      <br>
      <small style="color: #6b7280;">Stock: ${prov.stock} | Plazo: ${prov.plazo}</small>
    </button>
  `).join('');

  document.getElementById('suppliersList').innerHTML = html;
  document.getElementById('suppliersDropdown').style.display = 'block';
}
```

### 🎨 UI Changes
- Dropdown de proveedores (oculto hasta seleccionar material)
- Badge "MEJOR PRECIO" en verde
- Mostrar stock y plazo de entrega

### ⏱️ Estimado
- **Tiempo:** 35-40 minutos
- **Líneas JavaScript:** +60 líneas
- **Líneas HTML:** +20 líneas
- **Complejidad:** 🔴 Alta

### 📊 Impacto UX
- ✅ Mejores decisiones de compra
- ✅ Comparación de proveedores
- ✅ Información de confiabilidad

---

## 💾 PROPUESTA 9: CARRITO GUARDADO (Save/Resume Cart)

**Descripción:** Guardar carrito en localStorage y recuperarlo en siguiente sesión.

### 📋 Problema que Resuelve
- Usuario agrega 15 materiales
- Cierra la página accidentalmente
- Tiene que empezar de nuevo
- **Solución:** Carrito guardado automáticamente

### 🎯 Funcionalidad

```
CUANDO USUARIO AGREGA MATERIAL:
Material agregado → Guardar en localStorage → ✓

CUANDO USUARIO ABRE LA PÁGINA:
localStorage: "{materiales: [...]}"
      ↓
Auto-cargar tabla
      ↓
"¿Recuperar carrito anterior? [Sí] [No]"

RESULTADO:
Tabla restaurada con 15 materiales
Total restaurado: $127.50
```

### 📱 Especificaciones Técnicas

**localStorage Structure:**
```javascript
localStorage['spm_cart'] = JSON.stringify({
  timestamp: 1730000000,
  usuario: "user@empresa.com",
  estado: "info",  // Estado del formulario P1
  centro: "Centro Logístico A",
  sector: "Sector 1",
  almacen: "Almacén Virtual",
  criticidad: "Normal",
  fecha: "2025-11-05",
  materiales: [
    {
      id: 1,
      codigo: "TOR-M6",
      nombre: "TORNILLO M6",
      cantidad: 10,
      precio: 0.50,
      subtotal: 5.00,
      proveedor: "Proveedor B",
      timestamp: 1730000100
    }
  ],
  total: 127.50,
  savedAt: "2025-11-03T10:30:00Z"
})
```

**JavaScript:**
```javascript
window.saveCartToLocalStorage = function() {
  const cart = {
    timestamp: Date.now(),
    estado: getCurrentFormState(),
    materiales: window.addedMaterials || [],
    total: calculateTotal()
  };

  localStorage['spm_cart'] = JSON.stringify(cart);
  showToast('✓ Carrito guardado automáticamente');
}

window.loadCartFromLocalStorage = function() {
  const saved = localStorage.getItem('spm_cart');
  if (!saved) return;

  const cart = JSON.parse(saved);
  const age = Date.now() - cart.timestamp;

  if (age < 24 * 60 * 60 * 1000) {  // Si es menor a 24h
    const confirmed = confirm(
      `Carrito guardado hace ${formatTimeAgo(age)}. ¿Recuperar?`
    );

    if (confirmed) {
      restoreCart(cart);
    }
  }
}

window.clearSavedCart = function() {
  localStorage.removeItem('spm_cart');
  showToast('✓ Carrito limpiado');
}
```

### 🎨 UI Changes
- Banner en top: "Carrito guardado hace 2 horas"
- Botones: [Recuperar] [Descartar]
- Auto-save en background

### ⏱️ Estimado
- **Tiempo:** 20-25 minutos
- **Líneas JavaScript:** +50 líneas
- **Líneas HTML:** +10 líneas
- **Complejidad:** 🟡 Media

### 📊 Impacto UX
- ✅ Nunca perder carrito
- ✅ Mejor experiencia de usuario
- ✅ Más conversiones

---

## 📊 TABLA COMPARATIVA - 5 PROPUESTAS

| Propuesta | Nombre | Tiempo | Complejidad | Impacto | Prioridad |
|-----------|--------|--------|-------------|---------|-----------|
| **4** | Cantidad Rápida | 20-25 min | 🟢 Baja | 🟢🟢 Alto | 🔴 ALTA |
| **5** | Unidad de Medida | 25-30 min | 🟡 Media | 🟢🟢 Alto | 🔴 ALTA |
| **6** | Descuentos Volumen | 30-35 min | 🟠 Media-Alta | 🟢🟢🟢 Muy Alto | 🟡 MEDIA |
| **7** | Proveedores Alt. | 35-40 min | 🔴 Alta | 🟢🟢🟢 Muy Alto | 🟡 MEDIA |
| **9** | Carrito Guardado | 20-25 min | 🟡 Media | 🟢🟢 Alto | 🟡 MEDIA |

---

## 🎯 RECOMENDACIÓN DE SECUENCIA

### Opción A: Quick Wins (Máximo Impacto / Mínimo Tiempo)
```
1. PROPUESTA 4 - Cantidad Rápida (20 min)
2. PROPUESTA 9 - Carrito Guardado (20 min)
3. PROPUESTA 5 - Unidad de Medida (25 min)
├─ Subtotal completado: 65 minutos (3 propuestas)
```

### Opción B: Flujo Natural (Lógica de Producto)
```
1. PROPUESTA 4 - Cantidad Rápida (20 min)
2. PROPUESTA 5 - Unidad de Medida (25 min)
3. PROPUESTA 6 - Descuentos Volumen (35 min)
├─ Subtotal completado: 80 minutos (3 propuestas)
```

### Opción C: Completo (Todas)
```
1. PROPUESTA 4 - Cantidad Rápida (20 min)
2. PROPUESTA 5 - Unidad de Medida (25 min)
3. PROPUESTA 6 - Descuentos Volumen (35 min)
4. PROPUESTA 7 - Proveedores Alt. (40 min)
5. PROPUESTA 9 - Carrito Guardado (25 min)
├─ TOTAL: 145 minutos = ~2.5 horas (5 propuestas)
```

---

## ✅ ESTADO ACTUAL

**Completadas:** PROPUESTAS 1, 2, 3, 8 (40%)

**Pendientes:** PROPUESTAS 4, 5, 6, 7, 9, 10 (60%)

**Sesión Actual:**
- ✅ Análisis de incoherencias identificado
- ✅ 5 nuevas propuestas presentadas
- ⏳ Pendiente: Seleccionar propuesta(s) a implementar

---

## 🚀 ¿CUÁL QUIERES IMPLEMENTAR?

**Opciones:**

1. **PROPUESTA 4** - Cantidad Rápida (Simple, impactante)
2. **PROPUESTA 5** - Unidad de Medida (Útil, no complejo)
3. **PROPUESTA 6** - Descuentos (Atractivo, medio complejo)
4. **PROPUESTA 7** - Proveedores (Completo, más complejo)
5. **PROPUESTA 9** - Carrito Guardado (Práctico, importante)
6. **2-3 PROPUESTAS** - Combinación rápida
7. **TODAS (4+5+6+9)** - Maratón de 100+ minutos
8. **PRIMERO** - Unificar UI (bloques búsqueda + agregación)

¿Cuál prefieres? 🎯

---

**Generado:** 3 de noviembre de 2025
