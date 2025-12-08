# 📊 AUDITORÍA COMPLETA - 5 PROCESOS CRÍTICOS SPM

**Fecha:** 2 de noviembre de 2025
**Enfoque:** Pulir y perfeccionar los procesos de alma del proyecto

---

## 🎯 RESUMEN EJECUTIVO

Se han identificado y documentado los 5 procesos críticos del proyecto:

1. ✅ **Nueva Solicitud** - Bien estructurado, necesita mejoras menores
2. ✅ **Agregar Materiales** - Funcional, requiere validaciones adicionales
3. ⚠️ **Aprobación (Jefe/Gerente)** - Lógica confusa, necesita refactorización
4. ⚠️ **Asignación a Planificador** - Automático, pero no siempre correcto
5. ✅ **Gestión de Solicitud** - Básica, necesita más opciones

---

## 1️⃣ PROCESO: NUEVA SOLICITUD

### 📋 Descripción
Usuario crea una nueva solicitud de materiales con detalles básicos.

### 🔍 Análisis del Código

**Ubicación:** `src/backend/routes/solicitudes.py` - Línea 747: `crear_solicitud()`

**Flujo Actual:**
```
1. Usuario autentica
2. Valida payload con Pydantic (SolicitudCreate)
3. Crea borrador (draft) O solicitud completa
4. Sistema asigna automáticamente:
   - Aprobador basado en monto
   - Planificador basado en rol
5. Crea notificación para aprobador
6. Devuelve ID de solicitud
```

**Datos Recolectados:**
```json
{
  "id_usuario": "user_id",
  "centro": "Centro principal",
  "sector": "Sector X",
  "justificacion": "Motivo de la solicitud",
  "centro_costos": "CC-001",
  "almacen_virtual": "ALM-001",
  "criticidad": "Normal|Alta",
  "fecha_necesidad": "2025-11-15",
  "items": [
    {
      "codigo": "MAT-001",
      "descripcion": "Descripción del material",
      "cantidad": 10,
      "precio_unitario": 100.00,
      "comentario": "Notas"
    }
  ]
}
```

### ✅ QUÉ ESTÁ BIEN
- ✅ Validación con Pydantic robusta
- ✅ Manejo de borradores (drafts)
- ✅ Asignación automática de aprobador
- ✅ Notificaciones creadas
- ✅ Control de permisos

### ⚠️ PROBLEMAS IDENTIFICADOS

**1. Resolutor de Aprobador (Línea 67-94)**
```python
def _resolve_approver(con, user: dict, total_monto: float = 0.0):
    # Lógica de montos:
    # <= 20000: Jefe
    # 20000-100000: Gerente1
    # > 100000: Gerente2
```

**Problema:** Los montos están codificados, no configurables

**Impacto:** Si cambian políticas, hay que modificar código

**Recomendación:** Mover a tabla de configuración `aprobacion_limites`

---

**2. Resolución de Planificador (Línea 96-103)**
```python
def _resolve_planner(user: dict) -> str | None:
    # Busca: gerente2 → gerente1
    # Toma el primer no vacío
```

**Problema:** Lógica poco clara, mezcla roles con usuarios

**Impacto:** Asignación inconsistente

**Recomendación:** Usar tabla de mapeo explícito

---

**3. Validación de Items**
```python
# Solo valida que codigo existe
# NO valida:
# - Si el código existe en catalogo
# - Si el precio es correcto
# - Si hay stock disponible
```

**Impacto:** Items inválidos llegan a aprobación

**Recomendación:** Validar contra tabla de materiales

---

**4. Fechas de Necesidad**
```python
# NO se valida que sea fecha futura
# NO se valida contra fechas de corte
```

**Impacto:** Solicitudes con fechas pasadas

**Recomendación:** Validar fecha >= hoy

---

### 🔧 MEJORAS RECOMENDADAS

```python
# 1. Mover límites a config
CREATE TABLE aprobacion_limites (
    id INTEGER PRIMARY KEY,
    nombre VARCHAR(50),
    desde DECIMAL(15,2),
    hasta DECIMAL(15,2),
    aprobador_rol VARCHAR(50)
);

# 2. Validar material existe
def validar_material(codigo):
    material = db.materiales.find_by_codigo(codigo)
    if not material:
        raise ValueError(f"Material {codigo} no existe")
    return material

# 3. Validar fecha futuro
from datetime import date
def validar_fecha(fecha_str):
    fecha = date.fromisoformat(fecha_str)
    if fecha < date.today():
        raise ValueError("Fecha no puede ser en el pasado")
```

---

## 2️⃣ PROCESO: AGREGAR MATERIALES

### 📋 Descripción
Usuario agrega materiales/items a una solicitud (actualmente o en fase de borrador).

### 🔍 Análisis del Código

**Ubicación:** `src/backend/routes/solicitudes.py` - Funciones:
- `_normalize_items()` - Línea 123-164
- `actualizar_borrador()` - Línea 805-870
- `finalizar_solicitud()` - Línea 872-950

**Flujo Actual:**
```
1. Usuario incluye items en payload
2. Sistema normaliza items:
   - Extrae codigo, descripcion, cantidad, precio
   - Valida formato
   - Calcula subtotal
   - Calcula total
3. Guarda en data_json
4. Actualiza total_monto
5. Recalcula aprobador si cambió monto
```

**Datos de Item:**
```json
{
  "codigo": "MAT-001",
  "descripcion": "Material",
  "cantidad": 10,
  "precio_unitario": 100.00,
  "comentario": "Notas",
  "unidad": "UNIDAD",
  "subtotal": 1000.00
}
```

### ✅ QUÉ ESTÁ BIEN
- ✅ Normalización robusta de datos
- ✅ Manejo de formatos variados (precio, cantidad)
- ✅ Cálculo de totales automático
- ✅ Recalcula aprobador si necesario
- ✅ Permite actualizar items en borrador

### ⚠️ PROBLEMAS IDENTIFICADOS

**1. Sin Validación de Catalogo (Línea 123-164)**
```python
def _normalize_items(raw_items):
    for raw in raw_items:
        codigo = _coerce_str(raw.get("codigo"))
        if not codigo:
            continue  # ❌ SOLO valida que no esté vacío
        # NO busca en tabla materiales
```

**Impacto:** Items con códigos inventados pasan

**Recomendación:** Buscar en materiales.codigo

---

**2. Precios No Validados (Línea 148)**
```python
try:
    precio = float(precio_raw)
except:
    precio = 0.0  # ❌ Silencia errores
if precio < 0:
    precio = 0.0  # ❌ Pero acepta negativo y pone 0
```

**Impacto:** Precios inconsistentes, no hay auditoría

**Recomendación:** Rechazar si no hay precio, usar precio de catalogo

---

**3. Sin Validación de Cantidad**
```python
try:
    cantidad = int(raw.get("cantidad", 0))
except:
    cantidad = 0  # ❌ Silencia error
if cantidad < 1:
    cantidad = 1  # ❌ Corrige sin avisar
```

**Impacto:** Usuario no sabe que su cantidad fue modificada

**Recomendación:** Rechazar con mensaje claro

---

**4. Sin Límite de Items**
```python
# NO hay límite de items por solicitud
# NO hay validación de cantidad total
# NO hay validación de presupuesto total
```

**Impacto:** Solicitudes gigantes pueden colgar el sistema

**Recomendación:** Límites configurables

---

**5. Sin Eliminación de Items (Una vez submitida)**
```python
# Items solo se pueden cambiar en DRAFT
# Una vez submitida, NO se pueden eliminar
```

**Impacto:** Si hay error, debe cancelar y crear nueva

**Recomendación:** Permitir eliminar items hasta aprobación

---

### 🔧 MEJORAS RECOMENDADAS

```python
# 1. Validar material existe y obtener datos
def validar_y_enriquecer_item(codigo):
    material = db.query(
        "SELECT codigo, descripcion, precio, unidad "
        "FROM materiales WHERE codigo = ?"
        (codigo,)
    )
    if not material:
        raise ValueError(f"Código {codigo} no existe en catálogo")
    return {
        "codigo": material["codigo"],
        "descripcion": material["descripcion"],
        "precio_actual": material["precio"],
        "unidad": material["unidad"]
    }

# 2. Validar y rechazar si no está bien
def validar_item_completo(item):
    if not item.get("cantidad") or item["cantidad"] < 1:
        raise ValueError(f"Cantidad inválida: {item.get('cantidad')}")
    if not item.get("precio_unitario") or item["precio_unitario"] < 0:
        raise ValueError(f"Precio inválido: {item.get('precio_unitario')}")
    if item["cantidad"] > MAX_CANTIDAD_ITEM:
        raise ValueError(f"Cantidad excede límite {MAX_CANTIDAD_ITEM}")

# 3. Límite de items
MAX_ITEMS_POR_SOLICITUD = 50
MAX_CANTIDAD_ITEM = 10000
MAX_TOTAL_SOLICITUD = 5000000.00

# 4. Permitir eliminar items hasta aprobación
def eliminar_item(solicitud_id, item_index):
    solicitud = get_solicitud(solicitud_id)
    if solicitud.status not in ("DRAFT", "PENDIENTE_APROBACION"):
        raise ValueError("No se pueden eliminar items en este estado")
    items = solicitud.items
    items.pop(item_index)
    recalcular_total(solicitud)
    save(solicitud)
```

---

## 3️⃣ PROCESO: APROBACIÓN (JEFE/GERENTE 1/GERENTE 2)

### 📋 Descripción
Aprobador (Jefe, Gerente 1 o Gerente 2) revisa y aprueba/rechaza solicitud.

### 🔍 Análisis del Código

**Ubicación:** `src/backend/routes/solicitudes.py` - Línea 990+: `decidir_solicitud()`

**Flujo Actual:**
```
1. Aprobador obtiene lista de solicitudes pendientes
2. Revisa detalles (items, monto, justificación)
3. Decide: aprobar o rechazar
4. Si aprueba: status = "aprobada", va a planificador
5. Si rechaza: status = "rechazada", notifica usuario
6. Crea auditoria de decisión
```

### ✅ QUÉ ESTÁ BIEN
- ✅ Flujo básico funciona
- ✅ Permisos controlados (solo aprobador designado)
- ✅ Notificaciones creadas
- ✅ Auditoría de decisiones

### ⚠️ PROBLEMAS IDENTIFICADOS

**1. Aprobador Incorrecto (Línea 67-94)**
```
Lógica actual:
Monto <= 20,000 → Jefe
20,000 < Monto <= 100,000 → Gerente 1
Monto > 100,000 → Gerente 2
```

**Problema:**
- ❌ Sin validación si aprobador existe
- ❌ Sin fallback si aprobador falta
- ❌ Sin re-asignación si aprobador se va
- ❌ Sin escalada si jefe no responde

**Impacto:** Solicitudes quedan en limbo

**Recomendación:**
- Validar aprobador activo
- Escalada automática a Gerente 1 después de N días
- Asignar substituto si aprobador falta

---

**2. Flujo de Decisión Confuso (Línea 990+)**
```python
def decidir_solicitud():
    # Busca tabla de "tratamientos"
    # Pero si no existe, usa "decidir"
    # Hay dos caminos posibles, poco claro
```

**Problema:** Código duplicado, lógica no centralizada

**Impacto:** Difícil mantener, confuso para debuggear

**Recomendación:** Centralizar en función única `aprobar_solicitud()`

---

**3. Sin Validaciones en Aprobación**
```python
# NO valida:
# - Si materiales están disponibles
# - Si hay presupuesto
# - Si monto es consistente
# - Si usuario aún tiene acceso
```

**Impacto:** Aprobar sin saber si es posible ejecutar

**Recomendación:** Pre-validaciones antes de aprobar

---

**4. Sin Análisis de Rechazo**
```python
# Permite rechazar con comentario
# Pero NO guarda razón de rechazo
# Usuario no sabe por qué fue rechazado
```

**Impacto:** Comunicación pobre, usuario confundido

**Recomendación:** Guardar razón, notificar con detalles

---

**5. Sin Auditoría Completa**
```python
# Guarda quién aprobó
# Pero NO guarda:
# - Timestamp exacto
# - IP de aprobador
# - Notas del aprobador
# - Cambios realizados
```

**Impacto:** Auditoría incompleta para compliance

**Recomendación:** Tabla de auditoría dedicada

---

### 🔧 MEJORAS RECOMENDADAS

```python
# 1. Tabla de auditoria
CREATE TABLE solicitudes_auditoria (
    id INTEGER PRIMARY KEY,
    solicitud_id INTEGER,
    usuario_id VARCHAR,
    accion VARCHAR,  -- crear, editar, aprobar, rechazar
    detalles TEXT,  -- JSON con cambios
    ip_address VARCHAR,
    timestamp DATETIME,
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
);

# 2. Validaciones pre-aprobación
def pre_validar_aprobacion(solicitud):
    # Validar que materiales existen
    for item in solicitud.items:
        if not material_exists(item.codigo):
            raise ValidationError(f"Material {item.codigo} no existe")

    # Validar presupuesto
    presupuesto = get_presupuesto(solicitud.centro, solicitud.centro_costos)
    if solicitud.total > presupuesto.disponible:
        raise ValidationError(f"Presupuesto insuficiente")

    # Validar usuario sigue activo
    user = get_usuario(solicitud.id_usuario)
    if user.status != "activo":
        raise ValidationError(f"Usuario no activo")

# 3. Función única de aprobación
def aprobar_solicitud(solicitud_id, aprobador_id, comentario=None):
    solicitud = get_solicitud(solicitud_id)

    # Validar permisos
    if not es_aprobador_correcto(solicitud, aprobador_id):
        raise PermissionError("No eres aprobador de esta solicitud")

    # Pre-validaciones
    pre_validar_aprobacion(solicitud)

    # Realizar aprobación
    solicitud.status = "APROBADA"
    solicitud.aprobado_por = aprobador_id
    solicitud.aprobado_at = now()
    solicitud.comentario_aprobacion = comentario

    # Auditoría
    crear_auditoria(
        solicitud_id=solicitud_id,
        usuario_id=aprobador_id,
        accion="APROBAR",
        detalles={"comentario": comentario}
    )

    # Notificaciones
    notificar_usuario_aprobada(solicitud)
    notificar_planificador_nueva_solicitud(solicitud)

    save(solicitud)
    commit()
```

---

## 4️⃣ PROCESO: ASIGNACIÓN A PLANIFICADOR

### 📋 Descripción
Solicitud aprobada se asigna automáticamente al Planificador de Abastecimiento.

### 🔍 Análisis del Código

**Ubicación:** `src/backend/routes/solicitudes.py` - Línea 1054+

**Flujo Actual:**
```
1. Cuando se aprueba solicitud
2. Sistema busca "planner_id" de usuario
3. Asigna solicitud a ese planificador
4. Crea notificación para planificador
5. Cambia status a "en_tratamiento"
```

### ✅ QUÉ ESTÁ BIEN
- ✅ Automático (no requiere intervención)
- ✅ Notificación creada
- ✅ Status actualizado

### ⚠️ PROBLEMAS IDENTIFICADOS

**1. Planificador por Rol Confuso (Línea 96-103)**
```python
def _resolve_planner(user):
    # Toma gerente2 o gerente1 del usuario
    # Asume que es planificador
    # Muy frágil
```

**Problema:**
- ❌ No hay tabla explícita de planificadores
- ❌ Usa rol del usuario, no asignación
- ❌ Si usuario no tiene gerente2/gerente1, falla
- ❌ Sin fallback

**Impacto:** Solicitudes sin planificador asignado

**Recomendación:** Tabla `planificadores` con mapeo explícito

---

**2. Sin Validación de Planificador**
```python
# NO valida que planificador:
# - Existe
# - Está activo
# - Tiene permisos
# - No está sobrecargado
```

**Impacto:** Asigna a usuarios que no pueden procesar

**Recomendación:** Pre-validar antes de asignar

---

**3. Sin Carga de Trabajo**
```python
# NO considera carga actual del planificador
# Si un planificador tiene 1000 solicitudes
# Le sigue agregando más
```

**Impacto:** Cuello de botella, planificador abrumado

**Recomendación:** Balanceo de carga, round-robin

---

**4. Sin Escalada**
```python
# Si planificador falta, NO hay escalada
# Solicitud queda sin procesar indefinidamente
```

**Impacto:** Solicitudes en limbo

**Recomendación:** Escalada automática después de N días

---

### 🔧 MEJORAS RECOMENDADAS

```python
# 1. Tabla explícita de planificadores
CREATE TABLE planificadores (
    id INTEGER PRIMARY KEY,
    usuario_id VARCHAR UNIQUE,
    nombre VARCHAR,
    centro VARCHAR,
    sector VARCHAR,
    activo BOOLEAN DEFAULT 1,
    carga_maxima INTEGER DEFAULT 100,
    created_at DATETIME
);

# 2. Validar planificador
def obtener_planificador_disponible(centro, sector):
    planificador = db.query(
        """
        SELECT * FROM planificadores
        WHERE activo = 1
        AND (centro IS NULL OR centro = ?)
        AND (sector IS NULL OR sector = ?)
        AND (
            SELECT COUNT(*) FROM solicitudes
            WHERE planner_id = planificadores.usuario_id
            AND status IN ('en_tratamiento', 'asignada')
        ) < carga_maxima
        ORDER BY RANDOM()
        LIMIT 1
        """
        (centro, sector)
    )
    if not planificador:
        raise NoAvailablePlannerError("No hay planificador disponible")
    return planificador

# 3. Asignar con validación
def asignar_a_planificador(solicitud_id):
    solicitud = get_solicitud(solicitud_id)
    planificador = obtener_planificador_disponible(
        solicitud.centro, solicitud.sector
    )

    solicitud.planner_id = planificador.usuario_id
    solicitud.status = "EN_TRATAMIENTO"
    solicitud.asignado_at = now()

    notificar_planificador(
        planificador.usuario_id,
        f"Solicitud #{solicitud_id} asignada para tratamiento"
    )

    save(solicitud)

# 4. Escalada automática
def escalar_solicitud_sin_planificador():
    solicitudes_viejas = db.query(
        """
        SELECT id FROM solicitudes
        WHERE status = 'EN_TRATAMIENTO'
        AND planner_id IS NULL
        AND created_at < datetime('now', '-3 days')
        """
    )

    for solicitud_id in solicitudes_viejas:
        solicitud = get_solicitud(solicitud_id)
        planificador = obtener_planificador_disponible_fuerza()
        asignar_a_planificador(solicitud_id, planificador.usuario_id)
        notificar_admin("Escalada: Solicitud #{solicitud_id} asignada")
```

---

## 5️⃣ PROCESO: GESTIÓN DE LA SOLICITUD

### 📋 Descripción
Planificador gestiona solicitud (sigue estado, actualiza información, finaliza).

### 🔍 Análisis del Código

**Ubicación:** `src/backend/routes/solicitudes.py` - Línea 1000+

**Flujo Actual:**
```
1. Planificador obtiene lista de solicitudes asignadas
2. Puede ver detalles de solicitud
3. Puede marcar como completada o en proceso
4. Puede cancelar
5. Genera reportes de estado
```

### ✅ QUÉ ESTÁ BIEN
- ✅ Permisos controlados (solo planificador o aprobador)
- ✅ Estados controlados
- ✅ Auditoría de cambios

### ⚠️ PROBLEMAS IDENTIFICADOS

**1. Estados Incompletos**
```python
STATUS_PENDING = "pendiente_de_aprobacion"
STATUS_APPROVED = "aprobada"
STATUS_REJECTED = "rechazada"
STATUS_CANCELLED = "cancelada"
STATUS_FINALIZED = "finalizada"
STATUS_DRAFT = "draft"
STATUS_IN_TREATMENT = "en_tratamiento"
```

**Problema:**
- ❌ Estados son cadenas, no enumerados
- ❌ Transiciones sin validar (puede ir de cualquier lado a cualquier lado)
- ❌ Estados faltantes (ej: "parcialmente_cumplida", "en_espera_de_proveedor")
- ❌ Sin máquina de estados

**Impacto:** Transiciones inválidas, confusión

**Recomendación:** Máquina de estados explícita

---

**2. Sin Actualización de Items**
```python
# Una vez aprobada, NO se pueden cambiar items
# Si hay cambios en disponibilidad, hay que cancelar y crear nueva
```

**Impacto:** Proceso tedioso si hay cambios

**Recomendación:** Permitir cambios limitados hasta cierta fase

---

**3. Sin Historial de Cambios**
```python
# NO guarda historial de cambios
# Si item pasó de "compra" a "stock", no se sabe
# NO se puede auditar
```

**Impacto:** Auditoría imposible

**Recomendación:** Tabla de historial de cambios

---

**4. Sin Fechas de Cumplimiento**
```python
# NO hay SLA
# NO hay deadline de tratamiento
# NO hay seguimiento de retrasos
```

**Impacto:** Sin visibilidad de delays

**Recomendación:** Agregar SLA y alertas

---

**5. Sin Reportes de Progreso**
```python
# NO hay endpoint para ver progreso
# Usuario no sabe en qué estado está su solicitud
# Solo puede ver status
```

**Impacto:** Comunicación pobre

**Recomendación:** Endpoint de timeline/historial

---

### 🔧 MEJORAS RECOMENDADAS

```python
# 1. Máquina de estados
class SolicitudStatus(Enum):
    DRAFT = "draft"
    PENDIENTE_APROBACION = "pendiente_aprobacion"
    APROBADA = "aprobada"
    EN_TRATAMIENTO = "en_tratamiento"
    PARCIALMENTE_CUMPLIDA = "parcialmente_cumplida"
    COMPLETADA = "completada"
    RECHAZADA = "rechazada"
    CANCELADA = "cancelada"
    EN_ESPERA_PROVEEDOR = "en_espera_proveedor"

# Transiciones válidas
TRANSICIONES_VALIDAS = {
    DRAFT: [PENDIENTE_APROBACION, CANCELADA],
    PENDIENTE_APROBACION: [APROBADA, RECHAZADA],
    APROBADA: [EN_TRATAMIENTO],
    EN_TRATAMIENTO: [PARCIALMENTE_CUMPLIDA, EN_ESPERA_PROVEEDOR, CANCELADA],
    EN_ESPERA_PROVEEDOR: [EN_TRATAMIENTO],
    PARCIALMENTE_CUMPLIDA: [COMPLETADA, CANCELADA],
    COMPLETADA: [CANCELADA],
    RECHAZADA: [DRAFT],  # Permite re-submit
    CANCELADA: [],
}

# 2. Tabla de historial de cambios
CREATE TABLE solicitudes_cambios (
    id INTEGER PRIMARY KEY,
    solicitud_id INTEGER,
    campo VARCHAR,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    usuario_id VARCHAR,
    razon TEXT,
    timestamp DATETIME,
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
);

# 3. Validar transición
def cambiar_estado(solicitud_id, nuevo_estado, razon=None):
    solicitud = get_solicitud(solicitud_id)
    estado_actual = solicitud.status

    if nuevo_estado not in TRANSICIONES_VALIDAS.get(estado_actual, []):
        raise InvalidTransitionError(
            f"No se puede ir de {estado_actual} a {nuevo_estado}"
        )

    # Registrar cambio
    crear_cambio(
        solicitud_id=solicitud_id,
        campo="status",
        valor_anterior=estado_actual,
        valor_nuevo=nuevo_estado,
        razon=razon
    )

    solicitud.status = nuevo_estado
    solicitud.updated_at = now()
    save(solicitud)

# 4. Timeline de solicitud
def obtener_timeline(solicitud_id):
    cambios = db.query(
        """
        SELECT * FROM solicitudes_cambios
        WHERE solicitud_id = ?
        ORDER BY timestamp ASC
        """
        (solicitud_id,)
    )

    timeline = [
        {
            "timestamp": cambio.timestamp,
            "evento": f"Status cambió a {cambio.valor_nuevo}",
            "usuario": cambio.usuario_id,
            "razon": cambio.razon,
        }
        for cambio in cambios
    ]

    return timeline

# 5. Endpoint de historial
@bp.get("/solicitudes/<int:sol_id>/historial")
def obtener_historial_solicitud(sol_id):
    timeline = obtener_timeline(sol_id)
    cambios = obtener_cambios_items(sol_id)
    return {
        "timeline": timeline,
        "cambios": cambios
    }
```

---

## 📊 MATRIZ DE ISSUES

| Proceso | Severidad | Issue | Impacto | Fix |
|---------|-----------|-------|--------|-----|
| Nueva Solicitud | 🟡 Media | Aprobador hardcodeado | Inflexible | Mover a config |
| Nueva Solicitud | 🟡 Media | Sin validación de material | Items inválidos | Validar contra catalogo |
| Agregar Materiales | 🔴 Alta | Sin validación de precios | Inconsistencia | Rechazar o usar de catalogo |
| Agregar Materiales | 🟡 Media | Sin límites | Solicitudes gigantes | Agregar límites |
| Agregar Materiales | 🟡 Media | Sin eliminar items post-submit | Inflexible | Permitir eliminar |
| Aprobación | 🔴 Alta | Aprobador puede no existir | Solicitud en limbo | Validar y fallback |
| Aprobación | 🟡 Media | Sin pre-validaciones | Aprobar lo imposible | Agregar validaciones |
| Aprobación | 🟡 Media | Sin auditoría completa | Compliance risk | Tabla de auditoría |
| Asignación | 🔴 Alta | Planificador sin validar | Asignación fallida | Validar y fallback |
| Asignación | 🟡 Media | Sin balanceo de carga | Cuello de botella | Implementar round-robin |
| Asignación | 🟡 Media | Sin escalada | Solicitud en limbo | Escalada automática |
| Gestión | 🟡 Media | Sin máquina de estados | Transiciones inválidas | Implementar FSM |
| Gestión | 🟡 Media | Sin historial de cambios | Sin auditoría | Tabla de historial |
| Gestión | 🟡 Media | Sin SLA | Sin seguimiento | Agregar SLA |
| Gestión | 🟡 Media | Sin reportes de progreso | Mala comunicación | Endpoint de timeline |

---

## 🎯 PLAN DE ACCIÓN PRIORITIZADO

### FASE 1: Crítico (Semana 1)
- [ ] Validación de material existe
- [ ] Validación de aprobador existe
- [ ] Validación de planificador disponible
- [ ] Pre-validaciones en aprobación

### FASE 2: Alta Prioridad (Semana 2)
- [ ] Máquina de estados explícita
- [ ] Tabla de auditoria
- [ ] Tabla de historial de cambios
- [ ] Mover límites a configuración

### FASE 3: Mejoras (Semana 3)
- [ ] Balanceo de carga de planificadores
- [ ] Escalada automática
- [ ] SLA y alertas
- [ ] Endpoint de timeline

### FASE 4: Futuro
- [ ] IA para sugerencias de aprobador
- [ ] Predicción de retrasos
- [ ] Optimización automática de rutas de abastecimiento

---

## ✅ PRÓXIMOS PASOS

1. Revisar este análisis con el equipo
2. Priorizar fixes según impacto
3. Crear tickets para cada issue
4. Comenzar implementación en FASE 1
5. Testing exhaustivo de cada proceso

---

**Generado:** 2 de noviembre de 2025
**Autor:** GitHub Copilot - Code Review
**Versión:** 1.0 - Análisis Inicial
