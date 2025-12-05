# 📋 Guía de Deployment a Producción - SPM v2.0

## 📊 Estado Actual
- ✅ Backend: Corriendo en Render (https://spmsystem2-0.onrender.com)
- ✅ Base de datos: Inicialización automática configurada
- ⏳ Frontend: Listo para Vercel, requiere deployment
- ⏳ Variables de entorno: Requieren configuración en Render

---

## 🚀 4 Pasos para Producción Completa

### **Paso 1: Configurar Variables de Entorno en Render** ✅

El backend ya está corriendo en Render, pero necesitas configurar las variables secretas:

#### 1.1 Acceder al Dashboard
1. Ir a https://dashboard.render.com
2. Seleccionar el servicio `spmsystem2-0`
3. Ir a **Settings** → **Environment**

#### 1.2 Variables a Agregar
```
FLASK_ENV=production
SECRET_KEY=<GENERA_AQUI>
JWT_SECRET_KEY=<GENERA_AQUI>
RENDER_SERVICE_URL=https://spmsystem2-0.onrender.com
FRONTEND_URL=<URL_VERCEL_AQUI>
CORS_ORIGINS=<URL_VERCEL>,https://spmsystem2-0.onrender.com
```

#### 1.3 Generar Claves Secretas
Ejecuta en tu terminal (local o remota):
```powershell
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
```

**Ejemplo de salida:**
```
SECRET_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_SECRET_KEY=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a
```

#### 1.4 Variables de Render (automáticas)
- `RENDER_EXTERNAL_URL` (automática en Render)
- `PORT` (automática, generalmente 10000)

#### 1.5 Después de Agregar Variables
1. **Guardar** cambios
2. **Redeploy** el servicio:
   - Click en **Manual Deploy** → **Latest Commit**
   - Esperar que se complete (2-3 minutos)

---

### **Paso 2: Verificar Base de Datos en Producción** ✅

La inicialización está automática, pero verifica que funcionó:

#### 2.1 Verificación Manual
```bash
# En el dashboard de Render, abre la consola y ejecuta:
curl https://spmsystem2-0.onrender.com/
```

**Respuesta esperada:**
```json
{
  "message": "SPM API v2.0",
  "endpoints": {
    "auth": "/api/auth/login",
    "materials": "/api/materials",
    "requests": "/api/requests"
  },
  "status": "✓ API activo"
}
```

#### 2.2 Si NO Inicializa
Si ves error 500, ejecuta manualmente en Render:
```bash
# En la consola de Render
python init_db_production.py
```

Debería mostrar:
```
✓ Base de datos inicializada correctamente
✓ Usuario admin creado: admin / a1
```

#### 2.3 Credenciales Temporales
- Usuario: `admin`
- Contraseña: `a1`

⚠️ **CAMBIAR INMEDIATAMENTE en producción**

---

### **Paso 3: Desplegar Frontend a Vercel** 🚀

#### 3.1 Crear Cuenta en Vercel
Si no tienes:
1. Ir a https://vercel.com/signup
2. Conectar con GitHub

#### 3.2 Desplegar Proyecto
1. Ir a https://vercel.com/new
2. **Importar Git Repository**
3. Buscar `manuelremon/SPMSystem2.0`
4. **Configuración:**
   - **Framework Preset:** Vite
   - **Root Directory:** `./frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

#### 3.3 Agregar Variables de Entorno
En **Environment Variables:**
```
VITE_API_URL=https://spmsystem2-0.onrender.com/api
```

#### 3.4 Desplegar
Click **Deploy** y esperar (2-3 minutos)

**URL resultante:**
```
https://spmv2-0-vercel-project.vercel.app
```
(El nombre exacto se mostrará después del deploy)

---

### **Paso 4: Configurar CORS y Actualizar URLs** 🔗

Después que Vercel termine, actualiza Render:

#### 4.1 Obtén URL de Vercel
Ir a https://vercel.com/dashboard y copiar la URL de deployment

#### 4.2 Actualizar Variables en Render
1. Dashboard → `spmsystem2-0` → **Settings**
2. Editar:
```
FRONTEND_URL=https://tu-proyecto.vercel.app
CORS_ORIGINS=https://tu-proyecto.vercel.app,https://spmsystem2-0.onrender.com
```

#### 4.3 Redeploy Backend
- Click **Manual Deploy** → **Latest Commit**

---

## 📱 Testing Post-Deployment

### Test 1: Backend API
```bash
curl https://spmsystem2-0.onrender.com/
# Debe retornar JSON con endpoints disponibles
```

### Test 2: CSRF Token
```bash
curl -i https://spmsystem2-0.onrender.com/api/auth/csrf
# Debe retornar header X-CSRF-Token
```

### Test 3: Login
```bash
curl -X POST https://spmsystem2-0.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spm.local","password":"a1"}'
# Debe retornar token JWT
```

### Test 4: Frontend
1. Abrir https://tu-proyecto.vercel.app
2. Login con admin/a1
3. Verificar que carga la aplicación
4. Hacer una solicitud para probar API

---

## 🔐 Configuración de Dominio Personalizado (Opcional)

### Opción A: Dominio en Render (Backend)
1. Render Dashboard → `spmsystem2-0`
2. **Settings** → **Custom Domain**
3. Agregar: `api.tu-dominio.com`
4. Seguir instrucciones de DNS

### Opción B: Dominio en Vercel (Frontend)
1. Vercel Dashboard → Proyecto
2. **Settings** → **Domains**
3. Agregar: `tu-dominio.com` o `www.tu-dominio.com`
4. Seguir instrucciones de DNS

---

## 📝 Checklist Pre-Producción

- [ ] Variables de entorno configuradas en Render
- [ ] Backend redeploy completado exitosamente
- [ ] Base de datos inicializada (verificado con curl /)
- [ ] Frontend desplegado en Vercel
- [ ] CORS configurado correctamente
- [ ] Login funciona en producción
- [ ] Solicitudes funcionan end-to-end
- [ ] HTTPS activado (automático en ambos servicios)
- [ ] Contraseña admin cambiada
- [ ] Logs monitoreados en Render dashboard

---

## 🐛 Troubleshooting

### Backend retorna 502 Bad Gateway
- Abrir Render logs: Dashboard → `spmsystem2-0` → **Logs**
- Buscar errores de inicialización
- Verificar variables de entorno están configuradas
- Redeploy: **Manual Deploy** → **Latest Commit**

### Frontend no conecta a Backend
- Verificar `VITE_API_URL` en Vercel
- Verificar CORS en Render config
- Abrir DevTools (F12) → Console
- Buscar errores CORS

### Login falla
- Verificar credenciales: admin / a1
- Verificar JWT_SECRET_KEY está configurada en Render
- Revisar Backend logs en Render
- Probar endpoint CSRF manualmente con curl

### Base de datos no inicializada
- Render → Logs → Buscar "init_db"
- Si no aparece, ejecutar: `python init_db_production.py` en consola
- Verificar archivo `spm.db` existe: `ls -la backend_v2/spm.db`

---

## 📚 Referencias Útiles

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Variables de Entorno Render:** https://render.com/docs/environment-variables
- **Vercel Environment:** https://vercel.com/docs/concepts/projects/environment-variables

---

## ✅ Resumen Rápido

```
┌─────────────────────────────────────────────────┐
│ 🎯 4 PASOS PARA PRODUCCIÓN                      │
├─────────────────────────────────────────────────┤
│ 1️⃣  Render env vars + SECRET_KEY + Redeploy    │
│ 2️⃣  Verificar BD inicializada (curl /)         │
│ 3️⃣  Desplegar Frontend en Vercel               │
│ 4️⃣  Actualizar CORS, login y testar            │
└─────────────────────────────────────────────────┘

⏱️  Tiempo estimado: 10-15 minutos
🔒 Resultado: Aplicación completa en producción
```

---

**Última actualización:** Octubre 2024
**Estado:** Listo para producción
**Siguiente:** Monitoreo y mantenimiento
