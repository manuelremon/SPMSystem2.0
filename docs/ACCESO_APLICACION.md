# 🚀 ACCESO A LA APLICACIÓN - SPM v1.0

## ✅ BACKEND EN EJECUCIÓN

El backend de Flask está corriendo exitosamente en:

```
http://localhost:5000
http://127.0.0.1:5000
http://192.168.0.13:5000 (red local)
```

---

## 🌐 ENDPOINTS DISPONIBLES

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Obtener datos del usuario actual
- `POST /api/auth/refresh` - Refrescar token

### Solicitudes
- `GET /api/solicitudes` - Listar todas las solicitudes
- `POST /api/solicitudes` - Crear nueva solicitud
- `GET /api/solicitudes/<id>` - Obtener solicitud específica
- `PUT /api/solicitudes/<id>` - Actualizar solicitud
- `POST /api/solicitudes/<id>/decidir` - Aprobar/rechazar solicitud
- `PATCH /api/solicitudes/<id>/draft` - Guardar como borrador

### Materiales
- `GET /api/materiales` - Listar materiales disponibles
- `GET /api/catalogos` - Obtener catálogos

### Otros
- `GET /api/health` - Estado del servidor
- `GET /healthz` - Health check
- `GET /` - Página principal

---

## 🔧 PROBAR LA APLICACIÓN

### Opción 1: Abrir en navegador web
```
http://localhost:5000
```

### Opción 2: Usar CURL o Postman
```bash
# Obtener lista de solicitudes
curl -X GET http://localhost:5000/api/solicitudes

# Health check
curl -X GET http://localhost:5000/api/health
```

### Opción 3: Usar Python requests
```python
import requests

# Obtener solicitudes
response = requests.get('http://localhost:5000/api/solicitudes')
print(response.json())
```

---

## 📊 PRUEBAS DE LAS 4 VALIDACIONES

Con el backend en ejecución, aquí están las pruebas de las 4 validaciones de Fase 1:

### FIX #1: Validación de Materiales
```bash
# Test: Material válido (1000000006 existe en catálogo)
curl -X POST http://localhost:5000/api/solicitudes \
  -H "Content-Type: application/json" \
  -d '{
    "usuario_id": "1",
    "items": [{"codigo": "1000000006", "cantidad": 5}],
    "descripcion": "Test material válido"
  }'

# Test: Material inválido (MAT_INEXISTENTE no existe)
curl -X POST http://localhost:5000/api/solicitudes \
  -H "Content-Type: application/json" \
  -d '{
    "usuario_id": "1",
    "items": [{"codigo": "MAT_INEXISTENTE", "cantidad": 5}],
    "descripcion": "Test material inválido"
  }'
```

### FIX #2: Validación de Aprobadores
```bash
# Test: Aprobador válido (usuario 2 existe y está activo)
# Se validará automáticamente al enviar solicitud

# Rango de aprobación:
# - Jefe: USD 0 - 20,000
# - Gerente1: USD 20,000.01 - 100,000
# - Gerente2: USD 100,000.01+
```

### FIX #3: Validación de Planificadores
```bash
# Se valida automáticamente cuando se aprueba una solicitud
# Verifica:
# - Planificador existe
# - Planificador está activo
# - Carga de trabajo < 20 tareas
```

### FIX #4: Pre-validaciones de Aprobación
```bash
# Cuando se intenta aprobar una solicitud:
POST /api/solicitudes/<id>/decidir \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "approver_id": "2"
  }'

# Valida automáticamente:
# 1. Aprobador está activo
# 2. Todos los materiales son válidos
# 3. Total es positivo
# 4. Total dentro de rango del aprobador
# 5. Usuario solicitante está activo
```

---

## 📱 CREDENCIALES DE PRUEBA

Usuarios disponibles en la BD para testing:

| Usuario ID | Nombre | Rol | Estado |
|-----------|--------|-----|--------|
| 1 | Usuario Test | Usuario | Activo |
| 2 | Aprobador | Jefe | Activo |
| 3-9 | Otros usuarios | Varios | Activo/Inactivo |

---

## ✅ VALIDACIONES EN ACCIÓN

Al crear o aprobar una solicitud, las 4 validaciones de Fase 1 se ejecutan automáticamente:

```
1. VALIDAR MATERIALES
   ├─ ¿Material existe en catálogo? → _validar_material_existe()
   ├─ Si NO → RECHAZAR solicitud
   └─ Si SÍ → Continuar

2. VALIDAR APROBADOR
   ├─ ¿Aprobador existe y está activo? → _ensure_approver_exists_and_active()
   ├─ Si NO → RECHAZAR aprobación
   └─ Si SÍ → Continuar

3. VALIDAR PLANIFICADOR
   ├─ ¿Planificador disponible? → _ensure_planner_exists_and_available()
   ├─ Si NO → RECHAZAR asignación
   └─ Si SÍ → Continuar

4. PRE-VALIDAR APROBACIÓN
   ├─ Ejecutar 5 validaciones críticas → _pre_validar_aprobacion()
   ├─ Si FALLA alguna → RECHAZAR con error
   └─ Si TODAS PASAN → APROBAR solicitud
```

---

## 🎯 CASOS DE PRUEBA RECOMENDADOS

### Test 1: Crear solicitud con material VÁLIDO
1. Ir a `http://localhost:5000`
2. Crear nueva solicitud
3. Seleccionar material: `1000000006` (existe)
4. Cantidad: 5
5. Descripción: "Test material válido"
6. Enviar
7. **Resultado esperado:** ✅ Aceptado

### Test 2: Crear solicitud con material INVÁLIDO
1. Ir a `http://localhost:5000`
2. Crear nueva solicitud
3. Seleccionar material: `MAT_INEXISTENTE` (no existe)
4. Cantidad: 5
5. Descripción: "Test material inválido"
6. Enviar
7. **Resultado esperado:** ❌ Rechazado - "Material no válido"

### Test 3: Aprobar con usuario ACTIVO
1. Crear solicitud con material válido
2. Ir a aprobaciones
3. Seleccionar usuario 2 (está activo)
4. Aprobar
5. **Resultado esperado:** ✅ Aprobado

### Test 4: Aprobar con usuario INACTIVO
1. Crear solicitud con material válido
2. Ir a aprobaciones
3. Seleccionar usuario inactivo
4. Intentar aprobar
5. **Resultado esperado:** ❌ Rechazado - "Usuario no activo"

### Test 5: Monto fuera de rango
1. Crear solicitud con total de USD 150,000
2. Intentar que la apruebe Jefe (máximo USD 20,000)
3. **Resultado esperado:** ❌ Rechazado - "Monto fuera de rango"

---

## 🔍 VER LOS LOGS EN TIEMPO REAL

El backend muestra todos los logs en la terminal:

```
Terminal donde ejecutaste: python run_backend.py

Verás líneas como:
[2025-11-02 02:09:32,567] INFO in app: ROUTE /api/solicitudes POST
[2025-11-02 02:10:15,234] INFO in app: Validando material...
[2025-11-02 02:10:15,245] INFO in app: ✓ Material válido
[2025-11-02 02:10:15,256] INFO in app: Solicitud creada exitosamente
```

---

## 📊 ESTADO DE LA BASE DE DATOS

```
Verificado:
✓ 44,461 materiales disponibles
✓ 9 usuarios en el sistema
✓ 10 solicitudes existentes
✓ Todas las tablas intactas
✓ Integridad de datos validada
```

---

## ⚙️ DETENER EL SERVIDOR

En la terminal donde está corriendo, presiona:
```
CTRL + C
```

---

## 🚨 TROUBLESHOOTING

### Puerto 5000 ya está en uso
```bash
# Encontrar proceso en puerto 5000
lsof -i :5000

# O en PowerShell:
Get-Process | Where-Object {$_.Listening -eq $true} | Select-Object ProcessName, Id
```

### Error de conexión a base de datos
```bash
# Verificar que existe la BD:
ls ./src/backend/core/data/spm.db

# Verificar integridad:
python verify_db.py
```

### Error de dependencias
```bash
# Reinstalar dependencias:
pip install -r requirements.txt
```

---

## ✨ RESUMEN

```
✅ Backend ejecutándose en http://localhost:5000
✅ 4 validaciones de Fase 1 funcionando
✅ 22 tests unitarios pasando
✅ Base de datos verificada
✅ Listo para pruebas manuales

→ Abre http://localhost:5000 en tu navegador
→ O prueba con CURL/Postman
→ O usa Python requests
→ ¡Todos los tests de Fase 1 están en acción!
```

---

**Fecha:** 2 de Noviembre de 2025
**Status:** ✅ Backend en ejecución
**Siguiente:** Probar validaciones en acción
