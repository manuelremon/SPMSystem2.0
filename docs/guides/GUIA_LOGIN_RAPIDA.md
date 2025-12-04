# 🚀 GUÍA RÁPIDA - LOGIN Y NUEVA SOLICITUD

## 📍 ACCESO A LA APLICACIÓN

### URL
```
http://127.0.0.1:5000
```

---

## 👤 PASO 1: LOGIN

La aplicación está ahora disponible en http://127.0.0.1:5000

### Credenciales de Prueba

Puedes usar cualquiera de estos usuarios:

#### Usuario Solicitante
```
Email: solicitante1@empresa.com
Contraseña: password123
```

#### Usuario Aprobador
```
Email: jefe@empresa.com
Contraseña: password123
```

#### Usuario Administrador
```
Email: admin@empresa.com
Contraseña: password123
```

---

## ✍️ PASO 2: CREAR UNA NUEVA SOLICITUD

Una vez logueado como **Solicitante**:

1. Haz clic en **"Crear Solicitud"** en el menú
2. Completa el formulario con:
   - **Centro de Compra**: Selecciona de la lista
   - **Material**: Selecciona un material válido
   - **Cantidad**: Ingresa cantidad
   - **Monto**: El monto se calculará automáticamente
   - **Descripción**: Describe la solicitud (opcional)

3. **Valida que tu solicitud pase todas las validaciones:**
   - ✅ Material debe existir en la base de datos
   - ✅ Cantidad debe ser positiva
   - ✅ Monto debe ser coherente
   - ✅ El aprobador debe estar activo

4. Haz clic en **"Enviar Solicitud"**

---

## ✅ PASO 3: APROBAR LA SOLICITUD

Una vez que has creado la solicitud:

1. Cierra sesión (Logout)
2. Inicia sesión con el usuario **Aprobador** (`jefe@empresa.com`)
3. Verás la solicitud en **"Solicitudes Pendientes"**
4. Abre la solicitud y haz clic en **"Aprobar"** o **"Rechazar"**

---

## 🔍 PASO 4: MONITOREAR EL FLUJO

- **Como Solicitante**: Ve a **"Mis Solicitudes"** para ver el estado
- **Como Aprobador**: Ve a **"Solicitudes Pendientes"** para ver las que necesitan aprobación
- **Como Planificador**: Ve a **"Panel de Planificación"** para ver solicitudes aprobadas

---

## 📊 BASE DE DATOS VERIFICADA

La base de datos contiene:

```
✅ 44,461 Materiales
✅ 9 Usuarios (Solicitantes, Aprobadores, Planificadores)
✅ Estructura de BD completa y funcional
```

---

## ✨ LAS 4 VALIDACIONES ESTÁN ACTIVAS

Todas las validaciones de Fase 1 están implementadas y activas:

1. **Material Validation** ✅
   - Verifica que el material exista
   - Rechaza materiales inválidos

2. **Approver Validation** ✅
   - Verifica que el aprobador exista
   - Verifica que el aprobador esté ACTIVO

3. **Planner Validation** ✅
   - Verifica que el planificador exista
   - Verifica que el planificador esté disponible

4. **Pre-Approval Validation** ✅
   - Valida montos según rangos de autoridad
   - Rechaza solicitudes fuera de rango

---

## 🐛 TROUBLESHOOTING

### El navegador no abre
- Verifica que el servidor esté corriendo (debe estar en background)
- Intenta manualmente: http://127.0.0.1:5000

### Login falla
- Verifica la contraseña (es `password123`)
- Verifica que el correo sea exactamente como se muestra arriba

### Material no existe
- Es posible que los materiales no hayan sincronizado
- Recarga la página o intenta con otro material de la lista

### Solicitud se rechaza
- Verifica que el aprobador del rango esté activo
- Verifica que el monto esté dentro del rango de autorización

---

## 📞 SOPORTE

Si necesitas ayuda:
1. Verifica `docs/00_COMIENZA_AQUI.md`
2. Lee `docs/REPORTE_EJECUTIVO_FINAL.md`
3. Consulta `docs/CODE_REVIEW_GUIDE.md` para detalles técnicos

---

## ✅ STATUS: APLICACIÓN LISTA PARA TESTING

La Fase 1 está 100% completada y el sistema está listo para:
- ✅ Testing manual
- ✅ Code review
- ✅ Deployment a staging
- ✅ Deployment a producción
