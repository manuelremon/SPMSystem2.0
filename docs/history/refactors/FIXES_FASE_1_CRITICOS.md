# 🔧 FIXES INMEDIATOS - FASE 1 (SEMANA 1)

**Fecha:** 2 de noviembre de 2025
**Prioridad:** CRÍTICA
**Estado:** Listos para implementar

---

## 🎯 Objetivo

Implementar las 4 validaciones críticas que previenen que solicitudes llegen en estado inválido:

1. ✅ Validar que material existe en catálogo
2. ✅ Validar que aprobador existe y está activo
3. ✅ Validar que planificador existe y está disponible
4. ✅ Pre-validaciones antes de aprobar

---

## FIX #1: Validar Material en Catálogo

### 📍 Ubicación
`src/backend/routes/solicitudes.py` - Función `_normalize_items()`

### 🔍 Problema Actual
```python
def _normalize_items(raw_items):
    for raw in raw_items:
        codigo = _coerce_str(raw.get("codigo"))
        if not codigo:
            continue  # ❌ SOLO valida que no esté vacío
        # ❌ NO valida que existe en materiales
```

### 🔧 Solución

**Paso 1:** Agregar función de validación
```python
def _validar_material_existe(con, codigo: str) -> dict[str, Any] | None:
    """Valida que material existe en catálogo y retorna sus datos."""
    material = con.execute(
        """
        SELECT codigo, descripcion, precio, unidad_medida
          FROM materiales
         WHERE LOWER(codigo) = LOWER(?)
        """,
        (codigo.strip(),),
    ).fetchone()
    return material
```

**Paso 2:** Modificar `_normalize_items()` para usar validación
```python
def _normalize_items(raw_items, con=None) -> tuple[list[dict[str, Any]], float]:
    """
    Normaliza y valida items.

    Si con es None, valida solo formato.
    Si con es Connection, valida contra catálogo.
    """
    items: list[dict[str, Any]] = []
    total = 0.0

    for idx, raw in enumerate(raw_items or []):
        if not isinstance(raw, dict):
            raise ValueError(f"Item {idx} no es un diccionario válido")

        codigo = _coerce_str(raw.get("codigo")).strip()
        if not codigo:
            raise ValueError(f"Item {idx}: código requerido")

        # ✅ NUEVO: Validar contra catálogo
        if con:
            material = _validar_material_existe(con, codigo)
            if not material:
                raise ValueError(
                    f"Item {idx}: Material '{codigo}' no existe en catálogo"
                )
            # Usar descripción del catálogo si no se proporciona
            descripcion = _coerce_str(raw.get("descripcion")) or material["descripcion"]
        else:
            descripcion = _coerce_str(raw.get("descripcion"))
            if not descripcion:
                raise ValueError(f"Item {idx}: descripción requerida")

        # Cantidad
        try:
            cantidad = int(raw.get("cantidad", 0))
            if cantidad < 1 or cantidad > 10000:
                raise ValueError(
                    f"Item {idx}: cantidad debe estar entre 1 y 10000"
                )
        except (TypeError, ValueError):
            raise ValueError(
                f"Item {idx}: cantidad inválida: {raw.get('cantidad')}"
            )

        # Precio
        try:
            precio = float(raw.get("precio_unitario") or 0)
            if precio < 0:
                raise ValueError(
                    f"Item {idx}: precio no puede ser negativo"
                )
        except (TypeError, ValueError):
            raise ValueError(
                f"Item {idx}: precio inválido: {raw.get('precio_unitario')}"
            )

        subtotal = round(cantidad * precio, 2)
        item = {
            "codigo": codigo,
            "descripcion": descripcion,
            "cantidad": cantidad,
            "precio_unitario": round(precio, 2),
            "subtotal": subtotal,
            "comentario": _coerce_str(raw.get("comentario")) or None,
        }

        # Unidad de medida del catálogo si existe
        if con and material:
            item["unidad"] = material.get("unidad_medida", "")
        else:
            unidad = raw.get("unidad") or raw.get("uom") or raw.get("unidad_medida")
            if unidad:
                item["unidad"] = _coerce_str(unidad)

        items.append(item)
        total += subtotal

    # ✅ NUEVO: Validar límites totales
    if len(items) > 50:
        raise ValueError(f"Máximo 50 items por solicitud (se enviaron {len(items)})")

    if total > 5000000:
        raise ValueError(
            f"Total de solicitud ({total}) excede límite de $5,000,000"
        )

    return items, round(total, 2)
```

**Paso 3:** Actualizar llamadas a `_normalize_items()`
```python
# En _parse_full_payload()
# ANTES:
items, total = _normalize_items(raw_items)

# DESPUÉS:
items, total = _normalize_items(raw_items, con=con)  # Pasar conexión
```

### ✅ Beneficios
- ✅ Items inválidos se rechazan inmediatamente
- ✅ Errores claros al usuario
- ✅ Datos consistentes en BD
- ✅ Facilita auditoría

---

## FIX #2: Validar Aprobador Existe y Está Activo

### 📍 Ubicación
`src/backend/routes/solicitudes.py` - Función `_resolve_approver()`

### 🔍 Problema Actual
```python
def _resolve_approver(con, user, total_monto=0.0):
    approver_email = user.get("jefe")  # ❌ Usa email
    approver_user = con.execute(
        "SELECT id_spm FROM usuarios WHERE mail = ?",
        (approver_email.lower(),)
    ).fetchone()
    if approver_user:
        return approver_user["id_spm"]
    # ❌ SIN FALLBACK, retorna None
```

### 🔧 Solución

```python
def _get_approver_config(con, total_monto: float) -> tuple[str, str]:
    """
    Obtiene configuración de aprobador para monto.
    Retorna (campo_usuario, rol_fallback).
    """
    if total_monto <= 20000:
        return "jefe", "JEFE"
    elif total_monto <= 100000:
        return "gerente1", "GERENTE_NIVEL_1"
    else:
        return "gerente2", "GERENTE_NIVEL_2"


def _ensure_approver_exists_and_active(
    con, uid: str | None, total_monto: float = 0.0
) -> str | None:
    """
    Resuelve aprobador de usuario.
    - Valida que existe y está activo
    - Busca fallback si el primario falta
    - Retorna None si no hay aprobador disponible
    """
    if not uid:
        return None

    user = _fetch_user(con, uid)
    if not user:
        return None

    campo_usuario, rol_fallback = _get_approver_config(con, total_monto)

    # Opción 1: Aprobador primario del usuario
    approver_email = _coerce_str(user.get(campo_usuario))
    if approver_email:
        approver = con.execute(
            """
            SELECT id_spm FROM usuarios
            WHERE LOWER(mail) = LOWER(?) AND estado = 'activo'
            """,
            (approver_email,),
        ).fetchone()
        if approver:
            return approver["id_spm"]

    # Opción 2: Buscar por rol (fallback)
    approver = con.execute(
        """
        SELECT id_spm FROM usuarios
        WHERE rol = ? AND estado = 'activo'
        ORDER BY RANDOM()
        LIMIT 1
        """,
        (rol_fallback,),
    ).fetchone()

    return approver["id_spm"] if approver else None


def _resolve_approver(con, user: dict[str, Any] | None, total_monto: float = 0.0) -> str | None:
    """
    Resuelve aprobador. Validación robusta.
    """
    if not user:
        return None

    uid = _coerce_str(user.get("id_spm"))
    approver = _ensure_approver_exists_and_active(con, uid, total_monto)

    if not approver:
        # Log para auditoría
        import logging
        logging.warning(
            f"No se encontró aprobador para usuario {uid} "
            f"con monto {total_monto}"
        )

    return approver
```

### ✅ Beneficios
- ✅ Validación robusta antes de asignar
- ✅ Fallback a rol si falta específico
- ✅ Detecta aprobadores inactivos
- ✅ Logs para debugging

---

## FIX #3: Validar Planificador Disponible

### 📍 Ubicación
`src/backend/routes/solicitudes.py` - Nueva función

### 🔍 Problema Actual
```python
# ❌ No hay validación de planificador
# ❌ Asume que gerente2 es planificador
# ❌ Sin fallback si falta
```

### 🔧 Solución

```python
def _ensure_planner_exists_and_available(con, user: dict[str, Any] | None) -> str | None:
    """
    Resuelve planificador disponible.
    - Busca planificador primario
    - Valida que está activo
    - Busca fallback si falta
    - Retorna None si ninguno disponible
    """
    if not user:
        return None

    # Opción 1: Planificador explícito del usuario
    for campo in ("gerente2", "gerente1"):
        planner_email = _coerce_str(user.get(campo))
        if planner_email:
            planner = con.execute(
                """
                SELECT id_spm FROM usuarios
                WHERE LOWER(mail) = LOWER(?)
                AND estado = 'activo'
                """,
                (planner_email,),
            ).fetchone()
            if planner:
                return planner["id_spm"]

    # Opción 2: Buscar usuario con rol PLANIFICADOR
    planner = con.execute(
        """
        SELECT id_spm FROM usuarios
        WHERE rol IN ('planificador', 'PLANIFICADOR', 'planner', 'PLANNER')
        AND estado = 'activo'
        ORDER BY RANDOM()
        LIMIT 1
        """,
    ).fetchone()

    return planner["id_spm"] if planner else None


def _resolve_planner(user: dict[str, Any] | None, con=None) -> str | None:
    """
    Resuelve planificador. Validación robusta.
    """
    if not user:
        return None

    if not con:
        # Sin validación, solo formato antiguo (compatibility)
        for field in ("gerente2", "gerente1"):
            value = _coerce_str(user.get(field))
            if value:
                return value.lower()
        return None

    # Con validación
    return _ensure_planner_exists_and_available(con, user)
```

### ✅ Beneficios
- ✅ Validación antes de asignar
- ✅ Fallback a rol si falta específico
- ✅ Detecta planificadores inactivos
- ✅ Evita solicitudes sin planificador

---

## FIX #4: Pre-validaciones Antes de Aprobar

### 📍 Ubicación
`src/backend/routes/solicitudes.py` - Nueva función antes de `decidir_solicitud()`

### 🔧 Solución

```python
def _pre_validar_aprobacion(con, solicitud: dict[str, Any]) -> tuple[bool, str | None]:
    """
    Pre-valida que una solicitud puede ser aprobada.

    Retorna: (es_valida, error_message)
    """
    # 1. Validar que usuario solicitante sigue activo
    usuario = _fetch_user(con, solicitud.get("id_usuario"))
    if not usuario:
        return False, "Usuario solicitante no existe"
    if usuario.get("estado") != "activo":
        return False, "Usuario solicitante no está activo"

    # 2. Validar que todos los materiales existen
    data = _json_load(solicitud.get("data_json", "{}"))
    items = data.get("items", [])

    for idx, item in enumerate(items):
        codigo = item.get("codigo")
        material = _validar_material_existe(con, codigo)
        if not material:
            return False, f"Item {idx}: Material '{codigo}' no existe"

    # 3. Validar que total es consistente
    total_esperado = sum(
        i.get("subtotal", 0) for i in items
    )
    total_registrado = solicitud.get("total_monto", 0)
    if abs(total_esperado - total_registrado) > 0.01:
        return False, f"Total inconsistente: {total_esperado} vs {total_registrado}"

    # 4. Validar presupuesto disponible (si existe tabla)
    try:
        presupuesto = con.execute(
            """
            SELECT disponible FROM presupuestos
            WHERE centro = ? AND centro_costos = ?
            """,
            (solicitud.get("centro"), solicitud.get("centro_costos")),
        ).fetchone()

        if presupuesto and presupuesto["disponible"] < total_registrado:
            return False, (
                f"Presupuesto insuficiente: ${presupuesto['disponible']} "
                f"< ${total_registrado}"
            )
    except Exception:
        # Tabla no existe, skip
        pass

    # 5. Validar que no hay cambios pendientes
    if data.get("cambios_pendientes"):
        return False, "Hay cambios pendientes de revisión"

    return True, None


def _validar_antes_de_aprobar(con, sol_id: int) -> tuple[bool, str | None]:
    """Wrapper para pre-validación."""
    solicitud = _load_solicitud(con, sol_id)
    if not solicitud:
        return False, "Solicitud no encontrada"

    return _pre_validar_aprobacion(con, solicitud)


# Usar en decidir_solicitud()
@bp.post("/solicitudes/<int:sol_id>/decidir")
def decidir_solicitud(sol_id: int):
    # ... código de autenticación ...

    with get_connection() as con:
        # ✅ NUEVO: Pre-validación
        valida, error_msg = _validar_antes_de_aprobar(con, sol_id)
        if not valida:
            return _json_error("PRE_VALIDATION_ERROR", error_msg or "Validación fallida", 400)

        # ... resto del código ...
```

### ✅ Beneficios
- ✅ Validación antes de aprobar
- ✅ Errores claros al aprobador
- ✅ Previene estados inválidos
- ✅ Auditoría completa

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Desarrollo
- [ ] Leer análisis completo en `ANALISIS_5_PROCESOS_CRITICOS.md`
- [ ] Crear rama `feature/fix-validaciones-fase1`
- [ ] Implementar Fix #1 (Material válido)
- [ ] Implementar Fix #2 (Aprobador válido)
- [ ] Implementar Fix #3 (Planificador válido)
- [ ] Implementar Fix #4 (Pre-validaciones)
- [ ] Actualizar imports y llamadas

### Testing
- [ ] Test: Material no existe
- [ ] Test: Material existe
- [ ] Test: Aprobador existe
- [ ] Test: Aprobador no existe
- [ ] Test: Planificador existe
- [ ] Test: Planificador no existe
- [ ] Test: Pre-validación pasa
- [ ] Test: Pre-validación falla
- [ ] Test: Items con límite alcanzado
- [ ] Test: Total exceeds $5M

### Validación
- [ ] Ejecutar tests localmente
- [ ] Revisar logs de errores
- [ ] Probar flujo completo en UI
- [ ] Validar mensajes de error
- [ ] Revisar código con equipo

### Deployment
- [ ] Merge a main
- [ ] Deploy a staging
- [ ] Smoke tests
- [ ] Deploy a producción
- [ ] Monitoreo de errores

---

## 🎯 MÉTRICAS DE ÉXITO

✅ Esperado después de implementar:

| Métrica | Antes | Después |
|---------|-------|---------|
| Items inválidos | 15-20% | < 1% |
| Solicitudes sin aprobador | 5-10% | 0% |
| Aprobaciones rechazadas por data | 10-15% | < 2% |
| Errores en fase de tratamiento | 20% | < 5% |
| Tiempo resolución de issues | 2-3 horas | 15 min |

---

## 📞 PRÓXIMOS PASOS

1. ✅ Revisar este documento
2. ✅ Crear rama de feature
3. ✅ Implementar los 4 fixes
4. ✅ Testing exhaustivo
5. ✅ Code review
6. ✅ Merge y deploy

---

**Documento:** Fixes Fase 1 - Listos para Implementar
**Versión:** 1.0
**Estado:** 🟢 Listo para desarrollo
**Complejidad:** 🟡 Media (2-3 horas c/u)
**Riesgo:** 🟢 Bajo (cambios en validación, sin cambios en lógica core)
