1. Resumen Ejecutivo
Estrategia por fases para estabilizar el backend/ frontend, reducir deuda técnica (acceso directo SQLite, lógica mezclada en rutas), mejorar rendimiento (WAL, índices, cache), elevar observabilidad (logs estructurados, métricas), y preparar transición futura a Postgres y CI/CD. Se prioriza mínima disrupción operativa.

2. Fases y Objetivos
Fase 1 – Estabilización (Correcciones inmediatas)
Objetivo: Eliminar ambigüedades y fuentes de errores silenciosos.

Unificar blueprint de planificador (retirar legacy).
Logging único (evitar handlers duplicados).
Respuestas de error consistentes (formato estándar).
Validación de payloads fundamentales (análisis, tratamiento, opciones).
Revisión flujo CSRF y token refresh.
Documentar convenciones nombres endpoints.
Fase 2 – Refactor Core
Objetivo: Separar responsabilidades para facilitar pruebas y evolución.

Repositorio DB (repository.py) y capa servicio (planner_service.py).
Modelos/DTO centralizados (schemas.py).
Módulo de carga y cache (cache_loader.py).
Limpieza código en planner.py hacia funciones puras.
Revisión naming y eliminación código comentado obsoleto.
Fase 3 – Data & Performance
Objetivo: Mejorar concurrencia y preparar volumen mayor.

Activar WAL + PRAGMA relevantes.
Índices en tablas clave (solicitudes, tratamiento, equivalencias).
Optimizar generación opciones abastecimiento (pre-caches indexadas).
Reducir tamaño de payloads (solo campos necesarios).
Estrategia migración equivalencias Excel → tabla normalizada.
Fase 4 – Feature Enhancements
Objetivo: Mejorar robustez funcional del flujo de tratamiento.

Idempotency en aceptar/finalizar.
Historial granular decisiones (tabla tratamiento_historial).
Sub-estados detallados (analizando, opciones, revisión, cerrado).
Batch tratamiento de ítems.
Hook frontend para cache decisiones con expiración.
Fase 5 – Observabilidad & Calidad
Objetivo: Visibilidad y prevención de regresiones.

Logging JSON con trace_id y user_id.
Métricas Prometheus (/metrics).
Tracing ligero OpenTelemetry (rutas críticas).
Tests unitarios + integración + snapshots payload.
Lint (ruff) + tipos (mypy) + reglas CI.
Reglas contract de API (versión semántica de respuestas).
Fase 6 – Hardening & Deployment
Objetivo: Seguridad y preparación para entornos mayores.

Decorators de autorización por rol (authz).
Rate limiting mutaciones.
Gestión de secretos por entorno (ENV vars).
Pipeline CI/CD (build, test, lint, image).
Plan migración Postgres (schema, Alembic).
Rotación y refresco tokens, política expiración.
3. Correcciones Críticas Iniciales
Blueprint duplicada /api/planner vs /api/planificador.
Handlers logging duplicados (doble línea INFO).
Payload tratamiento: decisión derivada de prefijo en vez de campo explícito.
Acceso DB repetitivo sin WAL.
Falta validación estructurada de entrada (riesgo datos malformados).
Manejo CSRF manual disperso.
4. Riesgos y Mitigaciones
Bloqueos SQLite: WAL + retries controlados.
Crecimiento Excel: transición progresiva a tablas.
Cambios de API: versionado de respuestas / contrato.
Carga futura: índice y normalización temprana minimizan refactors urgentes.
5. Métricas de Éxito
Tiempo medio Paso 2 < 300 ms.
Error rate 5xx < 1%.
Latencia análisis (Paso 1) < 500 ms con 50 items.
Cobertura tests servicios ≥ 70%.
Cero bloqueos DB en pruebas carga moderada (10 solicitudes concurrentes).
6. Roadmap Tentativo (depende capacidad)
Semana 1: Fase 1 completa.
Semana 2–3: Fase 2.
Semana 4: Fase 3.
Semana 5: Fase 4 parcial + observabilidad base.
Semana 6: Fase 5 y arranque hardening.
Semana 7+: Migración Postgres piloto.
7. Pendientes de Clarificación
Volumen esperado solicitudes/día y usuarios simultáneos.
Plazo objetivo migrar a Postgres.
Restricciones de downtime (ventanas vs cero).
Preferencia ORM (SQLAlchemy completo o mínimo).
Requisitos compliance (PII / retención logs).
Integraciones externas previstas (ERP / BI).
Prioridad negocio: ¿Qué paso (1,2,3) optimizar primero?
8. Supuestos (a validar)
< 5 concurrentes intensivos hoy.
Migración Postgres aceptable en ≤ 2 meses.
No hay requisito estricto de cifrado columna.
Excel fuentes cambian poco (bajo churn).
Equipo dispone ~15–20 h/semana para mejoras.
Fase 1 – Plan Detallado
Objetivo
Eliminar duplicidades, formalizar errores, asegurar base consistente para refactors posteriores sin cambiar comportamiento funcional.

Tareas (Orden Sugerido)
Unificación blueprint:
Retirar registro duplicado en app.py: dejar solo /api/planificador.
Mover dashboard legacy a archivo planner_legacy.py (opcional) o eliminar si no se usa.
Logging:
Revisar configuración _configure_logging y evitar agregar handlers en cada reload.
Asegurar if not app.logger.handlers: antes de configurar.
Errores Consistentes:
Crear backend_v2/core/errors.py con función api_error(code, message, details=None, status=400).
Reemplazar respuestas ad-hoc en planner.py (ej. retornos 404 y 500).
Validación Payloads Clave:
Definir esquemas mínimos (pydantic o validación manual) para:
POST /guardar-tratamiento: lista decisiones[*] con campos obligatorios.
POST /analizar: (sin payload) pero estructurar respuesta con esquema.
GET /items/<idx>/opciones-abastecimiento: validar índices rango.
Agregar helper parse_json() con manejo de JSON inválido.
Campo Explícito decision_tipo:
Ajustar parse en /guardar-tratamiento para usar decision_tipo directo en lugar de prefijo de opcion_id.
Modificar TratarSolicitudModal.jsx al construir payload.decisiones.
CSRF Revisión:
Centralizar obtención en un único módulo (services/csrf.js) y usarlo antes de POST críticos.
Verificar expiración (si falla -> renovar y reintentar una vez).
Documentación Rápida:
Añadir sección “API Error Format” en ARCHITECTURE.md y “Convenciones Tratamiento” en CHECKLIST_FRONTEND_TRATAR_SOLICITUD.md.
Resultado Esperado
Rutas limpias sin duplicación.
Logs sin entradas repetidas.
Payload tratamiento claramente tipado.
Errores con formato consistente (ok: False, error: {code, message, details}).
Base preparada para extracción de servicios (Fase 2) sin romper clientes.
Indicadores de Finalización
grep en repo encuentra solo una instancia de registro blueprint planner.
Tests manuales dev: llamadas Paso 1–3 retornan error estructurado ante entradas inválidas.
Logs muestran una sola línea de inicialización backend.
