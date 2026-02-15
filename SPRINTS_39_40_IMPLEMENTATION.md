# Sprints 39 & 40 Implementation Summary

**Date**: 2026-02-14
**Author**: Claude Code
**Sprints**: 39 (Proveedor Scorecard Persistente), 40 (Auto-Aprobación por Reglas)

---

## Sprint 39: Proveedor Scorecard Persistente

### Objetivo
Crear un sistema de evaluación persistente de proveedores con snapshots automáticos mensuales desde datos SAP.

### Archivos Creados

#### 1. Migration `backend/migrations/037_proveedor_scorecard.py`
- **Tabla `proveedor_evaluacion`**:
  - `id`, `proveedor_id`, `proveedor_nombre`, `periodo` (YYYY-MM)
  - `calidad_score`, `entrega_score`, `precio_score`, `servicio_score`, `score_global`
  - `evaluado_por` (NULL para evaluaciones automáticas)
  - `notas`, `created_at`
  - Índices: `(proveedor_id)`, `(periodo)`, `(proveedor_id, periodo)`

- **Tabla `proveedor_meta`**:
  - `id`, `proveedor_id`, `meta_key`, `meta_value`, `updated_at`
  - Índices: `(proveedor_id)`, `(proveedor_id, meta_key)`

#### 2. Endpoints en `backend/routes/procurement.py`

**INSTRUCCIONES**: Agregar manualmente al final de `procurement.py`:
```python
# Copiar contenido de backend/routes/procurement_scorecard_endpoints.py
```

**Nuevos endpoints**:
- `GET /api/procurement/scorecard/<proveedor_id>` - Obtener scorecard actual + historial
  - Query params: `meses` (default: 12)
  - Returns: `{current: {...}, historial: [...], meta: {...}}`

- `POST /api/procurement/scorecard/<proveedor_id>/evaluar` - Evaluación manual
  - Requiere: Admin
  - Body: `{calidad_score, entrega_score, precio_score, servicio_score, notas}`
  - Calcula `score_global` con ponderación: entrega 35%, calidad 30%, precio 20%, servicio 15%

- `GET /api/procurement/scorecard/ranking` - Ranking de proveedores
  - Query params: `periodo` (default: mes actual), `limit` (default: 20, max: 100)
  - Returns: `{ok, periodo, ranking: [{...tendencia}]}`
  - Incluye tendencia comparando con mes anterior (up/down/stable)

#### 3. Celery Task en `backend/core/tasks.py`

**Función agregada**: `snapshot_proveedor_scorecard`
- Ejecuta el 1ro de cada mes a las 2am (crontab)
- Lee datos de `v_sap_cumplimiento` view
- Calcula scores automáticos:
  - `calidad_score` = `pct_completas`
  - `entrega_score` = `pct_a_tiempo`
  - `precio_score` = `100 - abs(valor_desviacion_pct)`
  - `servicio_score` = `avg(calidad, entrega)` (proxy)
  - `score_global` = weighted average
- Inserta en `proveedor_evaluacion` con `evaluado_por = NULL`
- Idempotente: solo crea si no existe evaluación para el periodo actual

#### 4. Celery Beat Schedule en `backend/core/celery_app.py`

**Cambio agregado**:
```python
from celery.schedules import crontab  # Agregado al import

# En beat_schedule:
"snapshot-proveedor-scorecard-monthly": {
    "task": "backend.core.tasks.snapshot_proveedor_scorecard",
    "schedule": crontab(day_of_month=1, hour=2, minute=0),
},
```

---

## Sprint 40: Auto-Aprobación por Reglas

### Objetivo
Sistema configurable de reglas para auto-aprobar solicitudes basado en condiciones como monto, historial del solicitante, y criticidad.

### Archivos Creados

#### 1. Migration `backend/migrations/038_auto_approval_rules.py`
- **Tabla `regla_auto_aprobacion`**:
  - `id`, `nombre`, `descripcion`
  - `condiciones_json` (JSON con condiciones de la regla)
  - `activo` (0/1), `centro_id` (NULL = aplica a todos)
  - `prioridad` (menor = mayor prioridad, default: 100)
  - `creado_por`, `created_at`, `updated_at`
  - Índices: `(activo, prioridad)`, `(centro_id)`

**Estructura `condiciones_json`**:
```json
{
  "monto_max": 50000,
  "materiales_conocidos_only": true,
  "historial_solicitante_min": 5,
  "criticidad_max": "media"
}
```

#### 2. Service `backend/services/auto_approval_service.py`

**Clase `AutoApprovalService`** con métodos estáticos:

- `evaluar_solicitud(solicitud_id)` → `{auto_aprobable, regla_aplicada, confianza, motivo}`
  - Carga datos de solicitud (monto, items, solicitante, criticidad)
  - Carga reglas activas ordenadas por prioridad ASC
  - Evalúa TODAS las condiciones de cada regla:
    - `monto_max`: total_monto <= monto_max
    - `materiales_conocidos_only`: todos los materiales fueron solicitados antes
    - `historial_solicitante_min`: solicitante tiene >= N solicitudes aprobadas
    - `criticidad_max`: criticidad <= threshold (baja=1, media=2, alta=3, critica=4)
  - Retorna la primera regla que cumple TODAS las condiciones
  - `confianza` = condiciones_cumplidas / total_condiciones

- `get_rules()` → Lista de todas las reglas

- `create_rule(data, user_id)` → Regla creada

- `update_rule(rule_id, data, user_id)` → Regla actualizada

- `delete_rule(rule_id, user_id)` → bool

- `simulate(rule_id=None, dias=30)` → `{total_solicitudes, auto_aprobables, porcentaje, detalle}`
  - Simula cuántas solicitudes recientes habrían sido auto-aprobadas

#### 3. FSM Integration `backend/core/fsm_auto_approval.py`

**INSTRUCCIONES**: Agregar manualmente a `backend/core/fsm.py` al final del archivo:
```python
# Copiar contenido de backend/core/fsm_auto_approval.py
```

**Función nueva**: `intentar_auto_aprobacion(solicitud_id, user_id="sistema")`
- Evalúa solicitud con `AutoApprovalService.evaluar_solicitud()`
- Si `auto_aprobable` y `confianza >= 0.95`:
  - Llama `cambiar_estado(solicitud_id, 'approved', actor_id=user_id, razon=..., metadata=...)`
  - Crea entrada en `audit_logs` con `event_type = 'auto_approval'`
- Returns: `{evaluado, auto_aprobado, regla_aplicada, confianza, motivo, resultado_fsm}`

**Uso**: Llamar desde `routes/solicitudes/crud.py` después de transicionar a `submitted`

#### 4. Admin Endpoints en `backend/routes/admin.py`

**INSTRUCCIONES**: Agregar manualmente al final de `admin.py`:
```python
import json  # Si no está ya importado

# Copiar contenido de backend/routes/admin_auto_approval_endpoints.py
```

**Nuevos endpoints**:
- `GET /api/admin/auto-approval-rules` - Listar reglas
  - Requiere: Admin
  - Parsea `condiciones_json` → `condiciones` para display

- `POST /api/admin/auto-approval-rules` - Crear regla
  - Requiere: Admin
  - Body: `{nombre, descripcion, condiciones, centro_id, prioridad, activo}`

- `PUT /api/admin/auto-approval-rules/<rule_id>` - Actualizar regla
  - Requiere: Admin

- `DELETE /api/admin/auto-approval-rules/<rule_id>` - Eliminar regla
  - Requiere: Admin

- `POST /api/admin/auto-approval-rules/simulate` - Simular auto-aprobación
  - Requiere: Admin
  - Body: `{rule_id: optional, dias: 30}`
  - Retorna cuántas solicitudes recientes habrían sido auto-aprobadas

---

## Pasos Manuales Requeridos

### 1. Ejecutar Migraciones
```bash
# Terminal 1 (desde raíz del proyecto)
python backend/migrations/037_proveedor_scorecard.py
python backend/migrations/038_auto_approval_rules.py
```

### 2. Agregar Endpoints a procurement.py
```bash
# Copiar contenido de procurement_scorecard_endpoints.py
# Al final de backend/routes/procurement.py (después de línea 1513)
```

### 3. Agregar Endpoints a admin.py
```bash
# Copiar contenido de admin_auto_approval_endpoints.py
# Al final de backend/routes/admin.py
```

### 4. Agregar Función a fsm.py
```bash
# Copiar contenido de fsm_auto_approval.py
# Al final de backend/core/fsm.py (después de la función puede_rechazar)
```

### 5. Integrar Auto-Aprobación en Flujo de Solicitudes

En `backend/routes/solicitudes/crud.py`, después de crear una solicitud y transicionarla a `submitted`, agregar:

```python
# En la función create_solicitud(), después de cambiar_estado a 'submitted'
try:
    from backend.core.fsm import intentar_auto_aprobacion

    resultado_auto = intentar_auto_aprobacion(
        solicitud_id=solicitud_id,
        user_id="sistema"
    )

    if resultado_auto.get("auto_aprobado"):
        logger.info(
            f"Solicitud {solicitud_id} auto-aprobada por regla: "
            f"{resultado_auto.get('regla_aplicada')}"
        )
except Exception as e:
    # No fallar si auto-aprobación falla - la solicitud ya está submitted
    logger.warning(f"Error en auto-aprobación de solicitud {solicitud_id}: {e}")
```

### 6. Reiniciar Servicios
```bash
# Backend
# Ctrl+C en Terminal 1, luego:
python wsgi.py

# Celery Worker (si está corriendo)
# Ctrl+C, luego:
celery -A backend.core.celery_app worker --loglevel=info

# Celery Beat (para tareas programadas)
# Ctrl+C, luego:
celery -A backend.core.celery_app beat --loglevel=info
```

---

## Testing

### Sprint 39: Scorecard

#### Test Manual de Endpoints
```bash
# 1. Obtener scorecard de proveedor
curl http://localhost:5000/api/procurement/scorecard/30123456789 \
  -H "Authorization: Bearer <token>"

# 2. Evaluar proveedor manualmente (Admin)
curl -X POST http://localhost:5000/api/procurement/scorecard/30123456789/evaluar \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "calidad_score": 85,
    "entrega_score": 90,
    "precio_score": 75,
    "servicio_score": 80,
    "notas": "Buen desempeño general"
  }'

# 3. Obtener ranking
curl http://localhost:5000/api/procurement/scorecard/ranking?limit=10 \
  -H "Authorization: Bearer <token>"
```

#### Test Celery Task
```bash
# Ejecutar manualmente el snapshot
celery -A backend.core.celery_app call backend.core.tasks.snapshot_proveedor_scorecard
```

### Sprint 40: Auto-Aprobación

#### Test Manual de Service
```python
# En shell Python
from backend.services.auto_approval_service import AutoApprovalService

# 1. Crear regla de prueba
rule_data = {
    "nombre": "Auto-aprobar solicitudes pequeñas",
    "descripcion": "Monto <= 10,000 y criticidad baja/media",
    "condiciones": {
        "monto_max": 10000,
        "criticidad_max": "media"
    },
    "activo": 1,
    "prioridad": 10
}
rule = AutoApprovalService.create_rule(rule_data, user_id=1)
print(rule)

# 2. Evaluar una solicitud
result = AutoApprovalService.evaluar_solicitud(123)
print(result)

# 3. Simular auto-aprobación
simulation = AutoApprovalService.simulate(dias=30)
print(simulation)
```

#### Test Endpoints Admin
```bash
# 1. Listar reglas
curl http://localhost:5000/api/admin/auto-approval-rules \
  -H "Authorization: Bearer <admin_token>"

# 2. Crear regla
curl -X POST http://localhost:5000/api/admin/auto-approval-rules \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Auto-aprobar usuarios experimentados",
    "descripcion": "Usuarios con 5+ solicitudes aprobadas y monto < 20k",
    "condiciones": {
      "monto_max": 20000,
      "historial_solicitante_min": 5,
      "criticidad_max": "alta"
    },
    "prioridad": 50,
    "activo": 1
  }'

# 3. Simular
curl -X POST http://localhost:5000/api/admin/auto-approval-rules/simulate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"dias": 30}'
```

---

## Datos de Prueba

### Sprint 39: Scorecard

Para probar el scorecard, necesitas:
1. Datos en `sap_purchase_orders` con `proveedor_cuit` poblado
2. Vista `v_sap_cumplimiento` creada (ya existe en migración 020)
3. Mínimo 3 pedidos por proveedor para aparecer en scorecard

### Sprint 40: Auto-Aprobación

Para probar auto-aprobación, necesitas:
1. Solicitudes en estado `submitted`
2. Items con `material_codigo` y `precio_unitario`
3. Historial de solicitudes del usuario (para `historial_solicitante_min`)

**Ejemplo de regla de prueba**:
```json
{
  "nombre": "Test Rule - Monto Bajo",
  "descripcion": "Auto-aprobar solicitudes <= $5,000",
  "condiciones": {
    "monto_max": 5000,
    "criticidad_max": "media"
  },
  "activo": 1,
  "prioridad": 100
}
```

---

## Estructura de Archivos Creados

```
backend/
├── migrations/
│   ├── 037_proveedor_scorecard.py       ✅ NUEVO
│   └── 038_auto_approval_rules.py       ✅ NUEVO
├── services/
│   └── auto_approval_service.py         ✅ NUEVO
├── core/
│   ├── tasks.py                         ✅ MODIFICADO (agregado snapshot_proveedor_scorecard)
│   ├── celery_app.py                    ✅ MODIFICADO (agregado schedule + import crontab)
│   └── fsm_auto_approval.py             ✅ NUEVO (copiar a fsm.py)
└── routes/
    ├── procurement_scorecard_endpoints.py   ✅ NUEVO (copiar a procurement.py)
    └── admin_auto_approval_endpoints.py     ✅ NUEVO (copiar a admin.py)
```

---

## Checklist de Implementación

### Sprint 39
- [x] Migración 037 creada
- [x] Endpoints de scorecard escritos
- [x] Celery task snapshot_proveedor_scorecard
- [x] Schedule en celery_app.py
- [ ] **PENDIENTE**: Copiar endpoints a procurement.py
- [ ] **PENDIENTE**: Ejecutar migración 037
- [ ] **PENDIENTE**: Reiniciar backend + celery

### Sprint 40
- [x] Migración 038 creada
- [x] AutoApprovalService implementado
- [x] Función intentar_auto_aprobacion escrita
- [x] Endpoints admin escritos
- [ ] **PENDIENTE**: Copiar función a fsm.py
- [ ] **PENDIENTE**: Copiar endpoints a admin.py
- [ ] **PENDIENTE**: Integrar en create_solicitud()
- [ ] **PENDIENTE**: Ejecutar migración 038
- [ ] **PENDIENTE**: Reiniciar backend

---

## Notas de Implementación

### Sprint 39
- El snapshot automático usa datos de `v_sap_cumplimiento` view (ya existente)
- Score global usa ponderación: entrega 35%, calidad 30%, precio 20%, servicio 15%
- Evaluaciones manuales sobrescriben las automáticas para el periodo actual
- Tendencia se calcula comparando con mes anterior (up/down/stable si diff > 1%)

### Sprint 40
- Confianza >= 0.95 requerida para auto-aprobar (TODAS las condiciones deben cumplirse)
- Reglas se evalúan por prioridad ASC (menor número = mayor prioridad)
- Auto-aprobación NO bloquea el flujo si falla (la solicitud queda en `submitted`)
- Audit log registra todas las auto-aprobaciones con metadata completa
- Simulación limitada a 100 solicitudes y máximo 90 días

---

## Dependencias

Ambos sprints requieren:
- PostgreSQL o SQLite (dual-compatible)
- Redis (para Celery)
- Celery Worker + Beat corriendo
- Vista `v_sap_cumplimiento` (creada en migración 020)
- Tabla `audit_logs` (para Sprint 40)

---

## Próximos Pasos

1. Ejecutar migraciones 037 y 038
2. Copiar código de endpoints a archivos destino
3. Integrar auto-aprobación en flujo de solicitudes
4. Reiniciar servicios
5. Crear reglas de auto-aprobación de prueba
6. Probar endpoints con Postman/curl
7. Verificar que el snapshot mensual funciona (forzar ejecución manual primero)

---

**Fin de Implementación de Sprints 39 y 40**
