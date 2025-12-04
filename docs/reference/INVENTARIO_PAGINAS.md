# 📄 INVENTARIO DE PÁGINAS - Fase 1 Preparación

**Creado:** 8 de noviembre de 2025
**Propósito:** Documentar todas las páginas HTML actuales para la migración SPA → Multi-Page

---

## 📋 CONTEO TOTAL

- **Total de archivos .html:** 30+
- **Páginas principales:** 20+
- **Páginas de admin:** 8
- **Archivos especiales:** index.html (login), dashboard.html (home)

---

## 🗂️ ESTRUCTURA ACTUAL

### 1️⃣ PÁGINAS PÚBLICAS / LOGIN

| Archivo | Función | Componentes |
|---------|---------|-----------|
| `index.html` | **Login / Autenticación** | Formulario login, registro |
| `home.html` | Home dashboard inicial | Cards de acciones rápidas |

---

### 2️⃣ PÁGINAS DE USUARIO (Roles: Usuario, Coordinador, Admin)

| Archivo | Función | Ruta Propuesta | Status |
|---------|---------|----------------|--------|
| `dashboard.html` | Dashboard principal | `/dashboard` | ✅ Core |
| `mis-solicitudes.html` | Mis solicitudes (usuario) | `/mis-solicitudes` | ✅ Core |
| `crear-solicitud.html` | Crear nueva solicitud | `/crear-solicitud` | ✅ Core |
| `materiales.html` | Catálogo de materiales | `/materiales` | ✅ Core |
| `equipo-solicitudes.html` | Solicitudes del equipo | `/equipo-solicitudes` | ⚠️ Coordinador |
| `planificacion.html` | Planificación de solicitudes | `/planificacion` | ⚠️ Especial |
| `reportes.html` | Reportes y estadísticas | `/reportes` | ⚠️ Especial |
| `ai-console.html` | Consola IA (asistente) | `/ai-console` | ⚠️ Especial |
| `ayuda.html` | Página de ayuda | `/ayuda` | ℹ️ Info |

---

### 3️⃣ PÁGINAS DE ADMINISTRACIÓN (Rol: Admin)

| Archivo | Función | Ruta Propuesta |
|---------|---------|----------------|
| `admin-dashboard.html` | Admin dashboard | `/admin` |
| `admin-usuarios.html` | Gestionar usuarios | `/admin/usuarios` |
| `admin-materiales.html` | Gestionar materiales | `/admin/materiales` |
| `admin-solicitudes.html` | Gestionar solicitudes | `/admin/solicitudes` |
| `admin-reportes.html` | Reportes admin | `/admin/reportes` |
| `admin-configuracion.html` | Configuración del sistema | `/admin/configuracion` |
| `admin-almacenes.html` | Gestionar almacenes | `/admin/almacenes` |
| `admin-centros.html` | Gestionar centros | `/admin/centros` |

---

### 4️⃣ PÁGINAS ESPECIALES / TEMPORALES

| Archivo | Función | Estado | Acción |
|---------|---------|--------|--------|
| `agregar-materiales.html` | Agregar materiales masivos | ⏳ Experimental | ? Mantener |
| `almacenes.html` | Almacenes (vista de usuario) | ⏳ Experimental | ? Mantener |
| `centros.html` | Centros (vista de usuario) | ⏳ Experimental | ? Mantener |
| `debug-materiales.html` | Debug de materiales | 🔧 Debug | ❌ Eliminar |
| `preview.html` | Preview (documentación) | 📚 Doc | ℹ️ Revisar |
| `solicitudes.html` | ¿Duplicado? | ⚠️ Revisar | ? Revisar |

---

## 🔍 ANÁLISIS DE INTERDEPENDENCIAS

### Archivos Compartidos (Todos las páginas usan):

```
├── app.js ..................... Lógica principal, API, validación
├── styles.css ................. Estilos globales
├── vite.config.js ............. Configuración build
└── variables globales en index.html
    ├── state (objeto global)
    ├── API (configuración backend)
    ├── Funciones compartidas
    └── Constantes
```

### Componentes Reutilizables (encontrados en app.js):

```
✅ Modales:
  • showMaterialDescriptionModal()
  • showConfirmDialog()
  • showFormModal()

✅ Tablas:
  • renderRequestsTable()
  • renderMaterialsTable()
  • renderUsersTable()

✅ Formularios:
  • validateSolicitudForm()
  • validateUserForm()
  • submitForm()

✅ Utilidades:
  • api() - llamadas HTTP
  • toast() - notificaciones
  • makeRequest() - wrapper HTTP
  • formatCurrency() - formato moneda
```

---

## 📊 ESTADO DE LA REFACTORIZACIÓN

### ✅ Páginas "Listas" (sin dependencias complejas)

- `ayuda.html` - Solo contenido estático
- `home.html` - Simple, pocos elementos
- `planificacion.html` - Parcialmente independiente

### ⚠️ Páginas "Intermedias" (requieren ajustes)

- `mis-solicitudes.html` - Depende de app.js
- `dashboard.html` - Depende de app.js + variables globales
- `reportes.html` - Depende de API backend

### 🔴 Páginas "Complejas" (requieren refactor profundo)

- `crear-solicitud.html` - Integración form, validación, API
- `admin-*.html` - Múltiples dependencias
- `ai-console.html` - Integración especial

---

## 🎯 DECISIONES A TOMAR

### Decisión 1: Páginas de Debug y Experimentos
```
❌ ELIMINAR:
  • debug-materiales.html
  • preview.html (mover a docs/)

⚠️ REVISAR:
  • solicitudes.html (¿es duplicado?)
  • agregar-materiales.html (¿estado experimental?)
```

### Decisión 2: Estructura de Rutas Admin
```
OPCIÓN A: Bajo /admin
  /admin/usuarios
  /admin/materiales
  /admin/solicitudes

OPCIÓN B: Separado en nivel superior
  /admin-usuarios
  /admin-materiales
  /admin-solicitudes
```

**Mi recomendación:** OPCIÓN A (más coherente)

### Decisión 3: Páginas "Transitorias"
```
¿Mantener durante transición?
  • almacenes.html
  • centros.html
  • agregar-materiales.html

O ¿Integrar directamente en admin?
```

---

## 🏗️ PLAN DE MIGRACIÓN

### FASE 1A: Preparación (AHORA)
- [x] Documentar todas las páginas
- [ ] Crear layout base (`_layout.html`)
- [ ] Extraer navbar a componente reutilizable
- [ ] Crear estructura de directorios

### FASE 1B: Scaffold (siguiente)
- [ ] Crear cada página como archivo independiente
- [ ] Heredar de layout base
- [ ] Probar carga individual

### FASE 2: Conversión
- [ ] Actualizar links de navegación
- [ ] Cambiar href a rutas reales
- [ ] Adaptar app.js para nuevas rutas

### FASE 3: Validación
- [ ] Probar cada página funciona
- [ ] Verificar navbar persiste
- [ ] Testing completo

---

## 📝 NOTA IMPORTANTE

Todas las páginas actuales **se cargan dinámicamente** dentro de `index.html`:

```javascript
// Patrón actual:
Click en link → href="mis-solicitudes.html"
  ↓
app.js intercepta
  ↓
Carga archivo HTML dentro de <div class="content-section">
  ↓
Desaparece página anterior, muestra nueva contenido
```

**Después de migración:**

```javascript
// Patrón nuevo:
Click en link → href="/mis-solicitudes"
  ↓
Navegador carga completamente nueva página
  ↓
Navbar se mantiene visible (layout base)
  ↓
Contenido principal cambia
```

---

## 🔐 BACKUPS ANTES DE CAMBIOS

Crear backup completo:
```powershell
.\scripts\dev\cambios.ps1 -accion backup
```

---

**Próximo paso:** Crear `_layout.html` base
