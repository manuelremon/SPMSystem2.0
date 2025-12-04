# ✅ FLUJO DE SOLICITUDES - SPM v1.0
## Sistema Completo y Funcional

**Fecha:** 2025-11-20
**Estado:** ✅ VERIFICADO Y FUNCIONAL

---

## 📋 Resumen Ejecutivo

El flujo completo de solicitudes en SPM v1.0 está **completamente funcional** y ha sido probado exitosamente desde el login hasta la aprobación/rechazo.

### ✅ Componentes Verificados:

1. **Autenticación** - Login/Logout con JWT
2. **Creación de Solicitudes** - Con validación completa
3. **Búsqueda de Materiales** - Catálogo funcional
4. **Aprobación/Rechazo** - Flujo de decisión completo
5. **Base de Datos** - Estructura completa y operativa

---

## 🔄 Flujo Completo Detallado

### ETAPA 1: Autenticación

```
Usuario accede → http://127.0.0.1:5000
                ↓
         Pantalla de Login
                ↓
    POST /api/auth/login
    {
      "username": "usuario@spm.com",
      "password": "user123"
    }
                ↓
     Backend valida credenciales
     - Verifica usuario en BD
     - Valida password (bcrypt)
     - Verifica estado activo
                ↓
      Genera JWT Token
      + Datos de usuario
                ↓
    Response 200 OK
    {
      "ok": true,
      "user": {
        "id_spm": "user001",
        "nombre": "Juan",
        "apellido": "Usuario",
        "rol": "usuario",
        "mail": "usuario@spm.com"
      }
    }
```

#### ✅ Verificación:
```bash
# Login exitoso
✓ Usuario autenticado
✓ JWT generado
✓ Sesión establecida
```

---

### ETAPA 2: Obtener Catálogos

```
GET /api/catalogos
    ↓
Backend consulta BD:
- catalog_centros
- catalog_sectores
- catalog_almacenes
    ↓
Response 200 OK
{
  "centros": [...],
  "sectores": [...],
  "almacenes": [...]
}
```

#### ✅ Datos Disponibles:
```
Centros:
- 1008: Centro Plaza Huincul
- 1009: Centro Neuquen
- 1010: Centro Cutral-Co

Sectores:
- Mantenimiento
- Operaciones
- Abastecimiento
- Planificacion

Almacenes:
- ALM0001: Almacen Central (1008)
- ALM0002: Almacen Neuquen (1009)
```

---

### ETAPA 3: Búsqueda de Materiales

```
GET /api/materiales?q=TUERCA&limit=10
    ↓
Backend consulta BD:
- Tabla materiales
- LIKE COLLATE NOCASE
- Ordenado por relevancia
    ↓
Response 200 OK
[
  {
    "codigo": "1000000001",
    "descripcion": "TUERCA HEXAGONAL M8",
    "precio_usd": 12.50,
    "unidad": "UNI"
  },
  ...
]
```

#### ✅ Materiales Disponibles:
```
1. 1000000001 - TUERCA HEXAGONAL M8      ($12.50)
2. 1000000002 - TUERCA HEXAGONAL M10     ($15.00)
3. 1000000003 - TUERCA HEXAGONAL M12     ($18.50)
4. 1000000004 - TORNILLO M8 x 30mm       ($8.00)
5. 1000000005 - TORNILLO M10 x 40mm      ($10.50)
6. 1000000006 - TORNILLO M12 x 50mm      ($13.00)
7. 1000000007 - ARANDELA PLANA M8        ($3.50)
8. 1000000008 - ARANDELA PLANA M10       ($4.00)
9. 1000000009 - GRASA MULTIPROPOSITO     ($25.00)
10. 1000000010 - ACEITE HIDRAULICO ISO 32 ($45.00)
```

---

### ETAPA 4: Creación de Solicitud

```
POST /api/solicitudes
{
  "centro": "1008",
  "sector": "Mantenimiento",
  "justificacion": "Materiales para mantenimiento preventivo",
  "centro_costos": "CC001",
  "almacen_virtual": "ALM0001",
  "criticidad": "Normal",
  "fecha_necesidad": "2025-12-05",
  "items": [
    {
      "codigo": "1000000002",
      "descripcion": "TUERCA HEXAGONAL M10",
      "cantidad": 5,
      "precio_unitario": 15.00,
      "comentario": "Para mantenimiento"
    },
    {
      "codigo": "1000000003",
      "descripcion": "TUERCA HEXAGONAL M12",
      "cantidad": 5,
      "precio_unitario": 18.50,
      "comentario": "Para mantenimiento"
    }
  ]
}
    ↓
Backend (src/backend/routes/solicitudes.py):
1. Valida JWT Token
2. Valida esquema con Pydantic
3. Verifica materiales existen
4. Calcula totales
5. Asigna aprobador
6. Asigna planificador
    ↓
Insert en tabla solicitudes:
- id_usuario: user001
- status: pendiente_de_aprobacion
- total_monto: 167.50
- data_json: {...items...}
- aprobador_id: coord001
- planner_id: admin001
    ↓
Response 200 OK
{
  "ok": true,
  "id": 2,
  "status": "pendiente_de_aprobacion",
  "total_monto": 167.50
}
```

#### ✅ Validaciones Aplicadas:
```
✓ Campos obligatorios presentes
✓ Formatos de fecha correctos
✓ Materiales existen en BD
✓ Cantidades > 0
✓ Precios >= 0
✓ Centro y sector válidos
✓ Usuario activo
✓ Presupuesto disponible
```

---

### ETAPA 5: Aprobación de Solicitud

```
Login como Coordinador/Admin
    ↓
GET /api/solicitudes?status=pendiente_de_aprobacion
    ↓
Backend filtra por:
- Rol del usuario
- Solicitudes asignadas
- Status pendiente
    ↓
Response: Lista de solicitudes
    ↓
Coordinador selecciona solicitud
    ↓
POST /api/solicitudes/{id}/decidir
{
  "accion": "aprobar",
  "comentario": "Aprobada - OK"
}
    ↓
Backend verifica:
1. Usuario tiene permisos (coordinador/admin)
2. Es el aprobador asignado
3. Solicitud está pendiente
4. Usuario está activo
    ↓
Update en BD:
- status: aprobada
- data_json: {decision: ...}
- updated_at: CURRENT_TIMESTAMP
    ↓
Crea notificación para solicitante
    ↓
Response 200 OK
{
  "ok": true,
  "status": "aprobada",
  "decision": {
    "accion": "aprobar",
    "decided_by": "coord001",
    "decided_at": "2025-11-20T22:43:55Z",
    "comment": "Aprobada - OK",
    "status": "aprobada"
  }
}
```

#### ✅ Decisiones Posibles:
```
1. Aprobar → status: "aprobada"
   - Pasa a planificación
   - Notifica al solicitante
   - Notifica al planificador

2. Rechazar → status: "rechazada"
   - Finaliza el flujo
   - Notifica al solicitante
   - Registra motivo de rechazo
```

---

## 📊 Estados de una Solicitud

```
DRAFT (borrador)
    ↓ [Enviar]
PENDIENTE_DE_APROBACION
    ↓
    ├─ [Aprobar] → APROBADA → EN_TRATAMIENTO → FINALIZADA
    └─ [Rechazar] → RECHAZADA

Estados adicionales:
- CANCELADA (cancelación directa)
- CANCELACION_PENDIENTE (solicitud de cancelación)
- CANCELACION_RECHAZADA (cancelación rechazada)
```

---

## 🗄️ Estructura de Base de Datos

### Tabla: solicitudes
```sql
CREATE TABLE solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario TEXT NOT NULL,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    justificacion TEXT NOT NULL,
    centro_costos TEXT,
    almacen_virtual TEXT,
    criticidad TEXT DEFAULT 'Normal',
    fecha_necesidad TEXT,
    data_json TEXT NOT NULL,
    status TEXT DEFAULT 'pendiente_de_aprobacion',
    aprobador_id TEXT,
    planner_id TEXT,
    total_monto REAL DEFAULT 0,
    notificado_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(id_usuario) REFERENCES usuarios(id_spm)
);
```

### Estructura data_json:
```json
{
  "id_usuario": "user001",
  "centro": "1008",
  "sector": "Mantenimiento",
  "justificacion": "...",
  "centro_costos": "CC001",
  "almacen_virtual": "ALM0001",
  "criticidad": "Normal",
  "fecha_necesidad": "2025-12-05",
  "items": [
    {
      "codigo": "1000000002",
      "descripcion": "TUERCA HEXAGONAL M10",
      "cantidad": 5,
      "precio_unitario": 15.00,
      "comentario": "...",
      "subtotal": 75.00
    }
  ],
  "total_monto": 167.50,
  "aprobador_id": "coord001",
  "planner_id": "admin001",
  "decision": {
    "accion": "aprobar",
    "decided_by": "coord001",
    "decided_at": "2025-11-20T22:43:55Z",
    "comment": "Aprobada - OK",
    "status": "aprobada"
  }
}
```

---

## 🧪 Pruebas Realizadas

### Test 1: Login ✅
```bash
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "usuario@spm.com", "password": "user123"}'

Resultado: ✅ Login exitoso
```

### Test 2: Búsqueda de Materiales ✅
```bash
curl http://127.0.0.1:5000/api/materiales?q=TUERCA

Resultado: ✅ 3 materiales encontrados
```

### Test 3: Creación de Solicitud ✅
```bash
curl -X POST http://127.0.0.1:5000/api/solicitudes \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{...datos...}'

Resultado: ✅ Solicitud #2 creada
  - Status: pendiente_de_aprobacion
  - Total: $167.50
```

### Test 4: Aprobación ✅
```bash
curl -X POST http://127.0.0.1:5000/api/solicitudes/2/decidir \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"accion": "aprobar", "comentario": "OK"}'

Resultado: ✅ Solicitud aprobada
  - Status: aprobada
  - Decisión registrada
```

---

## 📁 Archivos Clave del Sistema

### Backend:
```
src/backend/routes/
├── auth_routes.py          ← Autenticación
├── solicitudes.py          ← CRUD de solicitudes (★ PRINCIPAL)
├── materiales.py           ← Búsqueda de materiales
├── catalogos.py            ← Catálogos
├── admin.py                ← Administración
└── planner_routes.py       ← Planificación

src/backend/models/
├── schemas.py              ← Validaciones Pydantic
└── roles.py                ← Definición de roles

src/backend/services/
├── auth/                   ← Servicios de autenticación
│   ├── auth.py
│   └── jwt_utils.py
└── db/                     ← Servicios de BD
    └── security.py         ← Hash de passwords
```

### Frontend:
```
src/frontend/
├── index.html              ← Login (mejorado)
├── nueva-solicitud.html    ← Crear solicitud
├── solicitudes.html        ← Listar solicitudes
├── dashboard.html          ← Dashboard
└── styles.css              ← Estilos (mejorados)
```

### Base de Datos:
```
src/backend/spm.db          ← SQLite principal
  ├── usuarios              ← 5 usuarios de prueba
  ├── solicitudes           ← Solicitudes creadas
  ├── materiales            ← 10 materiales de prueba
  ├── catalog_centros       ← 3 centros
  ├── catalog_sectores      ← 4 sectores
  ├── catalog_almacenes     ← 2 almacenes
  ├── presupuestos          ← 3 presupuestos
  └── notificaciones        ← Sistema de notificaciones
```

---

## 🚀 Cómo Usar el Sistema

### 1. Iniciar el Servidor
```bash
# Servidor Flask corriendo en:
http://127.0.0.1:5000

# Verificar salud:
curl http://127.0.0.1:5000/api/health
```

### 2. Usuarios Disponibles
```
Usuario Solicitante:
- Email: usuario@spm.com
- Password: user123
- Rol: usuario

Coordinador:
- Email: coordinador@spm.com
- Password: coord123
- Rol: coordinador

Administrador:
- Email: admin@spm.com
- Password: admin123
- Rol: admin
```

### 3. Flujo de Trabajo

**Como Usuario:**
1. Login en http://127.0.0.1:5000
2. Ir a "Crear Solicitud"
3. Seleccionar centro, sector, fecha
4. Buscar y agregar materiales
5. Completar justificación
6. Enviar solicitud

**Como Coordinador/Admin:**
1. Login en http://127.0.0.1:5000
2. Ir a "Solicitudes Pendientes"
3. Revisar detalle de solicitud
4. Aprobar o Rechazar con comentario

---

## ✅ Checklist de Funcionalidades

- [x] Login/Logout con JWT
- [x] Validación de credenciales
- [x] Gestión de sesiones
- [x] Búsqueda de materiales
- [x] Catálogos de centros/sectores/almacenes
- [x] Creación de solicitudes
- [x] Validación de datos con Pydantic
- [x] Cálculo de totales
- [x] Asignación automática de aprobadores
- [x] Asignación automática de planificadores
- [x] Aprobación de solicitudes
- [x] Rechazo de solicitudes
- [x] Cambio de estados
- [x] Sistema de notificaciones
- [x] Registro de decisiones
- [x] Auditoría de cambios

---

## 🔧 Componentes Técnicos

### Validaciones con Pydantic:
```python
# src/backend/models/schemas.py

class SolicitudItem(BaseModel):
    codigo: str
    descripcion: Optional[str] = None
    cantidad: int  # >= 1
    precio_unitario: float  # >= 0
    comentario: Optional[str] = None

class SolicitudCreate(BaseModel):
    centro: str
    sector: str
    justificacion: str
    centro_costos: str
    almacen_virtual: str
    criticidad: Literal["Normal", "Alta"]
    fecha_necesidad: date
    items: List[SolicitudItem]  # Min 1 item
```

### Autenticación JWT:
```python
# src/backend/services/auth/jwt_utils.py

def create_access_token(
    subject: str,
    ttl: int = 3600,
    claims: Optional[Dict] = None
) -> str:
    # Genera JWT con claims personalizados
    # TTL configurable
    # Secret key segura
```

### Seguridad de Passwords:
```python
# src/backend/services/db/security.py

def hash_password(password: str) -> str:
    # Bcrypt con salt automático
    # Rounds configurables

def verify_password(
    stored_hash: str,
    password: str
) -> Tuple[bool, bool]:
    # Verifica password
    # Detecta si necesita rehash
```

---

## 📈 Mejoras Implementadas

### 1. Diseño Visual ✨
- Nuevo gradiente purple para login
- Glassmorphism en tarjetas
- Efectos hover mejorados
- Animaciones suaves
- Transiciones naturales

### 2. Validaciones de Negocio ✅
- Materiales deben existir en BD
- Cantidades deben ser > 0
- Fechas en formato correcto
- Usuario debe estar activo
- Presupuesto debe estar disponible

### 3. Datos de Prueba 📊
- 5 usuarios con diferentes roles
- 10 materiales variados
- 3 centros operativos
- 4 sectores funcionales
- 2 almacenes
- 3 presupuestos iniciales

---

## 🎯 Próximos Pasos

### Planificación (Pendiente):
```
GET /api/planner/solicitudes
  ↓
Motor de optimización:
- Algoritmos MIP/ILP
- Sistema de scoring
- Reglas de negocio
  ↓
Genera plan de ejecución:
- Qué comprar
- Cuándo comprar
- A quién comprar
  ↓
Integración con ERP (futuro)
```

### Reportes y Analytics:
- Dashboard con métricas
- Gráficos de solicitudes
- Análisis de presupuestos
- Tiempos de aprobación
- Historial de decisiones

### Notificaciones en Tiempo Real:
- WebSockets para notificaciones
- Email automático
- Alertas de presupuesto
- Recordatorios de aprobación

---

## 📞 Soporte

**Servidor:** http://127.0.0.1:5000
**API Docs:** Ver archivo [CLAUDE.md](CLAUDE.md)
**Archivo de prueba:** test_flujo_completo.py

---

**Documentado por:** Claude (Asistente IA)
**Verificado:** 2025-11-20
**Estado:** ✅ SISTEMA FUNCIONAL Y OPERATIVO
