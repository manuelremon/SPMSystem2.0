# TEST FASE 8: Presupuestos

**Fecha inicio**: 2026-02-05 06:10
**Fecha finalización**: 2026-02-05 06:20
**Duración**: 10 minutos
**Prioridad**: ALTA
**Estado**: ✅ COMPLETADA

---

## Objetivos

1. ✅ Validar consulta de presupuesto
2. ✅ Probar ledger de movimientos
3. ✅ Verificar creación de BUR
4. ✅ Probar flujo de aprobación
5. ✅ Validar rechazo de BUR

---

## Resumen Ejecutivo

| Test | Descripción | Estado |
|------|-------------|--------|
| 1 | Presupuesto por Centro/Sector | ✅ PASSED |
| 2 | Presupuesto Ledger | ✅ PASSED |
| 3 | Lista Budget Requests | ✅ PASSED |
| 4 | BURs Pendientes | ✅ PASSED |
| 5 | Crear BUR | ✅ PASSED |
| 6 | Obtener BUR específico | ✅ PASSED |
| 7 | Aprobar BUR | ✅ PASSED |
| 8 | Rechazar BUR | ✅ PASSED |
| 9 | Revertir BUR | ⚠️ Bug conocido |

**Total: 8/9 tests pasados (89%)**

---

## Ejecución Detallada

### TEST 1: Presupuesto por Centro/Sector ✅

```
GET /api/presupuesto/AA102/Mantenimiento → HTTP 200
Response: {"ok": true, "presupuesto": {...}}
```

### TEST 2: Presupuesto Ledger ✅

```
GET /api/presupuesto-ledger → HTTP 200
Muestra historial de movimientos de presupuesto
```

### TEST 3: Lista Budget Requests ✅

```
GET /api/budget-requests → HTTP 200
Retorna lista paginada de BURs
```

### TEST 4: BURs Pendientes ✅

```
GET /api/budget-requests/pendientes → HTTP 200
Filtra solo BURs en estado pendiente
```

### TEST 5: Crear BUR ✅

```
POST /api/budget-requests → HTTP 201
Body: {
  "centro": "AA102",
  "sector": "Mantenimiento",
  "monto_solicitado": 3000.00,
  "justificacion": "Justificación de al menos 10 caracteres"
}
Response: {"ok": true, "bur": {"id": 36, ...}}
```

### TEST 6: Obtener BUR específico ✅

```
GET /api/budget-requests/36 → HTTP 200
```

### TEST 7: Aprobar BUR ✅

```
POST /api/budget-requests/36/aprobar → HTTP 200
Body: {"comentario": "Comentario de aprobación"}
```

### TEST 8: Rechazar BUR ✅

```
POST /api/budget-requests/37/rechazar → HTTP 200
Body: {"motivo": "Motivo del rechazo"}
```

### TEST 9: Revertir BUR ⚠️

```
POST /api/budget-requests/38/revertir → HTTP 400
Error: CHECK constraint failed - tipo_movimiento no incluye 'reversion_bur'
```

**Bug identificado**: El tipo de movimiento para reversión de BUR no está en la lista permitida del constraint de la tabla `presupuesto_ledger`.

---

## Endpoints Verificados

| Endpoint | Método | Estado |
|----------|--------|--------|
| `/api/presupuesto/<centro>/<sector>` | GET | ✅ 200 |
| `/api/presupuesto-ledger` | GET | ✅ 200 |
| `/api/budget-requests` | GET | ✅ 200 |
| `/api/budget-requests` | POST | ✅ 201 |
| `/api/budget-requests/pendientes` | GET | ✅ 200 |
| `/api/budget-requests/<id>` | GET | ✅ 200 |
| `/api/budget-requests/<id>/aprobar` | POST | ✅ 200 |
| `/api/budget-requests/<id>/rechazar` | POST | ✅ 200 |
| `/api/budget-requests/<id>/revertir` | POST | ⚠️ Bug DB |

---

## Flujo de BUR Verificado

```
1. Crear BUR (POST /budget-requests) → estado: "pendiente"
2. Aprobar BUR (POST /budget-requests/{id}/aprobar) → estado: "aprobado"
   - Actualiza saldo en presupuesto
   - Registra movimiento en ledger
3. Rechazar BUR (POST /budget-requests/{id}/rechazar) → estado: "rechazado"
   - No afecta saldo
```

---

## Niveles de Aprobación

El sistema determina automáticamente el nivel de aprobación requerido:

| Monto (USD) | Nivel |
|-------------|-------|
| $0 - $200,000 | L1 (Coordinador) |
| $200,000 - $1,000,000 | L2 (Jefe) |
| > $1,000,000 | ADMIN |

---

## Bug Identificado

### BUR-001: Reversión de BUR falla por constraint

**Severidad**: Media
**Ubicación**: `presupuesto_ledger` table constraint
**Descripción**: El tipo de movimiento para reversión de BUR no está incluido en la lista de tipos permitidos.

**Constraint actual**:
```sql
tipo_movimiento IN (
    'consumo_aprobacion',
    'reversion_rechazo',
    'ajuste_manual',
    'bur_aprobado'
)
```

**Solución sugerida**: Agregar `'reversion_bur'` al constraint.

---

**FASE 8: COMPLETADA ✅**

*Fecha finalización: 2026-02-05 06:20*
*Por: Claude Code*
