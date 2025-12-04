# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPM (Sistema de Solicitudes de Materiales) is a material request management system with a Flask backend and Vite + JavaScript frontend. The application includes a Supply Chain Planning Engine (SCPE) with sophisticated optimization algorithms.

**Tech Stack:**
- Backend: Flask 3.1.2 + SQLAlchemy 2.0.44 + Python 3.11/3.12
- Frontend: Vite 5.0 + Vanilla JavaScript (ES6+)
- Database: SQLite (dev) / PostgreSQL (prod)
- Auth: JWT tokens with bcrypt
- Testing: pytest (backend) + Jest (frontend)

## Common Development Commands

### Starting the Application

**Backend (Flask):**
```bash
# Activate virtual environment
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/macOS

# Start Flask development server
python run_backend.py
# OR
python src/backend/app.py

# Server runs on http://localhost:5000
```

**Frontend (Vite):**
```bash
# Install dependencies (if needed)
npm install

# Start Vite dev server with HMR
npm run dev
# Runs on http://localhost:5173 with proxy to :5000

# Build for production
npm run build

# Preview production build
npm run preview
```

**Docker:**
```bash
# Build and start
docker compose up --build

# Start without rebuild
docker compose up

# Stop
docker compose down
```

### Database Management

```bash
# Initialize/seed database
python scripts/utilities/seed_db.py

# Inspect database tables
python scripts/utilities/inspect_tables.py

# Check database schema
python scripts/utilities/check_schema.py

# Analyze database structure
python scripts/utilities/analizar_db.py

# Check specific users
python scripts/utilities/check_users.py
```

### Running Tests

```bash
# Backend tests (pytest)
pytest tests/ -v                    # All tests
pytest tests/unit/ -v               # Unit tests only
pytest tests/integration/ -v        # Integration tests only
pytest tests/e2e/ -v                # End-to-end tests only
pytest tests/ --cov=src --cov-report=html  # With coverage

# Frontend tests (Jest)
npm test                            # Run all tests
npm run test:watch                  # Watch mode
```

### Linting and Formatting

```bash
# Python (configured in pyproject.toml)
black src/ --line-length 100       # Format code
ruff check src/ --fix              # Lint and fix

# JavaScript
npm run lint                       # Lint frontend code
npm run format                     # Format frontend code
```

## Architecture Overview

### Monolithic Application with Clear Separation

The application follows a modular monolithic architecture with clear separation between frontend and backend:

```
Browser → Vite Dev Server (5173) → Proxy → Flask API (5000) → SQLite DB
```

### Backend Structure (`src/backend/`)

**Key architectural points:**

1. **app.py**: Main Flask application factory. Handles frontend file serving through multiple search directories (static/, frontend/pages/, frontend/components/, etc.)

2. **Route organization**: Routes are organized by feature/domain in `routes/`:
   - `auth_routes.py` - Authentication (login, logout, token refresh)
   - `solicitudes.py` - Material request CRUD
   - `materiales.py` - Material catalog management
   - `catalogos.py` - Master data catalogs (warehouses, centers)
   - `planner_routes.py` - Supply chain planning engine endpoints
   - `presupuestos.py` - Budget management
   - `usuarios.py` - User management

3. **Service layer**: Business logic lives in `services/`:
   - `auth/` - JWT utilities, authentication helpers
   - `uploads/` - File handling utilities
   - `db/` - Database pagination and utilities
   - `data_providers.py` - Data provider interfaces

4. **Models**: SQLAlchemy models in `models/`:
   - Each model file represents a database table
   - `roles.py` defines RBAC roles (admin, coordinador, usuario)
   - `catalog_schema.py` contains catalog-related schemas

5. **Middleware**: Custom middleware in `middleware/`:
   - `auth_helpers.py` - Token verification decorators
   - `decorators.py` - Custom decorators (role_required, etc.)
   - `ratelimit.py` - Rate limiting
   - `csrf.py` - CSRF protection

6. **Configuration**: Centralized in `core/config.py`:
   - Settings class with environment variable loading
   - Paths for DB, uploads, logs
   - `ensure_dirs()` creates necessary directories

### Frontend Structure (`src/frontend/`)

**Key architectural points:**

1. **No framework**: Pure JavaScript with ES6 modules
2. **Component-based**: Reusable components in `components/`
3. **Page-specific logic**: `pages/` contains HTML + accompanying JS
4. **Utilities**: `utils/` has API client, validators, formatters
5. **UI components**: `ui/` contains reusable UI patterns
6. **Vite bundling**: Configured in `vite.config.js` with API proxy

### Supply Chain Planning Engine (`src/planner/`)

This is a sophisticated optimization engine with:

1. **Models** (`models/`):
   - `items.py` - Item master with BOM, equivalents, compliance
   - `inventory.py` - Inventory lots with traceability, QC status
   - `lead_times.py` - Lead time tracking
   - `capacity.py` - Capacity constraints
   - `sourcing.py` - Sourcing strategies

2. **Algorithms** (`algorithms/`):
   - `reserve_dynamic.py` - Dynamic reservation
   - `purchase_multicriterion.py` - Multi-criteria purchase optimization
   - `release_marginal_cost.py` - Marginal cost analysis
   - `disassembly_knapsack.py` - Disassembly knapsack problem
   - `substitutes_graph.py` - Substitute item graph
   - `transfer_tdabc.py` - Time-driven ABC transfer
   - `ctp_johnson.py` - Capable-to-promise using Johnson's algorithm
   - `expedite_probability.py` - Expediting probability analysis

3. **Optimization** (`optimization/`):
   - `formulation.py` - Problem formulation
   - `constraint_builder.py` - Constraint building
   - `solver_manager.py` - Solver interface
   - `model_analyzer.py` - Solution analysis

4. **Decision Tree** (`decision_tree/`):
   - `decision_tree.py` - Decision tree structure
   - `gate_manager.py` - Gate/checkpoint management
   - `execution_engine.py` - Tree execution
   - `path_evaluator.py` - Path evaluation

5. **Filters** (`filters/`):
   - `technical_legal.py` - Technical and legal compliance filters

6. **Scoring** (`scoring/`):
   - `base_scorer.py` - Base scoring interface
   - `criticality_scorer.py` - Material criticality scoring
   - `feature_extractor.py` - Feature extraction for ML

### Database Schema

Key tables:
- `usuarios` - Users with role-based access (admin/coordinador/usuario)
- `solicitudes` - Material requests with approval workflow
- `solicitud_items` - Line items in requests
- `materiales` - Material master catalog
- `almacenes` - Warehouse/storage locations
- `centros` - Cost/work centers
- `presupuestos` - Budget tracking

The database uses SQLite for development and can be migrated to PostgreSQL for production. Migrations live in `database/migrations/`.

## Important Development Notes

### Authentication Flow

1. User logs in via `/api/auth/login`
2. Backend returns JWT token (24h expiry)
3. Frontend stores token in localStorage
4. All API requests include `Authorization: Bearer <token>` header
5. Backend middleware (`auth_helpers.py`) verifies token
6. Token contains user_id, email, rol

### Development Mode Features

- `AUTH_BYPASS=1` in `.env` bypasses authentication (dev only)
- Flask runs with `debug=True` for hot reload
- Vite provides HMR for instant frontend updates
- CORS is configured for cross-origin requests

### Frontend Serving Strategy

The Flask app serves frontend files through a complex search mechanism (see `_serve_frontend()` in `app.py`):
1. Searches static/ first
2. Then frontend/ and subdirectories
3. Falls back to recursive search with rglob
4. Handles both dev (loose files) and prod (bundled) scenarios

This is important when debugging 404s for static files.

### File Uploads

- Uploads go to `SPM_UPLOAD_DIR` (default: ./uploads)
- Handled by `solicitudes_archivos.py` route
- File utilities in `services/uploads/file_utils.py`
- Security: validate file extensions, sanitize filenames

### Testing Strategy

**Backend:**
- Unit tests: Test individual functions/classes
- Integration tests: Test API endpoints with test client
- E2E tests: Test complete workflows
- Use fixtures defined in `tests/integration/conftest.py`
- Auth utilities in `tests/integration/auth_utils.py`

**Frontend:**
- Jest with jsdom environment
- Tests in `tests/` directory (if any, not many currently)
- Setup in `tests/setup-jest.js`

### Planning Engine Integration

The planning engine is accessed via `/api/planner/*` endpoints in `planner_routes.py`. It's a complex system with:
- Inventory optimization algorithms
- Multi-criteria decision making
- Constraint satisfaction
- Traceability and compliance checking

When working with the planner:
1. Understand the domain models in `models/`
2. Each algorithm in `algorithms/` is self-contained
3. Tests exist for critical algorithms (test_*.py files)
4. README files in planner subdirectories explain the subsystems

### Environment Variables

Key variables (see `.env`):
- `SPM_SECRET_KEY` - JWT signing key (MUST change in production)
- `SPM_DB_PATH` - Database location (default: ./spm.db)
- `SPM_UPLOAD_DIR` - Upload directory (default: ./uploads)
- `SPM_LOG_PATH` - Log file location
- `AUTH_BYPASS` - Bypass auth for development (0=off, 1=on)
- `FLASK_ENV` - Flask environment (development/production)
- `DEBUG` - Debug mode (0/1)
- `HOST` - Server host (default: 0.0.0.0)
- `PORT` - Server port (default: 5000)

### Code Style

**Python:**
- PEP 8 compliant
- Line length: 100 characters (configured in pyproject.toml)
- Use type hints where appropriate
- Black for formatting, Ruff for linting

**JavaScript:**
- ES6+ syntax
- Modular imports/exports
- Consistent naming (camelCase for variables, PascalCase for classes)
- Spanish for user-facing strings, English for code

## Common Issues and Solutions

### Database locked error
SQLite can have concurrency issues. Solution:
```bash
rm spm.db
python scripts/utilities/seed_db.py
```

### Port already in use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :5000
kill -9 <PID>
```

### Frontend not loading
1. Check Vite dev server is running (npm run dev)
2. Check Flask is running (python run_backend.py)
3. Verify proxy config in vite.config.js
4. Check browser console for errors

### JWT token expired
Tokens expire after 24 hours. User must log in again. Frontend should handle 401 responses by redirecting to login.

### Import errors in Python
Ensure you're running from the repository root and the virtual environment is activated. The project uses absolute imports from `src/`.

## Documentation

Extensive documentation exists in `docs/`:
- `docs/guides/` - User and developer guides
- `docs/api.md` - API documentation
- `docs/STRUCTURE.md` - Detailed structure documentation
- `docs/CHANGELOG.md` - Change history
- `docs/archive/` - Historical documentation

The planner has its own README files:
- `src/planner/README_MODELS.md` - Data models
- `src/planner/filters/README_TECHNICAL_LEGAL.md` - Compliance filters
- `src/planner/scoring/README_SCORING.md` - Scoring system
- `src/planner/optimization/README_OPTIMIZATION.md` - Optimization engine
- `src/planner/decision_tree/README_DECISION_TREE.md` - Decision trees

## 🧠 Instrucciones para Claude Code

Por favor, responde **siempre en español técnico**, con explicaciones completas y detalladas.
Actúa como un **mentor senior en desarrollo full stack**, especializado en:
- Python (Flask, SQLAlchemy, optimización de algoritmos)
- JavaScript (Vite, ES6+, frontend modular)
- Integración entre backend y frontend

### Reglas de respuesta:
1. Explica el “por qué” detrás de cada solución, no solo el “cómo”.
2. Si detectas un error en el código o en la lógica, **corrígelo proactivamente** y explica el motivo.
3. Usa lenguaje claro y didáctico (sin traducciones literales ni respuestas parciales).
4. Prefiere ejemplos prácticos y comentados.
5. Mantén el idioma español, excepto en nombres de código, comandos o rutas.
6. Sé preciso: si algo no puede verificarse con certeza, indícalo explícitamente.

### Contexto de entorno
- Sistema operativo: Windows
- Editor: VSCode
- Extensiones instaladas: GitHub Copilot, Gemini Code Assist
- Proyecto actual: SPMv1.0 (Flask + Vite)
