# 🚀 GUÍA RÁPIDA - Cómo usar los nuevos servicios

**Para:** Developers que continúen el proyecto
**Léelo primero:** Sí, especialmente si vas a hacer cambios en PASO 1-3
**Tiempo:** 5 minutos

---

## 1. Estructura Rápida

```
backend/
├── core/
│   ├── repository.py       ← DB CRUD (5 clases)
│   ├── cache_loader.py     ← Excel caché (singleton)
│   ├── schemas.py          ← DTOs (dataclasses)
│   └── services/
│       └── planner_service.py  ← Lógica (3 funciones principales)
│
└── routes/
    └── planner.py          ← HTTP handlers (thin wrappers)
```

---

## 2. Cómo Usar en Rutas (HTTP)

### Patrón Standard para PASO 1-3:

```python
# 1. Import al inicio del archivo
from core.services.planner_service import paso_1_analizar_solicitud

# 2. Definir endpoint
@bp.route('/solicitudes/<int:solicitud_id>/analizar', methods=['POST'])
def analizar_solicitud(solicitud_id):
    # 3. Guardia de seguridad (auth/permission)
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    # 4. Try-catch para manejar errores
    try:
        # 5. Llamar servicio
        resultado = paso_1_analizar_solicitud(solicitud_id)
        # 6. Retornar JSON
        return jsonify({"ok": True, "data": resultado}), 200

    # 7. Manejo de errores específico
    except ValueError as e:
        return error_validation("solicitud_id", str(e))
    except Exception as e:
        return error_internal(str(e))
```

**Eso es todo.** La ruta nunca toca BD ni lógica.

---

## 3. Cómo Usar en Servicios (Lógica)

### Patrón para NEW servicios:

```python
# 1. Imports
from core.repository import SolicitudRepository, TratamientoRepository
from core.cache_loader import get_stock_cache
from core.schemas import ResultadoPaso1

# 2. Función puro Python
def mi_nueva_logica(solicitud_id: int) -> Dict[str, Any]:
    """Descripción clara"""

    # 3. Usar repositorio para BD
    solicitud = SolicitudRepository.get_by_id(solicitud_id)
    if not solicitud:
        raise ValueError(f"Solicitud {solicitud_id} no encontrada")

    # 4. Usar cache para Excel
    stock_df = get_stock_cache()

    # 5. Hacer lógica
    resultado = {
        "solicitud_id": solicitud_id,
        "data": "..."
    }

    # 6. Retornar Dict (NUNCA jsonify)
    return resultado
```

---

## 4. Cómo Usar Repositorio

### Para BD queries:

```python
from core.repository import SolicitudRepository, TratamientoRepository

# Obtener solicitud
solicitud = SolicitudRepository.get_by_id(1)
# → {"id": 1, "data_json": "...", "status": "pendiente"}

# Obtener items
items = SolicitudRepository.get_items(1)
# → [{"codigo": "MAT001", "cantidad": 10, ...}]

# Actualizar status
SolicitudRepository.update_status(1, "En tratamiento")

# Guardar decisión
TratamientoRepository.save_decision(
    solicitud_id=1,
    item_index=0,
    decision_tipo="stock",
    cantidad_aprobada=10,
    codigo_material="MAT001",
    id_proveedor="PROV006",
    precio_unitario_final=100.0,
    observacion="",
    actor="user1"
)

# Log evento
TratamientoRepository.log_evento(
    solicitud_id=1,
    item_index=0,
    tipo="decision_guardada",
    estado="PASO_3",
    payload={"item_idx": 0, "decision_tipo": "stock"},
    actor="user1"
)
```

**Ventaja:** No escribes SQL, no manejas conexiones.

---

## 5. Cómo Usar Cache

### Para archivos Excel:

```python
from core.cache_loader import get_stock_cache, get_equivalencias_cache, clear_cache

# Obtener caché (carga de Excel si no existe)
stock_df = get_stock_cache()
# → Pandas DataFrame con columnas normalizadas

# Filtrar
material_stock = stock_df[stock_df["codigo_norm"] == "001"]

# Obtener equivalencias
equiv_df = get_equivalencias_cache()
# → Pandas DataFrame con equivalencias

# Si cambió Excel, forzar recarga
clear_cache()
stock_df = get_stock_cache()  # Recarga desde disco
```

**Ventaja:** Cache global, no recargas Excel en cada request.

---

## 6. Cómo Usar Schemas

### Para validación de datos:

```python
from core.schemas import ResultadoPaso1, DecisionItem, Conflicto

# Validar entrada (desde cliente)
decision_raw = {"item_idx": 0, "decision_tipo": "stock", "cantidad_aprobada": 10}
try:
    decision = DecisionItem.from_dict(decision_raw)
except ValueError as e:
    return error_validation("decision", str(e))

# Construir salida (hacia cliente)
conflicto = Conflicto(
    tipo="stock_insuficiente",
    item_idx=0,
    codigo="MAT001",
    cantidad=10,
    stock_disponible=5
)
resultado = {
    "conflictos": [conflicto.to_dict()]
}
```

**Ventaja:** Type hints + serialización automática.

---

## 7. Ejemplos de Queries

### Query 1: ¿Cuántas solicitudes pendientes hay?

```python
from core.repository import SolicitudRepository

# ANTES (viejo código):
conn = sqlite3.connect("spm.db")
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM solicitudes WHERE status='pendiente'")
count = cur.fetchone()[0]
conn.close()

# AHORA (con repositorio):
# → Todo encapsulado en el repo, simplemente:
solicitudes = SolicitudRepository.list_aprobadas_para_planner(
    planner_id="user1",
    centro="CENTRO1",
    sector="SECTOR1"
)
count = len(solicitudes)
```

### Query 2: ¿Qué stock hay de MAT001?

```python
from core.cache_loader import get_stock_cache

# ANTES:
df = pd.read_excel("backend/stock.xlsx")
stock = df[df["Material"] == "001"]["Stock"].sum()

# AHORA:
stock_df = get_stock_cache()  # Ya normalizado
stock = stock_df[stock_df["codigo_norm"] == "001"]["stock"].sum()
```

### Query 3: Guardar decisión

```python
from core.repository import TratamientoRepository

# ANTES: INSERT + ON CONFLICT manual
cur.execute("""
    INSERT INTO solicitud_items_tratamiento
    (solicitud_id, item_index, decision, ...)
    VALUES (?, ?, ?, ...)
    ON CONFLICT(solicitud_id, item_index) DO UPDATE SET ...
""", (...))

# AHORA:
TratamientoRepository.save_decision(
    solicitud_id=1,
    item_index=0,
    decision_tipo="stock",
    cantidad_aprobada=10,
    codigo_material="MAT001",
    id_proveedor="PROV006",
    precio_unitario_final=100.0,
    observacion="",
    actor="user1"
)
```

---

## 8. Testing Rápido

```python
# test_planner_service.py
import pytest
from core.services.planner_service import paso_1_analizar_solicitud

def test_paso_1_valida():
    """Test que paso_1 funciona"""
    resultado = paso_1_analizar_solicitud(1)
    assert resultado["paso"] == 1
    assert "conflictos" in resultado
    assert "recomendaciones" in resultado

def test_paso_1_solicitud_no_existe():
    """Test que paso_1 falla si no existe"""
    with pytest.raises(ValueError):
        paso_1_analizar_solicitud(999)

# Run:
# pytest tests/test_planner_service.py -v
```

---

## 9. Debugging Rápido

### Si algo no funciona:

```python
# 1. Verificar imports
from core.repository import SolicitudRepository
from core.services.planner_service import paso_1_analizar_solicitud
# → Si falla, error de import

# 2. Verificar DB
solicitud = SolicitudRepository.get_by_id(1)
print(solicitud)  # Debe retornar dict o None
# → Si None, solicitud no existe

# 3. Verificar cache
stock_df = get_stock_cache()
print(stock_df.shape)  # (rows, cols)
print(stock_df.columns)  # Columnas
# → Si vacio, error al leer Excel

# 4. Llamar servicio directamente
try:
    resultado = paso_1_analizar_solicitud(1)
    print(resultado)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
```

---

## 10. Cheat Sheet

```python
# Imports frecuentes
from core.repository import SolicitudRepository, TratamientoRepository
from core.cache_loader import get_stock_cache, clear_cache
from core.schemas import ResultadoPaso1, Conflicto
from core.services.planner_service import paso_1_analizar_solicitud

# Patrón endpoint (16 líneas)
@bp.route('/endpoint', methods=['GET'])
def handler(id):
    guard, user = _require_solicitud_access(id)
    if guard: return guard
    try:
        resultado = paso_1_analizar_solicitud(id)
        return jsonify({"ok": True, "data": resultado}), 200
    except ValueError as e:
        return error_validation("id", str(e))
    except Exception as e:
        return error_internal(str(e))

# Patrón servicio (10 líneas mínimo)
def mi_servicio(id: int) -> Dict:
    solicitud = SolicitudRepository.get_by_id(id)
    if not solicitud: raise ValueError(f"No existe {id}")
    # Lógica
    return {"resultado": "..."}

# Patrón repo
from core.repository import MyRepository
obj = MyRepository.get_by_id(1)
MyRepository.save(obj)
```

---

## ❌ Errores Comunes

### ❌ Error 1: Llamar jsonify en servicio
```python
# ❌ MALO
def paso_1(...):
    resultado = {...}
    return jsonify(resultado)  # ← ¡NO!

# ✅ BIEN
def paso_1(...):
    resultado = {...}
    return resultado  # Dict puro
```

### ❌ Error 2: Queries SQL en ruta
```python
# ❌ MALO
@bp.route('/endpoint')
def handler():
    cur.execute("SELECT * FROM solicitudes")  # ← ¡NO!

# ✅ BIEN
@bp.route('/endpoint')
def handler():
    solicitudes = SolicitudRepository.list_all()
```

### ❌ Error 3: No usar guard
```python
# ❌ MALO
@bp.route('/solicitudes/<id>')
def handler(id):
    solicitud = SolicitudRepository.get_by_id(id)  # Qué si no tienes permiso?

# ✅ BIEN
@bp.route('/solicitudes/<id>')
def handler(id):
    guard, user = _require_solicitud_access(id)  # Primero checkear
    if guard: return guard
    solicitud = SolicitudRepository.get_by_id(id)
```

### ❌ Error 4: Cargar Excel en cada request
```python
# ❌ MALO
def paso_1(...):
    df = pd.read_excel("backend/stock.xlsx")  # ← Lento!

# ✅ BIEN
def paso_1(...):
    df = get_stock_cache()  # Caché global, rápido
```

---

## ✅ Checklist para New Feature

- [ ] ¿Hice la lógica en servicio (NO en ruta)?
- [ ] ¿Usé repositorio para BD (NO queries directas)?
- [ ] ¿Usé cache para Excel (NO read_excel)?
- [ ] ¿Mi ruta es thin wrapper (~15 líneas)?
- [ ] ¿Tengo try-catch con error handlers?
- [ ] ¿Tengo type hints en servicios?
- [ ] ¿Testé el servicio (puro Python)?
- [ ] ¿Documenté la función?

---

## 📞 Si Tienes Dudas

1. Busca en `FASE_2_REFACTOR_CORE_COMPLETADO.md`
2. Mira un endpoint existente (PASO 1-3) como ejemplo
3. Revisa `FASE_2_ARQUITECTURA_FLUJOS.md` para diagrama

**Éxito!** 🚀
