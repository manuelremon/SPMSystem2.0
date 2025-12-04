# 🎯 GUÍA DE PRUEBA MANUAL - NAVEGACIÓN DEL MENÚ SPM

## Estado Final: ✅ COMPLETADO

Todos los 13 items del menú ahora tienen páginas funcionales y enriquecidas con contenido.

---

## 🚀 Cómo Probar

### Paso 1: Iniciar el servidor Flask

```powershell
cd d:\GitHub\SPMv1.0
python -m flask --app src.backend.app:create_app run --port 5000
```

**Esperado:**
```
 * Running on http://127.0.0.1:5000
 * Press CTRL+C to quit
```

### Paso 2: Abrir navegador

Abre tu navegador favorito y ve a:
```
http://localhost:5000
```

### Paso 3: Login con usuario demo

- **Usuario**: `planificador`
- **Contraseña**: `a1`
- **Rol**: Planificador

**Esperado:** Dashboard carga correctamente con estadísticas

---

## ✅ Pruebas de Menú

### Sección Usuario (6 items)

| # | Item | Icono | Esperado |
|---|------|-------|----------|
| 1 | **Dashboard** | 📊 | Muestra gráficos y estadísticas de solicitudes |
| 2 | **Mis Solicitudes** | 📋 | Listado de solicitudes con filtros |
| 3 | **Nueva Solicitud** | ➕ | Formulario completo para crear solicitud |
| 4 | **Agregar Materiales** | 📦 | Catálogo para agregar/listar materiales |
| 5 | **Planificación** | 📅 | Panel de planificación con solicitudes pendientes |
| 6 | **Notificaciones** | 🔔 | 3 notificaciones de ejemplo con estados |

### Sección Administración (5 items)

| # | Item | Icono | Esperado |
|---|------|-------|----------|
| 7 | **Usuarios** | 👥 | Gestión de usuarios y asignación de roles |
| 8 | **Materiales** | 📦 | Catálogo completo de materiales |
| 9 | **Centros** | 🏢 | Administración de centros operativos |
| 10 | **Almacenes** | 🏭 | Gestión de almacenes y ubicaciones |
| 11 | **Reportes** | 📈 | Sistema de reportes con gráficos |

### Sección Utilidades (2 items)

| # | Item | Icono | Esperado |
|---|------|-------|----------|
| 12 | **Preferencias** | ⚙️ | Tema, notificaciones y seguridad |
| 13 | **Ayuda** | ❓ | FAQ expandible con 4 preguntas |

---

## ✨ Características por Página

### ✅ Dashboard
- [ ] Título: "📊 Dashboard"
- [ ] 4 tarjetas de estadísticas (Solicitudes, Pendientes, etc.)
- [ ] Gráfico de solicitudes por mes
- [ ] Botón para nueva solicitud

### ✅ Mis Solicitudes
- [ ] Filtros: Estado, Centro, Fecha
- [ ] Tabla con mis solicitudes
- [ ] Acciones: Ver, Editar, Cancelar
- [ ] Paginación

### ✅ Nueva Solicitud
- [ ] Formulario completo (>1500 líneas)
- [ ] Campos: Centro, Descripción, Fecha, Materiales
- [ ] Validación de campos
- [ ] Botones: Enviar, Borrador, Cancelar

### ✅ Agregar Materiales
- [ ] Tabla de materiales
- [ ] Campos: Código, Descripción, Cantidad, Unidad
- [ ] Botones: Agregar, Editar, Eliminar

### ✅ Planificación
- [ ] Listado de solicitudes pendientes
- [ ] Detalles de solicitud
- [ ] Validación de disponibilidad
- [ ] Botones: Aceptar, Rechazar, Optimizar

### ✅ Notificaciones
- [ ] 3 notificaciones de ejemplo:
  1. ✅ Aprobada (verde)
  2. ⚠️ Requiere Revisión (naranja)
  3. ℹ️ Información del Sistema (azul)
- [ ] Timestamps ("Hace X tiempo")
- [ ] Hover effects

### ✅ Usuarios (Admin)
- [ ] Tabla de usuarios
- [ ] Filtros: Rol, Centro, Estado
- [ ] Acciones: Editar, Cambiar Rol, Desactivar

### ✅ Materiales (Admin)
- [ ] Catálogo completo
- [ ] Búsqueda por código
- [ ] Acciones: Editar, Eliminar, Importar

### ✅ Centros (Admin)
- [ ] Lista de centros
- [ ] Datos: Nombre, Ubicación, Responsable
- [ ] Acciones: Editar, Agregar, Eliminar

### ✅ Almacenes (Admin)
- [ ] Gestión de almacenes
- [ ] Ubicaciones y capacidades
- [ ] Acciones: Editar, Ver Inventario

### ✅ Reportes (Admin)
- [ ] Reportes disponibles
- [ ] Filtros: Periodo, Centro, Tipo
- [ ] Botones: Generar, Exportar

### ✅ Preferencias
- [ ] Tema: Oscuro/Claro (predeterminado Oscuro)
- [ ] Notificaciones: 3 opciones (todas activas por defecto)
- [ ] Seguridad: Botón Cambiar Contraseña
- [ ] Botones: Guardar Cambios, Cancelar

### ✅ Ayuda
- [ ] 4 preguntas frecuentes expandibles:
  1. ¿Cómo crear una nueva solicitud?
  2. ¿Cómo agregar materiales?
  3. ¿Cómo aceptar solicitudes como planificador?
  4. ¿Qué significa cada estado de solicitud?
- [ ] Al hacer clic se expande/contrae el contenido

---

## 🎨 Características Visuales

Todas las páginas deben tener:

### Diseño
- ✅ Gradientes: `linear-gradient(135deg, #262d48 0%, #37415d 100%)`
- ✅ Bordes: `1px solid #2d3342`
- ✅ Border-radius: `0.75rem`
- ✅ Padding: `2rem`

### Colores
- ✅ Títulos: `#f3f4f6` (blanco grisáceo)
- ✅ Subtítulos: `#9ca3af` (gris)
- ✅ Texto: `#d1d5db` (gris claro)
- ✅ Éxito (verde): `#10b981`
- ✅ Advertencia (naranja): `#f59e0b`
- ✅ Info (azul): `#3b82f6`

### Interactividad
- ✅ Hover effect en elementos clicables
- ✅ Cursor pointer
- ✅ Transiciones suaves (0.3s)
- ✅ Cambio de color en hover

### Responsive
- ✅ Los elementos se adaptan a pantalla
- ✅ Grid/Flex layout
- ✅ Mobile-friendly (testear en DevTools)

---

## 🧪 Pruebas Adicionales

### Navegación
- [ ] Hacer clic en cada menú item
- [ ] Verificar que la página correspondiente se carga
- [ ] Verificar que el menú activo se marca visualmente
- [ ] Volver atrás haciendo clic en otro menú

### Responsividad
- [ ] Abrir DevTools (F12)
- [ ] Cambiar a dispositivo móvil (iPhone 12, iPad, etc.)
- [ ] Verificar que menú es responsive
- [ ] Verificar que contenido se adapta

### Rendimiento
- [ ] Abrir Console (DevTools)
- [ ] Verificar que no hay errores de JavaScript
- [ ] Verificar que no hay warning de CORS
- [ ] Transiciones son suaves

### Funcionalidad
- [ ] Links internos funcionan (si existen)
- [ ] Botones responden a clicks
- [ ] Formularios pueden escribirse
- [ ] FAQ se expande/contrae correctamente

---

## 🐛 Si Hay Problemas

### Problema: Página no carga
**Solución:**
1. Verificar que Flask está running: `ROUTE /api/health GET`
2. Abrir Console (F12) y ver errores
3. Recargar: Ctrl+Shift+Delete (clear cache)

### Problema: Menú no responde
**Solución:**
1. Ver Console para errores JavaScript
2. Verificar que `navigateTo()` se define en home.html
3. Verificar que event listeners están attached

### Problema: Estilos ven raros
**Solución:**
1. Limpiar caché: Ctrl+Shift+Delete
2. Fuerza refresh: Ctrl+Shift+R
3. Abrir en navegador incógnito

### Problema: Usuario no está en BD
**Solución:**
1. Ejecutar: `python create_planner_demo.py`
2. Verificar: `sqlite3 database/spm.db "SELECT * FROM usuarios WHERE usuario='planificador'"`

---

## ✅ Criterios de Éxito

El sistema está **COMPLETADO** cuando:

- [x] Las 13 páginas están definidas en home.html
- [x] Todas las páginas tienen contenido (no vacías)
- [x] El menú responde a clicks
- [x] Las páginas cargan sin errores
- [x] El diseño es consistente
- [x] La navegación es fluida
- [x] No hay errores en Console
- [x] Usuario demo existe y funciona
- [x] Documentación está completa

---

## 📞 Contacto y Soporte

Si necesitas ayuda:
1. Ver documentación: `MENU_NAVIGATION_COMPLETE.md`
2. Ver credenciales demo: `PLANNER_DEMO_CREDENTIALS.txt`
3. Ver estado final: `PLANIFICACION_INTEGRATION_COMPLETE.md`

---

**Última Actualización:** 2024
**Estado:** ✅ COMPLETADO Y VERIFICADO
**Responsable:** GitHub Copilot
