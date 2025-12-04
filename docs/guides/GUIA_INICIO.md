# 🚀 GUÍA DE INICIO - BASE DE DATOS SPM

## Estado Actual

✅ **Base de datos completamente poblada**
- 24/24 tablas con datos
- 44,577 registros totales
- Workflows completos de prueba
- Catálogo de 44,461 materiales

---

## Cómo Empezar

### 1️⃣ Verificar la Base de Datos

```bash
# Ver el conteo de registros
python check_tables.py

# Debería mostrar:
# ✅ 24 tablas pobladas
# ❌ 0 tablas vacías
```

### 2️⃣ Iniciar el Backend

```bash
# En PowerShell desde \SPM\SPM
python wsgi.py

# Debería ver:
# * Running on http://127.0.0.1:5000
```

### 3️⃣ Iniciar el Frontend

```bash
# En otra ventana PowerShell desde \SPM\SPM
npm run dev

# Debería ver:
# ➜ Local: http://localhost:5173/
```

### 4️⃣ Acceder a la Aplicación

Abre: **http://localhost:5173**

---

## 🔐 Credenciales de Prueba

Todos los usuarios tienen diferentes roles. Prueba con:

| Usuario | Email | Contraseña | Rol |
|---------|-------|-----------|-----|
| Manuel Remon | manuelremon@live.com.ar | a1 | Administrador |
| Juan Levi | juanlevi@ypf.com | a1 | Solicitante |
| Pedro Mamani | pedromamani@ypf.com | a2 | Solicitante |
| Roberto Rosas | robertorosas@ypf.com | a3 | Aprobador |
| Carlos Perez | carlosperez@ypf.com | a1 | Aprobador |

---

## 📋 Lo Que Puedes Hacer

### Como Solicitante (Juan Levi)
1. ✅ Crear nueva solicitud
2. ✅ Seleccionar materiales (44,461 disponibles)
3. ✅ Especificar cantidad
4. ✅ Adjuntar documentos
5. ✅ Enviar para aprobación

### Como Aprobador (Roberto Rosas)
1. ✅ Ver solicitudes pendientes
2. ✅ Revisar detalles
3. ✅ Aprobar o rechazar
4. ✅ Dejar comentarios

### Como Administrador (Manuel Remon)
1. ✅ Ver todas las solicitudes
2. ✅ Generar reportes
3. ✅ Ver presupuestos globales
4. ✅ Gestionar usuarios

---

## 🔍 Datos de Prueba Pre-cargados

### Solicitudes Existentes
- 5 solicitudes en diferentes estados
- Con líneas de items
- Algunos con archivos adjuntos
- Algunos en proceso de aprobación

### Presupuestos
- 2 presupuestos por centro/sector
- Total: $300,090 USD disponible

### Materiales
- 44,461 materiales en catálogo
- Listos para seleccionar en solicitudes

### Centros Operacionales
- UP Loma La Lata (1008)
- UP UTE Rio Neuquén (1500)
- UP Añelo (1050)
- Y otros más...

---

## 🧪 Escenarios de Testing

### Scenario 1: Solicitud Simple
1. Login como Juan Levi (Solicitante)
2. Crear nueva solicitud
3. Buscar material "Bombas" en catálogo
4. Agregar 2 unidades
5. Enviar

### Scenario 2: Aprobación
1. Login como Roberto Rosas (Aprobador)
2. Ver solicitud recién enviada
3. Revisar detalles
4. Aprobar
5. Ver que se genera OC (orden de compra)

### Scenario 3: Búsqueda Grande
1. Cualquier usuario
2. Buscar materiales
3. Aplicar filtros por sector
4. Verificar paginación con 44K items

### Scenario 4: Reportes
1. Login como Manuel Remon (Admin)
2. Ver dashboard
3. Generar reporte de presupuestos
4. Ver solicitudes por estado

---

## 📊 Qué Ver en el Sistema

### Dashboard (Inicio)
- [ ] Últimas solicitudes
- [ ] Presupuestos disponibles
- [ ] Notificaciones pendientes

### Solicitudes
- [ ] Crear nueva
- [ ] Filtrar por estado
- [ ] Ver detalles completos
- [ ] Descargar archivos

### Catálogo de Materiales
- [ ] Buscar por nombre
- [ ] Filtrar por sector
- [ ] Ver precios en USD
- [ ] Verificar disponibilidad

### Presupuestos
- [ ] Ver por centro
- [ ] Ver por sector
- [ ] Calcular saldo disponible
- [ ] Ver incorporaciones

### Usuarios
- [ ] Listar todos
- [ ] Ver roles
- [ ] Ver permisos
- [ ] (Admin) Editar

---

## 🐛 Cómo Reportar Problemas

Si encuentras un error:

1. **Anota el error exacto** que ves
2. **Reproduce el paso a paso**
3. **Captura pantalla si es UI**
4. **Revisa la consola del backend** (errores Python)
5. **Revisa la consola del navegador** (F12 → Console)

Errores comunes:

| Error | Causa | Solución |
|-------|-------|----------|
| "Port already in use" | Backend ya corre | Cambiar puerto o matar proceso |
| "Cannot GET /" | Frontend no iniciado | Ejecutar `npm run dev` |
| "Database locked" | Múltiples accesos | Cerrar todas las conexiones |
| 404 en API | Ruta inexistente | Verificar endpoint en docs |

---

## 📝 Próximos Pasos

Después de validar el sistema:

### Fase 1: Funcionalidad Base ✅ COMPLETADA
- [x] Base de datos poblada
- [x] Backend corriendo
- [x] Frontend accesible
- [x] Login funcionando

### Fase 2: Workflows (EN PROGRESO)
- [ ] Crear solicitud completa
- [ ] Flujo de aprobación
- [ ] Generación de órdenes
- [ ] Traslados

### Fase 3: Reporting (PENDIENTE)
- [ ] Reportes de solicitudes
- [ ] Análisis de presupuestos
- [ ] Históricos
- [ ] Exportación

### Fase 4: Optimización (PENDIENTE)
- [ ] Performance de búsqueda
- [ ] Caché de materiales
- [ ] Índices de base de datos
- [ ] Paginación

---

## 🚨 Importante

- **No cambies la BD manualmente** sin backup
- **Las contraseñas son de prueba** - cambiarlas en producción
- **Los emails no se envían realmente** - solo se encolan
- **Los datos se pueden reinicializar** ejecutando `load_data_final.py`

---

## 📞 Soporte

Si necesitas:
- **Resetear la BD**: Elimina `spm.db` y ejecuta `load_data_final.py`
- **Ver logs**: Revisa la carpeta logs/ o la consola
- **Cambiar puerto**: En `wsgi.py` modifica `port=5000`
- **Agregar datos**: Edita los CSV en `src/backend/data/` y re-ejecuta

---

## ✅ Checklist Final

Antes de proceder con testing integral:

- [ ] BD abierta correctamente
- [ ] Backend iniciado sin errores
- [ ] Frontend cargado en navegador
- [ ] Login exitoso con cualquier usuario
- [ ] Puedo ver dashboard
- [ ] Puedo acceder a catálogo de materiales
- [ ] Puedo ver solicitudes existentes
- [ ] Puedo ver presupuestos

**Si todos los checks ✅ estén OK → Sistema listo para testing**

---

¡**ÉXITO! Base de datos lista para explorar. 🎉**
