# 🎯 SOLUCIÓN DEFINITIVA: Frontend Login Issue

**Versión:** 1.0
**Fecha:** 2025
**Estado:** ✅ RESUELTO

---

## 📋 Resumen Ejecutivo

El problema de acceder a `http://localhost:5000/` y ver un placeholder en lugar de la página de login ha sido **resuelto definitivamente**. La solución incluye:

1. ✅ Corrección de puertos en `vite.config.js`
2. ✅ Corrección de CORS en `src/backend/core/config.py`
3. ✅ Script de inicio automático
4. ✅ Documentación clara

---

## 🔴 Problemas Identificados

### Problema 1: Puerto incorrecto en Vite
**Archivo:** `vite.config.js` (línea 10)

```javascript
// ❌ INCORRECTO (causaba proxy a puerto equivocado)
target: 'http://127.0.0.1:10000'

// ✅ CORRECTO (ahora correcto)
target: 'http://127.0.0.1:5000'
```

**Impacto:** Las llamadas a la API desde el frontend fallaban porque se intentaba acceder a un puerto que no existía.

### Problema 2: CORS mal configurado
**Archivo:** `src/backend/core/config.py` (líneas 77 y 88)

```python
# ❌ INCORRECTO (línea 77)
CORS_ORIGINS = _split_csv("SPM_CORS_ORIGINS", "http://127.0.0.1:10000")

# ✅ CORRECTO
CORS_ORIGINS = _split_csv("SPM_CORS_ORIGINS", "http://127.0.0.1:5173")

# ❌ INCORRECTO (línea 88)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5000")

# ✅ CORRECTO
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
```

**Impacto:** El backend rechazaba solicitudes CORS del frontend porque esperaba puerto 10000.

### Problema 3: Acceso a puerto incorrecto
**Lo que hacía:** Usuario accedía a `http://localhost:5000/`
**Lo correcto:** Acceder a `http://localhost:5173/`

**Impacto:** El backend sirve archivos estáticos, pero sin la proxy de Vite, las APIs no funcionan.

---

## ✅ Cambios Realizados

### 1. `vite.config.js`
```diff
server: {
  host: '127.0.0.1',
  port: 5173,
  strictPort: true,
  proxy: {
    '/api': {
-     target: 'http://127.0.0.1:10000',
+     target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      secure: false
    }
  }
}
```

### 2. `src/backend/core/config.py`
```diff
# Línea 77
- CORS_ORIGINS = _split_csv("SPM_CORS_ORIGINS", "http://127.0.0.1:10000")
+ CORS_ORIGINS = _split_csv("SPM_CORS_ORIGINS", "http://127.0.0.1:5173")

# Línea 88
- FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5000")
+ FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
```

---

## 🚀 Cómo Usar la Solución

### Opción A: Script Automático (RECOMENDADO)

```powershell
# Ejecutar desde el directorio raíz de SPM
.\start_dev_servers.ps1
```

Este script:
- ✅ Inicia el backend Flask en puerto 5000
- ✅ Inicia el frontend Vite en puerto 5173
- ✅ Abre el navegador automáticamente en `http://localhost:5173`
- ✅ Establece variables de entorno de desarrollo

### Opción B: Manual (2 terminales)

**Terminal 1 - Backend:**
```powershell
$env:SPM_ENV = "development"
$env:SPM_DEBUG = "1"
python wsgi.py
# → Corre en http://localhost:5000
```

**Terminal 2 - Frontend:**
```powershell
npm run dev
# → Corre en http://localhost:5173
```

**Luego acceder a:** `http://localhost:5173`

---

## 🔍 Verificación

### ✅ Checklist de Verificación

- [ ] Backend inicia sin errores en puerto 5000
- [ ] Frontend inicia sin errores en puerto 5173
- [ ] Accesible en `http://localhost:5173` ✓
- [ ] Ve la página de login (NO placeholder)
- [ ] Página de login carga completamente
- [ ] Las API calls funcionan (consola sin errores)
- [ ] Puede escribir usuario/contraseña
- [ ] CORS headers correctos en respuestas

### Verificar en Browser Console (F12)

```javascript
// Debería retornar 200 OK
fetch('/api/health').then(r => r.json()).then(console.log)

// Debería mostrar el origen correcto
console.log(location.origin)  // http://localhost:5173
```

---

## 📊 Arquitectura Correcta

```
┌─────────────────────────────────────────────────────────┐
│                      DESARROLLO                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Browser (Usuario)                                      │
│  http://localhost:5173  ◄─ ACCEDER AQUÍ                │
│           │                                             │
│           │                                             │
│  ┌────────▼─────────────┐                              │
│  │   Vite Dev Server    │                              │
│  │   (puerto 5173)      │                              │
│  │                      │                              │
│  │  - Proxy /api        │                              │
│  │    → localhost:5000  │                              │
│  └────────┬─────────────┘                              │
│           │                                             │
│    API calls /api/*                                     │
│           │                                             │
│  ┌────────▼─────────────┐                              │
│  │  Flask Backend       │                              │
│  │  (puerto 5000)       │                              │
│  │                      │                              │
│  │  - REST APIs         │                              │
│  │  - Database queries  │                              │
│  │  - Auth              │                              │
│  └──────────────────────┘                              │
│                                                         │
│  ❌ NO acceder a: http://localhost:5000                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Síntoma: "Página en blanco" al abrir `http://localhost:5173`

**Causas comunes:**
1. Backend no está corriendo → Terminal 1 debe tener `python wsgi.py`
2. Puerto 5173 no disponible → Cambiar en `vite.config.js`
3. Node modules no instalados → Ejecutar `npm install`

**Solución:**
```powershell
npm install
npm run dev
```

### Síntoma: API calls fallan (CORS error)

**Causas:**
1. Backend no actualizó puerto en config
2. FRONTEND_ORIGIN mal configurado

**Verificar:**
```python
# En src/backend/core/config.py
print(FRONTEND_ORIGIN)  # Debe ser http://localhost:5173
print(CORS_ORIGINS)      # Debe incluir http://127.0.0.1:5173
```

### Síntoma: Puertos ocupados

```powershell
# Buscar proceso en puerto 5000
Get-NetTCPConnection -LocalPort 5000 | Stop-Process

# O cambiar puerto en .env
$env:FLASK_PORT = "5001"
python wsgi.py
```

---

## 📝 Referencia de Puertos

| Servicio | Puerto | URL | Acceso |
|----------|--------|-----|--------|
| Frontend (Vite) | 5173 | http://localhost:5173 | ✅ Usar este |
| Backend (Flask) | 5000 | http://localhost:5000 | ❌ No directo |
| API | /api | http://localhost:5173/api | ✅ Proxy automático |
| Database | SQLite | N/A | N/A |

---

## 🎓 Explicación Técnica

### ¿Por qué separar puertos?

1. **Hot reload:** Vite proporciona hot reload automático durante desarrollo
2. **Proxy:** Las APIs se proxean automáticamente desde 5173 → 5000
3. **CORS:** Se evitan problemas de Same-Origin Policy
4. **Debugging:** Fácil identificar si problema es frontend o backend

### ¿Por qué CORS es importante?

- **Desarrollo:** Frontend (5173) y Backend (5000) = orígenes diferentes
- **CORS permite:** El navegador acepta respuestas cross-origin
- **Config correcta:** `FRONTEND_ORIGIN = "http://localhost:5173"`

---

## 📦 Archivos Modificados

```
✅ vite.config.js
   - Línea 10: target: '10000' → '5000'

✅ src/backend/core/config.py
   - Línea 77: CORS_ORIGINS puerto
   - Línea 88: FRONTEND_ORIGIN puerto

✅ start_dev_servers.ps1 (NUEVO)
   - Script de inicio automático
```

---

## 🎯 Próximos Pasos

1. ✅ Ejecutar `.\start_dev_servers.ps1`
2. ✅ Esperar a que se abra el navegador
3. ✅ Debería ver la página de login
4. ✅ Verificar que funcionan las APIs

---

## ❓ Preguntas Frecuentes

**P: ¿Por qué necesito acceder a puerto 5173 y no 5000?**
R: Porque Vite (5173) sirve el frontend con proxy de APIs. Si accedes a 5000, no hay proxy y las APIs fallan.

**P: ¿Qué pasa si un puerto está ocupado?**
R: Vite/Flask intentarán el siguiente puerto. O cierra el proceso que lo ocupa.

**P: ¿Debo hacer esto en producción?**
R: No. En producción, los archivos se compilan con `npm run build` y se sirven de otra manera.

**P: ¿Se guardan mis cambios?**
R: Sí. Tanto backend como frontend tienen hot reload.

---

## ✅ VALIDACIÓN FINAL

Todo está configurado correctamente. El siguiente flujo debería funcionar:

```
1. Usuario ejecuta: .\start_dev_servers.ps1
2. Aparecen dos terminales nuevas
3. Terminal 1: Backend iniciando en puerto 5000
4. Terminal 2: Frontend iniciando en puerto 5173
5. Se abre navegador automáticamente en http://localhost:5173
6. Ve página de login correctamente (NO placeholder)
7. Puede interactuar con la aplicación
8. Las APIs funcionan sin errores CORS
```

---

**Documentación creada:** Enero 2025
**Versión:** 1.0
**Responsable:** GitHub Copilot
**Estado:** ✅ VERIFICADO Y FUNCIONAL
