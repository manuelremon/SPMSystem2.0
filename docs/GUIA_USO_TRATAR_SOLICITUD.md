# GUÍA DE USO RÁPIDO - MÓDULO "TRATAR SOLICITUD"

## 🚀 INICIO RÁPIDO

### Requisitos Previos
1. ✅ Backend Flask corriendo (`python backend_v2/app.py`)
2. ✅ Frontend Vite corriendo (`npm run dev`)
3. ✅ Solicitudes aprobadas en la base de datos
4. ✅ Usuario autenticado en la aplicación

---

## 📍 CÓMO ACCEDER

```
1. Ir a http://127.0.0.1:5173/planner
2. Buscar una solicitud en la tabla
3. Hacer clic en botón verde "Tratar (nuevo)"
   └─ Se abre modal con 3 pasos
```

---

## 🎯 PASO 1: ANÁLISIS INICIAL

**¿Qué ves?**
- Presupuesto total, disponible y solicitado
- Materiales agrupados por criticidad (colores)
- Conflictos y avisos si los hay
- Recomendaciones

**¿Qué haces?**
- Leer la información
- Revisar si hay presupuesto insuficiente (rojo)
- Hacer clic en "Siguiente →"

**Ejemplo:**
```
Presupuesto Total:      $50,000.00
Presupuesto Disponible: $30,000.00  ← Verde (hay dinero)
Total Solicitado:       $45,000.00

⚠️ PRESUPUESTO INSUFICIENTE
Falta: $15,000.00

CRÍTICOS (2 materiales)
├─ MAT001: Piezas motor críticas (50 x $250 = $12,500)
└─ MAT002: Tornillos especiales (100 x $50 = $5,000)

NORMALES (3 materiales)
├─ MAT003: Tuberías PVC...
...
```

---

## 🎯 PASO 2: DECISIÓN DE ABASTECIMIENTO

**¿Qué ves?**
- 1 material a la vez
- 4 opciones para ese material:
  - 📦 Stock Interno (almacén)
  - 🚚 Proveedor 1 (más rápido/caro)
  - 🚚 Proveedor 2 (más lento/barato)
  - 🔄 Material Equivalente

**¿Qué haces?**
- Revisar los precios y plazos
- Seleccionar UNA opción (click en tarjeta)
- Ver checkmark ✓ en la opción
- Ir al siguiente material
- Repetir hasta completar todos

**Ejemplo:**
```
Material 1 de 8    ▓▓▓▓░░░░░░░░

MAT001 - Piezas motor críticas
Cantidad: 50 | Precio Unit: $250

┌─────────────┐  ┌─────────────┐
│ 📦 Stock    │  │ 🚚 Quick    │
│ 1 día       │  │ 5 días      │
│ $250        │  │ $240        │
│ = $12,500   │  │ = $12,000   │
│             │  │ Rating: ⭐⭐⭐│
└──✓ SELEC.──┘  └─────────────┘
  ← Seleccionada

[← Anterior] [Siguiente →]
```

**Validación:**
- No puedes ir al siguiente material sin seleccionar
- Si es el último material, botón cambia a "Continuar a Revisión Final →"

---

## 🎯 PASO 3: REVISIÓN FINAL

**¿Qué ves?**
- Tabla con TODAS tus decisiones:
  - Material
  - Opción que seleccionaste
  - Cantidad
  - Precio unitario
  - Subtotal
  - Plazo de entrega

- Resumen:
  - Total items completados
  - Costo total
  - Plazo máximo de entrega
  - Proveedores involucrados

**¿Qué haces?**
- Revisar que todo sea correcto
- Si algo está mal, haz clic "← Volver Atrás"
- Si todo está bien, haz clic "✓ Completar Tratamiento"

**Ejemplo:**
```
┌─────────────────────────────────────────────────┐
│ REVISIÓN FINAL DE DECISIONES                    │
├─────────────────────────────────────────────────┤
│ MAT │ Opción    │ Cant │ P.U. │ Subtotal │ Plazo│
├─────────────────────────────────────────────────┤
│ MAT1│ Stock     │  50  │ $250 │ $12,500  │  1d │
│ MAT2│ Quick     │ 100  │ $240 │ $24,000  │  5d │
│ MAT3│ Equiv 95% │ 500  │ $200 │ $10,000  │  1d │
└─────────────────────────────────────────────────┘

Total Items: 3/3 ✓
Costo Total: $46,500.00
Plazo Máximo: 5 días
Proveedores: Stock Interno, QuickSupply

[← Volver Atrás] [✓ Completar Tratamiento]
```

**Al completar:**
1. Se envía a la BD
2. Se muestra "Guardando..." con spinner
3. Si todo está bien: "✓ Tratamiento completado exitosamente"
4. Modal se cierra
5. Tabla de Planner se recarga automáticamente

---

## ❌ PROBLEMAS COMUNES

### "Error: Servidor no responde"
- ✅ Verificar que backend está corriendo: `python backend_v2/app.py`
- ✅ Verificar puerto 5000 disponible
- ✅ Revisar logs del backend

### "No hay opciones disponibles"
- ✅ Verificar que tabla `material_equivalencias` está poblada
- ✅ Verificar que tabla `proveedores` tiene registros (PROV001-PROV006)
- ✅ Revisar logs del backend

### "No puedo avanzar del PASO 2"
- ✅ Asegúrate de haber seleccionado una opción (debe verse ✓)
- ✅ Si es último material, click en "Continuar a Revisión Final →"

### "Error al guardar tratamiento"
- ✅ Revisar conexión a BD
- ✅ Revisar que usuario está autenticado
- ✅ Ver logs del backend para detalles

### "Modal se cerró sin guardar"
- ✅ Los datos se perdieron, volver a empezar
- ✅ Recargar página y intentar de nuevo

---

## 💡 CONSEJOS

1. **PASO 1:** Lee los conflictos y avisos cuidadosamente
   - Pueden afectar tus decisiones

2. **PASO 2:** Compara costos vs plazos
   - A veces vale pagar más por entrega rápida
   - A veces puedes usar equivalencias para ahorrar

3. **PASO 3:** Revisa el costo total
   - Asegúrate de no exceder el presupuesto
   - Si es insuficiente, vuelve a PASO 2 y cambia opciones

4. **Equivalencias:** 95% compatibilidad suele ser suficiente
   - Generalmente más barato que original
   - Mismo plazo de entrega

5. **Stock Interno:** Siempre es la opción más rápida (1 día)
   - Pero depende de disponibilidad

---

## 📊 FLUJO RESUMIDO

```
┌─────────────────────────────────────┐
│  Planner: Buscar Solicitud          │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  PASO 1: Leer Análisis              │
│  - Presupuesto                      │
│  - Materiales por criticidad        │
│  - Conflictos y avisos              │
│  [Siguiente →]                      │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  PASO 2: Seleccionar Opciones       │
│  - Material 1/8 → Seleccionar       │
│  - Material 2/8 → Seleccionar       │
│  - ...                              │
│  - Material 8/8 → Seleccionar       │
│  [Continuar a Revisión →]           │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  PASO 3: Revisar y Completar        │
│  - Tabla de decisiones              │
│  - Resumen financiero               │
│  [✓ Completar Tratamiento]          │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  ✓ Completado                       │
│  Modal cierra → Planner recarga     │
└─────────────────────────────────────┘
```

---

## 🔧 OPCIONES DISPONIBLES EN PASO 2

### Por Tipo de Material

| Material | Stock? | Proveedor 1 | Proveedor 2 | Equivalencia |
|----------|--------|------------|------------|--------------|
| Crítico | Raro | Sí | Sí | Sí (95%) |
| Normal | Medio | Sí | Sí | Sí (95%) |
| Bajo | Frecuente | Sí | Sí | Sí (95%) |

### Proveedores (Base de Datos)

```
PROV001: QuickSupply      (5 días)  Rating: ⭐⭐⭐⭐
PROV002: SupplyMaster     (7 días)  Rating: ⭐⭐⭐
PROV003: FastMaterials    (3 días)  Rating: ⭐⭐⭐⭐⭐
PROV004: BudgetSupply     (15 días) Rating: ⭐⭐⭐
PROV005: EcoMaterials     (10 días) Rating: ⭐⭐⭐⭐
PROV006: Stock Interno    (1 día)   Rating: ⭐⭐⭐⭐⭐
```

---

## 📱 EN DISPOSITIVOS MÓVILES

- Las opciones se muestran en 1 columna
- Las tablas se hacen scrolleables horizontalmente
- Los botones se adaptan al ancho de pantalla
- Todo funciona igual, solo con layout diferente

---

## 🎓 CASO DE USO EJEMPLO

**Escenario:** Solicitud #123 del Centro 1008

**PASO 1:**
```
Presupuesto: $30,000
Solicitado: $35,000
⚠️ Falta: $5,000

Hay 8 materiales
3 Críticos, 3 Normales, 2 Bajos
1 Conflicto: Presupuesto insuficiente
```

**PASO 2 - Decisiones tomadas:**
```
MAT001 (Crítico, $12,500) → Stock Interno (1d, $250/u)
MAT002 (Crítico, $8,000)  → QuickSupply (5d, $240/u)
MAT003 (Crítico, $5,000)  → Equivalencia 95% (1d, $180/u)
MAT004 (Normal, $2,000)   → BudgetSupply (15d, $100/u)
MAT005 (Normal, $3,000)   → EcoMaterials (10d, $150/u)
MAT006 (Normal, $1,500)   → Equivalencia 95% (1d, $120/u)
MAT007 (Bajo, $1,200)     → Stock Interno (1d, $50/u)
MAT008 (Bajo, $800)       → Stock Interno (1d, $40/u)
```

**PASO 3 - Resumen:**
```
Total Items: 8/8 ✓
Costo Total: $33,500.00 (dentro del presupuesto!)
Plazo: 15 días máximo
Proveedores: Stock Interno, QuickSupply, BudgetSupply, EcoMaterials
```

✅ **Completar** → Solicitud actualizada a "En tratamiento"

---

## 📞 SOPORTE

Si hay problemas:
1. Revisar logs del backend: `backend_v2/app.py`
2. Revisar consola del navegador (F12 → Console)
3. Verificar base de datos tiene datos requeridos
4. Contactar al equipo de desarrollo

---

*Guía rápida - Nov 2025*
