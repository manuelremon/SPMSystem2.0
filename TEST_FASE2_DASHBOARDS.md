# FASE 2: DASHBOARDS POR ROL (6 horas)

**Inicio**: 2026-02-05
**Prioridad**: ALTA
**Endpoints**: 4 dashboards principales

---

## OBJETIVO

Validar que cada rol vea un dashboard específico con datos correctos y permisos de visualización.

---

## DASHBOARDS A TESTEAR

| Dashboard | Ruta | Rol | Datos Esperados |
|-----------|------|-----|-----------------|
| Admin | `/dashboard` (admin) | admin | KPIs sistema, usuarios, presupuestos |
| Aprobador | `/dashboard` (coord) | coordinador | Solicitudes pendientes, presupuesto |
| Planificador | `/dashboard` (planner) | planificador | Solicitudes asignadas, alertas MRP |
| Solicitante | `/dashboard` (user) | usuario | Mis solicitudes, estado últimas |

---

## TEST PLAN

### TEST 1: Dashboard Admin
**Usuario**: ADMIN001 / admin

**Validaciones**:
- [ ] GET `/dashboard` retorna 200
- [ ] Contiene KPIs del sistema
- [ ] Muestra estadísticas de solicitudes
- [ ] Muestra gráficos de presupuestos
- [ ] Sidebar muestra opciones admin
- [ ] Sin errores en consola
- [ ] Carga en < 3 segundos
- [ ] Datos están completos

**Datos a Validar**:
- Total solicitudes
- Solicitudes por estado
- Presupuesto disponible
- Usuarios activos
- Gráficos cargados

---

### TEST 2: Dashboard Aprobador
**Usuario**: APRO001 / coordinador

**Validaciones**:
- [ ] GET `/dashboard` retorna 200
- [ ] Muestra solicitudes pendientes de aprobación
- [ ] Muestra presupuesto disponible
- [ ] Link a "Aprobaciones" visible
- [ ] No muestra opciones admin
- [ ] No muestra opciones planificador

---

### TEST 3: Dashboard Planificador
**Usuario**: PLAN001 / planificador

**Validaciones**:
- [ ] GET `/dashboard` retorna 200
- [ ] Muestra solicitudes asignadas/no asignadas
- [ ] Muestra alertas MRP
- [ ] Muestra métricas SLA
- [ ] Link a "Planificador" visible
- [ ] No muestra opciones admin
- [ ] No muestra opciones de aprobación

---

### TEST 4: Dashboard Solicitante
**Usuario**: USER001 / usuario

**Validaciones**:
- [ ] GET `/dashboard` retorna 200
- [ ] Muestra mis solicitudes recientes
- [ ] Botón "Nueva Solicitud" visible
- [ ] Muestra estado últimas solicitudes
- [ ] No muestra opciones admin
- [ ] No muestra opciones planificador
- [ ] Vista simplificada

---

### TEST 5: Navegación Global
**Validaciones para todos los roles**:
- [ ] Sidebar carga sin errores
- [ ] Links de navegación funcionan
- [ ] ErrorBoundary captura errores React
- [ ] Notificaciones en tiempo real (SSE)
- [ ] Logout funciona desde dashboard

---

### TEST 6: Lazy Loading
**Validaciones**:
- [ ] Componentes cargan bajo demanda
- [ ] Sin cargar datos innecesarios
- [ ] Performance aceptable (< 3s)
- [ ] No hay N+1 queries

---

### TEST 7: Permisos de Visualización
**Validaciones**:
- [ ] Admin ve todos los datos
- [ ] Solicitante solo ve sus datos
- [ ] Planificador ve asignados + alertas
- [ ] Aprobador ve pendientes de aprobación

---

### TEST 8: Responsividad
**Validaciones**:
- [ ] Desktop (1920px)
- [ ] Tablet (768px)
- [ ] Mobile (375px)
- [ ] Layout adapta correctamente

---

## ENDPOINTS A REVISAR

```
Backend:
- GET /api/solicitudes (listar)
- GET /api/solicitudes/estadisticas (stats)
- GET /api/presupuestos (presupuesto user)
- GET /api/planner/alertas-mrp (MRP)
- GET /api/admin/dashboard (admin stats)

Frontend:
- /dashboard (página principal)
- GET /api/me (usuario autenticado)
```

---

## MÉTRICAS DE ÉXITO

- [ ] 100% dashboards cargando
- [ ] 0 errores JavaScript
- [ ] Todos los roles ven datos correctos
- [ ] Performance < 3 segundos
- [ ] Permisos validados correctamente

---

## NOTAS

- Usar usuarios de prueba creados en FASE 1
- Validar con navegador (DevTools)
- Screenshot de cada dashboard
- Documentar en RESULTS_FASE2_DASHBOARDS.md

