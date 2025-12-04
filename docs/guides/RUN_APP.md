# 🚀 Guía de Ejecución - SPMv1.0

## Estado Actual

✅ **Backend (Flask)** - Iniciado
❌ **Frontend (Node.js)** - No disponible en el sistema

---

## 📋 Requisitos del Sistema

Para ejecutar la aplicación completa, necesitas:

### Backend
- ✅ Python 3.11+ (detectado: 3.14.0)
- ✅ pip (package manager)
- ✅ Entorno virtual (.venv/) - YA CONFIGURADO

### Frontend
- ❌ Node.js 18+ (NO disponible)
- ❌ npm (NO disponible)

---

## 🚀 Cómo Ejecutar

### Opción 1: Backend Solo (Desarrollo Rápido)

```powershell
# Windows PowerShell
.venv\Scripts\python src\backend\app.py
```

El backend estará disponible en: **http://localhost:5000**

### Opción 2: Backend + Frontend (Producción)

```powershell
# Terminal 1: Backend
.venv\Scripts\python src\backend\app.py

# Terminal 2: Frontend (requiere Node.js 18+)
npm install
npm run dev
```

Frontend en: **http://localhost:5173**

### Opción 3: Docker (Recomendado)

```powershell
# Build e iniciar con Docker Compose
docker-compose up --build

# O solo iniciar (sin rebuild)
docker-compose up
```

Disponible en: **http://localhost:5000**

---

## ⚙️ Configuración Necesaria

### 1. Crear archivo `.env` (si no existe)

```powershell
# Copiar desde ejemplo
Copy-Item .env.example .env

# Editar con valores locales
notepad .env
```

Variables importantes:
```
SPM_ENV=development
SPM_DEBUG=1
SPM_SECRET_KEY=dev-secret-key-change-in-production
CORS_ORIGINS=http://localhost:5173,http://localhost:5000
```

### 2. Instalar Dependencias Python

```powershell
# Activar entorno virtual
.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Para desarrollo
pip install -r requirements-dev.txt
```

### 3. Instalar Dependencias Node.js (Opcional)

```powershell
# Instalar Node.js desde:
# https://nodejs.org/ (LTS recomendado)

# Luego:
npm install
npm run dev
```

---

## 🧪 Pruebas

### Tests Python

```powershell
# Activar entorno
.venv\Scripts\Activate.ps1

# Ejecutar tests
pytest tests/

# Con cobertura
pytest --cov=src tests/
```

### Tests JavaScript

```powershell
# Si Node.js está instalado
npm test

# Con watch
npm test -- --watch
```

---

## 📊 Estado Actual del Sistema

### ✅ Disponible
- Python 3.14.0
- Entorno virtual (.venv)
- Dependencias Python instaladas
- Base de datos SQLite

### ❌ Faltante
- Node.js 18+
- npm
- Frontend ejecutable

---

## 🔧 Instalación de Dependencias Faltantes

### Instalar Node.js (Windows)

#### Opción 1: Descarga directa
1. Ir a https://nodejs.org/
2. Descargar **LTS** (18.x o 20.x)
3. Ejecutar instalador
4. Reiniciar terminal

#### Opción 2: Chocolatey
```powershell
# Si tienes Chocolatey instalado
choco install nodejs

# Verificar instalación
node --version
npm --version
```

#### Opción 3: winget
```powershell
# Si tienes winget (Windows 11+)
winget install OpenJS.NodeJS

# Verificar instalación
node --version
npm --version
```

---

## 📋 Checklist de Verificación

- [ ] Python 3.11+ instalado
- [ ] Entorno virtual activado
- [ ] Dependencias Python instaladas (`pip install -r requirements.txt`)
- [ ] `.env` configurado
- [ ] Base de datos lista (SQLite)
- [ ] Backend iniciado (`python src/backend/app.py`)
- [ ] Node.js 18+ instalado (opcional para frontend)
- [ ] npm instalado
- [ ] Dependencias Node instaladas (`npm install`)
- [ ] Frontend iniciado (`npm run dev`)

---

## 🌐 URLs de Acceso

Una vez todo está corriendo:

| Componente | URL | Puerto |
|-----------|-----|--------|
| Backend API | http://localhost:5000 | 5000 |
| Frontend Dev | http://localhost:5173 | 5173 |
| Frontend Prod | http://localhost:5000 | 5000 |
| API Docs | http://localhost:5000/api/docs | 5000 |

---

## ❓ Troubleshooting

### Error: "Python not found"
```powershell
# Solución:
# 1. Instalar Python desde python.org
# 2. O usar .venv\Scripts\python directamente
.venv\Scripts\python --version
```

### Error: "Module not found"
```powershell
# Solución:
.venv\Scripts\python -m pip install -r requirements.txt
```

### Error: "Port already in use"
```powershell
# Buscar proceso en puerto 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess

# Matar proceso (reemplaza 1234 con PID)
Stop-Process -Id 1234 -Force

# O cambiar puerto en src/backend/app.py
```

### Error: "Node/npm not found"
```powershell
# Solución:
# 1. Instalar Node.js desde nodejs.org
# 2. Reiniciar terminal/VS Code
# 3. Verificar: node --version
```

---

## 📚 Documentación Completa

- **Setup Detallado:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Despliegue:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Arquitectura:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Variables .env:** [.env.example](./.env.example)

---

## 🎯 Resumen Rápido

```powershell
# 1. Instalar Python (si no está)
# 2. Crear entorno virtual
python -m venv .venv

# 3. Activar
.venv\Scripts\Activate.ps1

# 4. Instalar dependencias
pip install -r requirements.txt

# 5. Copiar configuración
Copy-Item .env.example .env

# 6. Ejecutar backend
python src/backend/app.py

# ✅ Backend listo en http://localhost:5000
```

---

**Generado:** 1 de noviembre de 2025
**Estado:** Backend iniciado ✅
**Siguiente:** Frontend (requiere Node.js)
