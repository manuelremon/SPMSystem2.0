# PASOS 2-4: DEPLOYMENT A PRODUCCION

## PASO 2: DESPLEGAR FRONTEND EN VERCEL (5 minutos)

### 2.1 Preparar la aplicación
El frontend ya está listo en GitHub. Solo necesitas:

1. Ir a: https://vercel.com/new

2. Click "Import Git Repository"

3. Busca y selecciona: manuelremon/SPMSystem2.0

4. Vercel detectará la configuración. Configura así:
   - Framework: Vite
   - Root Directory: ./frontend
   - Build Command: npm run build (automático)
   - Output Directory: dist (automático)

5. Click en "Environment Variables"

6. Agrega esta variable:
   Name: VITE_API_URL
   Value: https://spmsystem2-0.onrender.com/api

7. Click "Deploy"

### 2.2 Espera el deployment
- El deployment toma 2-3 minutos
- Vercel mostrará un link como: https://spmv2-0-xxxxx.vercel.app
- COPIA ESTA URL - la necesitarás en el Paso 3

### 2.3 Verifica que el frontend está online
Abre en navegador la URL que copiaste:
- Debe mostrar la aplicación SPM
- Intenta hacer login (no funcionará completamente hasta Paso 3)

---

## PASO 3: ACTUALIZAR CORS EN RENDER (1 minuto)

### 3.1 Acceder a Render
1. Abre: https://dashboard.render.com

2. Encuentra el servicio "spmsystem2-0"

3. Click en Settings

4. Busca "Environment" en el menú

### 3.2 Editar las variables
Busca estas variables y actualízalas:

VARIABLE 1: FRONTEND_URL
Valor anterior: (vacío o localhost)
Valor nuevo: https://tu-url-vercel-copiada.vercel.app

VARIABLE 2: CORS_ORIGINS
Valor anterior: http://localhost:5173,https://spmsystem2-0.onrender.com
Valor nuevo: https://tu-url-vercel-copiada.vercel.app,https://spmsystem2-0.onrender.com

Ejemplo de cómo debe verse:
FRONTEND_URL=https://spmv2-0-123abc.vercel.app
CORS_ORIGINS=https://spmv2-0-123abc.vercel.app,https://spmsystem2-0.onrender.com

### 3.3 Guardar y redeploy
1. Click "Save changes"
2. Click "Manual Deploy"
3. Click "Latest Commit"
4. Espera 2-3 minutos a que se reinicie el backend

---

## PASO 4: TESTING Y VERIFICACION (2 minutos)

### 4.1 Test 1: Backend responde
En PowerShell ejecuta:

curl.exe https://spmsystem2-0.onrender.com/

Debe retornar JSON como:
{
  "message": "SPM API v2.0",
  "endpoints": {...},
  "status": "✓ API activo"
}

### 4.2 Test 2: Frontend carga
1. Abre en navegador: https://tu-url-vercel.vercel.app
2. Deberías ver la página de login
3. Intenta login con: admin / a1
4. Debe aceptar credenciales y cargar el dashboard

### 4.3 Test 3: Completo (opcional)
En PowerShell ejecuta:

cd "C:\Users\MANUE\SPMv2.0"
python test_production.py

Debe mostrar tests en VERDE (si ves errores, revisar paso anterior)

### 4.4 Si algo falla

ERROR: Backend retorna 502
- Ir a Render Dashboard → Logs
- Buscar el error
- Generalmente es una variable mal escrita

ERROR: Frontend no carga
- Abrir DevTools (F12)
- Ver la consola
- Buscar errores CORS

ERROR: Login no funciona
- Verificar JWT_SECRET_KEY está en Render (Paso 1)
- Verificar CORS_ORIGINS contiene tu URL de Vercel

---

## VERIFICACION FINAL

Si todo funciona:

1. Backend online: https://spmsystem2-0.onrender.com
2. Frontend carga: https://tu-vercel-url.vercel.app
3. Login funciona: admin / a1
4. Puedes ver materiales y solicitudes

Felicidades, tu aplicación está en producción!

---

## PROXIMOS PASOS (POST-DEPLOYMENT)

1. Cambiar contraseña admin
   - Login en producción
   - Settings → Change Password
   - Crear contraseña fuerte

2. (Opcional) Configurar dominio personalizado
   - Render: Settings → Custom Domain
   - Vercel: Settings → Domains

3. Monitoreo
   - Render Dashboard: ver logs
   - Vercel Dashboard: ver analytics

---

## REFERENCIAS RAPIDAS

Backend URL:        https://spmsystem2-0.onrender.com
Frontend URL:       https://tu-vercel-url.vercel.app
Render Dashboard:   https://dashboard.render.com
Vercel Dashboard:   https://vercel.com/dashboard
GitHub Repo:        https://github.com/manuelremon/SPMSystem2.0

Credenciales temp:
  Usuario: admin
  Pass: a1

