# FASE 3: FLUJO DE SOLICITUDES (12 horas)

**Inicio**: 2026-02-05
**Prioridad**: CRÍTICA
**Objetivo**: Validar máquina de estados (FSM) y flujo completo de solicitudes

---

## MÁQUINA DE ESTADOS (FSM)

```
draft
  ↓
submitted → approved → in_planning → in_treatment → treated → completed
  ↓
rejected → draft (máx 2 reenvíos)
```

**Estados válidos:**
| Estado | Rol Permitido | Descripción |
|--------|--------------|-------------|
| draft | Solicitante | Solicitud en edición |
| submitted | Solicitante | Enviada para aprobación |
| approved | Aprobador | Aprobada |
| rejected | Aprobador | Rechazada, puede reenviarse |
| in_planning | Planificador | En planificación |
| in_treatment | Planificador | En tratamiento/ejecución |
| treated | Planificador | Tratada, lista para cierre |
| completed | Sistema | Finalizada |

---

## TEST PLAN

### TEST 1: Crear Solicitud (Draft)

**Endpoint**: POST `/api/solicitudes`

**Payload**:
```json
{
  "centro_id": "1008",
  "sector_id": "MTN",
  "titulo": "Test Solicitud FASE3",
  "descripcion": "Solicitud de prueba para FASE 3"
}
```

**Validaciones**:
- [ ] Status: 201 Created
- [ ] Solicitud creada en estado `draft`
- [ ] Usuario (solicitante) asignado como propietario
- [ ] ID generado único
- [ ] Items vacío inicialmente
- [ ] Monto total: $0

**Campos esperados en respuesta**:
```json
{
  "ok": true,
  "id": "SOL-001",
  "estado": "draft",
  "items": [],
  "monto_total": 0,
  "creado_por": "user_id",
  "fecha_creacion": "2026-02-05T..."
}
```

---

### TEST 2: Agregar Materiales a Solicitud

**Endpoint**: POST `/api/solicitudes/{id}/items`

**Payload**:
```json
{
  "items": [
    {
      "codigo_sap": "000000000001234567890",
      "cantidad": 5,
      "precio_unitario": 100.00
    }
  ]
}
```

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Items agregados correctamente
- [ ] Monto total actualizado ($500 en este caso)
- [ ] Validación: cantidad > 0
- [ ] Validación: precio_unitario > 0
- [ ] Material existe en catálogo

**Casos Edge**:
- [ ] Agregar material sin cantidad → 400 Bad Request
- [ ] Agregar material con cantidad = 0 → 400 Bad Request
- [ ] Código SAP inválido → 404 Not Found
- [ ] Agregar mismo material 2 veces → Actualizar cantidad o permitir duplicados

---

### TEST 3: Editar Solicitud (Draft)

**Endpoint**: PUT `/api/solicitudes/{id}`

**Payload**:
```json
{
  "titulo": "Titulo actualizado",
  "descripcion": "Nueva descripción"
}
```

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Campos actualizados
- [ ] Ownership validado (solo propietario puede editar)
- [ ] Solo permitido en estado `draft`

**Validación ownership**:
- [ ] Usuario A crea solicitud
- [ ] Usuario B intenta editar → 403 Forbidden

---

### TEST 4: Enviar Solicitud (Draft → Submitted)

**Endpoint**: POST `/api/solicitudes/{id}/enviar`

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `draft` → `submitted`
- [ ] Solicitud requiere mínimo 1 item
- [ ] No puede enviarse sin materiales → 400 Bad Request
- [ ] Timestamp `fecha_envio` registrado

**Casos Edge**:
- [ ] Enviar 2 veces consecutivas → 400 "Already submitted"
- [ ] Enviar con items vacío → 400 "Need at least 1 item"

---

### TEST 5: Aprobar Solicitud (Submitted → Approved)

**Endpoint**: POST `/api/solicitudes/{id}/aprobar`

**Requerimientos**:
- [ ] Solo Aprobador puede acceder
- [ ] Validar presupuesto disponible
- [ ] Calcular consumo: sum(items.cantidad * items.precio_unitario)

**Payload**:
```json
{
  "motivo_aprobacion": "Presupuesto disponible"
}
```

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `submitted` → `approved`
- [ ] Presupuesto consumido (ledger actualizado)
- [ ] Timestamp `fecha_aprobacion` registrado
- [ ] Solo Aprobador acceso (otros → 403)

**Presupuesto**:
- [ ] Presupuesto suficiente → Aprobación exitosa
- [ ] Presupuesto insuficiente → 400 "Insufficient budget"
- [ ] Verificar nivel de aprobador (L1: $200k, L2: $1M, ADMIN: >$1M)

---

### TEST 6: Rechazar Solicitud (Submitted → Rejected)

**Endpoint**: POST `/api/solicitudes/{id}/rechazar`

**Payload**:
```json
{
  "motivo_rechazo": "Material no disponible en stock"
}
```

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `submitted` → `rejected`
- [ ] Motivo registrado (mínimo 5 caracteres)
- [ ] NO consume presupuesto (importante!)
- [ ] Solicitante notificado
- [ ] Timestamp `fecha_rechazo` registrado

**Casos Edge**:
- [ ] Motivo vacío → 400 Bad Request
- [ ] Motivo < 5 caracteres → 400 Bad Request
- [ ] Rechazar 2 veces → Validar que pueda o no

---

### TEST 7: Reenviar Solicitud Rechazada (Rejected → Submitted)

**Endpoint**: POST `/api/solicitudes/{id}/reenviar`

**Validaciones**:
- [ ] Solo en estado `rejected`
- [ ] Máximo 2 reenvíos permitidos
- [ ] Reenvío 1: Estado cambia `rejected` → `submitted`
- [ ] Reenvío 2: Permitido
- [ ] Reenvío 3: Rechazado con error 400

**Casos Edge**:
- [ ] Reenviar 3 veces → Error "Max reenvios exceeded"
- [ ] Reenviar sin estar rechazada → 400 "Not in rejected state"

---

### TEST 8: Cancelar Solicitud

**Endpoint**: POST `/api/solicitudes/{id}/cancelar`

**Estados permitidos para cancelación**:
- [ ] `draft` → `cancelled` ✓
- [ ] `submitted` → `cancelled` ✓
- [ ] `rejected` → `cancelled` ✓
- [ ] `approved` → `cancelled` (¿Revierte presupuesto?)
- [ ] `in_planning` o posterior → 400 "Cannot cancel in this state"

**Validaciones**:
- [ ] Presupuesto revertido si fue aprobada
- [ ] Timestamp `fecha_cancelacion` registrado
- [ ] Solo propietario puede cancelar

---

### TEST 9: Transicionar a Planificación (Approved → In_Planning)

**Endpoint**: POST `/api/solicitudes/{id}/enviar-planificacion`

**Requerimientos**:
- [ ] Solo Planificador puede acceder
- [ ] Solo en estado `approved`

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `approved` → `in_planning`
- [ ] Planificador asignado
- [ ] Timestamp `fecha_inicio_planificacion` registrado

**Casos Edge**:
- [ ] Planificador A asigna a Planificador B → Validar si permitido
- [ ] Enviar planificación sin estar aprobada → 400 Error

---

### TEST 10: Transicionar a Tratamiento (In_Planning → In_Treatment)

**Endpoint**: POST `/api/solicitudes/{id}/iniciar-tratamiento`

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `in_planning` → `in_treatment`
- [ ] Timestamp `fecha_inicio_tratamiento` registrado
- [ ] Decisiones de abastecimiento completadas

**Retroceso permitido**:
- [ ] Máximo 3 retrocesos a `in_planning`
- [ ] Retroceso 4: Error "Max rollbacks exceeded"

---

### TEST 11: Finalizar Tratamiento (In_Treatment → Treated)

**Endpoint**: POST `/api/solicitudes/{id}/finalizar-tratamiento`

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `in_treatment` → `treated`
- [ ] Timestamp `fecha_fin_tratamiento` registrado
- [ ] Todas las órdenes/acciones completadas

---

### TEST 12: Completar Solicitud (Treated → Completed)

**Endpoint**: POST `/api/solicitudes/{id}/completar`

**Validaciones**:
- [ ] Status: 200 OK
- [ ] Estado cambia: `treated` → `completed`
- [ ] Timestamp `fecha_completacion` registrado
- [ ] Estado terminal (no permite más cambios)

**Casos Edge**:
- [ ] Intentar cambiar estado de completed → 400 "Cannot modify completed request"

---

### TEST 13: Listar Solicitudes por Estado

**Endpoint**: GET `/api/solicitudes?estado=submitted`

**Validaciones**:
- [ ] Filtrar por estado correcto
- [ ] Paginación (50 por página)
- [ ] Solo mostrar solicitudes accesibles (ownership)
- [ ] Admin ve todas, solicitante ve solo sus propias

**Estados a probar**:
- [ ] `?estado=draft` → Solo mis borradores
- [ ] `?estado=submitted` → Solicitudes en aprobación
- [ ] `?estado=approved` → Solicitudes aprobadas
- [ ] `?estado=rejected` → Mis rechazadas
- [ ] Sin estado → Todas mis solicitudes

---

### TEST 14: Obtener Detalle de Solicitud

**Endpoint**: GET `/api/solicitudes/{id}`

**Validaciones**:
- [ ] Campos completos en respuesta
- [ ] Historial de estados incluido
- [ ] Items con detalles materiales
- [ ] Ownership validado (otros → 404 o 403)

**Respuesta esperada**:
```json
{
  "ok": true,
  "solicitud": {
    "id": "SOL-001",
    "titulo": "...",
    "estado": "submitted",
    "items": [...],
    "monto_total": 500,
    "creado_por": "user_id",
    "fecha_creacion": "...",
    "historial": [
      {"estado": "draft", "fecha": "..."},
      {"estado": "submitted", "fecha": "..."}
    ]
  }
}
```

---

### TEST 15: Validación de Ownership

**Objetivo**: Asegurar que usuarios solo accedan a sus solicitudes

**Escenario**:
1. Usuario A crea solicitud
2. Usuario B intenta acceder/editar
3. Usuario C (Admin) intenta acceder

**Validaciones**:
- [ ] Usuario A: Acceso completo ✓
- [ ] Usuario B: 404 Not Found o 403 Forbidden
- [ ] Admin: Acceso completo ✓

---

### TEST 16: Adjuntos

**Endpoint**: POST `/api/solicitudes/{id}/adjuntos`

**Validaciones**:
- [ ] Subir archivo PDF/Excel/Imagen
- [ ] Validar tamaño máximo (10MB)
- [ ] Solo propietario puede subir
- [ ] Listado de adjuntos en detalle

---

## MÉTRICAS DE ÉXITO

- [ ] 100% tests de FSM pasando
- [ ] Transiciones de estado correctas
- [ ] Presupuesto consumo/reversión funciona
- [ ] Ownership validado
- [ ] Máximo de reenvíos respetado (2)
- [ ] Máximo retrocesos respetado (3)
- [ ] Performance < 1s para crear/enviar solicitud

---

## ARCHIVOS CRÍTICOS

**Backend**:
- `backend/core/fsm.py` - Máquina de estados
- `backend/routes/solicitudes.py` - Endpoints solicitudes
- `backend/services/approval_service.py` - Lógica aprobaciones
- `backend/core/schemas.py` - Validación

**Frontend**:
- `frontend/src/pages/CreateSolicitud.jsx`
- `frontend/src/pages/MisSolicitudes.jsx`
- `frontend/src/pages/SolicitudDetalle.jsx`
- `frontend/src/pages/Materials.jsx`

---

## PRÓXIMOS PASOS

1. Verificar estructura BD (tabla solicitud, items)
2. Entender FSM actual (backend/core/fsm.py)
3. Ejecutar tests según plan
4. Documentar resultados en RESULTS_FASE3_SOLICITUDES.md
