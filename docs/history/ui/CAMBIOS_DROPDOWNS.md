# Mejoras en Dropdowns - Centro y Almacén
**Commit**: `07b7823`
**Cambio**: Dropdowns mejorados con control de acceso

## ¿Qué cambió?

### Antes
- Dropdowns mostraban SOLO los items a los que el usuario tenía acceso
- Indicador simple: ✅ (acceso) o 🔒 (sin acceso)
- No se podían ver items restringidos

### Ahora
- Dropdowns muestran TODOS los items del sistema
- Items permitidos primero con 🟢🔓 (candado verde abierto)
- Items restringidos después con 🔴🔒 (candado rojo cerrado)
- Advertencia cuando se selecciona item restringido

## Ejemplo Visual

```
Centro Dropdown:
┌─────────────────────────────────────────┐
│ Seleccione un Centro                    │
│ ───────────────────────────────────────  │
│ 🟢 🔓 CENTRO-001 - Centro Principal    │ ← Permitido
│ 🟢 🔓 CENTRO-002 - Centro Secundario   │ ← Permitido
│ 🔴 🔒 CENTRO-003 - Centro Restringido  │ ← NO Permitido
│ 🔴 🔒 CENTRO-004 - Centro Bloqueado    │ ← NO Permitido
└─────────────────────────────────────────┘

Al seleccionar item restringido:
→ Toast: ⚠️ No tienes acceso al Centro "Centro Restringido"
```

## Cambios Técnicos

**Archivo**: `src/frontend/home.html`
**Función**: `window.loadFormCatalogs()`

### Lógica Nueva

1. **Obtener datos**
   - Permisos del usuario: `/api/auth/mi-acceso`
   - Todos los items: `/api/catalogos`

2. **Separar en dos listas**
   - `centrosPermitidosList` - Items permitidos
   - `centrosNegadosList` - Items restringidos

3. **Agregar a dropdown**
   - Primero: items permitidos (🟢🔓)
   - Después: items restringidos (🔴🔒)

4. **Listeners para advertencias**
   - Si selecciona item restringido → toast warning
   - Formato: `⚠️ No tienes acceso al [Tipo] "[Nombre]"`

## Dropdowns Mejorados

- `#newReqCentro` (Centro)
- `#newReqAlmacén` (Almacén)

Ambos tienen:
- Sorting por acceso
- Iconos visuales
- Toasts de advertencia

## API Endpoints Usados

```javascript
// Obtener permisos del usuario
GET /api/auth/mi-acceso
→ { centros_permitidos: [...], almacenes_permitidos: [...] }

// Obtener TODOS los items
GET /api/catalogos
→ { centros: [...], almacenes: [...], materiales: [...] }
```

## Estado
✅ Implementado
✅ Testeado
✅ Committed
✅ Pusheado a GitHub

---
Commit: 07b7823 - feat: Improve Centro and Almacén dropdowns with access control
