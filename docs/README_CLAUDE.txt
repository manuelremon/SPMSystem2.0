
SPM v2 – Guía rápida para Claude
================================

Resumen funcional
- App de gestión de solicitudes de materiales (SPM). Flujo: Crear Solicitud -> Agregar Materiales -> Aprobaciones -> Planificador -> Mis Solicitudes/Mi Cuenta/Admin.
- Backend expuesto en http://localhost:5000 (DB en backend_v2/spm.db). Endpoints usados: auth/login/refresh/csrf, /catalogos*, /solicitudes (crear/listar/guardarBorrador/finalizar/aprobar/rechazar/aceptar).
- Frontend: Vite + React. Páginas en frontend/src/pages. Botón base en frontend/src/components/ui/Button.jsx. Autenticación por token en localStorage; CSRF cuando backend está activo.

Estilo visual “C40” (aplicar en nuevas vistas)
- Bordes negros 2–4 px; sin esquinas redondeadas (rounded-none).
- Texto uppercase con tracking amplio (0.05–0.18em), peso bold/black.
- Inputs/selects: border-2 border-black, focus ring warning-500 (amarillo). Selects nativos sin borde redondeado.
- Botones: usar componente Button; variantes primary (blanco/hover verde), secondary (amarillo/hover rojo claro), ghost (transparente/hover rojo claro), danger (rojo sólido).
- Tablas: border-collapse, contenedor con borde 4px; thead con borde 4px; celdas con borde 2px; filas alternadas bg-primary-50/60; acciones con Button.
- Modales/dropdowns: borde 4px negro, shadow dura ([8px_8px_0_0_#000] o similar), fondos blancos/primary-50, headers uppercase.
- Pills de estado: borde 2px, punto de color (amarillo/pendiente, verde/aprobado, rojo/rechazado, azul/en progreso).

Páginas ya alineadas al estilo C40
- Login, Dashboard, Crear Solicitud, Agregar Materiales, Aprobaciones, Mis Solicitudes, Mi Cuenta, Planner. (Admin* pendiente de revisar).
- Agregar Materiales: tabla “Resumen de Materiales” con estilo C40; botones Eliminar (danger), Guardar borrador hover amarillo, Enviar Solicitud verde; dropdown y modal de material con borde 4px/shadow dura.
- Crear Solicitud: campo “Fecha de Necesidad” por defecto = hoy +120 días (getDefaultNeedDate).
- Planner: tablas/modales C40, botones con Button, pill de estado con azul para “en progreso”.

Componentes/archivos clave
- frontend/src/components/ui/Button.jsx: estilos centralizados de botones.
- frontend/src/pages/Materials.jsx, CreateSolicitud.jsx, Aprobaciones.jsx, MisSolicitudes.jsx, Planner.jsx, Dashboard.jsx, MiCuenta.jsx.

Reglas de código
- Mantener ASCII; usar apply_patch para cambios manuales.
- No revertir cambios del usuario; evitar resets destructivos.
- Buscar con rg preferentemente.

Flujo de arranque
- Backend: correr servidor en 5000 con DB backend_v2/spm.db.
- Frontend: cd frontend && npm run dev (Vite en 5173).

Tareas pendientes sugeridas
- Revisar y estilizar páginas Admin* al estándar C40.
- Verificar hover/estados de botones en Mi Cuenta/Aprobaciones/Mis Solicitudes por consistencia.
- Confirmar textos con acentos correctos si aparecen artefactos de encoding.
