# 🏗️ SPM Architecture

**Versión:** 1.0
**Última actualización:** 1 de noviembre de 2025

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Componentes Principales](#componentes-principales)
3. [Flujo de Datos](#flujo-de-datos)
4. [API Architecture](#api-architecture)
5. [Base de Datos](#base-de-datos)
6. [Seguridad](#seguridad)
7. [Escalabilidad](#escalabilidad)
8. [Diagrama de Arquitectura](#diagrama-de-arquitectura)

---

## 📐 Descripción General

SPM es una aplicación monolítica moderna con:
- **Backend:** Flask + SQLAlchemy (Python 3.11/3.12)
- **Frontend:** Vite + JavaScript ES6+
- **Base de Datos:** SQLite (dev) / PostgreSQL (prod)
- **Autenticación:** JWT con roles
- **Despliegue:** Docker + Docker Compose

```
┌─────────────────────────────────────────────────┐
│                    Cliente Browser               │
│           (Vite Dev Server / Prod Build)        │
└────────────────────┬────────────────────────────┘
                     │ HTTP/REST
┌─────────────────────▼────────────────────────────┐
│         Proxy (Nginx / Reverse Proxy)            │
│              (Puerto 5000)                       │
└─────────────────────┬────────────────────────────┘
                      │
┌──────────────────────▼─────────────────────────────┐
│        Flask Application + Gunicorn               │
│   (Multiple workers para concurrencia)            │
└──────────────────────┬─────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼──┐    ┌─────▼─────┐    ┌──▼────┐
   │ Cache │    │ Database  │    │Files  │
   │(Redis)│    │(SQLite/   │    │Upload │
   └───────┘    │PostgreSQL)│    └───────┘
                └───────────┘
```

---

## 🧩 Componentes Principales

### 1. Backend (Flask)

#### Estructura
```
src/backend/
├── app.py                 # Aplicación Flask principal
├── auth.py               # Autenticación JWT
├── api/                  # API endpoints
├── routes/               # Rutas por módulo
│   ├── solicitudes.py   # Solicitudes
│   ├── materiales.py    # Materiales
│   ├── almacenes.py     # Almacenes
│   └── reportes.py      # Reportes
├── models/               # SQLAlchemy models
│   ├── usuario.py
│   ├── solicitud.py
│   ├── material.py
│   └── almacen.py
├── services/             # Lógica de negocio
│   ├── solicitud_service.py
│   ├── material_service.py
│   └── reporte_service.py
├── middleware/           # Middleware personalizado
├── core/                 # Utilidades
├── data/                 # Data inicial (CSV)
└── static/              # Archivos estáticos
```

#### Flujo Request-Response

```
Request HTTP
    ↓
Middleware (CORS, Auth)
    ↓
Route Handler
    ↓
Service Layer (Business Logic)
    ↓
Model/Database
    ↓
Response JSON
```

### 2. Frontend (Vite + JavaScript)

#### Estructura
```
src/frontend/
├── index.html                # Entrada principal
├── app.js                    # Inicialización
├── boot.js                   # Configuración
├── components/               # Componentes reutilizables
│   ├── modal.js
│   ├── form.js
│   └── table.js
├── pages/                    # Páginas principales
│   ├── admin/
│   ├── coordinador/
│   └── usuario/
├── ui/                       # Componentes UI
├── utils/                    # Utilidades
│   ├── api.js              # API client
│   ├── auth.js             # Auth helpers
│   └── validators.js       # Validaciones
├── styles.css               # Estilos globales
└── assets/                  # Imágenes, iconos
```

#### Stack de Frontend

- **Build:** Vite (HMR en dev, optimizado en prod)
- **APIs:** Fetch API con wrapper custom
- **Estado:** Local storage + Session storage
- **Validación:** Pydantic en backend + JS en frontend
- **Testing:** Jest + jsdom

### 3. Base de Datos

#### Modelos Principales

```
Usuario
├── id (PK)
├── email (UNIQUE)
├── contraseña (bcrypt)
├── rol (admin/coordinador/usuario)
├── estado (activo/inactivo)
└── timestamps

Solicitud
├── id (PK)
├── usuario_id (FK)
├── estado (pendiente/aprobada/rechazada)
├── items []
├── total
└── timestamps

Material
├── id (PK)
├── nombre
├── categoría
├── precio
├── stock
└── almacenes

Almacén
├── id (PK)
├── nombre
├── ubicación
├── capacidad
└── materiales
```

---

## 🔄 Flujo de Datos

### Crear Solicitud (Happy Path)

```
1. Usuario completa form en UI
   ↓
2. Frontend valida datos (JS)
   ↓
3. POST /api/solicitudes
   ├─ Middleware: verificar JWT
   ├─ Validar Pydantic schema
   └─ Guardar en DB
   ↓
4. Backend retorna solicitud creada
   ↓
5. Frontend actualiza UI
   ↓
6. Notificación a coordinador (async)
```

### Aprobar Solicitud (Con Flujo de Aprobación)

```
1. Coordinador ve solicitud pendiente
   ↓
2. Verificar disponibilidad de materiales
   ↓
3. PUT /api/solicitudes/{id}/aprobar
   ├─ Validar permisos
   ├─ Actualizar estado
   ├─ Disminuir stock
   └─ Crear notificación
   ↓
4. Email a usuario (async)
```

---

## 🔌 API Architecture

### Convención REST

```
GET    /api/solicitudes              # Listar
GET    /api/solicitudes/{id}         # Obtener
POST   /api/solicitudes              # Crear
PUT    /api/solicitudes/{id}         # Actualizar
DELETE /api/solicitudes/{id}         # Eliminar
POST   /api/solicitudes/{id}/aprobar # Acción específica
```

### Response Standard

```json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa",
  "timestamp": "2025-11-01T10:30:00Z"
}
```

### Error Handling

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validación fallida",
    "details": { ... }
  },
  "timestamp": "2025-11-01T10:30:00Z"
}
```

### Autenticación JWT

```
Header: Authorization: Bearer <token>

Token payload:
{
  "sub": "usuario_id",
  "email": "user@example.com",
  "rol": "coordinador",
  "exp": 1234567890
}
```

---

## 💾 Base de Datos

### Schema Relacional

```sql
-- Usuarios
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  contraseña VARCHAR(255) NOT NULL,  -- bcrypt hash
  rol VARCHAR(50) NOT NULL,
  estado VARCHAR(20) DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Solicitudes
CREATE TABLE solicitudes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  estado VARCHAR(50) DEFAULT 'pendiente',
  total DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items de Solicitud
CREATE TABLE solicitud_items (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
  material_id INTEGER NOT NULL REFERENCES materiales(id),
  cantidad INTEGER NOT NULL,
  precio_unitario DECIMAL(10,2),
  subtotal DECIMAL(10,2)
);

-- Materiales
CREATE TABLE materiales (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  categoría VARCHAR(100),
  precio DECIMAL(10,2),
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Almacenes
CREATE TABLE almacenes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  ubicación VARCHAR(255),
  capacidad INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Índices (Optimización)

```sql
CREATE INDEX idx_solicitudes_usuario_id ON solicitudes(usuario_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_solicitudes_created_at ON solicitudes(created_at);
CREATE INDEX idx_materiales_nombre ON materiales(nombre);
CREATE INDEX idx_usuarios_email ON usuarios(email);
```

---

## 🔐 Seguridad

### Autenticación
- JWT con RS256 (o HS256 con secret fuerte)
- Refresh tokens (implementar)
- Expiración: 24 horas (configurable)

### Autorización
- RBAC (Role-Based Access Control)
- Roles: admin, coordinador, usuario
- Validación en cada endpoint

### Validación de Datos
- Pydantic schemas en backend
- Validación en frontend
- Sanitización de inputs

### Protecciones
- CORS configurado
- CSRF tokens para formularios
- Rate limiting (implement if needed)
- SQL injection prevention (SQLAlchemy ORM)

---

## 📈 Escalabilidad

### Horizontal Scaling
```yaml
# Multiple workers
gunicorn -w 4 --worker-class sync 'app:create_app()'

# Load balancer (Nginx)
upstream backend {
  server app1:5000;
  server app2:5000;
  server app3:5000;
}

server {
  location / {
    proxy_pass http://backend;
  }
}
```

### Caché (Futuro)
```python
# Redis para session/caché
redis://localhost:6379

# Caché de materiales
@cache.cached(timeout=300)
def get_materiales():
    return Material.query.all()
```

### Base de Datos
- PostgreSQL para producción
- Conexiones pooling (min: 5, max: 20)
- Índices optimizados
- Replicación master-slave (futuro)

---

## 🔧 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER / CLIENT                        │
│          (Vite Dev / Optimized Prod Bundle)                 │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST (HTTPS in prod)
                     │
┌────────────────────▼────────────────────────────────────────┐
│           REVERSE PROXY / API GATEWAY                       │
│  (Nginx, Load Balancer, SSL Termination)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──┐  ┌─────────▼──────┐  ┌─────▼────┐
│App 1 │  │    App 2       │  │  App N   │
│Port  │  │    Port        │  │  Port    │
│5000  │  │    5000        │  │  5000    │
└───┬──┘  └────────┬───────┘  └────┬─────┘
    │              │               │
    │   (Gunicorn workers)        │
    │              │               │
    └──────────────┼───────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
    ┌───▼──┐   ┌──▼───┐  ┌──▼────┐
    │Cache │   │  DB  │  │Files  │
    │Redis │   │ Prod │  │Store  │
    │      │   │PG/   │  │ S3/   │
    └──────┘   │SQLite│  │Local  │
               └──────┘  └───────┘
```

---

## 🚀 Performance Optimization

### Frontend
- Code splitting con Vite
- Lazy loading de páginas
- Minificación de CSS/JS
- Compresión de imágenes

### Backend
- Query optimization (eager loading)
- Response caching
- Batch operations
- Async tasks (Celery - future)

### Database
- Índices estratégicos
- Query analysis (EXPLAIN)
- Connection pooling
- Regular maintenance (VACUUM, ANALYZE)

---

## 🛡️ Formato Estándar de Errores (Fase 1)

Todos los endpoints REST siguen un formato JSON consistente para errores y respuestas negativas:

### Estructura
```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "Mensaje legible para usuario",
    "trace_id": "uuid-único-para-seguimiento",
    "details": { /* campos adicionales opcionales */ }
  }
}
```

### Códigos de Error Estándar
| Código | HTTP | Significado |
|--------|------|------------|
| `validation_error` | 400 | Error en validación de entrada |
| `forbidden` | 403 | Acceso denegado (permisos insuficientes) |
| `not_found` | 404 | Recurso no encontrado |
| `conflict` | 409 | Conflicto (ej. estado inválido) |
| `internal_error` | 500 | Error del servidor |

### Ejemplos
**Validación fallida:**
```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Error validando campo 'decision_tipo': valor inválido",
    "trace_id": "550e8400-e29b-41d4-a716-446655440000",
    "details": { "field": "decision_tipo", "reason": "valor inválido" }
  }
}
```

**No encontrado:**
```json
{
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "Solicitud con ID 123 no encontrada",
    "trace_id": "550e8400-e29b-41d4-a716-446655440001",
    "details": { "resource": "Solicitud", "id": 123 }
  }
}
```

### Implementación en Backend
Usar helpers en `backend_v2/core/errors.py`:
- `api_error(code, message, details, status, trace_id)`
- `error_not_found(resource, id)`
- `error_forbidden(reason)`
- `error_validation(field, reason)`
- `error_internal(detail)`
- `error_conflict(reason)`

---

## 📋 Tratamiento de Solicitudes (Flujo 3 Pasos)

### Convenciones del Payload PASO 3 (Guardar Tratamiento)

**Campo Explícito `decision_tipo`**

A partir de Fase 1, el payload de `POST /planificador/solicitudes/<id>/guardar-tratamiento` incluye campo explícito `decision_tipo` para claridad y robustez:

```json
{
  "decisiones": [
    {
      "item_idx": 0,
      "decision_tipo": "stock",  // Valores: stock, proveedor, equivalencia, mix
      "opcion_id": "stock_interno",
      "id_proveedor": "PROV006",
      "codigo_material": "MAT001",
      "cantidad_aprobada": 10,
      "plazo_dias": 1,
      "precio_unitario_final": 50.0,
      "compatibilidad_pct": 100,
      "observaciones": "Entrega desde almacén local"
    }
  ],
  "usuario_id": "user_123"
}
```

**Validación Servidor**
- `decision_tipo` debe ser uno de: `stock`, `proveedor`, `equivalencia`, `mix`.
- `item_idx` debe estar en rango [0, items_count).
- `cantidad_aprobada` > 0.
- Si validación falla, retorna error con `code: "validation_error"`.

---

## 🔒 Gestión CSRF Token (Fase 1)

### Centralización en Frontend

Todos los requests que mutaciones (`POST`, `PATCH`, `DELETE`) deben usar el servicio centralizado `services/csrf.js`:

```javascript
import { ensureCsrfToken, refreshCsrfToken } from '../../services/csrf'

// Antes de cualquier POST/PATCH/DELETE
await ensureCsrfToken()  // Obtiene y cachea token si no existe o expiró
```

**Características:**
- Token autoexpiración: Se renueva automáticamente después de 55 minutos.
- Reintento automático: Si falla con 403, renueva token y reintenta una vez.
- Logout limpia token: `clearCsrfToken()` debe llamarse al desloguear.

**Uso en Componentes**
```javascript
const [loading, setLoading] = useState(false)

const handleSubmit = async () => {
  setLoading(true)
  try {
    await ensureCsrfToken()
    const response = await api.post('/endpoint', data)
    // Procesar respuesta
  } catch (err) {
    // Manejar error
  } finally {
    setLoading(false)
  }
}
```

---

**Última revisión:** 23 de noviembre de 2025
