# FASE 5: Plan de Implementación de Contenido

**Fecha:** 5 de noviembre de 2025
**Estado:** 🚧 En Desarrollo
**Objetivo:** Completar 13 páginas placeholder con contenido funcional

---

## 📋 Estrategia de Implementación

### Prioridades por Impacto

**Tier 1 - Críticas (User Workflows):**
1. ✅ **nueva-solicitud.html** - Crear solicitud (formulario/stepper)
2. ✅ **agregar-materiales.html** - Seleccionar materiales (search + grid)
3. ✅ **preferencias-page.html** - Preferencias usuario (settings)

**Tier 2 - Importantes (Admin Panels):**
4. ⏳ **usuarios.html** - Gestión usuarios (CRUD grid)
5. ⏳ **materiales.html** - Catálogo materiales (browser)
6. ⏳ **centros.html** - Gestión centros (CRUD)
7. ⏳ **almacenes.html** - Gestión almacenes (CRUD)

**Tier 3 - Complementarias (Info Pages):**
8. ⏳ **reportes.html** - Panel reportes (data visualization)
9. ⏳ **planificacion.html** - MRP planning (scheduler)
10. ⏳ **notificaciones-page.html** - Centro notificaciones (inbox)
11. ⏳ **mi-cuenta-page.html** - Perfil usuario (personal)
12. ⏳ **ayuda.html** - Sección ayuda (FAQ/Documentation)

---

## 🎯 FASE 5.1: Nueva Solicitud (Form/Stepper)

### Ubicación
`src/frontend/nueva-solicitud.html`

### Estructura
```html
3-Step Stepper:
├── STEP 1: Información Básica
│   ├── Centro (select dropdown) [API: /api/catalogos/centros]
│   ├── Sector (select dropdown) [API: /api/catalogos/sectores]
│   ├── Almacén (select dropdown) [API: /api/catalogos/almacenes]
│   └── Criticidad (radio: Baja/Media/Alta)
│
├── STEP 2: Justificación
│   ├── Justificación (textarea)
│   ├── Fecha Necesaria (date input)
│   ├── Observaciones (textarea opcional)
│   └── Archivos (file upload)
│
└── STEP 3: Revisión
    ├── Resumen de datos
    ├── Botón: "Guardar como Borrador" (POST /api/solicitudes/drafts)
    └── Botón: "Enviar Solicitud" (POST /api/solicitudes)

Navigation:
- Anterior/Siguiente entre steps
- Skip opcional para ciertos campos
- Validación antes de avanzar
```

### Estilos
- Stepper indicador visual (3 círculos con líneas)
- Form fields con validación inline
- Progress bar visual
- Buttons: Primary (Siguiente), Secondary (Anterior), Danger (Cancelar)

---

## 🎯 FASE 5.2: Agregar Materiales (Search Interface)

### Ubicación
`src/frontend/agregar-materiales.html`

### Estructura
```html
Layout Two-Column:
├── LEFT: Material Catalog (Search + Filter)
│   ├── Search Box (por nombre/código)
│   ├── Filters:
│   │   ├── Categoría (checkbox)
│   │   ├── Disponibilidad (toggle)
│   │   └── Precio Range (slider)
│   └── Material Grid (3 columns)
│       ├── Thumbnail/Icon
│       ├── Nombre
│       ├── Código
│       ├── Precio Unit.
│       ├── Stock disponible
│       └── "Agregar" button
│
└── RIGHT: Selected Materials (Summary)
    ├── Materiales seleccionados (table)
    ├── Columns: Material, Cantidad, Precio Unit., Subtotal
    ├── Input: Editable cantidad
    ├── Action: Eliminar material
    ├── Total
    ├── Botón: "Guardar Selección"
    └── Botón: "Limpiar Todo"

Data Loading:
- GET /api/materiales → Cargar catálogo
- GET /api/materiales?search=... → Búsqueda
- Guardar en sessionStorage mientras edita
```

### Estilos
- Two-column layout responsive
- Material cards con hover effects
- Search highlight
- Quantity inputs con +/- buttons
- Pricing calculations in real-time

---

## 🎯 FASE 5.3: Usuarios (Admin Grid)

### Ubicación
`src/frontend/usuarios.html`

### Estructura
```html
Admin Dashboard - User Management:
├── Header con "Agregar Usuario" button (modal form)
├── Filtros:
│   ├── Buscar por nombre/email
│   ├── Rol (dropdown)
│   ├── Estado (Active/Inactive)
│   └── Centro (select)
│
└── Users Table (8 columns):
    ├── ID
    ├── Nombre
    ├── Email
    ├── Centro
    ├── Rol (Admin/Planner/User)
    ├── Estado (badge: Active/Inactive)
    ├── Último Login
    └── Acciones (Ver, Editar, Desactivar, Eliminar)

Modales:
├── Modal: Agregar Usuario (form)
├── Modal: Editar Usuario (form)
├── Modal: Confirmar Eliminación
└── Modal: Ver Detalles Usuario

APIs:
- GET /api/admin/usuarios → Listado
- POST /api/admin/usuarios → Crear
- PUT /api/admin/usuarios/{id} → Editar
- DELETE /api/admin/usuarios/{id} → Eliminar
```

### Estilos
- Admin table con striped rows
- Status badges coloreadas
- Action buttons con icons
- Modal forms con validación
- Pagination si hay muchos usuarios

---

## 🎯 FASE 5.4: Materiales (Catálogo)

### Ubicación
`src/frontend/materiales.html`

### Estructura
```html
Material Catalog Admin:
├── Header con "Agregar Material" button
├── Filtros:
│   ├── Buscar por nombre/código
│   ├── Categoría (dropdown)
│   ├── Stock (Low/Adequate/High)
│   └── Proveedor (select)
│
├── View Toggle: Grid/List
├── Materials Grid/Table:
│   ├── Thumbnail/Image
│   ├── Código
│   ├── Nombre
│   ├── Categoría
│   ├── Precio Unit.
│   ├── Stock Actual
│   ├── Stock Mínimo
│   ├── Proveedor
│   └── Acciones (Ver, Editar, Eliminar)
│
└── Modales:
    ├── Agregar Material
    ├── Editar Material
    └── Ver Detalles

APIs:
- GET /api/materiales → Catálogo
- POST /api/materiales → Crear
- PUT /api/materiales/{id} → Editar
- DELETE /api/materiales/{id} → Eliminar
```

---

## 🎯 FASE 5.5-5.8: Páginas Admin Restantes

### centros.html (Centro Management)
```
- CRUD table para centros
- Columns: Código, Nombre, Ubicación, Responsable, Estado
- Filtros: Búsqueda, Estado, Región
- Modales: Agregar, Editar, Ver Detalles
```

### almacenes.html (Warehouse Management)
```
- CRUD table para almacenes
- Columns: Código, Nombre, Centro, Capacidad, Stock Usado, Estado
- Filtros: Búsqueda, Centro, Capacidad
- Modales: Agregar, Editar, Ver Detalles
```

### reportes.html (Reports Dashboard)
```
- Report selectors (Dropdown)
- Date range picker
- Buttons: Generate PDF, Export Excel, View
- Report preview area
- Charts/Graphics
- Filters: Centro, Sector, Date Range
```

### planificacion.html (MRP Planning)
```
- Planificador visual (Gantt-like)
- Timeline: Next 30/60/90 days
- Cards: Solicitudes programadas
- Drag-drop para rescheduling
- Color coding por estado
- Filters: Centro, Criticidad, Estado
```

---

## 🎯 FASE 5.9-5.12: User Pages

### notificaciones-page.html (Notification Center)
```
- Inbox-style layout
- Filters: All/Read/Unread
- Search notifications
- Mark as read/unread
- Delete notification
- Notification detail view
- Columns: Time, Title, Type, Actions
```

### preferencias-page.html (User Preferences)
```
- Settings form:
  ├── Theme (Light/Dark/Auto)
  ├── Idioma (Español/English)
  ├── Formato de Fecha
  ├── Zona Horaria
  ├── Notificaciones (checkboxes)
  ├── Email de Recuperación
  └── Contraseña (Change Password button)

- Save button
- Validación de datos
- Success/Error messages
```

### mi-cuenta-page.html (User Profile)
```
- Profile Card:
  ├── Avatar (uploadable)
  ├── Nombre
  ├── Email
  ├── Centro asignado
  ├── Rol
  ├── Fecha de creación
  ├── Último acceso

- Editable Fields:
  ├── Nombre completo
  ├── Email
  ├── Teléfono
  └── Foto de perfil

- Acciones:
  ├── Editar perfil
  ├── Cambiar contraseña
  ├── Descargar datos
  └── Cerrar sesión
```

### ayuda.html (Help Section)
```
- FAQ Accordion:
  ├── ¿Cómo crear solicitud?
  ├── ¿Cómo agregar materiales?
  ├── ¿Cómo cambiar preferencias?
  ├── ¿Cómo ver reportes?
  └── [Más preguntas]

- Contact Form:
  ├── Asunto (dropdown)
  ├── Mensaje (textarea)
  ├── Email (prefilled)
  └── Enviar button

- Documentation Links:
  ├── User Guide PDF
  ├── Video Tutorials
  ├── API Documentation
  └── Known Issues
```

---

## 🛠️ Arquitectura Común para Todas

### Base HTML Template
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Page Title] - SPM</title>
  <link rel="stylesheet" href="/components/shared-styles.css">
  <!-- Additional page-specific styles -->
</head>
<body>
  <div id="navbar"></div>
  <div class="main-container">
    <div id="header"></div>
    <div class="content">
      <div class="content-header">
        <h1 class="page-title">[Title]</h1>
        <p class="page-subtitle">[Subtitle]</p>
      </div>

      <!-- PAGE-SPECIFIC CONTENT HERE -->

    </div>
  </div>

  <script src="/components/shared-scripts.js"></script>
  <script src="/static/js/api_client.js"></script> <!-- Usar si existe -->
  <script>
    // Page-specific initialization
    async function initPage() {
      await loadComponents();
      // Load page data
      // Setup event handlers
    }
    document.addEventListener('DOMContentLoaded', initPage);
  </script>
</body>
</html>
```

### CSS Patterns
```css
/* Usar variables de shared-styles.css */
/* Colores: var(--primary), var(--danger), var(--success) */
/* Spacing: var(--spacing-xs) a var(--spacing-3xl) */
/* Typography: var(--font-family), var(--text-* ) */

/* Componentes reusables: */
.btn, .btn-primary, .btn-secondary, .btn-danger
.form-group, .form-input, .form-select, .form-textarea
.modal, .modal-header, .modal-body, .modal-footer
.table, .table-striped, .table-hover
.card, .badge, .alert
```

### JavaScript Patterns
```javascript
// 1. Cargar componentes
async function loadComponents() {
  const navbar = await fetch('/components/navbar.html');
  const header = await fetch('/components/header.html');
  if (navbar.ok) document.getElementById('navbar').innerHTML = await navbar.text();
  if (header.ok) document.getElementById('header').innerHTML = await header.text();
  updateActiveNavItem();
  loadUserInfo();
  setupLogout();
  setupNotificationBadge();
}

// 2. Cargar datos de API
async function loadPageData() {
  try {
    const response = await fetch('/api/endpoint', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    populateUI(data);
  } catch (error) {
    console.error(error);
    showNotification('Error loading data', 'error');
  }
}

// 3. Event handlers
document.querySelector('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(Object.fromEntries(formData))
  });
  if (response.ok) showNotification('Success', 'success');
});
```

---

## 📊 Estimación de Esfuerzo

| Página | Complejidad | Líneas Est. | Tiempo Est. |
|--------|------------|------------|------------|
| nueva-solicitud | Alta | 400+ | 30 min |
| agregar-materiales | Alta | 350+ | 25 min |
| preferencias | Media | 200+ | 15 min |
| usuarios | Alta | 300+ | 25 min |
| materiales | Alta | 300+ | 25 min |
| centros | Media | 250+ | 20 min |
| almacenes | Media | 250+ | 20 min |
| reportes | Media | 200+ | 20 min |
| planificacion | Muy Alta | 400+ | 35 min |
| notificaciones-page | Media | 250+ | 20 min |
| mi-cuenta | Media | 250+ | 20 min |
| ayuda | Baja | 200+ | 15 min |
| **TOTAL** | | **3650+** | **~4 horas** |

---

## ✅ Criterios de Éxito

Para cada página:
- ✅ HTML estructura correcta
- ✅ Importa shared-styles.css
- ✅ Carga shared-scripts.js
- ✅ Inyecta navbar y header
- ✅ Llama al menos 1 endpoint de API
- ✅ Maneja errores y loading states
- ✅ Responsive design
- ✅ Accesible (WCAG básico)
- ✅ Sin console errors

---

## 🚀 Comenzar

Voy a empezar con las **3 páginas de Tier 1** (mayor impacto):

1. **nueva-solicitud.html** ← Inicio aquí
2. **agregar-materiales.html**
3. **preferencias-page.html**

¿Procedemos?
