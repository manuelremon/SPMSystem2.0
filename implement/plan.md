# Implementation Plan - Sistema de Notificaciones en Tiempo Real
**Fecha**: 2025-11-29 03:15 UTC
**Feature**: Real-time Notification System for SPM v2.0

## Source Analysis

- **Source Type**: Feature Description / Best Practices Research
- **Core Features**:
  - Real-time notifications using Server-Sent Events (SSE) or WebSockets
  - Visual notification center/bell icon
  - Toast notifications for immediate feedback
  - Mark as read/unread functionality
  - Notification history
  - Real-time updates without page reload
- **Dependencies**:
  - Backend: Flask-SSE o similar (evaluaremos opciones)
  - Frontend: EventSource API (nativo) o socket.io-client
  - UI: Componente NotificationBell con dropdown
- **Complexity**: Media-Alta (requiere backend + frontend + tiempo real)

## Target Integration

### Arquitectura Actual Detectada

**Backend (Flask):**
- Python 3.11+, Flask 3.1.2, SQLAlchemy 2.0.44
- Estructura: `backend_v2/routes/*.py`
- Auth: JWT (PyJWT 2.10.1)
- DB: SQLite en `database/spm.db`
- Tabla `notificaciones` ya existe en schema (según CLAUDE.md)

**Frontend (React + Vite):**
- Vite 5.4.21, JavaScript (no TypeScript)
- Componentes en `frontend/src/components/ui/`
- Páginas en `frontend/src/pages/`
- Estilo: Linear Dark SaaS (TensorStax) - recientemente implementado
- CSS Variables: `--primary: #FF5722`, `--border: #333333`, etc.
- Componentes existentes: Card, Button, Modal, SearchInput, Badge

### Integration Points

1. **Backend - Nueva Ruta**: `backend_v2/routes/notificaciones.py`
   - GET /api/notificaciones - Listar notificaciones del usuario
   - POST /api/notificaciones/:id/marcar-leida - Marcar como leída
   - GET /api/notificaciones/stream - SSE endpoint para tiempo real

2. **Backend - Servicios**:
   - `backend_v2/services/notification_service.py` - Lógica de negocio
   - Integrar con solicitudes.py para crear notificaciones automáticas

3. **Frontend - Componente UI**:
   - `frontend/src/components/ui/NotificationBell.jsx` - Icono con badge
   - `frontend/src/components/ui/NotificationPanel.jsx` - Panel dropdown
   - `frontend/src/components/ui/Toast.jsx` - Notificaciones toast

4. **Frontend - Context**:
   - `frontend/src/context/NotificationContext.jsx` - Estado global
   - Hook: `useNotifications()` para consumir

5. **Frontend - Service**:
   - `frontend/src/services/notifications.js` - API client
   - SSE connection management

### Affected Files

**Crear:**
- `backend_v2/routes/notificaciones.py`
- `backend_v2/services/notification_service.py`
- `frontend/src/components/ui/NotificationBell.jsx`
- `frontend/src/components/ui/NotificationPanel.jsx`
- `frontend/src/components/ui/Toast.jsx`
- `frontend/src/context/NotificationContext.jsx`
- `frontend/src/services/notifications.js`
- `frontend/src/hooks/useNotifications.js`

**Modificar:**
- `backend_v2/routes/__init__.py` - Registrar blueprint
- `backend_v2/routes/solicitudes.py` - Crear notificaciones en eventos
- `frontend/src/App.jsx` - Agregar NotificationProvider y NotificationBell
- `database/schemas/refactored_schema.sql` - Verificar/actualizar tabla notificaciones

### Pattern Matching

**Backend Patterns:**
- Usar Pydantic para schemas (como en `solicitudes.py`)
- Decorador `@token_required` para auth
- Respuestas JSON con estructura `{"ok": True, "data": {...}}`
- Manejo de errores con try/except

**Frontend Patterns:**
- Componentes funcionales con hooks
- CSS usando variables `var(--nombre)`
- Clsx para clases condicionales
- Estructura: Card, Button, Badge components
- Estilo Linear Dark SaaS (rounded-xl, border-subtle, etc.)

## Implementation Tasks

### Phase 1: Backend Foundation
- [ ] 1.1 Verificar/crear tabla `notificaciones` en DB
- [ ] 1.2 Crear `backend_v2/models/notification_schema.py` (Pydantic)
- [ ] 1.3 Crear `backend_v2/services/notification_service.py`
  - [ ] create_notification(user_id, message, solicitud_id)
  - [ ] get_user_notifications(user_id, unread_only=False)
  - [ ] mark_as_read(notification_id)
  - [ ] get_unread_count(user_id)
- [ ] 1.4 Crear `backend_v2/routes/notificaciones.py`
  - [ ] GET /api/notificaciones
  - [ ] POST /api/notificaciones/:id/marcar-leida
  - [ ] GET /api/notificaciones/stream (SSE)
- [ ] 1.5 Registrar blueprint en `backend_v2/routes/__init__.py`
- [ ] 1.6 Testear endpoints con curl/Postman

### Phase 2: Backend Integration
- [ ] 2.1 Modificar `backend_v2/routes/solicitudes.py`
  - [ ] Al crear solicitud: notificar a aprobadores
  - [ ] Al aprobar/rechazar: notificar a solicitante
  - [ ] Al planificar: notificar a planificador
- [ ] 2.2 Agregar notificaciones en otros flujos críticos
- [ ] 2.3 Testear creación automática de notificaciones

### Phase 3: Frontend - Componentes UI
- [ ] 3.1 Crear `frontend/src/components/ui/Toast.jsx`
  - [ ] Variants: success, error, warning, info
  - [ ] Auto-dismiss con timeout configurable
  - [ ] Animaciones (slide-in desde arriba)
  - [ ] Estilo Linear Dark SaaS
- [ ] 3.2 Crear `frontend/src/components/ui/NotificationBell.jsx`
  - [ ] Icono Bell de lucide-react
  - [ ] Badge con contador (solo si > 0)
  - [ ] Glow effect con primary color
  - [ ] Click para toggle panel
- [ ] 3.3 Crear `frontend/src/components/ui/NotificationPanel.jsx`
  - [ ] Dropdown absolute positioning
  - [ ] Lista de notificaciones (últimas 10)
  - [ ] Botón "Ver todas"
  - [ ] Botón "Marcar todas como leídas"
  - [ ] Empty state
  - [ ] Scroll infinito (opcional)

### Phase 4: Frontend - Estado y Lógica
- [ ] 4.1 Crear `frontend/src/services/notifications.js`
  - [ ] fetchNotifications()
  - [ ] markAsRead(id)
  - [ ] markAllAsRead()
  - [ ] connectSSE() - EventSource connection
- [ ] 4.2 Crear `frontend/src/context/NotificationContext.jsx`
  - [ ] Estado: notifications[], unreadCount
  - [ ] Actions: addNotification, markRead, clearAll
  - [ ] SSE connection lifecycle
- [ ] 4.3 Crear `frontend/src/hooks/useNotifications.js`
  - [ ] Hook para consumir context
  - [ ] Helper functions

### Phase 5: Frontend - Integration
- [ ] 5.1 Modificar `frontend/src/App.jsx`
  - [ ] Wrap con NotificationProvider
  - [ ] Agregar NotificationBell en header
  - [ ] Agregar Toast container
- [ ] 5.2 Testear notificaciones manuales
- [ ] 5.3 Testear SSE connection
- [ ] 5.4 Testear flujo completo end-to-end

### Phase 6: Polish & Optimization
- [ ] 6.1 Agregar animaciones suaves (scroll-reveal)
- [ ] 6.2 Agregar sonido de notificación (opcional)
- [ ] 6.3 Persistir notificaciones leídas en localStorage
- [ ] 6.4 Implementar badge "NEW" en notificaciones recientes
- [ ] 6.5 Responsive design para mobile
- [ ] 6.6 Accessibility (ARIA labels, keyboard navigation)

### Phase 7: Testing & Documentation
- [ ] 7.1 Crear tests para backend
- [ ] 7.2 Crear tests para frontend components
- [ ] 7.3 Documentar API endpoints
- [ ] 7.4 Crear guía de usuario
- [ ] 7.5 Performance testing (stress test SSE)

## Validation Checklist

- [ ] Tabla notificaciones existe y funciona
- [ ] Endpoints backend responden correctamente
- [ ] SSE stream funciona sin memory leaks
- [ ] UI components render correctamente
- [ ] Notificaciones se crean automáticamente en flujos
- [ ] Toast notifications aparecen y desaparecen
- [ ] Badge counter actualiza en tiempo real
- [ ] Marcar como leída funciona
- [ ] No hay errores en consola
- [ ] Performance aceptable (< 100ms response time)
- [ ] Funciona en Chrome, Firefox, Safari
- [ ] Responsive en mobile
- [ ] Tests pasan

## Technical Decisions

### SSE vs WebSockets
**Decision: Server-Sent Events (SSE)**
- Más simple de implementar en Flask
- Unidireccional (suficiente para notificaciones)
- Reconexión automática
- Compatible con HTTP/1.1
- Menos overhead que WebSockets

### Real-time Strategy
1. SSE connection abierta en `/api/notificaciones/stream`
2. Backend push de nuevas notificaciones vía SSE
3. Frontend EventSource listener actualiza state
4. Context provider distribuye a componentes

### UI Design
- Bell icon en header (top-right)
- Badge naranja (#FF5722) con contador
- Panel dropdown con Glassmorphism
- Toast notifications en top-right corner
- Estilo consistente con Linear Dark SaaS

## Risk Mitigation

### Potential Issues

1. **SSE Connection Limits**
   - Risk: Browsers limitan conexiones SSE concurrentes
   - Mitigation: Cerrar conexión si tab inactivo, reconectar al activar

2. **Memory Leaks**
   - Risk: EventSource no cerrado correctamente
   - Mitigation: useEffect cleanup, cerrar en unmount

3. **Database Locking (SQLite)**
   - Risk: Escrituras concurrentes pueden lockear
   - Mitigation: Connection pooling, WAL mode

4. **Performance con muchas notificaciones**
   - Risk: Query lento con miles de notificaciones
   - Mitigation: Paginación, índices en DB

5. **Notificaciones duplicadas**
   - Risk: Múltiples eventos crean duplicados
   - Mitigation: Idempotencia en creation, unique constraints

### Rollback Strategy

1. Feature flag en backend (enable_notifications = False)
2. Git branches para cada phase
3. Commits frecuentes con mensajes descriptivos
4. Backup de DB antes de migrations
5. Poder deshabilitar SSE sin romper app

## Success Metrics

- Notificaciones entregadas en < 1 segundo
- Zero memory leaks en 24h runtime
- < 5% error rate en SSE connections
- 100% test coverage en componentes críticos
- User feedback positivo

## Timeline Estimate

- Phase 1-2: 2-3 horas (Backend)
- Phase 3-4: 2-3 horas (Frontend Components)
- Phase 5: 1 hora (Integration)
- Phase 6-7: 1-2 horas (Polish & Testing)

**Total: 6-9 horas de desarrollo**

## Next Steps

1. Confirmar plan con usuario
2. Iniciar Phase 1: Backend Foundation
3. Crear PR por cada phase completada
4. Testear end-to-end después de Phase 5

---

**Status**: PENDING APPROVAL
**Last Updated**: 2025-11-29 03:15 UTC
