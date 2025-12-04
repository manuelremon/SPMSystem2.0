# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de Desarrollo

```bash
# Backend (Flask) - Terminal 1
python wsgi.py                    # Inicia en http://localhost:5000

# Frontend (Vite + React) - Terminal 2
cd frontend && npm run dev        # Inicia en http://localhost:5173

# Tests
pytest tests/                     # Backend tests
cd frontend && npm test           # Frontend tests

# Build producción
cd frontend && npm run build
```

## Arquitectura

```
Frontend (React + Vite)     Backend (Flask)           Base de Datos
http://localhost:5173       http://localhost:5000     SQLite
        │                           │                      │
        └─── API REST (/api/*) ─────┴──────────────────────┘
```

### Estructura Principal

```
SPMv2.0/
├── backend_v2/              # API Flask
│   ├── routes/              # Endpoints (auth, solicitudes, materiales, admin, planner)
│   ├── services/            # Lógica de negocio
│   ├── models/schemas.py    # Validación Pydantic
│   └── core/                # Config, DB, init_db.py
├── frontend/src/
│   ├── pages/               # Páginas React
│   ├── components/ui/       # Componentes reutilizables
│   ├── context/             # Auth, i18n providers
│   └── services/            # API clients
└── tests/
```

### Flujo de Solicitudes

Estados: `draft` → `submitted` → `approved/rejected` → `processing` → `dispatched` → `closed`

### Roles

- **admin**: Acceso total
- **coordinador**: Aprobar/rechazar solicitudes
- **usuario**: Crear solicitudes
- **planner**: Planificar solicitudes aprobadas

## Convenciones de Código

### Python (backend)
- snake_case para variables/funciones
- Validación con Pydantic en `models/schemas.py`
- Blueprints por dominio en `routes/`

### JavaScript/React (frontend)
- camelCase para variables, PascalCase para componentes
- Componentes UI en `components/ui/`
- Usar sistema i18n para TODOS los textos visibles

### Sistema i18n (Internacionalización)
- Ubicación: `frontend/src/context/i18n.jsx`
- API: `const { t } = useI18n(); t('clave', 'fallback')`
- Convención de claves: `prefijo_nombre` (ej: `nav_solicitudes`, `materials_buscar`)
- Prefijos: `nav_`, `dash_`, `common_`, `materials_`, `admin_`, `planner_`

### Sistema de Diseño
- Estilos: Tailwind CSS + CSS Variables (Linear Dark SAAS)
- Variables en `frontend/src/index.css`:
  - Fondos: `--bg`, `--surface`, `--card`
  - Textos: `--fg`, `--fg-muted`, `--fg-subtle`
  - Acentos: `--primary` (#FB923C naranja), `--accent` (#22D3EE cyan)
  - Estados: `--success`, `--warning`, `--danger`, `--info`

### Estilos de Estados y Criticidad
- **Archivo de configuración**: `frontend/src/utils/styleConfig.js`
- **Componentes**:
  - `StatusBadge`: Muestra estado con icono + texto coloreado
  - `Button`: Botones con borde de color (transparente → hover rellena)
- **Helpers disponibles**:
  - `getEstadoConfig(estado)`: Retorna {color, icon, label}
  - `getCriticidadConfig(criticidad)`: Retorna {color, icon, label}
- **Estilo visual**: Icono a la izquierda + texto coloreado (sin fondo)

### Estilos de Tablas (DataTable)
**Estilo visual**: Cuadrícula con bordes verticales y horizontales entre celdas.

**Alineación de columnas** - Aplicar consistentemente en TODAS las tablas:

| Columna | Alineación | Clase Tailwind | Ejemplo |
|---------|------------|----------------|---------|
| Títulos (headers) | Centro | `text-center` | - |
| ID | Centro | `text-center` | "1", "20", "102" |
| Estado | Centro | `text-center` | Icono + texto |
| Criticidad | Centro | `text-center` | Icono + texto |
| Items (cantidad) | Centro | `text-center` | "1", "10", "32" |
| Centro | Centro | `text-center` | "1008" |
| Almacén | Centro | `text-center` | "ALM001" |
| Sector | Centro | `text-center` | "Compras" |
| Solicitante | Centro | `text-center` | "Juan Pérez" |
| Planificador | Centro | `text-center` | "María García" |
| Fechas | Centro | `text-center` | "04/12/24" |
| Acciones | Centro | `text-center` | Botones |
| **Monto** | **Derecha** | `text-right` | "USD 1.234,56" |
| **Asunto/Justificación** | **Izquierda** | `text-left` | Texto largo... |

**Variantes de botones** (con borde de color):
- `primary`: Naranja (acción principal)
- `success`: Verde (aprobar)
- `danger`: Rojo (rechazar/eliminar)
- `info`: Azul (información)
- `warning`: Amarillo (precaución)
- `accent`: Cyan (destacar)
- `ghost`: Sin borde (acción sutil)
- `primary-solid`: Fondo sólido naranja (casos especiales)

## Reglas de Negocio

- Solicitudes requieren mínimo 1 item con cantidad > 0
- Presupuesto se valida por centro/sector antes de aprobar
- Materiales identificados por código SAP único
- Autenticación JWT (access token 1h + refresh token)

## Convenciones de Fechas y Moneda

- **Zona horaria**: America/Argentina/Buenos_Aires (UTC-03:00)
- **Almacenamiento**: UTC, formato ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`)
- **Frontend**: Convierte UTC → hora local para mostrar
- **Moneda**: USD con 2 decimales

## Instrucciones para Claude

1. Explicar el plan antes de modificar código
2. Cambios pequeños y controlados
3. Usar siempre el sistema i18n para textos de UI
4. Mantener consistencia con el sistema de diseño (CSS variables + Tailwind)
5. No hardcodear textos en español/inglés
6. No modificar estructura de BD sin crear migración
7. Verificar que el build compile sin errores

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `backend_v2/routes/solicitudes.py` | CRUD de solicitudes (endpoint principal) |
| `backend_v2/models/schemas.py` | Esquemas Pydantic para validación |
| `backend_v2/core/init_db.py` | Estructura de BD y datos iniciales |
| `frontend/src/context/i18n.jsx` | Sistema de traducciones |
| `frontend/src/index.css` | Variables CSS del sistema de diseño |
| `frontend/src/pages/*.jsx` | Páginas principales de la aplicación |

## Documentación Adicional

- `PROJECT_INFO.md` - Reglas detalladas para IA
- `docs/` - Documentación técnica
- `DEPLOYMENT.md` - Guía de despliegue
