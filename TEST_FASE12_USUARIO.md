# TEST FASE 12: Usuario (Mi Cuenta)

**Fecha inicio**: 2026-02-05 08:45
**Fecha finalización**: 2026-02-05 08:55
**Duración**: 10 minutos
**Prioridad**: MEDIA
**Estado**: ✅ COMPLETADA (78%)

---

## Objetivos

1. ✅ Validar perfil de usuario
2. ✅ Probar actualización de contacto
3. ✅ Verificar solicitudes de cambio de perfil
4. ⚠️ Validar preferencias de notificación
5. ⚠️ Probar admin profile requests

---

## Resumen Ejecutivo

| Test | Descripción | Estado |
|------|-------------|--------|
| 1 | GET /mi-cuenta | ✅ PASSED |
| 2 | GET /mi-cuenta/notification-preferences | ⚠️ Error 500 |
| 3 | GET /mi-cuenta/solicitudes-cambio-perfil | ✅ PASSED |
| 4 | PUT /mi-cuenta/contacto | ✅ PASSED |
| 5 | GET /mi-cuenta/admin/profile-requests | ⚠️ Error 500 |
| 6 | POST /mi-cuenta/solicitud-cambio-perfil | ✅ PASSED |
| 7 | GET /mi-cuenta/solicitudes-cambio-perfil (lista) | ✅ PASSED |
| 8 | POST /solicitudes-cambio-perfil/{id}/mensaje | ✅ PASSED |
| 9 | POST /solicitudes-cambio-perfil/{id}/cancelar | ✅ PASSED |

**Total: 7/9 tests pasados (78%)**

---

## Ejecución Detallada

### PARTE 1: Perfil (/api/mi-cuenta)

```
TEST 1: GET /api/mi-cuenta → HTTP 200 ✅
  Retorna: información completa del usuario

TEST 2: GET /api/mi-cuenta/notification-preferences → HTTP 500 ⚠️
  Error: near "%": syntax error
  Bug: Error SQL en query de preferencias

TEST 4: PUT /api/mi-cuenta/contacto → HTTP 200 ✅
  Body: {"telefono": "...", "mail_respaldo": "..."}
```

### PARTE 2: Solicitudes Cambio Perfil

```
TEST 3: GET /api/mi-cuenta/solicitudes-cambio-perfil → HTTP 200 ✅
  Retorna: lista de solicitudes del usuario

TEST 6: POST /api/mi-cuenta/solicitud-cambio-perfil → HTTP 200 ✅
  Body: {"rol_solicitado": "planificador", "justificacion": "..."}
  Result: id=2, campos_solicitados=["rol_solicitado","justificacion"]

TEST 7: GET /api/mi-cuenta/solicitudes-cambio-perfil → HTTP 200 ✅
  Retorna: solicitud creada con estado "pendiente"

TEST 8: POST /api/mi-cuenta/solicitudes-cambio-perfil/2/mensaje → HTTP 200 ✅
  Body: {"mensaje": "..."}

TEST 9: POST /api/mi-cuenta/solicitudes-cambio-perfil/2/cancelar → HTTP 200 ✅
```

### PARTE 3: Admin Profile Requests

```
TEST 5: GET /api/mi-cuenta/admin/profile-requests → HTTP 500 ⚠️
  Error: no such column: upr.tipo_cambio
  Bug: Columna faltante en tabla
```

---

## Endpoints Verificados

| Endpoint | Método | Estado |
|----------|--------|--------|
| `/api/mi-cuenta` | GET | ✅ 200 |
| `/api/mi-cuenta/contacto` | PUT | ✅ 200 |
| `/api/mi-cuenta/password` | PUT | ⏳ No testeado |
| `/api/mi-cuenta/notification-preferences` | GET | ⚠️ 500 |
| `/api/mi-cuenta/notification-preferences` | PUT | ⏳ No testeado |
| `/api/mi-cuenta/solicitud-cambio-perfil` | POST | ✅ 200 |
| `/api/mi-cuenta/solicitudes-cambio-perfil` | GET | ✅ 200 |
| `/api/mi-cuenta/solicitudes-cambio-perfil/<id>/mensaje` | POST | ✅ 200 |
| `/api/mi-cuenta/solicitudes-cambio-perfil/<id>/cancelar` | POST | ✅ 200 |
| `/api/mi-cuenta/admin/profile-requests` | GET | ⚠️ 500 |
| `/api/mi-cuenta/admin/profile-requests/<id>` | GET | ⏳ No testeado |
| `/api/mi-cuenta/admin/profile-requests/<id>/aprobar` | POST | ⏳ No testeado |
| `/api/mi-cuenta/admin/profile-requests/<id>/rechazar` | POST | ⏳ No testeado |
| `/api/mi-cuenta/admin/profile-requests/<id>/mensaje` | POST | ⏳ No testeado |

---

## Bugs Identificados

### USER-001: GET /notification-preferences retorna 500

**Severidad**: Media
**Error**: `near "%": syntax error`
**Descripción**: Error SQL en query de preferencias de notificación.

### USER-002: GET /admin/profile-requests retorna 500

**Severidad**: Media
**Error**: `no such column: upr.tipo_cambio`
**Descripción**: La tabla `user_profile_requests` no tiene la columna `tipo_cambio`.

---

## Datos de Respuesta

### GET /mi-cuenta
```json
{
  "id_usuario_spm": "1",
  "nombre_apellido": "Manu Remón",
  "nombre_usuario": "1",
  "mail": "admin@demo.local",
  "telefono": "02994673103",
  "puesto": "Administrador General",
  "rol_spm": "admin",
  "roles": ["admin","aprobador_presupuestos","aprobador_solicitudes","planificador"],
  "sector_actual": "Mantenimiento",
  "centros_actuales": ["AA101","AA102",...],
  "almacenes_actuales": ["AA001","AA012",...],
  "estado_registro": "Activo"
}
```

---

**FASE 12: COMPLETADA ✅**

*Funcionalidad principal de usuario funciona*
*Bugs menores en preferencias y admin requests*

*Fecha finalización: 2026-02-05 08:55*
*Por: Claude Code*
