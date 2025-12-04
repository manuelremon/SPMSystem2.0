# 🧪 TESTING NAVEGACIONAL - ITERACIÓN 2

**Fecha:** 8 de noviembre de 2025
**Servidor:** http://localhost:5173
**Backend:** http://localhost:5000
**Status:** 🟢 EN EJECUCIÓN

---

## 📋 PLAN DE TESTING

### Fase 1: Carga Inicial ✅
- [ ] **Dashboard** → http://localhost:5173/dashboard
  - Verifica que carga sin errores
  - Comprueba navbar persiste
  - Valida que aparecen datos (si existen)

### Fase 2: Navegación Horizontal (Dentro de Navegación Principal)
- [ ] Dashboard → Mis Solicitudes
- [ ] Mis Solicitudes → Crear Solicitud
- [ ] Crear Solicitud → Materiales
- [ ] Materiales → Notificaciones
- [ ] Notificaciones → Mi Cuenta

**Checklist por página:**
```
✓ Navbar visible
✓ Sin errores en consola (F12)
✓ URL limpia (sin .html)
✓ Contenido específico carga
```

### Fase 3: Navegación Admin (Solo si autenticado como admin)
- [ ] Dashboard → Admin (si visible)
- [ ] Admin → Solicitudes Admin
- [ ] Admin → Usuarios
- [ ] Admin → Materiales
- [ ] Admin → Centros
- [ ] Admin → Almacenes
- [ ] Admin → Reportes

### Fase 4: Validación Técnica

#### 4.1 Navbar Persistencia
```javascript
// Ejecutar en consola (F12):
document.querySelector('header.app-header') ? 'OK' : 'FALLO'
document.querySelector('nav') ? 'OK' : 'FALLO'
```

#### 4.2 Scripts Cargados
```javascript
// Verificar en consola:
window.app ? 'app.js cargado ✓' : 'ERROR'
```

#### 4.3 Enlaces Funcionales
```javascript
// Contar enlaces en navbar:
document.querySelectorAll('nav a').length
// Verificar que NO son .html:
Array.from(document.querySelectorAll('nav a')).filter(a =>
  a.href.includes('.html')
).length === 0 ? 'OK' : 'FALLO'
```

#### 4.4 Estilos Aplicados
```javascript
// Verificar estilos.css cargado:
document.head.innerHTML.includes('/styles.css') ? 'OK' : 'FALLO'
```

---

## 🔍 PUNTOS CRÍTICOS A VALIDAR

### Navbar
- ✓ Presente en todas las páginas
- ✓ Activo (no es iframe)
- ✓ Enlaces navegan sin recargar
- ✓ Ícono/Logo visible

### Rutas
- ✓ Sin `.html` en URL
- ✓ URLs limpias (solo `/pagina`)
- ✓ Botón atrás funciona
- ✓ Refresh mantiene URL

### Contenido
- ✓ Específico de cada página
- ✓ No superpuesto (sin capas)
- ✓ Responde a usuario
- ✓ Estilos aplicados correctamente

### Consola (F12)
- ✓ Sin errores rojos
- ✓ Sin 404s en recursos
- ✓ Sin warnings críticos

---

## 📊 CRITERIOS DE ÉXITO

| Criterio | Umbral | Estado |
|----------|--------|--------|
| Páginas cargan sin error | 5/5 | ⏳ Testing |
| Navbar persiste | 5/5 | ⏳ Testing |
| Rutas limpias | 5/5 | ⏳ Testing |
| Consola sin errores | 5/5 | ⏳ Testing |
| Enlaces funcionales | 100% | ⏳ Testing |

---

## 🚀 EJECUCIÓN

### Paso 1: Navega a http://localhost:5173/dashboard
```
✓ ¿Se carga sin errores?
✓ ¿Ves navbar?
✓ ¿Ves contenido del dashboard?
```

### Paso 2: Abre consola (F12) y ejecuta:
```javascript
// Verifica que app.js cargó
console.log('Navbar:', document.querySelector('header') ? 'OK' : 'FALLO');
console.log('Scripts:', window.app ? 'Cargado' : 'NO CARGADO');
console.log('Estilos:', document.head.innerHTML.includes('/styles.css') ? 'OK' : 'FALLO');
```

### Paso 3: Haz clic en enlaces del navbar
- Mis Solicitudes (o similar)
- Verifica que navega sin recargar
- Verifica que URL cambia a `/mis-solicitudes` (SIN .html)
- Verifica navbar sigue visible

### Paso 4: Si hay errores
```
Toma screenshot o copia error
Comparte en editor
→ Diagnosticaré y corregiré
```

---

## 📝 REGISTRO DE RESULTADOS

### Sesión 1 - [FECHA/HORA]
**Tester:** [TU NOMBRE]
**Duración:** [X minutos]

#### Dashboard
- [ ] Carga sin errores
- [ ] Navbar visible
- [ ] URL correcta: /dashboard
- [ ] Consola limpia (F12)
- [ ] Observaciones: _______________

#### Mis Solicitudes
- [ ] Carga sin errores
- [ ] Navbar visible
- [ ] URL correcta: /mis-solicitudes
- [ ] Consola limpia (F12)
- [ ] Observaciones: _______________

#### Crear Solicitud
- [ ] Carga sin errores
- [ ] Navbar visible
- [ ] URL correcta: /crear-solicitud
- [ ] Consola limpia (F12)
- [ ] Observaciones: _______________

#### Materiales
- [ ] Carga sin errores
- [ ] Navbar visible
- [ ] URL correcta: /materiales
- [ ] Consola limpia (F12)
- [ ] Observaciones: _______________

#### Admin Dashboard
- [ ] Carga sin errores
- [ ] Navbar visible
- [ ] URL correcta: /admin
- [ ] Consola limpia (F12)
- [ ] Observaciones: _______________

---

## 🎯 RESULTADO FINAL

**Status:** ⏳ PENDIENTE EJECUCIÓN

```
[ ] Todas las páginas cargan correctamente
[ ] Navbar persiste en todas las páginas
[ ] URLs son limpias (sin .html)
[ ] Navegación funciona sin recargar
[ ] Consola sin errores críticos
[ ] Enlaces internos funcionales

✅ LISTO PARA PRODUCCIÓN si: 5/5 ✓
```

---

**Próxima acción:** Abre http://localhost:5173/dashboard y comienza testing
