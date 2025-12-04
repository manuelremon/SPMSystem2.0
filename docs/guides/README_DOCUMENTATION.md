# 🎯 README_DOCUMENTATION.md - Comienza Aquí

## ¡Bienvenido al Análisis Completo de SPM v1.0!

Se ha completado un análisis exhaustivo del codebase. Aquí está lo que necesitas saber:

---

## 📚 3 Archivos de Documentación Principales

### 1. **CLAUDE.md** ⭐⭐⭐ (40.5 KB)
**Tu guía técnica completa**

- ✅ Resumen ejecutivo del proyecto
- ✅ Arquitectura con diagramas ASCII
- ✅ Stack tecnológico detallado
- ✅ Estructura de directorios anotada
- ✅ Backend Flask (rutas, servicios, esquemas)
- ✅ Frontend Vite (arquitectura, componentes)
- ✅ Base de datos (tablas, relaciones)
- ✅ API REST (40+ endpoints)
- ✅ Flujos clave del sistema
- ✅ Módulos especializados (Planner, IA)

**Cuando usarlo:** Cuando necesitas entender profundamente cómo funciona el sistema.

---

### 2. **QUICK_DEV_REFERENCE.md** ⭐⭐ (10 KB)
**Tu referencia rápida diaria**

- ✅ "¿Dónde está X?" → 10 respuestas rápidas
- ✅ Tareas comunes con ejemplos de código
- ✅ Errores comunes y sus soluciones
- ✅ Estados de solicitud
- ✅ Roles y permisos
- ✅ Testing y debugging

**Cuando usarlo:** Cuando desarrollas y necesitas respuestas rápidas.

---

### 3. **DOCUMENTATION_INDEX.md** ⭐ (5 KB)
**Tu brújula de navegación**

- ✅ "¿Por dónde empezar?" según tu necesidad
- ✅ Búsqueda por tema
- ✅ Recomendaciones por rol de desarrollador
- ✅ Preguntas frecuentes
- ✅ Mapa de documentación

**Cuando usarlo:** Cuando no sabes qué consultar primero.

---

## 🚀 Comienza Aquí Según Tu Necesidad

### Si eres **NUEVO** en el proyecto (5 minutos)
```
1. Lee esta sección completa (ahora)
2. Abre QUICK_DEV_REFERENCE.md
3. Navega a http://localhost:5173
4. ¡Explora la aplicación!
```

### Si eres **DESARROLLADOR** que necesita CÓDIGO
```
1. QUICK_DEV_REFERENCE.md → "Tareas Comunes"
2. CLAUDE.md → Sección relevante
3. Encuentra el código en VS Code
4. Copia patrón similar
```

### Si necesitas **ENTENDER LA ARQUITECTURA**
```
1. CLAUDE.md → "Arquitectura General"
2. CLAUDE.md → "Backend (Flask)"
3. CLAUDE.md → "Frontend (Vite + JavaScript)"
4. CLAUDE.md → "Base de Datos"
5. ARCHITECTURE.md (si necesitas más detalle)
```

### Si tienes un **ERROR**
```
1. QUICK_DEV_REFERENCE.md → "Errores Comunes"
2. Si no está ahí:
   - Revisa logs: src/backend/core/logs/app.log
   - Abre DevTools (F12) en el navegador
   - Consulta CLAUDE.md sobre el tema relevante
```

### Si quieres **DEPLOYAR**
```
1. Lee DEPLOYMENT.md
2. Consulta CLAUDE.md → "Configuración y Entorno"
3. Sigue paso a paso en DEPLOYMENT.md
```

---

## 📊 Proyecto Analizado

**SPM v1.0** - Sistema de Solicitudes de Materiales

```
Backend:     Flask 3.1.2 + Python 3.11
Frontend:    Vite 5.4.21 + JavaScript
BD:          SQLite (spm.db)
API:         40+ endpoints REST

Componentes:
✓ 19 rutas backend
✓ 30+ páginas frontend
✓ 9 tablas de BD
✓ 3 módulos especializados (Planner, Agentes IA)
```

---

## 🎯 Arquitectura en 60 Segundos

```
┌─ USUARIO EN NAVEGADOR ─────────────────────────┐
│ http://localhost:5173 (Vite Frontend)          │
│ • Interfaz HTML/CSS/JavaScript                 │
│ • 30+ páginas                                  │
│ • Validación local Pydantic-like               │
└────────────────┬────────────────────────────────┘
                 │ (fetch API)
                 ↓
┌─ BACKEND FLASK (Puerto 5000) ──────────────────┐
│ • 40+ endpoints API REST                       │
│ • Autenticación JWT                            │
│ • Validación Pydantic                          │
│ • Lógica de negocio                            │
│ • Integración IA (Claude)                      │
└────────────────┬────────────────────────────────┘
                 │ (SQL queries)
                 ↓
┌─ BASE DE DATOS (SQLite) ───────────────────────┐
│ • 9 tablas: usuarios, solicitudes, materiales  │
│ • ~100k registros de ejemplo                   │
│ • Auditoría completa                           │
└────────────────────────────────────────────────┘
```

**Flujo típico:**
```
1. Usuario completa formulario en el frontend
   ↓
2. Frontend valida datos
   ↓
3. Frontend hace POST /api/solicitudes
   ↓
4. Backend valida con Pydantic
   ↓
5. Backend inserta en BD
   ↓
6. Backend retorna respuesta
   ↓
7. Frontend actualiza UI
```

---

## 📁 Archivos Clave (Mapa de Navegación)

```
DESARROLLO                          UBICACIÓN
────────────────────────────────────────────────
¿Agregar nueva ruta API?      → src/backend/routes/
¿Agregar esquema validación?  → src/backend/models/schemas.py
¿Agregar página frontend?     → src/frontend/[nombre].html
¿Agregar tabla a BD?          → src/backend/core/init_db.py
¿Cambiar estilos?             → src/frontend/styles.css
¿Ver logs del backend?        → src/backend/core/logs/app.log
¿Entender planificación?      → src/planner/
¿Entender IA?                 → src/agent/
¿Configurar entorno?          → .env file
¿Desplegar?                   → DEPLOYMENT.md
```

---

## 🔧 Quick Commands

```bash
# Iniciar desarrollo
npm run dev                    # Frontend (5173)
python wsgi.py               # Backend (5000)

# Tests
python tests/test_create_solicitud.py

# Reset BD (desarrollo)
python -c "from src.backend.core.init_db import build_db; build_db(force=True)"

# Acceder a BD
sqlite3 src/backend/core/data/spm.db

# Ver logs
tail -f src/backend/core/logs/app.log
```

---

## 🌐 URLs de Acceso

```
Aplicación:     http://localhost:5173  (Frontend)
API Backend:    http://localhost:5000/api
Base de datos:  src/backend/core/data/spm.db
Logs:           src/backend/core/logs/app.log
```

---

## 👥 Roles del Sistema

```
ADMIN
• Crear/editar usuarios
• Crear/editar materiales
• Aprobar solicitudes
• Ver reportes
• Crear presupuestos

COORDINADOR
• Ver solicitudes del sector
• Aprobar algunas solicitudes
• Generar reportes
• Gestionar almacenes

USUARIO (Default)
• Crear solicitudes
• Ver sus solicitudes
• Ver materiales
• Editar borradores
```

---

## 🎓 Recomendación de Lectura

**Primera vez en el proyecto?**

| Tiempo | Lectura |
|--------|---------|
| 5 min | Este archivo + QUICK_START.txt |
| 15 min | QUICK_DEV_REFERENCE.md completo |
| 30 min | CLAUDE.md → Arquitectura + Backend |
| 1 hora | CLAUDE.md completamente |

---

## 💡 Tips Útiles

### Debugging
```javascript
// En DevTools (F12):
// Pestaña Network → Ver requests/responses
// Pestaña Console → Ver logs JS
// Pestaña Application → Ver localStorage (token)
```

### Errores Típicos
```
401 Unauthorized    → Token expirado
404 Not Found       → Ruta mal configurada
422 Validation      → Datos no validan con Pydantic
CORS Error          → Frontend/Backend en puertos incompatibles
```

### Validar Estado
```bash
# Backend activo?
curl http://localhost:5000/api/health

# Frontend activo?
curl http://localhost:5173

# BD funciona?
sqlite3 src/backend/core/data/spm.db ".tables"
```

---

## 🆘 Problema? Consulta

```
¿Dónde está...?               → QUICK_DEV_REFERENCE.md
¿Cómo hago...?                → QUICK_DEV_REFERENCE.md → "Tareas Comunes"
¿Por qué error...?            → QUICK_DEV_REFERENCE.md → "Errores"
¿Qué es...?                   → CLAUDE.md (buscar el tema)
¿Cuál es la arquitectura?     → CLAUDE.md → "Arquitectura General"
¿Necesito navegar?            → DOCUMENTATION_INDEX.md
```

---

## 📞 Documentación Relacionada

```
DENTRO DE ESTE PROYECTO:
✓ CLAUDE.md                          (documentación técnica)
✓ QUICK_DEV_REFERENCE.md            (referencia rápida)
✓ DOCUMENTATION_INDEX.md            (índice)
✓ README.md                         (descripción general)
✓ ARCHITECTURE.md                   (detalles arquitectura)
✓ DEPLOYMENT.md                     (deployment)
✓ docs/guides/                      (guías específicas)

DENTRO DE CÓDIGO:
✓ Comentarios en código fuente
✓ Docstrings en funciones Python
✓ Comments en archivos JavaScript
```

---

## 🎯 Próximos Pasos

```
PASO 1:  Lee este archivo (ya terminaste!)
PASO 2:  Abre QUICK_DEV_REFERENCE.md
PASO 3:  Navega a http://localhost:5173
PASO 4:  Explora la interfaz
PASO 5:  Abre el código en VS Code
PASO 6:  Cuando necesites info → Consulta CLAUDE.md
PASO 7:  Cuando necesites respuesta rápida → QUICK_DEV_REFERENCE.md
```

---

## ✅ Checklist de Orientación

- [ ] Leí este archivo
- [ ] Abrí QUICK_DEV_REFERENCE.md
- [ ] Visité http://localhost:5173
- [ ] Exploré la interfaz
- [ ] Leí la sección relevante de CLAUDE.md
- [ ] Entiendo dónde obtener respuestas rápidas
- [ ] Sé cómo debuggear problemas

**¡Cuando todo esté marcado, estás listo para desarrollar!**

---

**Última actualización:** 8 de noviembre de 2025
**Documentación generada automáticamente**
**Preguntas? Consulta DOCUMENTATION_INDEX.md**
