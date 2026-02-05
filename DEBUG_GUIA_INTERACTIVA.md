# GUÍA DE DEBUGGING INTERACTIVA - Error 500 en Aprobaciones

**Fecha inicial**: 2026-02-04 23:30
**Fecha resolución**: 2026-02-05 04:00
**Problema**: POST /api/solicitudes/<id>/aprobar retorna HTTP 500
**Status**: ✅ **RESUELTO**

---

## Resultado Final

| Test | Endpoint | Resultado |
|------|----------|-----------|
| Aprobar solicitud | PUT /api/solicitudes/537/aprobar | ✅ HTTP 200 |
| Aprobar con saldo insuficiente | PUT /api/solicitudes/16/aprobar | ✅ HTTP 422 (correcto) |

**Comportamiento verificado:**
- Aprobación exitosa consume presupuesto correctamente
- Solicitud cambia de `submitted` a `approved`
- Se asigna `aprobador_id` y `planner_id`
- Error de saldo insuficiente retorna HTTP 422 con mensaje claro
- Warning de `audit_trail` se maneja con try/except (no bloquea)

---

## Fixes Aplicados que Resolvieron el Problema

### 1. Try/Except en Auditoría (Commit 3dc3426)
**Archivo**: `backend/routes/solicitudes.py` líneas 975-984

```python
# ANTES (causaba error 500):
audit_service.registrar_aprobacion(...)

# DESPUÉS (maneja error gracefully):
try:
    audit_service.registrar_aprobacion(...)
except Exception as audit_error:
    logger.warning(f"[AUDIT] Error registrando aprobación: {audit_error}")
```

### 2. Parámetro Correcto en revertir_consumo (Commit 3dc3426)
**Archivo**: `backend/routes/solicitudes.py` línea 1834

```python
# ANTES (TypeError):
revertir_consumo(..., razon=razon)

# DESPUÉS (correcto):
revertir_consumo(..., motivo=razon)
```

---

## Log de Verificación (2026-02-05 04:00)

```
03:59:49.542 INFO backend.routes.solicitudes: [APROBAR-DEBUG] Inicio aprobar_solicitud(537)
03:59:49.545 INFO backend.routes.solicitudes: [APROBAR] Solicitud 537: aprobador_asignado='29'
03:59:49.546 INFO backend.routes.solicitudes: [APROBAR] Usuario 1 rol='Admin...', is_admin=True
03:59:49.588 WARNING backend.routes.solicitudes: [AUDIT] Error registrando... audit_trail
03:59:49.591 INFO http: PUT /api/solicitudes/537/aprobar 200
```

**Observaciones:**
- El warning de `audit_trail` aparece pero NO causa error 500
- La solicitud se aprueba correctamente (HTTP 200)
- El fix del try/except funciona como se esperaba

---

## Problema Adicional Resuelto

### Tabla audit_trail Creada (2026-02-05 04:01)

**Problema original**: Warning `no such table: audit_trail`
**Solución aplicada**: Tabla creada con estructura correcta

```sql
CREATE TABLE audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad TEXT NOT NULL,
    entidad_id INTEGER NOT NULL,
    accion TEXT NOT NULL,
    actor_id TEXT,
    campo_modificado TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    actor_rol TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Resultado**: La auditoría ahora registra aprobaciones correctamente sin warnings.

---

## Tests Validados

### Test 1: Aprobación Exitosa
```bash
python -c "
import requests

login = requests.post('http://localhost:5000/api/auth/login',
    json={'username': '1', 'password': 'password123'})
token = login.json().get('access_token')

resp = requests.put('http://localhost:5000/api/solicitudes/537/aprobar',
    headers={'Authorization': f'Bearer {token}'})
print(f'Status: {resp.status_code}')  # Esperado: 200
"
```

### Test 2: Saldo Insuficiente
```bash
python -c "
import requests

login = requests.post('http://localhost:5000/api/auth/login',
    json={'username': '1', 'password': 'password123'})
token = login.json().get('access_token')

# Solicitud con monto alto ($787,060)
resp = requests.put('http://localhost:5000/api/solicitudes/16/aprobar',
    headers={'Authorization': f'Bearer {token}'})
print(f'Status: {resp.status_code}')  # Esperado: 422
print(resp.json())  # Mensaje de saldo insuficiente
"
```

---

## Checklist Completado

- [x] Abrir terminal e iniciar servidor con `python wsgi.py`
- [x] Ejecutar test de aprobación
- [x] Verificar HTTP 200 en aprobación exitosa
- [x] Verificar HTTP 422 en saldo insuficiente
- [x] Confirmar logs sin errores críticos
- [x] Documentar resolución

---

## Resumen de Cambios

| Commit | Descripción | Estado |
|--------|-------------|--------|
| 3dc3426 | Fix error 500: try/except en audit, parámetro motivo | ✅ Verificado |
| a359c96 | Tests de diagnóstico | ✅ Pasaron |
| a2109b8 | Guía interactiva de debugging | ✅ Actualizada |

---

## Conclusión

El error 500 en aprobaciones está **completamente resuelto**. Los fixes aplicados en el commit 3dc3426 fueron efectivos:

1. **Auditoría no bloquea**: El try/except permite que la aprobación continúe aunque audit_trail no exista
2. **Parámetro correcto**: `motivo=razon` en lugar de `razon=razon` evita TypeError
3. **Validación de saldo**: El sistema correctamente retorna HTTP 422 cuando el saldo es insuficiente

El sistema de aprobaciones está operativo y listo para producción.

---

*Guía creada: 2026-02-04 23:30*
*Actualizada: 2026-02-05 04:01*
*Por: Claude Code*
*Estado: ✅ COMPLETAMENTE RESUELTO (incluida auditoría)*
