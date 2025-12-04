# 🎯 QUICK_DEV_REFERENCE.md - Referencia Rápida para Desarrollo

**¿Dónde ir cuando necesitas...?**

---

## 📍 Encontrar Cosas

### "¿Dónde está la ruta para crear solicitudes?"
→ `src/backend/routes/solicitudes.py` línea 748+
→ Búsqueda de función: `@bp.route("/solicitudes", methods=["POST"])`

### "¿Dónde está el esquema de solicitud?"
→ `src/backend/models/schemas.py`
→ Clases: `SolicitudBase`, `SolicitudCreate`, `SolicitudItem`

### "¿Dónde está la lógica de validación del frontend?"
→ `src/frontend/app.js` línea 1+
→ Función: `validateForm()`, `validateSolicitud()`

### "¿Dónde está la configuración de CORS?"
→ `src/backend/app.py` línea 200+
→ Variable de entorno: `SPM_CORS_ORIGINS`

### "¿Dónde está la autenticación JWT?"
→ `src/backend/services/auth/jwt_utils.py`
→ Funciones: `verify_token()`, `create_access_token()`

### "¿Dónde está la inicialización de BD?"
→ `src/backend/core/init_db.py`
→ Función: `build_db(force=False)`

### "¿Dónde está la búsqueda de materiales?"
→ `src/backend/routes/materiales.py`
→ Función: `search_materiales()`

### "¿Dónde está el panel de admin?"
→ `src/backend/routes/admin.py`
→ Múltiples rutas: `/admin/*`

### "¿Dónde está el módulo de planificación?"
→ `src/planner/` (carpeta completa)
→ Entrada: `src/backend/routes/planner_routes.py`

### "¿Dónde está el HTML de una página?"
→ `src/frontend/[nombre].html`
→ Ej: `src/frontend/nueva-solicitud.html`

---

## 🔧 Tareas Comunes

### Agregar Nueva Ruta API

**1. Crear handler en routes:**
```python
# src/backend/routes/mi_ruta.py
from flask import Blueprint, request, jsonify
from ..services.auth.jwt_utils import verify_token

bp = Blueprint("mi_ruta", __name__, url_prefix="/api")

@bp.get("/mi-endpoint")
def mi_endpoint():
    uid = verify_token()  # Validar auth
    if not uid:
        return {"error": "No autenticado"}, 401
    return {"ok": True, "data": "..."}, 200
```

**2. Registrar en app.py:**
```python
# src/backend/app.py
from .routes.mi_ruta import bp as mi_ruta_bp

app.register_blueprint(mi_ruta_bp)
```

**3. Crear esquema Pydantic (si aplica):**
```python
# src/backend/models/schemas.py
class MiRequest(BaseModel):
    campo1: str
    campo2: int
    campo3: Optional[str] = None
```

**4. Llamar desde frontend:**
```javascript
// src/frontend/app.js
const response = await fetch('/api/mi-endpoint', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${state.auth.token}` }
});
const data = await response.json();
```

### Agregar Campo a Solicitud

**1. Actualizar esquema:**
```python
# src/backend/models/schemas.py
class SolicitudBase(BaseModel):
    # ... campos existentes ...
    mi_nuevo_campo: str  # Agregar aquí
```

**2. Migrar BD:**
```python
# src/backend/core/init_db.py en _apply_migrations()
con.execute("ALTER TABLE solicitudes ADD COLUMN mi_nuevo_campo TEXT")
```

**3. Actualizar frontend:**
```html
<!-- src/frontend/nueva-solicitud.html -->
<input type="text" name="mi_nuevo_campo" required />
```

### Debuggear Una Solicitud Fallida

**1. Ver logs del servidor:**
```bash
# Terminal del backend
# Los logs aparecen directamente en el output
# O revisa: src/backend/core/logs/app.log
```

**2. Ver red en DevTools:**
```javascript
// Abre DevTools (F12) → Network tab
// Busca la request fallida
// Lee respuesta en el tab "Response"
```

**3. Consultar BD directamente:**
```bash
sqlite3 src/backend/core/data/spm.db
SELECT * FROM solicitudes WHERE id = 1;
```

**4. Validar token JWT:**
```javascript
// Copiar token de localStorage
const token = localStorage.getItem('access_token');
// Decodificar en jwt.io
```

### Agregar Nueva Tabla a BD

**1. Crear migración:**
```python
# src/backend/core/init_db.py
def _apply_migrations(con):
    if not _table_exists(con, "mi_nueva_tabla"):
        con.execute("""
            CREATE TABLE mi_nueva_tabla (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
```

**2. Resetear BD (solo desarrollo):**
```python
from src.backend.core.init_db import build_db
build_db(force=True)
```

### Cambiar Estilos

**1. Localizar clase en HTML:**
```html
<!-- src/frontend/styles.css -->
.btn { /* Estilos del botón */ }
.btn.pri { /* Botón primario */ }
.btn.sec { /* Botón secundario */ }
```

**2. Modificar estilos:**
```css
/* Cambiar color primario */
:root {
  --color-primary: #007bff;  /* Cambiar este valor */
}
```

---

## 🚨 Errores Comunes y Soluciones

### "401 Unauthorized"
**Causa:** Token expirado o no enviado
**Solución:**
```javascript
// Verificar que el token se envía correctamente
const headers = {
  'Authorization': `Bearer ${state.auth.token}`,
  'Content-Type': 'application/json'
};
```

### "CORS Error"
**Causa:** Frontend llamando a origen no permitido
**Solución:**
1. Verifica que el frontend esté en puerto 5173
2. Backend debe tener `SPM_CORS_ORIGINS=http://127.0.0.1:5173`
3. Reinicia backend

### "404 Not Found"
**Causa:** Ruta no registrada
**Solución:**
1. Verifica que el blueprint esté registrado en `app.py`
2. Verifica que el prefijo de URL sea correcto
3. Reinicia backend

### "422 Unprocessable Entity"
**Causa:** Validación Pydantic falló
**Solución:**
1. Verifica que los datos cumplan el esquema
2. Lee el mensaje de error en response
3. Ajusta los datos enviados

### "ModuleNotFoundError"
**Causa:** Archivo Python no existe o está en rama incorrecta
**Solución:**
```bash
pip install -r requirements.txt
python -c "import src.backend.app"  # Verificar importación
```

### Frontend no actualiza
**Causa:** Cache del navegador
**Solución:**
```javascript
// Limpiar cache
// DevTools → Application → Cache Storage → Clear
// O: Hard refresh (Ctrl+Shift+R)
```

---

## 📊 Estados de Solicitud

```
CREACIÓN:
┌──────────────────────────────────┐
│ draft (borrador)                 │
│ - Usuario puede editar           │
│ - No se envía a aprobadores      │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ submitted / pendiente_de_aprobacion
│ - En cola de aprobación          │
│ - Admin/Coordinador puede ver    │
└──────────────┬───────────────────┘
               ↓
        ┌──────┴─────┐
        ↓            ↓
┌──────────────┐ ┌──────────┐
│ aprobado     │ │ rechazado│
│ approved     │ │ rejected │
└──────┬───────┘ └──────────┘
       ↓
┌──────────────────────────────────┐
│ processing / planificacion       │
│ - Planificador asignado          │
│ - En proceso de entrega          │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ dispatched / despachado          │
│ - En ruta/entrega                │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ closed / cerrado                 │
│ - Entregado                      │
│ - Completado                     │
└──────────────────────────────────┘

CANCELACIÓN:
draft → cancelled
submitted → cancelled
```

---

## 🔑 Roles y Permisos

```
ADMIN:
- Crear/editar/eliminar usuarios
- Crear/editar/eliminar materiales
- Ver todas las solicitudes
- Aprobar/rechazar solicitudes
- Crear presupuestos

COORDINADOR:
- Ver solicitudes de su sector
- Aprobar/rechazar en algunos casos
- Generar reportes
- Gestionar almacenes

USUARIO:
- Crear solicitudes
- Ver sus propias solicitudes
- Editar sus solicitudes (borrador)
- Ver materiales
```

---

## 🧪 Testing

### Crear Usuario de Prueba

```sql
-- En DB
INSERT INTO usuarios VALUES (
  'test_user',
  'Test',
  'User',
  'usuario',
  'Posición',
  'Sector',
  'test@ejemplo.com',
  '555-1234',
  'ID_YPF',
  'Jefe',
  'Gerente',
  'Gerente',
  '["1008"]',  -- JSON con centros
  'activo',
  '...',  -- bcrypt hash
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

### Crear Solicitud de Prueba

```bash
# Ejecutar script de test
python tests/test_create_solicitud.py
```

---

## 📝 Logs Útiles

```bash
# Logs del backend
tail -f src/backend/core/logs/app.log

# Logs del navegador (DevTools Console)
# F12 → Console tab
```

**Niveles de log:**
```
DEBUG   → Información de debug
INFO    → Información general
WARNING → Advertencias
ERROR   → Errores
```

---

## 🚀 Deployment

**Ver archivo completo:** `DEPLOYMENT.md`

**Pasos rápidos:**
```bash
1. pip install -r requirements.txt
2. npm install && npm run build
3. python wsgi.py --prod
4. Navegar a http://localhost:5000
```

---

## 📖 Documentación Completa

- **CLAUDE.md** → Documentación completa del codebase
- **api.md** → Referencia API REST
- **ARCHITECTURE.md** → Arquitectura detallada
- **DEPLOYMENT.md** → Guía de deployment
- **docs/guides/** → Múltiples guías específicas

---

**Última actualización:** 8 de noviembre de 2025
