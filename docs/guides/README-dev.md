# 🚀 Guía de Desarrollo Local - SPM## Desarrollo local



Este documento te guía para ejecutar SPM en tu máquina local.SPM puede ejecutarse en un unico origen (frontend + API desde Flask) o con dos servidores coordinados por un proxy de desarrollo.



---### Requisitos previos

- Python 3.11 con entorno virtual en .venv

## 📋 Requisitos Previos- Dependencias del backend (pip install -r requirements.txt)

- Node 18+ si quieres la opcion con Vite (

- **Python 3.11+** con virtualenvpm install dentro de src/frontend)

- **Node.js 18+** (solo si usas Vite para desarrollo frontend)

- **SQLite3** (generalmente incluido en Python)### Opcion A: todo en Flask (recomendada)

- **Git** (para clonar el repositorio)1. Activa tu entorno virtual.

2. Exporta las variables necesarias:

---   `ash

   set PORT=5000           # PowerShell:  = "5000"

## ⚡ Quick Start (5 minutos)   set AUTH_BYPASS=1       # opcional para test

   `

### 1. Clonar e instalar3. Ejecuta python src/backend/app.py o

un_dev.bat (Windows).

```powershell4. Visita http://127.0.0.1:5000/home.html y http://127.0.0.1:5000/api/health.

# Clonar el repo

git clone <repo-url>### Opcion B: Flask + Vite (proxy)

cd SPM1.

pm install dentro de src/frontend.

# Crear entorno virtual2. Lanza

python -m venv .venvun_dev_two_servers.bat o ejecuta manualmente:

   `ash

# Activar entorno   # Terminal 1

.\.venv\Scripts\Activate.ps1   set PORT=10000

   python src/backend/app.py

# Instalar dependencias

python -m pip install -r requirements.txt   # Terminal 2

```   cd src/frontend

   npm run dev -- --host

### 2. Configurar entorno   `

3. Abre http://127.0.0.1:5173/home.html; todas las llamadas a /api se redirigen hacia Flask.

Crea o edita `.env` en la raíz:

### Bypass de autenticacion para desarrollo

```envPara simular un usuario dmin en local agrega a tu .env:

PORT=5000`env

SPM_SECRET_KEY=dev-temp-keyAUTH_BYPASS=1

AUTH_BYPASS=1`

SPM_ENV=developmentNo lo uses en ambientes productivos.

SPM_DEBUG=1

```### Health checks utiles

- /api/health: respuesta JSON con {"ok": true} cuando la base responde.

### 3. Ejecutar- /api/status: resumen de servicios externos (Ollama, Render, etc.).



```powershell### Problemas frecuentes

python .\src\backend\app.py- **404 en home.html**: confirma la ruta de arranque y que los archivos sigan en src/frontend.

```- **Errores CORS**: usa siempre rutas relativas (/api/...) cuando trabajas con Vite.

- **Sesion que expira**: revisa SPM_SECRET_KEY y el flag AUTH_BYPASS.

### 4. Acceder

### Pasos rapidos en PowerShell

- Frontend: http://127.0.0.1:5000/`powershell

- API: http://127.0.0.1:5000/api/healthpython -m venv .venv

- API Status: http://127.0.0.1:5000/api/status.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt

---cd src/frontend

npm ci

## 🎯 Dos Opciones de Desarrollonpm run build

cd ..\..

### Opción A: Todo en Flask ⭐ (Recomendada) = 'dev-temp-key'

 = 'true'

**Mejor para**: Desarrollo rápido, pruebas generales, menos configuración. = '5000'

python .\src\backend\app.py

**Ventajas**:Invoke-WebRequest http://127.0.0.1:5000/api/health | % Content

- Un solo servidor`

- Más simple de debuggear

- Perfecto para principiantesAbre http://127.0.0.1:5000/ para validar el frontend servido por Flask.

- Frontend se sirve desde Flask

**Pasos**:

1. Activa el entorno virtual:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

2. Configura variables (en `.env` o en la terminal):
   ```powershell
   $env:PORT = "5000"
   $env:SPM_SECRET_KEY = "dev-temp-key"
   $env:AUTH_BYPASS = "1"
   ```

3. Ejecuta:
   ```powershell
   # Opción 1: Script automatizado
   .\scripts\dev\run-dev.ps1

   # Opción 2: Directo
   python .\src\backend\app.py
   ```

4. Verifica:
   ```powershell
   Invoke-WebRequest http://127.0.0.1:5000/api/health | ConvertFrom-Json
   ```

### Opción B: Flask + Vite (Desarrollo Avanzado)

**Mejor para**: Desarrollo frontend intenso, hot reload, mejor experiencia DX.

**Ventajas**:
- Hot reload en cambios de frontend
- Mejor performance durante desarrollo
- Experiencia más fluida
- Separación clara backend/frontend

**Pasos**:

1. **Terminal 1** - Backend:
   ```powershell
   $env:PORT = "10000"
   python .\src\backend\app.py
   ```

2. **Terminal 2** - Frontend:
   ```powershell
   cd src\frontend
   npm install  # Primera vez solo
   npm run dev -- --host
   ```

3. **Accede**:
   - Frontend: http://127.0.0.1:5173/ (con hot reload)
   - Las llamadas `/api/*` se redirigen a Flask automáticamente

---

## 🔑 Variables de Entorno

Crea `.env` en la raíz del proyecto:

```env
# Base de datos
SPM_DB_PATH=./spm.db

# Servidor
PORT=5000
HOST=127.0.0.1

# Seguridad
SPM_SECRET_KEY=your-secret-key-min-32-chars
AUTH_BYPASS=0  # 1 para desarrollo local solo

# Logging
SPM_LOG_PATH=./logs/app.log
SPM_DEBUG=1

# Uploads
SPM_UPLOAD_DIR=./uploads

# Frontend
FRONTEND_ORIGIN=http://localhost:5000

# Entorno
SPM_ENV=development
```

⚠️ **Nota**: `.env` está en `.gitignore` - no se sube al repositorio.

---

## 🐍 Gestión del Entorno Virtual

```powershell
# Crear entorno
python -m venv .venv

# Activar (PowerShell)
.\.venv\Scripts\Activate.ps1

# Activar (Bash/Git Bash)
source .venv/Scripts/activate

# Desactivar
deactivate

# Reinstalar todo
pip install -r requirements.txt

# Instalar dependencias de desarrollo (opcional)
pip install -r requirements-dev.txt
```

---

## 📁 Estructura de Desarrollo

```
SPM/
├── src/
│   ├── backend/              # 👈 API Flask
│   │   ├── app.py            # Punto de entrada
│   │   ├── core/             # Config central
│   │   ├── api/              # Endpoints
│   │   ├── middleware/       # Auth, CSRF, etc.
│   │   └── services/         # Lógica
│   └── frontend/             # 👈 HTML + JS
│       ├── pages/            # Páginas HTML
│       ├── utils/            # api.js, etc.
│       ├── components/       # Componentes reutilizables
│       └── __tests__/        # Tests
├── tests/                    # Tests de integración
├── scripts/dev/              # Scripts de desarrollo
├── database/                 # Migraciones, esquemas
├── docs/                     # Documentación
├── docker-compose.yml        # Para ejecutar con Docker
└── .env                      # Variables (no subir)
```

Ver `STRUCTURE.md` para documentación completa.

---

## 🧪 Ejecutar Tests

### Python (Backend)

```powershell
# Todos los tests
pytest tests/

# Un archivo específico
pytest tests/api/test_health.py

# Un test específico
pytest tests/api/test_health.py::test_health_endpoint

# Con cobertura
pytest --cov=src tests/
```

### JavaScript (Frontend)

```powershell
cd src\frontend

# Todos los tests
npm test

# En modo watch
npm test -- --watch

# Con cobertura
npm test -- --coverage
```

---

## 🔍 Health Checks Útiles

```powershell
# Verificar que el backend responde
curl http://127.0.0.1:5000/api/health

# Ver estado de servicios externos
curl http://127.0.0.1:5000/api/status

# Con PowerShell
(Invoke-WebRequest http://127.0.0.1:5000/api/health).Content
```

Respuesta esperada:
```json
{"ok": true, "timestamp": "2025-10-26T12:00:00"}
```

---

## 🐛 Debugging

### Backend

```python
# En src/backend/app.py u otro archivo
import pdb; pdb.set_trace()  # Breakpoint interactivo

# O usa debugger de VS Code con F5
```

### Frontend

```javascript
// En js
debugger;  // Se detiene aquí si dev tools está abierto

// O en console del navegador
console.log('Variable:', myVar);
```

### Logs

```powershell
# Ver logs en tiempo real
tail -f logs/app.log

# O en PowerShell
Get-Content logs/app.log -Wait
```

---

## 🚀 Scripts de Desarrollo Disponibles

```powershell
# Ejecutar en Flask (recomendado)
.\scripts\dev\run-dev.ps1

# Ejecutar con Flask + Vite
.\scripts\dev\run-dev-two-servers.ps1

# Inicializar entorno
.\scripts\dev\init-env.ps1

# Ver base de datos
python .\scripts\db\check_db.py

# Actualizar BD
python .\scripts\db\update_db.py
```

---

## ⚠️ Problemas Frecuentes

| Problema | Solución |
|----------|----------|
| **ModuleNotFoundError** | Verifica que `.venv` está activado: `.\.venv\Scripts\Activate.ps1` |
| **Port 5000 in use** | Cambia a otro puerto: `$env:PORT = "5001"` |
| **CORS errors** | Usa rutas relativas: `/api/health` en vez de URLs absolutas |
| **Sesión expira** | Verifica `SPM_SECRET_KEY` en `.env` y `AUTH_BYPASS=1` para desarrollo |
| **404 en `/`** | Verifica que `src/frontend/pages/` existe y contiene archivos HTML |
| **npm not found** | Instala Node.js desde https://nodejs.org/ |
| **Python 3.11+ required** | Descarga de https://python.org/ |

---

## 🐳 Alternativa: Docker

Para ejecutar con Docker Compose:

```powershell
docker-compose up -d
```

Luego accede a:
- Frontend: http://localhost:5000
- API: http://localhost:5000/api/health

Ver `docker-compose.yml` para configuración detallada.

---

## 📚 Documentación Adicional

- **Estructura completa**: Ver `STRUCTURE.md`
- **API endpoints**: Ver `docs/api.md`
- **Deployment**: Ver `infra/deploy/`
- **Configuración**: Ver `config/`

---

## ✅ Checklist de Setup Rápido

- [ ] Python 3.11+ instalado: `python --version`
- [ ] Entorno virtual creado: `python -m venv .venv`
- [ ] Entorno activado: `.\.venv\Scripts\Activate.ps1`
- [ ] Dependencias instaladas: `pip install -r requirements.txt`
- [ ] `.env` creado con variables
- [ ] Backend arranca: `python .\src\backend\app.py`
- [ ] Frontend accesible: http://127.0.0.1:5000/
- [ ] API responde: `/api/health` devuelve JSON

---

## 🤝 Necesitas ayuda?

1. Revisa `README.md` para visión general
2. Consulta `STRUCTURE.md` para estructura del proyecto
3. Abre un issue en GitHub
4. Revisa los logs en `logs/app.log`

---

**Última actualización**: 26 de octubre de 2025
