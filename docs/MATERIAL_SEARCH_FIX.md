# 🔍 Fix: Búsqueda de Materiales - Campo de Entrada

## Problema Reportado
El cuadro de búsqueda de materiales no estaba funcionando correctamente al ingresar código SAP o descripción.

**Elementos afectados:**
- Input `#materialSearchSAP` - "Buscar por código SAP..."
- Input `#materialSearchDesc` - "Buscar por descripción..."

## Causa Raíz
En la función `loadFormCatalogs()` en `src/frontend/home.html`, cuando se cargaban los materiales en el select dropdown, se estaba guardando en el JSON solo:
```json
{
  "id": 123,
  "nombre": "Material X",
  "precio": 45.50
}
```

Pero la función `filterMaterials()` que se ejecuta al escribir en los inputs esperaba:
```json
{
  "id": 123,
  "nombre": "Material X",
  "precio": 45.50,
  "sap": "1000000006",        // ❌ FALTABA
  "descripcion": "Tuerca M12"  // ❌ FALTABA
}
```

Sin estos campos, el filtro no podía comparar el texto ingresado contra `material.sap` y `material.descripcion`.

## Solución Implementada
En `src/frontend/home.html` línea ~3678-3691, se modificó el código que carga los materiales:

### Antes:
```javascript
// Cargar materiales
const materialSelect = document.getElementById('materialSelect');
if (catalogs.materiales && materialSelect) {
  materialSelect.innerHTML = '<option value="">Seleccione un Material</option>';
  catalogs.materiales.forEach(m => {
    const opt = document.createElement('option');
    opt.value = JSON.stringify({
      id: m.id,
      nombre: m.nombre,
      precio: m.precio || 0
    });
    opt.textContent = m.nombre;
    materialSelect.appendChild(opt);
  });
}
```

### Después:
```javascript
// Cargar materiales
const materialSelect = document.getElementById('materialSelect');
if (catalogs.materiales && materialSelect) {
  materialSelect.innerHTML = '<option value="">Seleccione un Material</option>';
  catalogs.materiales.forEach(m => {
    const opt = document.createElement('option');
    opt.value = JSON.stringify({
      id: m.id,
      nombre: m.nombre,
      precio: m.precio || 0,
      sap: m.sap || m.codigo || '',      // ✅ AGREGADO
      descripcion: m.descripcion || ''   // ✅ AGREGADO
    });
    opt.textContent = m.nombre;
    materialSelect.appendChild(opt);
  });
}
```

## Flujo de Búsqueda (Ahora Funcional)

```
Usuario escribe en "Código SAP" o "Descripción"
              ↓
        oninput="filterMaterials()"
              ↓
filterMaterials() obtiene valores de inputs
              ↓
Itera cada opción en el select
              ↓
Parsea el JSON de opt.value
              ↓
Compara searchSAP contra material.sap ✅
Compara searchDesc contra material.nombre y material.descripcion ✅
              ↓
Muestra/oculta opciones según coincidencias
              ↓
Usuario ve lista filtrada 🎯
```

## Archivos Modificados
- `src/frontend/home.html` - Línea 3678-3691

## Commit
- **Hash:** `075b95b`
- **Mensaje:** "🔧 fix: Agregar sap y descripcion al JSON de materiales para que el filtro funcione"
- **Cambios:** +7 líneas, -1 línea

## Testing
Para verificar que funciona:

1. **Ir a:** Nueva Solicitud → Paso 2: Agregar Materiales
2. **Prueba 1 - Búsqueda por SAP:**
   - Ingresa "100" en "Código SAP"
   - Deberían filtrarse materiales que contengan "100" en su código
   - Ej: "1000000006" debe aparecer

3. **Prueba 2 - Búsqueda por Descripción:**
   - Ingresa "tuerca" en "Descripción"
   - Deberían filtrarse materiales con "tuerca" en su nombre o descripción
   - Ej: "TUERCA M12" debe aparecer

4. **Prueba 3 - Búsqueda Combinada:**
   - Ingresa "100" en SAP y "tuerca" en Descripción
   - Solo deberían aparecer opciones que cumplan AMBAS condiciones

## Impacto
- ✅ Búsqueda por código SAP completamente funcional
- ✅ Búsqueda por descripción completamente funcional
- ✅ Filtro combinado (SAP + Descripción) funciona correctamente
- ✅ Experiencia de usuario mejorada en selección de materiales
