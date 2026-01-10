# SPM v2.0 - Sistema de Planificacion de Materiales

Sistema web profesional para gestionar solicitudes de materiales, construido con **Flask** (backend) + **React + Vite** (frontend).

**Version:** 2.0 | **Estado:** Produccion | **Ultima actualizacion:** 9 Enero 2026

---

## Metricas del Proyecto

| Area | Valor |
|------|-------|
| **Backend** | 131 archivos Python, ~55,000 lineas |
| **Frontend** | 68 paginas, 87 componentes |
| **Endpoints API** | 200+ endpoints en 24 modulos |
| **Tests** | 1,045+ tests (153 archivos) |

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
- WebSockets para actualizaciones en tiempo real
- Sistema de gamificacion (Trivias)
- Interfaz moderna con soporte i18n (ES/EN)
- API REST documentada con Swagger

---

## Requisitos Previos

| Componente | Version | Proposito |
|-----------|---------|----------|
| Python | 3.11+ | Backend Flask |
| Node.js | 18+ | Frontend React |
| SQLite | Incluido | Bases de datos |
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
├── backend/                    # API Flask (131 archivos)
│   ├── routes/                 # Endpoints REST (24 modulos, 200+ endpoints)
│   ├── services/               # Logica de negocio (11 servicios)
│   ├── core/                   # Config, DB, Auth, Cache, WebSocket
│   ├── agent/                  # Modulo IA/ML (30 archivos)
│   │   └── pipelines/forecast/ # Modelos de pronostico
│   └── migrations/             # Migraciones de BD
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/pages/              # 68 paginas
│   ├── src/components/         # 87 componentes
│   │   ├── ui/                 # Sistema de diseno
│   │   ├── forecast/           # Graficos y visualizaciones
│   │   └── Planner/            # Wizard de planificacion
│   ├── src/hooks/              # 8 custom hooks
│   ├── src/context/            # Providers (Auth, i18n)
│   ├── src/services/           # 11 clientes API
│   └── src/store/              # 3 stores Zustand
│
├── data/                       # Bases de datos SQLite
├── infra/                      # Docker, nginx, migraciones SQL
├── scripts/                    # Scripts de utilidad y deployment
├── tests/                      # Tests (153 archivos, 1,045+ tests)
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
python -m pytest tests/           # Tests backend
cd frontend && npm test           # Tests frontend

# Migracion de datos SAP
python scripts/migrate_excel_to_db.py
```

---

## Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Transaccional (usuarios, solicitudes, auth) | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |

---

## Seguridad

**Implementado:**
- JWT Tokens (access 1h + refresh 7d)
- Proteccion CSRF (doble cookie)
- Headers de seguridad OWASP
- Validacion con Pydantic
- Encriptacion bcrypt

**Roles del sistema:**
- `admin`: Acceso total
- `coordinador`: Aprobar/rechazar solicitudes
- `usuario`: Crear solicitudes
- `planner`: Planificar solicitudes aprobadas
- `jefe`: Supervision de equipos

---

## Documentacion

- `CLAUDE.md` - Guia para Claude Code (inventario completo)
- `docs/ARQUITECTURA_SPM_2_0.md` - Arquitectura completa
- `docs/DEPLOYMENT.md` - Guia de despliegue
- `docs/GUIA_RAPIDA_USAR_SERVICIOS.md` - Uso de servicios
- `docs/implementation_progress.md` - Progreso de implementacion
- `/api/docs` - Swagger UI (cuando el servidor esta corriendo)

---

## Ejecutar Tests

```bash
# Tests unitarios
python -m pytest tests/unit/ -v

# Tests de integracion
python -m pytest tests/integration/ -v

# Con cobertura
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
- Commits en espanol

---

## Autor

**Manuel Remon** - Argentina

---

*Ultima actualizacion: 9 de Enero, 2026*
