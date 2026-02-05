# BUG TRACKER - SPM v3.0 Testing

**Actualizado**: 2026-02-05 (actualizado post-fix BUG-001)
**Total Bugs**: 2
**Críticos**: 0
**Altos**: 1 (0 abiertos, 1 resuelto)
**Menores**: 1
**Resolución Rate**: 50%

---

## BUG #1: Logout No Invalida Token ✅ RESUELTO

| Atributo | Valor |
|----------|-------|
| **ID** | BUG-001 |
| **Severidad** | ALTO |
| **Status** | RESUELTO |
| **Fase Encontrado** | FASE 2 |
| **Componente** | Auth - Logout |
| **Resuelto en** | Commit 0aca50a |

### Descripción
Después de ejecutar `POST /api/auth/logout`, el token JWT sigue siendo válido para hacer requests a endpoints protegidos.

### Pasos para Reproducir
1. Hacer login: `POST /api/auth/login` → 200 OK, retorna access_token
2. Hacer logout: `POST /api/auth/logout` con Bearer token → 200 OK
3. Intentar GET `/api/auth/me` con mismo token → **Actual: 200 OK**, **Esperado: 401**

### Expected Behavior
Después de logout, GET `/api/auth/me` debería retornar:
```json
{
  "ok": false,
  "error": {
    "code": "invalid_token",
    "message": "Token was revoked"
  }
}
```

### Actual Behavior
```json
{
  "ok": true,
  "user": { ... }
}
```

### Root Cause
El endpoint `/logout` solo borraba las cookies pero no invalidaba el JWT token. Si alguien usaba el token en el header `Authorization`, seguía siendo válido.

### Solución Implementada
Implementación de **Token Blacklist** (OPCIÓN 1) usando memoria en el servidor:

1. **Agregar UUID único (jti)** a cada token en `generate_tokens()`:
   ```python
   "jti": str(uuid.uuid4())  # JWT ID para revocation
   ```

2. **Crear clase `TokenBlacklist`** para mantener tokens revocados:
   ```python
   class TokenBlacklist:
       def revoke(token_jti, exp_timestamp)  # Agregar a blacklist
       def is_revoked(token_jti)  # Verificar revocation
       def _cleanup()  # Auto-limpiar tokens expirados
   ```

3. **Modificar `logout()`** para revocar el token:
   ```python
   # Extraer jti del token
   # Agregar a blacklist con su timestamp de expiración
   _token_blacklist.revoke(token_jti, exp_timestamp)
   ```

4. **Modificar `_decode_token()`** para verificar blacklist:
   ```python
   if _token_blacklist.is_revoked(token_jti):
       return 401 "Token was revoked"
   ```

### Impact
- **Security**: Sesiones se invalidan correctamente en logout ✓
- **Performance**: Blacklist se auto-limpia cuando tokens expiran ✓
- **Scope**: Aplicable a todos los endpoints protegidos ✓

### Tests
- ✅ Unit tests confirmados (test_logout_fix_unit.py)
- ✅ Tokens revocados rechazados con 401
- ✅ Otros tokens no afectados
- ✅ Auto-cleanup funciona

### Estimado
- **Implementado en**: 30 minutos
- **Complejidad**: Media
- **Tests**: 6 unit tests passed

---

## BUG #2: Security Headers No Presentes en Dev ℹ️ MENOR

| Atributo | Valor |
|----------|-------|
| **ID** | BUG-002 |
| **Severidad** | MENOR |
| **Status** | ESPERADO |
| **Fase Encontrado** | FASE 2 |
| **Componente** | Frontend - Vite Dev Server |

### Descripción
Headers de seguridad no están presentes en el dev server de Vite:
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Content-Security-Policy`
- `Referrer-Policy`

### Impacto
- Ninguno en desarrollo
- **Nota**: Estos headers deben estar configurados en nginx para producción

### Fix
Agregar en `infra/nginx/default.conf`:
```nginx
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header Content-Security-Policy "...";
add_header Referrer-Policy "strict-origin-when-cross-origin";
```

### Status
⏳ Pendiente para fase de producción

---

## BUGS CERRADOS

Ninguno (son todos nuevos)

---

## ESTADÍSTICAS

```
Total Bugs:      2
├── Abiertos:    2
│   ├── Alto:    1
│   └── Menor:   1
└── Cerrados:    0
```

---

## PRÓXIMAS ACCIONES

### Completadas
- [x] Fix BUG-001: Implementar token blacklist en logout ✅ COMPLETADO

### Antes de Producción
- [ ] Fix BUG-002: Agregar security headers a nginx

---

*Tracker actualizado automáticamente durante testing*
