# Browser Testing - Guía Práctica con DevTools

**Objetivo:** Verificar que las páginas convertidas pueden llamar a la API correctamente

---

## 🎯 Setup Inicial

### 1. Servidores Activos
```
✅ Flask Backend:    http://localhost:5000     (Puertos 5000)
✅ HTTP Frontend:    http://localhost:8080     (Puerto 8080)
✅ Vite SPA:         http://localhost:5173     (Puerto 5173)
```

### 2. Url de Testing
```
Desde Flask:    http://localhost:5000/dashboard.html
Desde HTTP:     http://localhost:8080/dashboard
Desde Vite:     http://localhost:5173/dashboard (SPA)
```

---

## 📋 Checklist de Testing Manual

### 1. Carga Inicial de Página

**Abrir:** `http://localhost:5000/dashboard.html`

**Verificar:**
- [ ] Página carga sin errores (status 200)
- [ ] HTML completo con navbar visible
- [ ] `/styles.css` cargado (buscarlo en Network tab)
- [ ] `/app.js` cargado (Network tab)
- [ ] Ningún error de 404 o 500

**DevTools - Network tab:**
```
1. F12 → Network tab
2. Recargar página (F5)
3. Buscar requests fallidos (en rojo)
4. Verificar status codes (200 OK)
```

---

### 2. API Calls desde Página

**Objetivo:** Ver llamadas `/api/*` en Network tab

**Pasos:**
1. Abrir DevTools (F12)
2. Ir a tab **Network**
3. Filter: `api` (para ver solo llamadas API)
4. Navegar por la página
5. Observar requests y responses

**Qué buscar:**
- `GET /api/health` - Status 200
- `GET /api/catalogos` - Status 200
- `GET /api/solicitudes` - Status 200 o 401 (si necesita auth)

---

### 3. Console Errors

**Objetivo:** Verificar que no hay JavaScript errors

**Pasos:**
1. F12 → **Console** tab
2. Navegar por todas las páginas principales
3. Observar si hay errores (en rojo)

**Errores esperados:** ❌ NINGUNO
**Warnings esperados:** ⚠️ Algunos warnings de librerías es normal

**Ejemplo de error a buscar:**
```javascript
// ❌ Error:
Uncaught TypeError: Cannot read property 'fetch'

// ✅ OK:
GET /api/solicitudes 200 OK
```

---

### 4. Navbar Persistencia

**Objetivo:** Verificar que navbar se mantiene al navegar

**Pasos:**
1. Abrir page 1: `http://localhost:5000/dashboard.html`
2. Hacer click en navbar (ir a otra página)
3. Verificar navbar sigue visible
4. Repeat con diferentes páginas

**Qué verificar:**
- [ ] Navbar presente en todas las páginas
- [ ] Links de navbar son clickables
- [ ] Página carga sin recargar (smooth navigation)

---

### 5. LocalStorage/SessionStorage

**Objetivo:** Verificar que datos de sesión se guardan

**Pasos:**
1. F12 → **Application** tab
2. Expandir **LocalStorage**
3. Buscar datos guardados (tokens, preferencias, etc)

**Qué buscar:**
- `auth_token` - Token JWT del usuario
- `user_prefs` - Preferencias del usuario
- `recent_items` - Items recientes visitados

---

### 6. Performance Metrics

**Objetivo:** Medir velocidad de carga

**Pasos:**
1. F12 → **Network** tab
2. Recargar página (F5)
3. Ver tabla de recursos al final (muestra tiempos)
4. Click en línea de tiempo (Waterfall)

**Métricas importantes:**
- **DOMContentLoaded:** < 1000ms (ideal)
- **Load:** < 2000ms (ideal)
- **Total Resources:** < 20 (páginas limpias)

---

### 7. Responsividad

**Objetivo:** Verificar diseño en diferentes tamaños

**Pasos:**
1. F12 → Toggle **Device Toolbar** (Ctrl+Shift+M)
2. Seleccionar diferentes dispositivos:
   - iPhone 12 (390x844)
   - iPad (768x1024)
   - Desktop 1920x1080
3. Verificar que navbar y contenido se adaptan

**Qué verificar:**
- [ ] Navbar responsive en mobile
- [ ] Contenido legible en todos tamaños
- [ ] Sin scroll horizontal horizontal
- [ ] Botones clickeables en mobile

---

## 🔍 Debugging Específico

### Problema: "Cannot load /api/solicitudes"

**Solución:**
```javascript
// En Console, ejecutar:
fetch('/api/solicitudes')
  .then(r => r.json())
  .then(d => console.log('Data:', d))
  .catch(e => console.error('Error:', e))
```

### Problema: "Navbar no aparece"

**En Console:**
```javascript
// Buscar elemento
document.querySelector('.app-header')

// Si retorna null = Navbar no existe en HTML
// Solución: Revisar archivo HTML
```

### Problema: "CORS Error"

**Error típico:**
```
Access to fetch at 'http://localhost:5000/api/solicitudes'
from origin 'http://localhost:8080' has been blocked
```

**Solución:** Usar mismo servidor (localhost:5000 o localhost:8080, no mezclar)

---

## 📊 Páginas a Testear Manualmente

### Críticas (Testear primero)
1. ✅ `/dashboard.html` - Dashboard principal
2. ✅ `/login.html` - Autenticación
3. ✅ `/mis-solicitudes.html` - Listar solicitudes
4. ✅ `/crear-solicitud.html` - Crear solicitud
5. ✅ `/materiales.html` - Listar materiales

### Secundarias
6. `/mi-cuenta.html` - Perfil usuario
7. `/preferencias.html` - Preferencias
8. `/admin/dashboard.html` - Admin dashboard

### Extras (si tiempo permite)
9. `/ayuda.html` - Help page
10. `/notificaciones.html` - Notifications

---

## 📝 Plantilla de Testing

Usar esta plantilla para documentar resultados:

```markdown
## Test Report: [PÁGINA]

**URL:** http://localhost:5000/[PÁGINA].html
**Date:** 2025-11-08
**Tester:** [nombre]

### Carga Inicial
- [ ] Página carga (200 OK)
- [ ] HTML válido
- [ ] Navbar visible
- [ ] CSS cargado
- [ ] JS cargado

### API Calls
- [ ] /api/health: ✅/❌
- [ ] /api/solicitudes: ✅/❌
- [ ] /api/catalogos: ✅/❌

### Console
- [ ] Sin errores JavaScript
- [ ] Sin errores 404
- [ ] Sin errores CORS

### Navbar
- [ ] Navbar visible
- [ ] Navbar clickeable
- [ ] Links funcionan

### Performance
- [ ] Load time < 2s
- [ ] DOM parsed < 1s
- [ ] Responsivo (mobile/tablet/desktop)

### Issues Encontrados
- [ ] Ninguno
- [ ] (o listar aquí)

### Status Final
- ✅ PASS / ❌ FAIL
```

---

## 🚀 Comandos Útiles en Console

### Verificar API disponible
```javascript
fetch('/api/health').then(r => r.json()).then(d => console.log(d))
```

### Obtener todas las solicitudes
```javascript
fetch('/api/solicitudes').then(r => r.json()).then(d => console.log(d))
```

### Ver HTML de navbar
```javascript
console.log(document.querySelector('.app-header').outerHTML)
```

### Medir tiempo de carga
```javascript
console.time('load')
// ... hacer algo ...
console.timeEnd('load')
```

---

## ✅ Criterios de Éxito - Phase 3

✅ **Todos alcanzados si:**
- Página carga desde Flask (200 OK)
- Navbar presente y funcional
- API /api/health accesible (200 OK)
- API /api/solicitudes accesible
- Sin errores JavaScript en console
- Responsive en mobile/tablet/desktop
- Performance < 2s para load time
