# 🔄 Flujo de Datos - Arquitectura Fase 2

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Frontend)                       │
│  TratarSolicitudModal.jsx ← ensureCsrfToken (CSRF centralizado) │
└────────────────────────────┬────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  HTTP Request      │
                    │  POST/GET/PATCH    │
                    └─────────┬──────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                    CAPA HTTP (Flask Routes)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ @bp.route('/solicitudes/<id>/analizar')                 │   │
│  │  → guard, user = _require_solicitud_access(id)          │   │
│  │  → resultado = paso_1_analizar_solicitud(id)  ◄─────┐   │   │
│  │  → return jsonify({"ok": True, "data": resultado})  │   │   │
│  │                                                       │   │   │
│  │ @bp.route('.../opciones-abastecimiento')             │   │   │
│  │  → resultado = paso_2_opciones_abastecimiento(id)  ◄─┤   │   │
│  │  → return jsonify(...)                               │   │   │
│  │                                                       │   │   │
│  │ @bp.route('.../guardar-tratamiento')                 │   │   │
│  │  → resultado = paso_3_guardar_tratamiento(id)  ◄─────┤   │   │
│  │  → return jsonify(...)                               │   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                    ┌─────────▼────────────────────────┐
                    │ CAPA DE SERVICIOS (Lógica)      │
                    │ planner_service.py               │
                    │                                  │
                    │  ┌─────────────────────────────┐ │
                    │  │ paso_1_analizar_solicitud   │ │
                    │  │ • Validar solicitud existe  │ │
                    │  │ • Fetch presupuesto         │ │
                    │  │ • Detectar conflictos       │ │
                    │  │ • Return: ResultadoPaso1    │ │
                    │  └──────────┬──────────────────┘ │
                    │             │                     │
                    │  ┌──────────▼──────────────────┐ │
                    │  │ paso_2_opciones_abastem...  │ │
                    │  │ • Fetch item                │ │
                    │  │ • Generar 4 opciones        │ │
                    │  │ • Return: ResultadoPaso2    │ │
                    │  └──────────┬──────────────────┘ │
                    │             │                     │
                    │  ┌──────────▼──────────────────┐ │
                    │  │ paso_3_guardar_tratamiento  │ │
                    │  │ • Validar decisiones        │ │
                    │  │ • Guardar en BD             │ │
                    │  │ • Log evento                │ │
                    │  │ • Return: ResultadoPaso3    │ │
                    │  └──────────┬──────────────────┘ │
                    │             │                     │
                    └─────────────┼─────────────────────┘
                                  │
                    ┌─────────────▼──────────────────────────┐
                    │  CAPA DE REPOSITORIO (CRUD)            │
                    │  repository.py                         │
                    │                                        │
                    │  ┌────────────────────────────────┐   │
                    │  │ SolicitudRepository            │   │
                    │  │ • get_by_id(id)                │   │
                    │  │ • get_items(id)                │   │
                    │  │ • update_status(id, status)    │   │
                    │  └──────────┬─────────────────────┘   │
                    │             │                         │
                    │  ┌──────────▼─────────────────────┐   │
                    │  │ PresupuestoRepository          │   │
                    │  │ • get_disponible(centro, sec)  │   │
                    │  └──────────┬─────────────────────┘   │
                    │             │                         │
                    │  ┌──────────▼─────────────────────┐   │
                    │  │ TratamientoRepository          │   │
                    │  │ • save_decision(...)           │   │
                    │  │ • log_evento(...)              │   │
                    │  └──────────┬─────────────────────┘   │
                    │             │                         │
                    │  ┌──────────▼─────────────────────┐   │
                    │  │ MaterialRepository              │   │
                    │  │ • get_stock_detalle(...)       │   │
                    │  └──────────┬─────────────────────┘   │
                    │             │                         │
                    └─────────────┼─────────────────────────┘
                                  │
                    ┌─────────────▼────────────────────────┐
                    │  CAPA DE CACHÉ (cache_loader.py)    │
                    │                                      │
                    │  ┌──────────────────────────────┐  │
                    │  │ get_stock_cache()            │  │
                    │  │  → ExcelCacheLoader.load()   │  │
                    │  │  → Pandas DataFrame          │  │
                    │  └──────────────────────────────┘  │
                    │                                      │
                    │  ┌──────────────────────────────┐  │
                    │  │ get_equivalencias_cache()    │  │
                    │  │  → from Excel file           │  │
                    │  └──────────────────────────────┘  │
                    │                                      │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼────────────────────┐
                    │     ACCESO A DATOS               │
                    │                                  │
                    │  ┌──────────────────────────┐   │
                    │  │   SQLite DB (spm.db)     │   │
                    │  │   • solicitudes          │   │
                    │  │   • presupuestos         │   │
                    │  │   • materiales           │   │
                    │  │   • stock_almacenes      │   │
                    │  │   • proveedores          │   │
                    │  └──────────────────────────┘   │
                    │                                  │
                    │  ┌──────────────────────────┐   │
                    │  │  Excel Files             │   │
                    │  │  • stock.xlsx            │   │
                    │  │  • equivalencias.xlsx    │   │
                    │  │  • consumo.xlsx          │   │
                    │  └──────────────────────────┘   │
                    │                                  │
                    └──────────────────────────────────┘
```

---

## Flujos de Uso - PASO 1

```
Cliente: POST /api/planificador/solicitudes/1/analizar

┌─────────────────────────────────────────────────────────────┐
│ analizar_solicitud(solicitud_id=1)                          │
│ [route handler, 15 líneas]                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ paso_1_analizar_solicitud(solicitud_id=1)                   │
│ [services/planner_service.py, 120 líneas]                   │
│                                                              │
│  1. SolicitudRepository.get_by_id(1)                        │
│     → SELECT * FROM solicitudes WHERE id=1                  │
│     → return {"id": 1, "data_json": {...}, ...}             │
│                                                              │
│  2. SolicitudRepository.get_items(1)                        │
│     → parse JSON → return [item1, item2, ...]               │
│                                                              │
│  3. PresupuestoRepository.get_disponible(centro, sector)    │
│     → SELECT monto, saldo FROM presupuestos                 │
│     → return {"monto": 10000, "saldo": 8000}                │
│                                                              │
│  4. Loop items:                                             │
│     - get_stock_cache() → Pandas DataFrame                  │
│     - Clasificar por criticidad                             │
│     - Detectar conflictos (stock, presupuesto)              │
│                                                              │
│  5. _generar_recomendaciones(conflictos, avisos)            │
│                                                              │
│  6. return ResultadoPaso1 → Dict                            │
│     {                                                        │
│       "solicitud_id": 1,                                    │
│       "resumen": {...},                                     │
│       "conflictos": [...],                                  │
│       "avisos": [...],                                      │
│       "recomendaciones": [...]                              │
│     }                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ return jsonify({"ok": True, "data": resultado}), 200        │
│                                                              │
│ Respuesta HTTP:                                             │
│ {                                                            │
│   "ok": true,                                               │
│   "data": {                                                 │
│     "solicitud_id": 1,                                      │
│     "paso": 1,                                              │
│     "resumen": {...},                                       │
│     "conflictos": [...],                                    │
│     "recomendaciones": [...]                                │
│   }                                                          │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Flujos de Uso - PASO 2

```
Cliente: GET /api/planificador/solicitudes/1/items/0/opciones-abastecimiento

┌──────────────────────────────────────────────────────────────┐
│ obtener_opciones_abastecimiento(solicitud_id=1, item_idx=0)  │
│ [route handler, 15 líneas]                                   │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ paso_2_opciones_abastecimiento(1, 0)                         │
│ [services/planner_service.py, 180 líneas]                    │
│                                                               │
│  1. SolicitudRepository.get_by_id(1)                         │
│     → Fetch solicitud + items                                │
│                                                               │
│  2. item = items[0]                                          │
│     → {"codigo": "MAT001", "cantidad": 10, ...}              │
│                                                               │
│  3. OPCIÓN 1: Stock Interno                                  │
│     get_stock_cache() → filter by codigo                     │
│     → {"opcion_id": "stock", "tipo": "stock", ...}           │
│                                                               │
│  4. OPCIÓN 2: Proveedores Externos                           │
│     ProveedorRepository.list_externos_activos()              │
│     → rank by score (precio+plazo+rating)                    │
│     → for prov in top3: add opcion                           │
│                                                               │
│  5. OPCIÓN 3: Equivalencias                                  │
│     get_equivalencias_cache() → filter by codigo_base        │
│     → for equiv: add opcion                                  │
│                                                               │
│  6. OPCIÓN 4: Mix (stock + proveedor)                        │
│     if stock < cantidad: add mix opcion                      │
│                                                               │
│  7. return ResultadoPaso2 → Dict                             │
│     {                                                         │
│       "solicitud_id": 1,                                     │
│       "item_idx": 0,                                         │
│       "item": {...},                                         │
│       "opciones": [                                          │
│         {"opcion_id": "stock", "tipo": "stock", ...},        │
│         {"opcion_id": "prov_001", "tipo": "proveedor", ...}, │
│         {"opcion_id": "equiv_MAT002", "tipo": "equivalencia" │
│         {"opcion_id": "mix_prov_001", "tipo": "mix", ...}    │
│       ]                                                       │
│     }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ return jsonify({"ok": True, "data": resultado}), 200         │
└────────────────────────────────────────────────────────────────┘
```

---

## Flujos de Uso - PASO 3

```
Cliente: POST /api/planificador/solicitudes/1/guardar-tratamiento
Body: {"decisiones": [{"item_idx": 0, "decision_tipo": "stock", ...}]}

┌────────────────────────────────────────────────────────────────┐
│ guardar_tratamiento(solicitud_id=1)                            │
│ [route handler, 25 líneas]                                     │
└─────────────────┬──────────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────────┐
│ paso_3_guardar_tratamiento(1, decisiones, usuario_id="user1")  │
│ [services/planner_service.py, 100 líneas]                      │
│                                                                 │
│  1. SolicitudRepository.get_by_id(1)                           │
│     → verify solicitud exists                                  │
│                                                                 │
│  2. for decision in decisiones:                                │
│     {                                                          │
│       "item_idx": 0,                                           │
│       "decision_tipo": "stock",                                │
│       "cantidad_aprobada": 10,                                 │
│       "codigo_material": "MAT001",                             │
│       ...                                                      │
│     }                                                          │
│                                                                 │
│  3. TratamientoRepository.save_decision(                       │
│       solicitud_id=1,                                          │
│       item_index=0,                                            │
│       decision_tipo="stock",                                   │
│       cantidad_aprobada=10,                                    │
│       codigo_material="MAT001",                                │
│       ...                                                      │
│     )                                                          │
│     → INSERT OR UPDATE solicitud_items_tratamiento            │
│                                                                 │
│  4. TratamientoRepository.log_evento(                          │
│       1, 0, "decision_guardada", "PASO_3", payload            │
│     )                                                          │
│     → INSERT solicitud_tratamiento_log                        │
│                                                                 │
│  5. SolicitudRepository.update_status(1, "En tratamiento")    │
│     → UPDATE solicitudes SET status="En tratamiento"           │
│                                                                 │
│  6. return ResultadoPaso3 → Dict                               │
│     {                                                          │
│       "solicitud_id": 1,                                       │
│       "paso": 3,                                               │
│       "status_actualizado": "tratamiento_guardado",            │
│       "cantidad_decisiones": 1,                                │
│       "decisiones": [                                          │
│         {"item_idx": 0, "decision_tipo": "stock", ...}         │
│       ]                                                        │
│     }                                                          │
└─────────────────┬──────────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────────┐
│ return jsonify({"ok": True, "data": resultado}), 200           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Importancias de Capas

### 1️⃣ Capa HTTP (routes)
- **Responsabilidad:** Parsing request, authorization, response formatting
- **Nunca:** Lógica de negocio, queries DB directas
- **Siempre:** Delegar a servicios

### 2️⃣ Capa de Servicios (services)
- **Responsabilidad:** Lógica de negocio, orquestación
- **Nunca:** Acceso directo a BD (usar repositorio), response formatting
- **Siempre:** Retornar dicts puro Python (no JSONify)

### 3️⃣ Capa de Repositorio (repository)
- **Responsabilidad:** CRUD, abstraer SQL
- **Nunca:** Lógica de negocio, manejo de excepciones HTTP
- **Siempre:** Manejo automático de conexiones (try/finally)

### 4️⃣ Capa de Caché (cache_loader)
- **Responsabilidad:** Carga y caching de archivos Excel
- **Nunca:** Queries DB, formateo de respuestas
- **Siempre:** Retornar DataFrames normalizados

---

## Flujo de Errores

```
┌─────────────────────────────────────┐
│ Solicitud HTTP llega a ruta         │
└────────────────┬────────────────────┘
                 │
┌────────────────▼─────────────────────┐
│ Validación HTTP (guard, auth)        │
│ ¿Error? → return error_forbidden()   │
└────────────────┬─────────────────────┘
                 │
┌────────────────▼──────────────────────────┐
│ Llamar servicio paso_X_...()              │
│                                            │
│ ¿ValueError? → error_validation()         │
│ ¿Exception? → error_internal()            │
└────────────────┬──────────────────────────┘
                 │
┌────────────────▼──────────────────────┐
│ Servicio valida datos + repositorio   │
│                                        │
│ ¿No existe? → raise ValueError        │
│ ¿Error DB? → raise Exception          │
└────────────────┬──────────────────────┘
                 │
┌────────────────▼──────────────────────┐
│ Retorna resultado Dict → HTTP         │
│ {"ok": True, "data": {...}}           │
└────────────────────────────────────────┘
```

---

## Ejemplo de Uso - Python REPL

```python
# Import servicios
from backend.core.services.planner_service import paso_1_analizar_solicitud

# Ejecutar servicio
resultado = paso_1_analizar_solicitud(solicitud_id=1)

# Inspeccionar
print(resultado.keys())  # dict_keys(['solicitud_id', 'paso', 'resumen', ...])
print(resultado['conflictos'])  # List de conflictos detectados
print(resultado['recomendaciones'])  # Acciones sugeridas

# Serializar a JSON
import json
json_response = json.dumps(resultado)

# Envolver en respuesta HTTP
response = {"ok": True, "data": resultado}
```

---

## Testing - Ejemplo Unit Test

```python
# tests/test_planner_service.py
import pytest
from backend.core.services.planner_service import paso_1_analizar_solicitud

def test_paso_1_solicitud_no_existe():
    """Test que paso_1 levanta ValueError si solicitud no existe"""
    with pytest.raises(ValueError, match="Solicitud .* no encontrada"):
        paso_1_analizar_solicitud(999)

def test_paso_1_retorna_estructura_correcta():
    """Test que paso_1 retorna estructura esperada"""
    resultado = paso_1_analizar_solicitud(1)

    assert "solicitud_id" in resultado
    assert "paso" in resultado
    assert resultado["paso"] == 1
    assert "conflictos" in resultado
    assert isinstance(resultado["conflictos"], list)
```

---

**Fin del documento de arquitectura**
