# CLAUDE.md

Guia para Claude Code cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2026-02-16

## Comandos de Desarrollo

```bash
# Backend (Flask)
python wsgi.py                    # http://localhost:5000

# Frontend (Vite + React)
cd frontend && npm run dev        # http://localhost:5173

# Tests
python -m pytest tests/           # Backend (1,200+ tests)
cd frontend && npm test           # Frontend (582 tests, 26 archivos)

# Build produccion
cd frontend && npm run build

# Seed datos de prueba
python scripts/seed_dev_data.py          # Genera datos
python scripts/seed_dev_data.py --clean  # Limpia y regenera
```

## Arquitectura

```
Frontend (React+Vite:5173) --API REST--> Backend (Flask:5000) ---> SQLite (dev) / PostgreSQL (prod)
```

### Estructura clave

```
backend/
├── routes/          # 67 modulos (3 packages: ai/, planner/, solicitudes/)
├── services/        # 49 servicios (patron: routes/X.py -> services/X_service.py)
├── core/            # Auth, DB, cache, security, schemas, FSM, WebSocket
├── agent/           # ML/IA: forecast/, rag/, proactive/, tools/
└── migrations/      # 83 migraciones (dual SQLite/PostgreSQL)

frontend/src/
├── pages/           # 139 paginas
├── components/      # 145 componentes (ui/, materials/, Planner/, Dashboard/, SCM/)
├── hooks/           # 22 custom hooks
├── services/        # 18 servicios API (api.js es el base con Axios+CSRF+refresh)
├── store/           # 8 stores Zustand
└── context/         # i18n provider (500+ keys)
```

### Patrones clave

- **Route -> Service**: Cada `routes/X.py` tiene su `services/X_service.py`
- **3 packages grandes**: `routes/ai/`, `routes/planner/`, `routes/solicitudes/` (divididos en sub-modulos)
- **Blueprints**: Registro centralizado en `core/blueprints.py` (53 blueprints)
- **DB access**: `core/db.py` con `get_db_connection()`, `is_using_postgresql()`
- **Auth**: `g.user` via `AuthMiddleware`, decoradores en `core/roles.py`
- **Cache**: L1 memory + L2 Redis en `core/cache.py`
- **FSM solicitudes**: draft -> submitted -> approved/rejected -> processing -> dispatched -> closed

## Bases de Datos

| BD | Proposito |
|----|-----------|
| `data/spm.db` | Usuarios, solicitudes, auth, mensajes |
| `data/sap_data.db` | Stock, consumo historico, pedidos SAP |
| `data/equivalentes.db` | Equivalencias materiales SAP |
| `data/catalogo_materiales.db` | Catalogo completo materiales |

**Produccion**: PostgreSQL con 83 migraciones. Tablas en espanol (desde migracion 025).
**Reimportar SAP**: `python scripts/migrate_excel_to_db.py`

## Roles

| Rol | Permisos |
|-----|----------|
| **admin** | Acceso total |
| **coordinador** | Aprobar/rechazar |
| **usuario** | Crear solicitudes |
| **planner** | Planificar aprobadas |
| **jefe** | Supervision |
| **Aprobador de Presupuesto** | Aprobar BURs |

## Convenciones de Codigo

### Python (backend)
- snake_case, Blueprints por dominio, Pydantic schemas en `core/schemas.py`
- Linting: Ruff (config en `pyproject.toml`, ignores E402/E721)
- Hook auto-format: Ruff se ejecuta automaticamente al editar `backend/**/*.py`

### JavaScript/React (frontend)
- camelCase variables, PascalCase componentes
- **Usar sistema i18n para TODOS los textos visibles**: `const { t } = useI18n(); t('clave', 'fallback')`
- Prefijos i18n por modulo: `nav_`, `dash_`, `common_`, `materials_`, `admin_`, `planner_`, etc.
- Linting: ESLint (`.eslintrc.cjs`)
- Stores: Zustand con selectores granulares

### Estilos
- Solo light mode, CSS Variables (`frontend/src/index.css`), Tailwind

## Reglas de Negocio

- Solicitudes requieren minimo 1 item con cantidad > 0
- Presupuesto validado por centro/sector antes de aprobar (L1 <$200K, L2 <$1M, ADMIN >$1M)
- Materiales identificados por codigo SAP unico
- JWT: access token 1h + refresh token 7d

## Tests

- **Backend**: 1,200+ tests, cobertura 29% (threshold enforced), timeout 60s
- **Frontend**: 582 tests en 26 archivos, 0 failures, CI bloqueante
- **CI excluye** tests pre-existentes rotos (ver `.github/workflows/ci.yml`)

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Backend tests+lint(Ruff) + Frontend build+lint(ESLint)+tests
- **Deploy** (`.github/workflows/deploy-production.yml`): rsync VPS, pg_dump backup pre-deploy, rollback automatico, health check

## Instrucciones para Claude

1. Explicar el plan antes de modificar codigo
2. Cambios pequenos y controlados
3. Usar siempre el sistema i18n para textos de UI
4. No hardcodear textos en espanol/ingles
5. No modificar estructura de BD sin crear migracion
6. Verificar que el build compile sin errores
7. Usar `repository_legacy.py` o `repository/` modular para acceso a datos

### Seguridad (Obligatorio)

- **Siempre validar ownership** antes de acceder/modificar datos de usuario
- **Usar SQL parametrizado** — nunca f-strings para queries
- **Validar inputs** con `@validate_json()` o schemas Pydantic
- **No exponer errores internos** — mensajes genericos al cliente
- **Agregar rate limiting** a endpoints sensibles
- **Revisar permisos por rol** antes de operaciones criticas
- **Proteger endpoints nuevos** con `@require_auth` o `@require_admin`

### Usuario de Prueba

```
Usuario: 1 (Manu) / Password: password123
Roles: Admin, Aprobador_presupuestos, Aprobador_solicitudes, Planificador
```

## Documentacion

- `docs/ARQUITECTURA_SPM_2_0.md` — Arquitectura completa
- `docs/DEPLOYMENT.md` — Guia de despliegue
- `docs/AUDIT.md` — Auditoria seguridad y calidad
- `docs/guides/QUICK_REFERENCE_BD.md` — Referencia BD
