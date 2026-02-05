# FASE 1: AUTENTICACIÓN Y AUTORIZACIÓN (4 horas)

**Inicio**: 2026-02-05
**Prioridad**: CRÍTICA
**Endpoints**: 4 principales
**Subtareas**: 18 checklist items

---

## 1. PREPARACIÓN

### 1.1 Crear Usuarios de Prueba
```sql
INSERT INTO usuarios (id_spm, email, nombre, password, rol, estado) VALUES
('ADMIN001', 'admin@spm.local', 'Admin Test', bcrypt('password123'), 'admin', 'activo'),
('PLAN001', 'planificador@spm.local', 'Planificador Test', bcrypt('password123'), 'planificador', 'activo'),
('APRO001', 'aprobador@spm.local', 'Aprobador Test', bcrypt('password123'), 'coordinador', 'activo'),
('USER001', 'usuario@spm.local', 'Usuario Test', bcrypt('password123'), 'usuario', 'activo');
```

### 1.2 Herramientas Necesarias
- curl (para testing API)
- Python (para scripts de test)
- Navegador (para testing UI)
- Postman o similar (opcional)

---

## 2. ENDPOINTS A PROBAR

| Endpoint | Método | Descripción | Auth |
|----------|--------|-------------|------|
| `/api/auth/login` | POST | Login con credenciales | ❌ |
| `/api/auth/refresh` | POST | Refrescar token | 🔑 |
| `/api/auth/logout` | POST | Cerrar sesión | 🔑 |
| `/api/auth/me` | GET | Obtener usuario actual | 🔑 |

---

## 3. TEST CASOS

### TEST 3.1: Login con Credenciales Válidas (id_spm)
**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "id_spm": "ADMIN001",
  "password": "password123"
}
```

**Expected Response** (200):
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "id_spm": "ADMIN001",
    "email": "admin@spm.local",
    "nombre": "Admin Test",
    "rol": "admin"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600
}
```

**Checklist**:
- [ ] Status 200
- [ ] access_token válido (JWT)
- [ ] refresh_token válido (JWT)
- [ ] expires_in = 3600 (1 hora)
- [ ] user.rol = "admin"
- [ ] Cookies configuradas con tokens (httpOnly en prod)

**Curl**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id_spm":"ADMIN001","password":"password123"}' \
  -c cookies.txt -v
```

---

### TEST 3.2: Login con Email (Alternativa)
**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "admin@spm.local",
  "password": "password123"
}
```

**Expected Response** (200): Igual que TEST 3.1

**Checklist**:
- [ ] Login con email funciona
- [ ] Mismo token que con id_spm
- [ ] Rol correcto

**Curl**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spm.local","password":"password123"}'
```

---

### TEST 3.3: Login con Contraseña Inválida
**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "id_spm": "ADMIN001",
  "password": "INVALID"
}
```

**Expected Response** (401):
```json
{
  "ok": false,
  "error": "Credenciales inválidas",
  "error_code": "INVALID_CREDENTIALS"
}
```

**Checklist**:
- [ ] Status 401 (no 400)
- [ ] No retorna user data
- [ ] No retorna tokens
- [ ] Mensaje genérico (sin revelar si usuario existe)

**Curl**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id_spm":"ADMIN001","password":"INVALID"}'
```

---

### TEST 3.4: Rate Limiting en Login
**Endpoint**: `POST /api/auth/login`

**Configuración**: 10 intentos / 5 minutos (según CLAUDE.md)

**Procedimiento**:
1. Hacer 10 requests con contraseña inválida rápidamente
2. Request 11 debe fallar con 429

**Expected Response** (429):
```json
{
  "ok": false,
  "error": "Demasiados intentos fallidos. Intenta de nuevo en 5 minutos",
  "retry_after": 300
}
```

**Checklist**:
- [ ] Primeros 10 intentos retornan 401
- [ ] Intento 11 retorna 429
- [ ] Header `Retry-After: 300` presente
- [ ] Rate limit se resetea después de 5 minutos

**Script**:
```bash
for i in {1..12}; do
  echo "Intento $i:"
  curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"id_spm":"ADMIN001","password":"WRONG"}' | jq '.error'
  sleep 0.5
done
```

---

### TEST 3.5: Refresh Token Válido
**Endpoint**: `POST /api/auth/refresh`

**Prerequisito**: Tener refresh_token válido de TEST 3.1

**Request**:
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Expected Response** (200):
```json
{
  "ok": true,
  "access_token": "eyJ...",
  "expires_in": 3600
}
```

**Checklist**:
- [ ] Status 200
- [ ] Nuevo access_token diferente al anterior
- [ ] refresh_token NO cambia
- [ ] Ambos tokens válidos
- [ ] Claims contienen user info

**Curl**:
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"eyJ..."}'
```

---

### TEST 3.6: Refresh Token Inválido/Expirado
**Endpoint**: `POST /api/auth/refresh`

**Request**:
```json
{
  "refresh_token": "INVALID_TOKEN_12345"
}
```

**Expected Response** (401):
```json
{
  "ok": false,
  "error": "Token inválido o expirado",
  "error_code": "INVALID_TOKEN"
}
```

**Checklist**:
- [ ] Status 401
- [ ] No retorna nuevo token
- [ ] Mensaje de error claro

---

### TEST 3.7: Logout
**Endpoint**: `POST /api/auth/logout`

**Prerequisito**: Access token válido

**Request**:
```
Headers: Authorization: Bearer eyJ...
```

**Expected Response** (200):
```json
{
  "ok": true,
  "message": "Sesión cerrada correctamente"
}
```

**Checklist**:
- [ ] Status 200
- [ ] Tokens invalidados en servidor (blacklist/timestamp)
- [ ] Solicitudes posteriores con mismo token fallan (401)
- [ ] Cookies borradas (httpOnly en prod)

**Curl**:
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer eyJ..." \
  -b cookies.txt
```

---

### TEST 3.8: Acceso sin Token
**Endpoint**: `GET /api/auth/me` (requiere auth)

**Request**:
```
(sin Authorization header)
```

**Expected Response** (401):
```json
{
  "ok": false,
  "error": "Token no proporcionado",
  "error_code": "NO_TOKEN"
}
```

**Checklist**:
- [ ] Status 401
- [ ] No retorna datos de usuario
- [ ] Mensaje claro

---

### TEST 3.9: Token Expirado
**Endpoint**: `GET /api/auth/me`

**Prerequisito**:
1. Obtener access_token
2. Esperar a que expire (1 hora en prod, 1 min en test)
3. O usar JWT expirado manualmente

**Expected Response** (401):
```json
{
  "ok": false,
  "error": "Token expirado",
  "error_code": "EXPIRED_TOKEN"
}
```

**Checklist**:
- [ ] Status 401
- [ ] Mensaje específico de expiración
- [ ] Cliente puede usar refresh_token para obtener nuevo access_token

---

### TEST 3.10: Obtener Usuario Actual
**Endpoint**: `GET /api/auth/me`

**Prerequisito**: Access token válido

**Expected Response** (200):
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "id_spm": "ADMIN001",
    "email": "admin@spm.local",
    "nombre": "Admin Test",
    "rol": "admin",
    "estado": "activo"
  }
}
```

**Checklist**:
- [ ] Status 200
- [ ] Datos correctos del usuario
- [ ] No retorna contraseña (CRÍTICO)
- [ ] Rol incluido

---

## 4. TESTING POR ROL

### TEST 4.1: Admin Acceso Completo
**Usuario**: admin@spm.local (ADMIN001)

**Endpoints a Probar**:
```
GET /api/admin/usuarios
GET /api/admin/materiales
GET /api/admin/presupuestos
POST /api/admin/usuarios (crear usuario)
```

**Checklist**:
- [ ] Todos retornan 200
- [ ] Datos completos sin restricciones
- [ ] Permisos de escritura activos

**Curl**:
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id_spm":"ADMIN001","password":"password123"}' | jq -r '.access_token')

curl -X GET http://localhost:5000/api/admin/usuarios \
  -H "Authorization: Bearer $TOKEN"
```

---

### TEST 4.2: Planificador Acceso Limitado
**Usuario**: planificador@spm.local (PLAN001)

**Endpoints que DEBEN funcionar**:
```
GET /api/planner/solicitudes
POST /api/planner/procesar
GET /api/mrp/alertas
```

**Endpoints que DEBEN fallar (403)**:
```
GET /api/admin/usuarios
POST /api/admin/usuarios
DELETE /api/admin/materiales/:id
```

**Checklist**:
- [ ] Rutas planificador retornan 200
- [ ] Rutas admin retornan 403
- [ ] Error message indica falta de permisos

---

### TEST 4.3: Aprobador Acceso Específico
**Usuario**: aprobador@spm.local (APRO001)

**Endpoints que DEBEN funcionar**:
```
GET /api/solicitudes?estado=submitted
POST /api/solicitudes/:id/aprobar
POST /api/solicitudes/:id/rechazar
GET /api/presupuestos
```

**Endpoints que DEBEN fallar (403)**:
```
POST /api/solicitudes (crear, rol usuario)
PUT /api/planner/procesar
GET /api/admin/usuarios
```

**Checklist**:
- [ ] Rutas aprobador funcionales
- [ ] Rutas protegidas retornan 403
- [ ] No puede crear solicitudes

---

### TEST 4.4: Usuario Regular Acceso Mínimo
**Usuario**: usuario@spm.local (USER001)

**Endpoints que DEBEN funcionar**:
```
GET /api/auth/me
POST /api/solicitudes (crear propia)
GET /api/mis-solicitudes
GET /api/materiales/catalogo
```

**Endpoints que DEBEN fallar (403)**:
```
GET /api/solicitudes/:id (de otro usuario)
POST /api/solicitudes/:id/aprobar
GET /api/admin/*
GET /api/planner/*
```

**Checklist**:
- [ ] Solo ve sus propias solicitudes
- [ ] No puede aprobar
- [ ] No puede acceder a admin
- [ ] Catálogo público accesible

---

## 5. VALIDACIONES DE SEGURIDAD

### TEST 5.1: CSRF Token Requerido (POST sin Bearer)
**Endpoint**: `POST /api/solicitudes` (crear solicitud)

**Request sin CSRF**:
```bash
curl -X POST http://localhost:5000/api/solicitudes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"descripcion":"Test"}'
```

**Expected Response** (403):
```json
{
  "ok": false,
  "error": "CSRF token missing or invalid"
}
```

**Checklist**:
- [ ] POST sin CSRF retorna 403
- [ ] GET /api/auth/login devuelve X-CSRF-Token header
- [ ] Incluyendo CSRF token funciona

---

### TEST 5.2: Bearer Token Bypass CSRF
**Endpoint**: `POST /api/solicitudes` con Bearer token

**Request con Bearer**:
```bash
curl -X POST http://localhost:5000/api/solicitudes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"descripcion":"Test"}'
```

**Expected**: CSRF no requerido si hay Bearer token

**Checklist**:
- [ ] Authorization: Bearer omite CSRF check
- [ ] API externos pueden usar sin cookie CSRF
- [ ] Cookies + CSRF aún requeridas en SPA

---

### TEST 5.3: Password Hashing (bcrypt)
**Procedimiento**:
1. Login exitoso
2. Inspeccionar BD: `SELECT password FROM usuarios WHERE id_spm='ADMIN001'`

**Expected**:
```
$2b$12$abcdefghijklmnopqrstuvwxyz... (bcrypt format)
```

**Checklist**:
- [ ] Password está hasheado (no plaintext)
- [ ] Formato bcrypt: `$2b$...`
- [ ] Hash diferente cada login (salt incluido)

---

### TEST 5.4: Tokens en Cookies vs LocalStorage
**Testing Frontend**:
1. Login en navegador
2. Abrir DevTools → Application → Cookies
3. Abrir DevTools → Application → LocalStorage

**Development Esperado**:
- [ ] access_token en LocalStorage
- [ ] refresh_token en LocalStorage
- [ ] CSRF token en LocalStorage
- [ ] O todos en httpOnly cookies (mejor)

**Production Esperado**:
- [ ] access_token en httpOnly cookie
- [ ] refresh_token en httpOnly cookie
- [ ] CSRF token accessible (no httpOnly)

---

## 6. TESTING FRONTEND

### TEST 6.1: Login UI Funcional
**URL**: http://localhost:5173/login

**Checklist**:
- [ ] Página carga sin errores (DevTools → Console)
- [ ] Campos: id_spm/email, password, botón login
- [ ] Validación en tiempo real
  - [ ] Email inválido muestra error
  - [ ] Password vacío desactiva botón
  - [ ] id_spm vacío desactiva botón
- [ ] Login válido redirige a dashboard
- [ ] Login inválido muestra error toast
- [ ] Loading spinner durante login

**Selenium Test** (pseudocódigo):
```python
def test_login_ui():
    driver.get("http://localhost:5173/login")
    id_input = driver.find_element(By.NAME, "id_spm")
    pass_input = driver.find_element(By.NAME, "password")
    button = driver.find_element(By.XPATH, "//button[contains(text(), 'Ingresar')]")

    id_input.send_keys("ADMIN001")
    pass_input.send_keys("password123")
    button.click()

    # Esperar redirección
    assert driver.current_url.contains("/dashboard")
    assert "Admin Test" in driver.page_source
```

---

### TEST 6.2: Logout UI Funcional
**Procedimiento**:
1. Login exitoso
2. Hacer clic en menú usuario (esquina superior derecha)
3. Hacer clic en "Cerrar Sesión"

**Expected**:
- [ ] Sesión cerrada
- [ ] Redirige a /login
- [ ] Tokens borrados del storage
- [ ] Página anterior no accesible (redirige a login)

---

### TEST 6.3: Token Refresh Automático
**Procedimiento**:
1. Login y guardar access_token
2. Esperar a que acceso_token expire (o simular expiration)
3. Hacer request a endpoint protegido
4. Verificar que se usa refresh_token para obtener nuevo access_token
5. Request se reintenta con nuevo token

**Checklist**:
- [ ] Interceptor de axios maneja 401
- [ ] Intenta refresh_token automáticamente
- [ ] Reintenta request original
- [ ] Usuario no sabe que sucedió (transparente)

---

### TEST 6.4: Roles Visibles en UI
**Procedimiento**:
1. Login como admin
2. Verificar sidebar muestra opciones admin
3. Logout
4. Login como planificador
5. Verificar sidebar muestra opciones planificador
6. Logout
7. Login como usuario
8. Verificar sidebar NO muestra opciones admin

**Checklist**:
- [ ] Sidebar dinámico según rol
- [ ] Links admin solo para admin
- [ ] Links planner solo para planificador
- [ ] Usuarios no ven rutas protegidas

---

## 7. TESTING CON PYTEST

**Archivo**: `tests/integration/test_auth.py`

```python
import pytest
from flask import json

class TestAuthLogin:
    def test_login_with_id_spm(self, client):
        response = client.post('/api/auth/login',
            json={'id_spm': 'ADMIN001', 'password': 'password123'})
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] == True
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['rol'] == 'admin'

    def test_login_with_email(self, client):
        response = client.post('/api/auth/login',
            json={'email': 'admin@spm.local', 'password': 'password123'})
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['email'] == 'admin@spm.local'

    def test_login_invalid_password(self, client):
        response = client.post('/api/auth/login',
            json={'id_spm': 'ADMIN001', 'password': 'WRONG'})
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data
        assert 'password' not in data

    def test_rate_limiting(self, client):
        for i in range(10):
            response = client.post('/api/auth/login',
                json={'id_spm': 'ADMIN001', 'password': 'WRONG'})
            assert response.status_code == 401

        # 11th attempt should be rate limited
        response = client.post('/api/auth/login',
            json={'id_spm': 'ADMIN001', 'password': 'WRONG'})
        assert response.status_code == 429
```

**Ejecutar**:
```bash
pytest tests/integration/test_auth.py -v --tb=short
```

---

## 8. RESULTADOS Y DOCUMENTACIÓN

### Archivos de Output
- `test_auth_curl.log` - Outputs de curl testing
- `test_auth_pytest.log` - Outputs de pytest
- `test_auth_browser.screenshots/` - Screenshots de UI testing

### Resumen Esperado

| Test | Status | Notas |
|------|--------|-------|
| Login ID_SPM | ✓ | 200 OK, tokens válidos |
| Login Email | ✓ | 200 OK, funciona alternativa |
| Login Inválido | ✓ | 401, no revela usuario |
| Rate Limiting | ✓ | 429 después 10 intentos |
| Refresh Token | ✓ | Nuevo access_token |
| Logout | ✓ | Tokens invalidados |
| Admin Role | ✓ | Acceso a /api/admin/* |
| Planner Role | ✓ | Acceso a /api/planner/* |
| User Role | ✓ | Acceso limitado |
| CSRF Token | ✓ | Requerido en forms |
| UI Login | ✓ | Carga, valida, redirige |
| Password Hash | ✓ | bcrypt, no plaintext |

---

## 9. SIGUIENTES PASOS

Si FASE 1 ✓ Completa:
→ Proceder a **FASE 2: Dashboards por Rol** (6 horas)

Si hay fallos:
→ Documentar en `BUG_TRACKER.md`
→ Crear issues/tickets
→ Remediar antes de continuar

---

*Documento generado para testing exhaustivo SPM v3.0*
