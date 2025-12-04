# USUARIOS DE PRUEBA - SPM v1.0

Estos son los usuarios de prueba creados para testing de la aplicación.

## URL de Acceso
- **Frontend:** http://localhost:5173 (Vite - cuando esté corriendo)
- **Backend:** http://localhost:5000 (Flask - actualmente corriendo)
- **API:** http://localhost:5000/api

## Usuarios Disponibles

### 1. Administrador Principal
- **Email:** admin@spm.com
- **Contraseña:** admin123
- **Rol:** admin
- **ID SPM:** admin001
- **Nombre:** Admin Principal
- **Posición:** Administrador del Sistema
- **Sector:** IT
- **Centros:** ["1008", "1009", "1010"]

### 2. Coordinador de Operaciones
- **Email:** coordinador@spm.com
- **Contraseña:** coord123
- **Rol:** coordinador
- **ID SPM:** coord001
- **Nombre:** Carlos Coordinador
- **Posición:** Coordinador de Operaciones
- **Sector:** Operaciones
- **Centros:** ["1008", "1009"]
- **Jefe:** admin001

### 3. Planificador de Materiales
- **Email:** planificador@spm.com
- **Contraseña:** planner123
- **Rol:** coordinador
- **ID SPM:** planner001
- **Nombre:** Pedro Planificador
- **Posición:** Planificador de Materiales
- **Sector:** Planificación
- **Centros:** ["1008", "1009", "1010"]
- **Jefe:** admin001

### 4. Usuario Regular - Mantenimiento
- **Email:** usuario@spm.com
- **Contraseña:** user123
- **Rol:** usuario
- **ID SPM:** user001
- **Nombre:** Juan Usuario
- **Posición:** Técnico de Mantenimiento
- **Sector:** Mantenimiento
- **Centros:** ["1008"]
- **Jefe:** coord001
- **Gerente1:** coord001
- **Gerente2:** admin001

### 5. Usuario Regular - Abastecimiento
- **Email:** maria.lopez@spm.com
- **Contraseña:** maria123
- **Rol:** usuario
- **ID SPM:** user002
- **Nombre:** Maria Lopez
- **Posición:** Analista de Compras
- **Sector:** Abastecimiento
- **Centros:** ["1008", "1009"]
- **Jefe:** coord001
- **Gerente1:** coord001
- **Gerente2:** admin001

## Permisos por Rol

### Admin
- Acceso completo al sistema
- Gestión de usuarios
- Gestión de materiales
- Gestión de catálogos
- Visualización de todas las solicitudes
- Aprobación/rechazo de solicitudes
- Acceso a reportes y estadísticas

### Coordinador
- Gestión de solicitudes
- Aprobación de solicitudes de su sector
- Visualización de solicitudes asignadas
- Planificación de materiales
- Acceso a reportes básicos

### Usuario
- Crear solicitudes
- Ver sus propias solicitudes
- Editar solicitudes en borrador
- Búsqueda de materiales
- Ver catálogos

## Pruebas de Login

### Usando curl:
```bash
# Login como admin
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@spm.com", "password": "admin123"}'

# Login como coordinador
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "coordinador@spm.com", "password": "coord123"}'

# Login como usuario
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "usuario@spm.com", "password": "user123"}'
```

### Respuesta exitosa:
```json
{
  "ok": true,
  "user": {
    "id_spm": "admin001",
    "nombre": "Admin",
    "apellido": "Principal",
    "rol": "admin",
    "mail": "admin@spm.com",
    "sector": "IT",
    "posicion": "Administrador del Sistema",
    "centros": ["1008", "1009", "1010"]
  }
}
```

## Base de Datos

- **Ubicación:** `src/backend/spm.db`
- **Backup:** `src/backend/core/data/spm.db`
- **Tamaño:** ~240KB
- **Usuarios creados:** 5

## Notas Importantes

1. **Contraseñas hasheadas con bcrypt** - Seguras para producción
2. **Todos los usuarios están activos** - `estado_registro = 'activo'`
3. **Los centros están en formato JSON** - Se normalizan automáticamente en el backend
4. **Login acepta múltiples campos:**
   - `username` o `id` o `usuario` → puede ser id_spm, mail o nombre
   - `password` o `contrasena` → contraseña del usuario

## Para Resetear Usuarios

Si necesitas resetear los usuarios a su estado inicial:

```bash
# Activar entorno virtual
. .venv/Scripts/activate

# Reinicializar BD
python -c "
import sys
sys.path.insert(0, '.')
from src.backend.core.init_db import build_db
build_db(force=True)
"

# Copiar a ubicación correcta
cp src/backend/core/data/spm.db src/backend/spm.db
```

---

**Creado:** 2025-11-20
**Última actualización:** 2025-11-20
