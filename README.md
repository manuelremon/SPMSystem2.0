# SPM v2.0 - Sistema de Planificacion de Materiales

[![CI Pipeline](https://github.com/MANUE/SPMSystem2.0/actions/workflows/ci.yml/badge.svg)](https://github.com/MANUE/SPMSystem2.0/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://reactjs.org/)

Sistema web profesional para gestionar solicitudes de materiales, construido con **Flask** (backend) + **React + Vite** (frontend).

**Version:** 2.1 | **Estado:** Produccion | **Ultima actualizacion:** 19 Enero 2026

---

## Metricas del Proyecto

| Area | Valor |
|------|-------|
| **Backend** | 168 archivos Python, ~65,000 lineas |
| **Frontend** | 75 paginas, 77 componentes, 11 hooks |
| **Endpoints API** | 200+ endpoints en 29 modulos |
| **Tests** | 1,220+ tests (55 archivos) |
| **Base de Datos** | SQLite (dev) + PostgreSQL (prod) |

---

## Descripcion General

SPM es un sistema integral de gestion de solicitudes de materiales disenado para optimizar procesos administrativos en empresas con multiples centros y almacenes.

**Caracteristicas principales:**
- Autenticacion segura basada en roles (Admin, Coordinador, Usuario, Planner, Jefe)
- Flujo de aprobacion completo con notificaciones push
- Gestion de materiales y almacenes multiubicacion
- Integracion con datos SAP (stock, consumo historico, pedidos)
- Equivalencias de materiales automatizadas
- Dashboard de KPIs y metricas SLA
- Motor MRP con alertas de reposicion
- Pronosticos de demanda con ML (ARIMA, Prophet, XGBoost)
- Asistente IA con Vertex AI
- WebSockets para actualizaciones en tiempo real
- Interfaz moderna con soporte i18n (ES/EN)
- API REST documentada con Swagger

---

## Requisitos Previos

| Componente | Version | Proposito |
|-----------|---------|----------|
| Python | 3.11+ | Backend Flask |
| Node.js | 18+ | Frontend React |
| SQLite | Incluido | Base de datos desarrollo |
| Git | 2.0+ | Control de versiones |

---

## Inicio Rapido

### Instalacion Local

```bash
# Clonar repositorio
git clone https://github.com/manuelremon/SPMSystem2.0.git
cd SPMSystem2.0

# Crear y activar entorno virtual
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Instalar dependencias backend
pip install -r requirements.txt

# Instalar dependencias frontend
cd frontend && npm install && cd ..

# Iniciar backend (Terminal 1)
python wsgi.py

# Iniciar frontend (Terminal 2)
cd frontend && npm run dev
```

**URLs de acceso:**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`

---

## Estructura del Proyecto

```
SPMv2.0/
├── backend/                    # API Flask (165 archivos, ~65K lineas)
│   ├── routes/                 # Endpoints REST (28 modulos)
│   ├── services/               # Logica de negocio (11 servicios)
│   ├── core/                   # Config, DB, Auth, CORS, SPA, Cache
│   ├── agent/                  # Modulo IA/ML (35+ archivos)
│   │   ├── pipelines/forecast/ # Modelos de pronostico
│   │   └── rag/                # Retrieval Augmented Generation
│   └── migrations/             # Migraciones de BD
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/pages/              # 75 paginas
│   ├── src/components/         # 80 componentes
│   │   ├── ui/                 # Sistema de diseno
│   │   ├── forecast/           # Graficos y visualizaciones
│   │   └── Planner/            # Wizard de planificacion
│   ├── src/hooks/              # 12 custom hooks
│   ├── src/context/            # Providers (Auth, i18n)
│   ├── src/services/           # 11 clientes API
│   └── src/store/              # 3 stores Zustand
│
├── data/                       # Bases de datos SQLite
├── infra/                      # Docker, nginx, Cloud Run
├── scripts/                    # Scripts de utilidad
├── tests/                      # Tests (54 archivos, 1,210+ tests)
│   ├── unit/                   # Tests unitarios
│   ├── integration/            # Tests de integracion
│   └── e2e/                    # Tests end-to-end
├── docs/                       # Documentacion tecnica
│
├── wsgi.py                     # Entry point del servidor
├── CLAUDE.md                   # Guia para Claude Code
└── README.md                   # Este archivo
```

---

## Comandos de Desarrollo

```bash
# Backend
python wsgi.py                    # Iniciar servidor (puerto 5000)

# Frontend
cd frontend && npm run dev        # Desarrollo (puerto 5173)
cd frontend && npm run build      # Build produccion

# Tests
python -m pytest tests/           # Tests backend (1,210+ tests)
cd frontend && npm test           # Tests frontend

# Windows - Inicio rapido
scripts/INICIAR_SPM.bat           # Inicia backend + frontend
```

---

## Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Transaccional (usuarios, solicitudes, auth) | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |
| PostgreSQL (prod) | Base de datos de produccion | - |

---

## Seguridad

**Implementado:**
- JWT Tokens (access 1h + refresh 7d)
- Proteccion CSRF (doble cookie)
- Headers de seguridad OWASP
- Rate limiting en endpoints sensibles
- Validacion con Pydantic
- Encriptacion bcrypt
- httpOnly cookies en produccion

**Roles del sistema:**
- `admin`: Acceso total
- `coordinador`: Aprobar/rechazar solicitudes
- `usuario`: Crear solicitudes
- `planner`: Planificar solicitudes aprobadas
- `jefe`: Supervision de equipos

---

## Documentacion

- `CLAUDE.md` - Guia completa para desarrollo
- `docs/claude-workflow.md` - Guia de trabajo con Claude
- `docs/ARQUITECTURA_SPM_2_0.md` - Arquitectura del sistema
- `docs/DEPLOYMENT.md` - Guia de despliegue
- `docs/GUIA_RAPIDA_USAR_SERVICIOS.md` - Uso de servicios
- `docs/AUDIT.md` - Auditoria de seguridad
- `/api/docs` - Swagger UI (servidor corriendo)

---

## Tests

```bash
# Tests unitarios (36 archivos)
python -m pytest tests/unit/ -v

# Tests de integracion (15 archivos)
python -m pytest tests/integration/ -v

# Tests e2e (2 archivos)
python -m pytest tests/e2e/ -v

# Todos los tests con cobertura
python -m pytest tests/ --cov=backend --cov-report=html
```

---

## Contribuir

1. Fork el repositorio
2. Crear branch: `git checkout -b feature/nueva-funcionalidad`
3. Hacer commits descriptivos
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abrir Pull Request

**Estandares:**
- Python: PEP 8
- JavaScript: ESLint
- Commits en espanol con prefijos: `feat:`, `fix:`, `docs:`, `test:`

---

## Autor

**Manuel Remon** - Argentina

---

*Ultima actualizacion: 19 de Enero, 2026*
