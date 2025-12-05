# 🚀 PRODUCTION DEPLOYMENT QUICK START - SPM v2.0

## 📍 Estado Actual
```
✅ Backend: Corriendo en Render (https://spmsystem2-0.onrender.com)
✅ Base de datos: Inicialización automática configurada
⏳ Frontend: Listo para Vercel, requiere deployment
⏳ Variables de entorno: Requieren configuración en Render
```

---

## ⚡ 4 PASOS RÁPIDOS (10 minutos)

### **PASO 1️⃣: Render Environment Variables** (2 min)

1. 🌐 Abre https://dashboard.render.com
2. 👆 Click en `spmsystem2-0` service
3. ⚙️ Settings → Environment
4. ➕ Agrega estas variables:

```
FLASK_ENV=production
SECRET_KEY=<COPIAR ABAJO>
JWT_SECRET_KEY=<COPIAR ABAJO>
RENDER_SERVICE_URL=https://spmsystem2-0.onrender.com
FRONTEND_URL=<URL_VERCEL_AQUI>
CORS_ORIGINS=<URL_VERCEL>,https://spmsystem2-0.onrender.com
```

**Generar claves** (copia estas líneas en PowerShell):
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

5. 💾 Guardar
6. 🔄 Manual Deploy → Latest Commit

---

### **PASO 2️⃣: Verificar Base de Datos** (1 min)

Ejecuta en PowerShell:
```powershell
$headers = @{}
$response = Invoke-WebRequest -Uri "https://spmsystem2-0.onrender.com/" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

**Debe mostrar:** JSON con endpoints y status OK ✅

---

### **PASO 3️⃣: Deploy Frontend a Vercel** (5 min)

1. 🌐 Abre https://vercel.com/new
2. 📦 Import Git Repository → `manuelremon/SPMSystem2.0`
3. ⚙️ Configure:
   - Framework: **Vite**
   - Root Directory: **./frontend**
   - Build: **npm run build**
   - Output: **dist**
4. 🔧 Environment Variables:
   ```
   VITE_API_URL=https://spmsystem2-0.onrender.com/api
   ```
5. 🚀 Deploy

**Resultado:** URL como `https://spmv2-0.vercel.app` (copia esto)

---

### **PASO 4️⃣: Actualizar CORS en Render** (1 min)

1. 🌐 Render Dashboard → `spmsystem2-0`
2. ⚙️ Settings → Environment
3. ✏️ Edita `FRONTEND_URL` y `CORS_ORIGINS`:
   ```
   FRONTEND_URL=https://tu-proyecto.vercel.app
   CORS_ORIGINS=https://tu-proyecto.vercel.app,https://spmsystem2-0.onrender.com
   ```
4. 🔄 Manual Deploy → Latest Commit

---

## ✅ Testing Rápido

### Test 1: Backend
```powershell
curl.exe https://spmsystem2-0.onrender.com/
```
✅ Debe retornar JSON

### Test 2: Frontend
Abre `https://tu-proyecto.vercel.app` en navegador
- Login con: **admin** / **a1**
- Debe cargar la aplicación ✅

### Test 3: Completo
```powershell
python test_production.py
```

---

## 📋 Verificación Automatizada

```powershell
cd "C:\Users\MANUE\SPMv2.0"
python verify_production_setup.py
```

Debe mostrar:
```
✓ Archivos Backend
✓ Archivos Frontend
✓ Documentación
✓ Seguridad
✓ Backend Online

🎉 LISTO PARA PRODUCCIÓN
```

---

## 🔐 Después del Deployment

**Cambiar contraseña admin:**
1. Login en producción con admin/a1
2. Settings → Change Password
3. Crear contraseña fuerte
4. Guardar

---

## 🐛 Si Algo Falla

| Problema | Solución |
|----------|----------|
| 502 Bad Gateway | ✓ Render → Logs (revisar errores) |
| Login falla | ✓ JWT_SECRET_KEY configurada? |
| Frontend no conecta API | ✓ CORS_ORIGINS correcto en Render |
| BD no inicializa | ✓ Render → ejecutar `python init_db_production.py` |

---

## 📚 Documentación Completa

Consulta: `docs/GUIA_DEPLOYMENT_PRODUCCION.md`

---

## 🎯 Checklist Final

```
✓ Paso 1: Variables en Render configuradas
✓ Paso 2: Backend respond OK (test curl)
✓ Paso 3: Frontend deployed en Vercel
✓ Paso 4: CORS actualizado
✓ Test 1: curl backend ✓
✓ Test 2: Frontend carga y login OK ✓
✓ Test 3: python test_production.py ✓
✓ Admin password cambiada ✓
```

---

**Tiempo estimado:** 10-15 minutos
**Resultado:** Aplicación completa en producción 🎉

---

*Última actualización: Octubre 2024*
*Guía rápida para deployment sin complicaciones*
