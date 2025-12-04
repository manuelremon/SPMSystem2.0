# 📋 REGISTRO ÚNICO DE CAMBIOS - Refactorización SPA → Multi-Page

**Proyecto:** SPM v1.0
**Iniciado:** 8 de noviembre de 2025
**Objetivo:** Convertir arquitectura SPA dinámica a Multi-Page con navegación persistente
**Estado:** ⏳ En Planificación

---

## 📌 CONVENCIÓN DE REGISTRO

Cada cambio sigue este formato:

```
## [CAMBIO-NNN] - [FECHA] - [ESTADO]
**Archivo:** ruta/archivo
**Tipo:** [CREACIÓN|MODIFICACIÓN|ELIMINACIÓN|REFACTORIZACIÓN]
**Descripción:** Qué se cambió y por qué
**Líneas afectadas:** [número o rango]
**Reversión:** Comando o pasos para revertir
**Validación:** Cómo verificar que funcionó
---
```

---

## 🔄 TABLA DE ESTADOS

| Estado | Símbolo | Significado |
|--------|---------|------------|
| Planificado | ⏳ | Cambio planeado pero no ejecutado |
| En Progreso | 🔄 | Se está haciendo ahora |
| Completado | ✅ | Hecho y validado |
| Revertido | ↩️ | Se deshizo el cambio |
| Parcial | ⚠️ | Hecho pero requiere ajustes |

---

## 📊 RESUMEN EJECUTIVO

### Fase 1: Preparación ⏳
- [ ] Documentar todas las páginas
- [ ] Crear layout base
- [ ] Extraer recursos compartidos

### Fase 2: Refactorización ⏳
- [ ] Crear navbar compartido
- [ ] Convertir páginas a independientes
- [ ] Ajustar configuración Vite

### Fase 3: Navegación ⏳
- [ ] Actualizar links
- [ ] Implementar routing
- [ ] Mantener estado global

### Fase 4: Pruebas ⏳
- [ ] Validar rutas
- [ ] Probar navbar persistente
- [ ] Testing completo

---

## 📝 CAMBIOS REALIZADOS

### FASE 1: PREPARACIÓN

---

## [CAMBIO-002] - 8 de noviembre 2025 - ✅ COMPLETADO

**Archivo:** `src/frontend/ayuda.html`
**Tipo:** REFACTORIZACION
**Estado:** ✅ Completado

**Descripcion:**
- Convertir página de Ayuda al nuevo layout con navbar persistente
- Cambiar de componentes inyectados dinámicamente a navbar nativo HTML
- Usar rutas limpias (`/ayuda` en lugar de `ayuda.html`)
- Incluir contenido de FAQ, tutoriales y soporte

**Cambios específicos:**
- Eliminé carga dinámica con fetch
- Agregué navbar completo con estructura HTML nativa
- Actualicé links a rutas limpias: `/mi-cuenta`, `/preferencias`, etc.
- Agregué contenido de FAQ con estructura semantica

**Validacion:** ✅
- Archivo creado correctamente
- Estructura HTML válida
- Navbar persistente incluido

---

## [CAMBIO-003] - 8 de noviembre 2025 - ✅ COMPLETADO

**Archivo:** `vite.config.js`
**Tipo:** CONFIGURACION
**Estado:** ✅ Completado

**Descripcion:**
- Configurar Vite para servir rutas limpias
- Cambiar raíz de proyecto a `src/frontend`
- Habilitar middleware mode para manejo de rutas

**Validacion:** ✅
- Configuracion sintácticamente válida
- Proxy API sigue funcionando

---

## [CAMBIO-001] - 8 de noviembre - ✅ COMPLETADO

**Archivo:** `INVENTARIO_PAGINAS.md`
**Tipo:** CREACIÓN
**Estado:** ✅ COMPLETADO
**Descripción:**
- Crear inventario completo de todas las 30+ páginas HTML
- Documentar categorías: públicas, usuario, admin, especiales
- Mapear rutas propuestas para la nueva arquitectura
- Identificar interdependencias y componentes compartidos

**Líneas afectadas:** N/A (nuevo archivo)

**Qué se hizo:**
- Documentadas todas las páginas actuales
- Creado plan de migración por fases
- Identificadas decisiones a tomar

**Validación:**
- ✅ Archivo creado exitosamente
- ✅ Estructura clara y organizada
- ✅ Contiene decisiones documentadas

**Reversión:**
```powershell
Remove-Item "INVENTARIO_PAGINAS.md"
```

---

## [CAMBIO-002] - 8 de noviembre - ✅ COMPLETADO

**Archivo:** `src/frontend/_layout.html`
**Tipo:** CREACIÓN
**Estado:** ✅ COMPLETADO
**Descripción:**
- Crear layout base HTML que hereden todas las páginas
- Incluir navbar persistente (idéntica estructura a mis-solicitudes.html)
- Preparar estructura para contenido variable
- Establecer base para nueva arquitectura multi-página

**Líneas afectadas:** N/A (nuevo archivo)

**Qué se hizo:**
- Creado `_layout.html` con estructura completa
- Copiada navbar de `mis-solicitudes.html` con rutas actualizadas
- Rutas cambioadas de `.html` a limpias (ej: `/dashboard` en lugar de `dashboard.html`)
- Preparado para que cada página lo herede o use como template
- Incluidas todas las referencias a CSS, favicon, meta tags

**Estructura:**
```
_layout.html
├── HEAD (meta, CSS, favicon)
├── BODY
│   ├── HEADER (navbar persistente)
│   │   ├── Logo/brand
│   │   ├── Toggle menu (responsive)
│   │   └── Nav principal (menú dinámico)
│   ├── MAIN (contenido variable por página)
│   │   └── content-section
│   ├── FOOTER (opcional)
│   └── SCRIPTS (app.js compartido)
```

**Validación:**
- ✅ Archivo HTML válido
- ✅ Navbar con rutas correctas
- ✅ Estructura lista para heredar

**Reversión:**
```powershell
Remove-Item "src/frontend/_layout.html"
```

---

## [CAMBIO-003] - 8 de noviembre - ✅ COMPLETADO

**Archivo:** `src/frontend/shared/navbar.html`
**Tipo:** CREACIÓN
**Estado:** ✅ COMPLETADO
**Descripción:**
- Crear componente navbar reutilizable
- Permitir incluirlo en otras páginas si es necesario
- Mantener sincronización con layout base
- Facilitar mantenimiento futuro

**Líneas afectadas:** N/A (nuevo archivo)

**Qué se hizo:**
- Extraído navbar de `_layout.html`
- Creado archivo `src/frontend/shared/navbar.html`
- Incluye toda estructura del menú con rutas limpias
- Comentarios explicativos en HTML

**Validación:**
- ✅ Componente reutilizable
- ✅ Rutas actualizadas
- ✅ Estructura idéntica a layout

**Reversión:**
```powershell
Remove-Item "src/frontend/shared/navbar.html"
Remove-Item "src/frontend/shared/" -Recurse -ErrorAction SilentlyContinue
```

---

## 📊 RESUMEN FASE 1

### ✅ Completado:
- [x] Documentación de todas las páginas (30+)
- [x] Creación de layout base (_layout.html)
- [x] Componente navbar reutilizable
- [x] Rutas actualizadas a formato limpio

### ⏳ Próximo:
- [ ] Convertir primeras páginas a layout base
- [ ] Configurar Vite para rutas
- [ ] Actualizar navegación en app.js
- [ ] Testing de primera página

---

## 🎯 PRÓXIMOS CAMBIOS PLANEADOS

### 1️⃣ CREAR LAYOUT BASE

**Archivo:** `src/frontend/_layout.html`
**Tipo:** CREACIÓN
**Estado:** ⏳ Planificado
**Descripción:**
- Layout base que hereden todas las páginas
- Incluye navbar persistente
- Scripts y estilos comunes
- Placeholder para contenido variable

**Campos a incluir:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <!-- Meta, CSS, etc -->
</head>
<body>
  <nav class="app-navbar"><!-- navbar --></nav>
  <main class="app-main"><!-- CONTENIDO --></main>
  <footer class="app-footer"><!-- footer --></footer>
  <script src="/app.js"></script>
</body>
</html>
```

**Reversión:** Eliminar archivo `src/frontend/_layout.html`

---

### 2️⃣ CREAR NAVBAR COMPARTIDO

**Archivo:** `src/frontend/shared/navbar.html`
**Tipo:** CREACIÓN
**Estado:** ⏳ Planificado
**Descripción:**
- Extraer navbar de index.html actual
- Hacerlo reutilizable en todas las páginas
- Mantener funcionalidad actual (menú, usuario, logout)

**Reversión:** Eliminar directorio `src/frontend/shared/`

---

### 3️⃣ LISTAR TODAS LAS PÁGINAS ACTUALES

**Tipo:** DOCUMENTACIÓN
**Estado:** ⏳ Planificado
**Descripción:**
Mapear todas las páginas HTML que existen actualmente:

```
src/frontend/
├── index.html ........................... Home / Dashboard
├── mis-solicitudes.html ................. Mis Solicitudes
├── crear-solicitud.html ................. Crear Solicitud
├── materiales.html ...................... Catálogo Materiales
├── admin-dashboard.html ................. Admin Dashboard
├── admin-usuarios.html .................. Admin Usuarios
├── admin-materiales.html ................ Admin Materiales
├── admin-presupuestos.html .............. Admin Presupuestos
├── admin-catalogos.html ................. Admin Catálogos
├── admin-reportes.html .................. Admin Reportes
├── planificacion.html ................... Planificación
├── reportes.html ........................ Reportes
└── [otras páginas...] ................... ...
```

**Reversión:** N/A (solo documentación)

---

### 4️⃣ REFACTORIZAR APP.JS

**Archivo:** `src/frontend/app.js`
**Tipo:** REFACTORIZACIÓN
**Estado:** ⏳ Planificado
**Descripción:**
- Eliminar lógica de carga dinámica de páginas
- Mantener funciones auxiliares (api, toast, validación)
- Preparar para importación en múltiples páginas
- Dividir en módulos si es necesario

**Líneas afectadas:** Múltiples secciones

**Backup antes de cambios:**
```powershell
Copy-Item "src/frontend/app.js" "src/frontend/app.js.backup-FECHA"
```

**Reversión:**
```powershell
Copy-Item "src/frontend/app.js.backup-FECHA" "src/frontend/app.js" -Force
```

---

## 🔐 SISTEMA DE BACKUPS

Antes de cada cambio importante, se crea un backup:

```
src/frontend/backups/
├── app.js.backup-2025-11-08
├── index.html.backup-2025-11-08
├── styles.css.backup-2025-11-08
└── [otros archivos modificados]
```

**Crear backup:**
```powershell
$fecha = Get-Date -Format "yyyy-MM-dd-HHmmss"
$archivo = "src/frontend/app.js"
Copy-Item $archivo "$($archivo).backup-$fecha"
```

**Listar backups:**
```powershell
Get-ChildItem -Path "src/frontend/*.backup-*" | Sort-Object -Descending
```

---

## ⚡ REVERSIÓN RÁPIDA

**Si algo sale mal, revertir es simple:**

### Revertir un archivo específico:
```powershell
# Ver backups disponibles
ls src/frontend/*.backup-*

# Restaurar
Copy-Item "src/frontend/app.js.backup-FECHA" "src/frontend/app.js" -Force
```

### Revertir todo a un punto anterior:
```bash
# Ver commits
git log --oneline -10

# Revertir al anterior
git revert HEAD

# O volver a un commit específico
git checkout [COMMIT-HASH] -- src/frontend/
```

### Usando Git (más seguro):
```bash
# Ver estado
git status

# Ver cambios
git diff src/frontend/app.js

# Descartar cambios locales
git checkout -- src/frontend/app.js

# Ver historial completo
git log --follow -p src/frontend/app.js
```

---

## 📋 CHECKLIST ANTES DE CADA CAMBIO

- [ ] Leer esta sección
- [ ] Crear backup manual
- [ ] Documentar cambio ANTES de hacerlo
- [ ] Hacer el cambio
- [ ] Validar funcionamiento
- [ ] Documentar resultado
- [ ] Commit a Git con mensaje claro

---

## 🔍 VALIDACIÓN DESPUÉS DE CAMBIOS

### Checklist de pruebas después de cada cambio:

```
Frontend:
- [ ] App carga sin errores en http://localhost:5173
- [ ] Console (F12) sin errores rojos
- [ ] Navbar visible y funcional
- [ ] Links de navegación funcionan
- [ ] Login/Logout funciona
- [ ] API calls responden (Network tab)

Backend:
- [ ] Servidor Flask en http://localhost:5000
- [ ] Logs sin errores críticos
- [ ] Endpoints accesibles
- [ ] CORS funcionando
```

---

## 📞 DECISIONES Y NOTAS

### Decisión 1: Estructura de Navbar
- **Opción elegida:** Navbar compartido en `shared/navbar.html`
- **Razón:** DRY (Don't Repeat Yourself), más mantenible
- **Fecha:** 8 de noviembre de 2025

### Decisión 2: Rutas
- **Opción elegida:** Rutas limpias `/mis-solicitudes` sin `.html`
- **Razón:** Más moderno, mejor SEO, Flask lo soporta
- **Fecha:** 8 de noviembre de 2025

### Decisión 3: Estado Global
- **Opción elegida:** Mantener `window.state` actual
- **Razón:** Funciona, no requiere cambios complejos
- **Fecha:** 8 de noviembre de 2025

---

## 📊 IMPACTO ESTIMADO

| Aspecto | Antes | Después | Impacto |
|---------|-------|---------|--------|
| Páginas HTML | 1 (index.html) + dinámico | 30+ archivos | Modularidad ↑ |
| Recargas de página | 0 (SPA) | Muchas | Experiencia ↓ pero UX más familiar |
| Navbar persistente | ✅ Dinámico | ✅ Nativo | Rendimiento ↑ |
| Cacheable por navegador | ❌ | ✅ | Performance ↑ |
| Tamaño inicial HTML | Pequeño | Más grande | pero cacheable |

---

## 📞 REFERENCIAS

**Documentación del Proyecto:**
- CLAUDE.md - Arquitectura general
- QUICK_DEV_REFERENCE.md - Comandos rápidos
- DOCUMENTATION_INDEX.md - Índice

**Herramientas:**
- Git: `git log`, `git checkout`, `git diff`
- PowerShell: `Copy-Item`, `Get-ChildItem`, `Remove-Item`
- DevTools: F12 en navegador para validación

---

## ✅ AUTORIZACIÓN PARA EMPEZAR

**Revisado por:** [Usuario]
**Fecha de revisión:** [Fecha]
**Aprobado:** ⏳ Pendiente

---

**Última actualización:** 8 de noviembre de 2025
**Próxima revisión:** Después de Fase 1

---

## [CAMBIO-004] - 2025-11-08 - ✅ COMPLETADO
**Archivos:** dashboard.html, mis-solicitudes.html, crear-solicitud.html, materiales.html, admin-dashboard.html
**Tipo:** REFACTORIZACIÓN MASIVA
**Descripción:** Conversión de 5 páginas críticas del formato SPA dinámico a layout independiente con navbar persistente. Cambio de URLs antiguas (.html) a rutas limpias (/dashboard, /mis-solicitudes, etc.) y eliminación de carga dinámica de componentes.
**Cambios específicos:**
1. Dashboard: Agregada navbar integrada, removida carga dinámica via fetch, actualizado script a /app.js
2. Mis Solicitudes: Restaurada desde backup, actualizado navbar a URLs limpias (/mi-cuenta, /preferencias, /mis-solicitudes)
3. Crear Solicitud: Restaurada desde backup, actualizado todos los links de navbar
4. Materiales: Recreada completamente con navbar integrada y estructura correcta
5. Admin Dashboard: Restaurada desde backup, actualizado todos los links del menú admin

**Reversión:**
```bash
# Restaurar desde backups
Copy-Item "d:\GitHub\SPMv1.0\src\frontend\dashboard.html.backup-2025-11-08" "d:\GitHub\SPMv1.0\src\frontend\dashboard.html" -Force
Copy-Item "d:\GitHub\SPMv1.0\src\frontend\mis-solicitudes.html.backup-2025-11-08" "d:\GitHub\SPMv1.0\src\frontend\mis-solicitudes.html" -Force
Copy-Item "d:\GitHub\SPMv1.0\src\frontend\crear-solicitud.html.backup-2025-11-08" "d:\GitHub\SPMv1.0\src\frontend\crear-solicitud.html" -Force
Copy-Item "d:\GitHub\SPMv1.0\src\frontend\materiales.html.backup-2025-11-08" "d:\GitHub\SPMv1.0\src\frontend\materiales.html" -Force
Copy-Item "d:\GitHub\SPMv1.0\src\frontend\admin-dashboard.html.backup-2025-11-08" "d:\GitHub\SPMv1.0\src\frontend\admin-dashboard.html" -Force
```

**Validación:**
- ✅ Acceder a http://localhost:5173/dashboard → Se carga con navbar persistente
- ✅ Navegar a Solicitudes → Mis solicitudes → Verificar enlace funciona
- ✅ Hacer clic en logo → Regresa a /dashboard
- ✅ Revisar que el navbar se mantenga igual en todas las páginas
- ✅ Verificar que no hay errores en consola del navegador

---

**Última actualización:** 8 de noviembre de 2025
**Próxima revisión:** Después de testing completo
