# Implementación del Adaptador Unificado de Payload - SPM v1.0

**Fecha:** 2025-11-20
**Estado:** ✅ Implementado y Funcionando
**Archivo modificado:** `src/backend/routes/solicitudes.py`

---

## 📋 Resumen

Se implementó un **adaptador unificado** en el backend que permite manejar tanto requests con **JSON** (`Content-Type: application/json`) como con **FormData** (`multipart/form-data`), resolviendo la incompatibilidad entre los nombres de campos que envía el frontend y los que espera el backend.

---

## 🎯 Problema Resuelto

### Antes de la Implementación

El sistema presentaba dos problemas:

1. **Incompatibilidad de Content-Type:**
   - Frontend enviaba FormData (desde formularios HTML)
   - Backend solo esperaba `application/json`
   - Resultado: Requests fallaban silenciosamente

2. **Incompatibilidad de Nombres de Campos:**

   | Frontend (FormData)      | Backend (Pydantic)      | Estado     |
   |--------------------------|-------------------------|------------|
   | `almacen`                | `almacen_virtual`       | ❌ Mismatch |
   | `fechaNecesaria`         | `fecha_necesidad`       | ❌ Mismatch |
   | `centroCostos`           | `centro_costos`         | ❌ Mismatch |
   | `criticidad: "Baja/Media/Alta"` | `criticidad: "Normal/Alta"` | ❌ Mismatch |

### Después de la Implementación

✅ Backend acepta **ambos formatos** (JSON y FormData)
✅ Campos del frontend se **mapean automáticamente** a los esperados por Pydantic
✅ Valores de criticidad se **normalizan** automáticamente
✅ **Compatibilidad hacia atrás** mantenida (API JSON sigue funcionando)

---

## 🛠️ Cambios Implementados

### 1. Nueva Función: `_map_criticidad()`

**Ubicación:** `src/backend/routes/solicitudes.py` (líneas 57-64)

**Propósito:** Normalizar valores de criticidad del frontend a los que espera Pydantic.

```python
def _map_criticidad(value: Any) -> str | None:
    """Normaliza valores de criticidad del frontend a lo que espera el modelo Pydantic."""
    v = _coerce_str(value).lower()
    if not v:
        return None
    if v in {"alta", "high", "crítica", "critica"}:
        return "Alta"
    return "Normal"
```

**Mapeo de valores:**
- `"Baja"` → `"Normal"`
- `"Media"` → `"Normal"`
- `"Alta"` → `"Alta"`
- `"High"` → `"Alta"`
- `"Crítica"` → `"Alta"`
- Cualquier otro → `"Normal"`

---

### 2. Nueva Función: `_get_payload_from_request()`

**Ubicación:** `src/backend/routes/solicitudes.py` (líneas 67-94)

**Propósito:** Unificar la lectura del payload independientemente del Content-Type.

```python
def _get_payload_from_request() -> dict[str, Any]:
    """Unifica la lectura del payload: JSON o FormData."""
    content_type = (request.content_type or "").lower()

    if "application/json" in content_type:
        return request.get_json(force=True, silent=False) or {}

    # FormData case
    form = request.form.to_dict(flat=True)
    payload = {
        "centro": form.get("centro"),
        "sector": form.get("sector"),
        "justificacion": form.get("justificacion"),
        "almacen_virtual": form.get("almacen_virtual") or form.get("almacen"),
        "fecha_necesidad": form.get("fecha_necesidad") or form.get("fechaNecesaria") or form.get("fecha_necesaria"),
        "centro_costos": form.get("centro_costos") or form.get("centroCostos"),
        "criticidad": _map_criticidad(form.get("criticidad")),
    }

    # Handle items - FormData sends items as a JSON string
    items_str = form.get("items")
    if items_str:
        try:
            payload["items"] = json.loads(items_str)
        except (json.JSONDecodeError, TypeError):
            payload["items"] = []

    return payload
```

**Características:**
- Detecta el `Content-Type` automáticamente
- Si es JSON: usa `request.get_json()`
- Si es FormData: extrae campos y los mapea
- Maneja múltiples variaciones de nombres de campo (e.g., `almacen` o `almacen_virtual`)
- Parsea `items` como JSON cuando viene en FormData
- Aplica normalización de criticidad

---

### 3. Modificación de Rutas

Se actualizaron **3 endpoints** para usar el nuevo adaptador:

#### a) `POST /api/solicitudes/drafts` (Crear Borrador)

**Línea:** 762

```python
# ANTES:
payload = request.get_json(force=True, silent=False) or {}

# DESPUÉS:
payload = _get_payload_from_request()
```

#### b) `POST /api/solicitudes` (Crear Solicitud)

**Línea:** 1015

```python
# ANTES:
payload = request.get_json(force=True, silent=False) or {}

# DESPUÉS:
payload = _get_payload_from_request()
```

#### c) `PATCH /api/solicitudes/<int:sol_id>/draft` (Actualizar Borrador)

**Línea:** 829

```python
# ANTES:
payload = request.get_json(force=True, silent=False) or {}

# DESPUÉS:
payload = _get_payload_from_request()
```

---

## ✅ Validación

### Test 1: JSON API (Compatibilidad Hacia Atrás)

```bash
python test_flujo_completo.py
```

**Resultado:**
```
[OK] Login exitoso como Juan Usuario
[OK] Se encontraron 3 materiales
[OK] Solicitud creada exitosamente
  - ID: 3
  - Status: pendiente_de_aprobacion
  - Total: $167.50
```

✅ **JSON API funciona correctamente**

---

### Test 2: FormData API (Nueva Funcionalidad)

```bash
python test_formdata.py
```

**Resultado:**
```
1. Login con JSON...
[OK] Login exitoso

2. Crear solicitud con JSON (Content-Type: application/json)...
Status: 200
Response: {'id': 4, 'ok': True, 'status': 'pendiente_de_aprobacion', 'total_monto': 62.5}
[OK] Solicitud JSON creada exitosamente

3. Crear solicitud con FormData (como lo hace el frontend)...
Status: 200
Response: {'id': 5, 'ok': True, 'status': 'pendiente_de_aprobacion', 'total_monto': 45.0}
[OK] Solicitud FormData creada exitosamente

=== Resumen ===
JSON:     OK
FormData: OK
```

✅ **FormData API funciona correctamente**

---

## 📊 Tabla de Mapeo Completa

| Campo Frontend (FormData) | Campo Backend (Pydantic) | Mapeo                                      |
|---------------------------|--------------------------|---------------------------------------------|
| `centro`                  | `centro`                 | Directo                                     |
| `sector`                  | `sector`                 | Directo                                     |
| `justificacion`           | `justificacion`          | Directo                                     |
| `almacen`                 | `almacen_virtual`        | **Mapeado** (prioridad: `almacen_virtual`) |
| `fechaNecesaria`          | `fecha_necesidad`        | **Mapeado** (prioridad: `fecha_necesidad`) |
| `centroCostos`            | `centro_costos`          | **Mapeado** (prioridad: `centro_costos`)   |
| `criticidad` ("Baja/Media/Alta") | `criticidad` ("Normal/Alta") | **Normalizado** por `_map_criticidad()` |
| `items` (JSON string)     | `items` (List[dict])     | **Parseado** con `json.loads()`             |

---

## 🔧 Cómo Funciona el Flujo

### Flujo con JSON (Existente)

```
1. Frontend envía:
   POST /api/solicitudes
   Content-Type: application/json
   {
     "centro": "1008",
     "almacen_virtual": "ALM0001",
     "criticidad": "Normal",
     "items": [...]
   }

2. Backend:
   _get_payload_from_request()
   ↓ Detecta "application/json" en Content-Type
   ↓ Usa request.get_json()
   ↓ Retorna payload tal cual

3. Pydantic valida SolicitudCreate
   ✅ OK

4. Se guarda en BD
```

---

### Flujo con FormData (Nuevo)

```
1. Frontend envía:
   POST /api/solicitudes
   Content-Type: multipart/form-data
   FormData {
     centro: "1008",
     almacen: "ALM0001",           // ← Nombre diferente
     criticidad: "Alta",            // ← Valor diferente
     fechaNecesaria: "2025-12-05",  // ← Nombre diferente
     items: '[{"codigo": "..."}]'   // ← String JSON
   }

2. Backend:
   _get_payload_from_request()
   ↓ Detecta FormData
   ↓ Lee request.form
   ↓ Mapea campos:
     almacen → almacen_virtual
     fechaNecesaria → fecha_necesidad
     criticidad → _map_criticidad("Alta") = "Alta"
   ↓ Parsea items con json.loads()
   ↓ Retorna payload normalizado

3. Pydantic valida SolicitudCreate
   ✅ OK

4. Se guarda en BD
```

---

## 🚀 Beneficios

1. **Flexibilidad:** Backend acepta ambos formatos sin cambios en el frontend
2. **Compatibilidad:** API JSON existente sigue funcionando
3. **Simplicidad:** Un solo punto de entrada (`_get_payload_from_request()`)
4. **Mantenibilidad:** Fácil agregar más mapeos si es necesario
5. **Robustez:** Maneja múltiples variaciones de nombres de campo

---

## 📝 Notas Adicionales

### Campos Opcionales

Si el frontend envía campos que el backend no necesita, simplemente se ignoran (Pydantic solo valida los campos definidos en `SolicitudCreate`).

### Valores por Defecto

Si el frontend no envía un campo opcional, Pydantic usa los valores por defecto definidos en el schema:
- `criticidad`: `"Normal"`
- `fecha_necesidad`: `None`

### Extensibilidad

Para agregar más mapeos de campos, simplemente modifica `_get_payload_from_request()`:

```python
payload = {
    # ... campos existentes ...
    "nuevo_campo_backend": form.get("nuevo_campo_frontend") or form.get("nuevo_campo_backend"),
}
```

---

## ⚠️ Consideraciones

1. **Items como String JSON:**
   - FormData no puede enviar arrays directamente
   - Frontend debe convertir items a JSON string antes de enviar
   - Backend lo parsea automáticamente

2. **Validación:**
   - Pydantic valida **después** del mapeo
   - Si hay errores de validación, se retorna 400 Bad Request

3. **Logs:**
   - Considerar agregar logging para debugging
   - Registrar qué Content-Type se detectó
   - Registrar mapeos de campos

---

## 🔜 Próximos Pasos Sugeridos

1. ✅ Implementar adaptador (COMPLETADO)
2. ✅ Validar con tests (COMPLETADO)
3. ⬜ Actualizar frontend para aprovechar el adaptador
4. ⬜ Agregar logging detallado
5. ⬜ Documentar en API docs
6. ⬜ Tests unitarios más exhaustivos

---

## 📚 Referencias

- **Archivo modificado:** [src/backend/routes/solicitudes.py](src/backend/routes/solicitudes.py:57-94)
- **Schemas Pydantic:** [src/backend/models/schemas.py](src/backend/models/schemas.py)
- **Test FormData:** [test_formdata.py](test_formdata.py)
- **Test JSON:** [test_flujo_completo.py](test_flujo_completo.py)

---

**Implementado por:** Claude
**Revisado:** Pendiente
**Estado:** ✅ Listo para producción
