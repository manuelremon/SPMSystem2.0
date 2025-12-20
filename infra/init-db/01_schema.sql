-- Schema PostgreSQL para SPM v2.0
-- Este archivo se ejecuta automaticamente al inicializar PostgreSQL

-- Tabla principal de usuarios
CREATE TABLE IF NOT EXISTS usuarios(
    id_spm TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    rol TEXT NOT NULL,
    contrasena TEXT NOT NULL,
    mail TEXT,
    posicion TEXT,
    sector TEXT,
    centros TEXT,
    jefe TEXT,
    gerente1 TEXT,
    gerente2 TEXT,
    telefono TEXT,
    estado_registro TEXT,
    id_ypf TEXT,
    mail_respaldo TEXT,
    almacenes TEXT
);

-- Solicitudes de cambio de perfil
CREATE TABLE IF NOT EXISTS user_profile_requests(
    id SERIAL PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    tipo TEXT NOT NULL,
    payload TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Solicitudes de materiales
CREATE TABLE IF NOT EXISTS solicitudes(
    id SERIAL PRIMARY KEY,
    id_usuario TEXT NOT NULL REFERENCES usuarios(id_spm),
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    justificacion TEXT NOT NULL,
    centro_costos TEXT,
    almacen_virtual TEXT,
    criticidad TEXT NOT NULL DEFAULT 'Normal',
    fecha_necesidad TEXT,
    data_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    aprobador_id TEXT,
    planner_id TEXT REFERENCES usuarios(id_spm),
    total_monto REAL DEFAULT 0,
    notificado_at TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Asignaciones de planificadores
CREATE TABLE IF NOT EXISTS planificador_asignaciones(
    id SERIAL PRIMARY KEY,
    planificador_id TEXT NOT NULL,
    centro TEXT,
    sector TEXT,
    almacen_virtual TEXT,
    prioridad INTEGER DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(planificador_id, centro, sector, almacen_virtual)
);

-- Notificaciones del sistema
CREATE TABLE IF NOT EXISTS notificaciones(
    id SERIAL PRIMARY KEY,
    destinatario_id TEXT NOT NULL,
    solicitud_id INTEGER REFERENCES solicitudes(id),
    mensaje TEXT NOT NULL,
    leido INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT DEFAULT 'info'
);

-- Incorporaciones de presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_incorporaciones(
    id SERIAL PRIMARY KEY,
    centro TEXT NOT NULL,
    sector TEXT,
    monto REAL NOT NULL,
    motivo TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    solicitante_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    aprobador_id TEXT REFERENCES usuarios(id_spm),
    comentario TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
);

-- Archivos adjuntos de solicitudes
CREATE TABLE IF NOT EXISTS archivos_adjuntos(
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    nombre_archivo TEXT NOT NULL,
    nombre_original TEXT NOT NULL,
    tipo_mime TEXT,
    tamano_bytes INTEGER,
    ruta_archivo TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tratamiento de items de solicitud
CREATE TABLE IF NOT EXISTS solicitud_items_tratamiento(
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    decision TEXT NOT NULL,
    cantidad_aprobada REAL NOT NULL,
    codigo_equivalente TEXT,
    proveedor_sugerido TEXT,
    precio_unitario_estimado REAL,
    comentario TEXT,
    updated_by TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(solicitud_id, item_index)
);

-- Eventos de tratamiento
CREATE TABLE IF NOT EXISTS solicitud_tratamiento_eventos(
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    planner_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    payload_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Log de tratamiento
CREATE TABLE IF NOT EXISTS solicitud_tratamiento_log(
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    item_index INTEGER,
    actor_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    estado TEXT,
    payload_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Traslados
CREATE TABLE IF NOT EXISTS traslados(
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    material TEXT NOT NULL,
    um TEXT,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    origen_centro TEXT NOT NULL,
    origen_almacen TEXT NOT NULL,
    origen_lote TEXT,
    destino_centro TEXT NOT NULL,
    destino_almacen TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planificado',
    referencia TEXT,
    created_by TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Solicitudes de pedido
CREATE TABLE IF NOT EXISTS solpeds(
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    material TEXT NOT NULL,
    um TEXT,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    precio_unitario_est REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'creada',
    numero TEXT,
    created_by TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ordenes de compra
CREATE TABLE IF NOT EXISTS purchase_orders(
    id SERIAL PRIMARY KEY,
    solped_id INTEGER NOT NULL REFERENCES solpeds(id) ON DELETE CASCADE,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    proveedor_email TEXT,
    proveedor_nombre TEXT,
    numero TEXT,
    status TEXT NOT NULL DEFAULT 'emitida',
    subtotal REAL DEFAULT 0,
    moneda TEXT DEFAULT 'USD',
    created_by TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cola de emails
CREATE TABLE IF NOT EXISTS outbox_emails(
    id SERIAL PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments_json TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
);

-- Migraciones
CREATE TABLE IF NOT EXISTS schema_migrations(
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK(tipo IN ('externo', 'almacen_interno')) NOT NULL,
    plazo_entrega_dias INTEGER NOT NULL,
    rating REAL CHECK(rating >= 0 AND rating <= 5) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proveedores Externos
CREATE TABLE IF NOT EXISTS proveedores_externos (
    cuit TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    direccion TEXT,
    localidad TEXT,
    pais TEXT DEFAULT 'Argentina',
    origen TEXT CHECK(origen IN ('local', 'exterior')),
    lead_time_dias INTEGER,
    rubro TEXT,
    calificacion TEXT DEFAULT 'sin_calificar' CHECK(calificacion IN ('cumplidor', 'incumplidor', 'sin_calificar')),
    activo BOOLEAN DEFAULT TRUE,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contactos de proveedores externos
CREATE TABLE IF NOT EXISTS proveedor_ext_contactos (
    id SERIAL PRIMARY KEY,
    cuit_proveedor TEXT NOT NULL REFERENCES proveedores_externos(cuit) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellido TEXT,
    cargo TEXT,
    es_principal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contactos_cuit ON proveedor_ext_contactos(cuit_proveedor);

-- Emails de proveedores externos
CREATE TABLE IF NOT EXISTS proveedor_ext_emails (
    id SERIAL PRIMARY KEY,
    cuit_proveedor TEXT NOT NULL REFERENCES proveedores_externos(cuit) ON DELETE CASCADE,
    email TEXT NOT NULL,
    tipo TEXT DEFAULT 'comercial',
    es_principal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emails_cuit ON proveedor_ext_emails(cuit_proveedor);

-- Telefonos de proveedores externos
CREATE TABLE IF NOT EXISTS proveedor_ext_telefonos (
    id SERIAL PRIMARY KEY,
    cuit_proveedor TEXT NOT NULL REFERENCES proveedores_externos(cuit) ON DELETE CASCADE,
    telefono TEXT NOT NULL,
    tipo TEXT DEFAULT 'fijo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telefonos_cuit ON proveedor_ext_telefonos(cuit_proveedor);

-- Proveedores Internos
CREATE TABLE IF NOT EXISTS proveedores_internos (
    centro TEXT NOT NULL,
    almacen TEXT NOT NULL,
    centro_nombre TEXT,
    almacen_nombre TEXT,
    sector TEXT,
    contacto_centro TEXT,
    responsable_centro TEXT,
    referente_id TEXT REFERENCES usuarios(id_spm),
    referente_nombre TEXT,
    referente_email TEXT,
    activo BOOLEAN DEFAULT TRUE,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (centro, almacen)
);

-- Precios negociados
CREATE TABLE IF NOT EXISTS proveedor_precios_negociados (
    id SERIAL PRIMARY KEY,
    cuit_proveedor TEXT NOT NULL REFERENCES proveedores_externos(cuit),
    codigo_material TEXT NOT NULL,
    precio_usd REAL NOT NULL,
    moneda TEXT DEFAULT 'USD',
    fecha_vigencia_desde DATE NOT NULL,
    fecha_vigencia_hasta DATE,
    condicion_pago TEXT,
    cantidad_minima INTEGER DEFAULT 1,
    notas TEXT,
    activo INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cuit_proveedor, codigo_material, fecha_vigencia_desde)
);
CREATE INDEX IF NOT EXISTS idx_precios_material ON proveedor_precios_negociados(codigo_material);
CREATE INDEX IF NOT EXISTS idx_precios_proveedor ON proveedor_precios_negociados(cuit_proveedor);

-- Configuracion de scores por tipo de equivalencia
CREATE TABLE IF NOT EXISTS config_equivalencia_scores (
    tipo_equiv TEXT PRIMARY KEY,
    compatibilidad_pct INTEGER NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1
);

-- Decision de abastecimiento
CREATE TABLE IF NOT EXISTS decision_abastecimiento (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    cantidad_solicitada REAL NOT NULL,
    cantidad_total_asignada REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente', 'parcial', 'completo', 'confirmado'
    )),
    comentario TEXT,
    planner_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(solicitud_id, item_index)
);
CREATE INDEX IF NOT EXISTS idx_decision_solicitud ON decision_abastecimiento(solicitud_id);

-- Fuentes de abastecimiento
CREATE TABLE IF NOT EXISTS decision_abastecimiento_fuentes (
    id SERIAL PRIMARY KEY,
    decision_id INTEGER NOT NULL REFERENCES decision_abastecimiento(id) ON DELETE CASCADE,
    tipo_fuente TEXT NOT NULL CHECK (tipo_fuente IN (
        'stock', 'transferencia', 'proveedor', 'equivalencia'
    )),
    centro_origen TEXT,
    almacen_origen TEXT,
    cuit_proveedor TEXT REFERENCES proveedores_externos(cuit),
    proveedor_nombre TEXT,
    codigo_material_equiv TEXT,
    tipo_equivalencia TEXT,
    cantidad_asignada REAL NOT NULL,
    precio_unitario REAL,
    precio_es_negociado INTEGER DEFAULT 0,
    plazo_dias INTEGER,
    score_opcion REAL,
    orden_prioridad INTEGER DEFAULT 1,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuentes_decision ON decision_abastecimiento_fuentes(decision_id);

-- Mensajes entre usuarios
CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    remitente_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    destinatario_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    solicitud_id INTEGER REFERENCES solicitudes(id),
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    parent_id INTEGER REFERENCES mensajes(id),
    leido INTEGER DEFAULT 0,
    tipo TEXT DEFAULT 'mensaje',
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger de presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_ledger (
    id SERIAL PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN (
        'consumo_aprobacion',
        'reversion_rechazo',
        'ajuste_manual',
        'bur_aprobado'
    )),
    monto_cents INTEGER NOT NULL,
    saldo_anterior_cents INTEGER NOT NULL,
    saldo_posterior_cents INTEGER NOT NULL,
    referencia_tipo TEXT,
    referencia_id INTEGER,
    actor_id TEXT NOT NULL,
    actor_rol TEXT,
    motivo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Solicitudes de actualizacion de presupuesto (BUR)
CREATE TABLE IF NOT EXISTS budget_update_requests (
    id SERIAL PRIMARY KEY,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    monto_solicitado_cents INTEGER NOT NULL,
    saldo_actual_cents INTEGER NOT NULL,
    nivel_aprobacion_requerido TEXT NOT NULL CHECK (nivel_aprobacion_requerido IN ('L1', 'L2', 'ADMIN')),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente', 'aprobado_l1', 'aprobado_l2', 'aprobado', 'rechazado'
    )),
    solicitante_id TEXT NOT NULL,
    solicitante_rol TEXT,
    justificacion TEXT NOT NULL,
    aprobador_l1_id TEXT,
    aprobador_l1_fecha TEXT,
    aprobador_l1_comentario TEXT,
    aprobador_l2_id TEXT,
    aprobador_l2_fecha TEXT,
    aprobador_l2_comentario TEXT,
    aprobador_final_id TEXT,
    aprobador_final_fecha TEXT,
    aprobador_final_comentario TEXT,
    rechazado_por TEXT,
    motivo_rechazo TEXT,
    fecha_rechazo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catalogos
CREATE TABLE IF NOT EXISTS catalog_sectores (
    nombre TEXT PRIMARY KEY,
    activo INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS catalog_centros (
    codigo TEXT PRIMARY KEY,
    nombre TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS catalog_almacenes (
    codigo TEXT PRIMARY KEY,
    nombre TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS catalog_roles (
    nombre TEXT PRIMARY KEY,
    activo INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS catalog_puestos (
    nombre TEXT PRIMARY KEY,
    activo INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

-- Presupuestos por centro/sector
CREATE TABLE IF NOT EXISTS presupuestos (
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    monto_usd REAL DEFAULT 0,
    saldo_usd REAL DEFAULT 0,
    version INTEGER DEFAULT 1,
    updated_by TEXT,
    monto_cents INTEGER DEFAULT 0,
    saldo_cents INTEGER DEFAULT 0,
    PRIMARY KEY (centro, sector)
);

-- Trivias - puntajes
CREATE TABLE IF NOT EXISTS trivias_scores (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foro - posts
CREATE TABLE IF NOT EXISTS foro_posts (
    id SERIAL PRIMARY KEY,
    autor_id TEXT NOT NULL,
    autor_nombre TEXT NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    categoria TEXT DEFAULT 'general',
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foro - respuestas
CREATE TABLE IF NOT EXISTS foro_respuestas (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES foro_posts(id) ON DELETE CASCADE,
    autor_id TEXT NOT NULL,
    autor_nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foro - likes
CREATE TABLE IF NOT EXISTS foro_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES foro_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Configuracion de almacenes
CREATE TABLE IF NOT EXISTS config_almacenes (
    id SERIAL PRIMARY KEY,
    centro TEXT NOT NULL,
    almacen TEXT NOT NULL,
    nombre TEXT,
    libre_disponibilidad INTEGER DEFAULT 0,
    responsable_id TEXT,
    excluido INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(centro, almacen)
);

-- Lotes excluidos
CREATE TABLE IF NOT EXISTS config_lotes_excluidos (
    id SERIAL PRIMARY KEY,
    lote TEXT NOT NULL UNIQUE,
    motivo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial de estados de solicitudes
CREATE TABLE IF NOT EXISTS solicitudes_historial_estados (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    actor_id TEXT,
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reglas de aprobacion
CREATE TABLE IF NOT EXISTS reglas_aprobacion (
    id SERIAL PRIMARY KEY,
    rol_solicitante TEXT NOT NULL,
    monto_minimo REAL DEFAULT 0,
    monto_maximo REAL,
    rol_aprobador TEXT NOT NULL,
    niveles_requeridos INTEGER DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Aprobadores delegados
CREATE TABLE IF NOT EXISTS aprobadores_delegados (
    id SERIAL PRIMARY KEY,
    aprobador_original_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    delegado_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alertas MRP
CREATE TABLE IF NOT EXISTS alertas_mrp (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    centro TEXT,
    tipo TEXT NOT NULL,
    severidad TEXT DEFAULT 'media',
    estado TEXT DEFAULT 'activa',
    resuelto_por TEXT,
    accion_tomada TEXT,
    fecha_resolucion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuracion SLA
CREATE TABLE IF NOT EXISTS sla_configuracion (
    id SERIAL PRIMARY KEY,
    tipo_solicitud TEXT NOT NULL,
    criticidad TEXT NOT NULL,
    tiempo_limite_horas INTEGER NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alertas SLA
CREATE TABLE IF NOT EXISTS sla_alertas (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
    tipo_alerta TEXT NOT NULL,
    mensaje TEXT,
    resuelta BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ordenes planificadas MRP
CREATE TABLE IF NOT EXISTS ordenes_planificadas (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    centro TEXT,
    cantidad REAL NOT NULL,
    fecha_necesidad DATE,
    tipo TEXT DEFAULT 'compra',
    prioridad INTEGER DEFAULT 1,
    estado TEXT DEFAULT 'planificada',
    solped_id INTEGER,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    entidad TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    accion TEXT NOT NULL,
    actor_id TEXT,
    campo_modificado TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    actor_rol TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    auth_secret TEXT,
    p256dh TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial de presupuestos
CREATE TABLE IF NOT EXISTS budget_history (
    id SERIAL PRIMARY KEY,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    tipo_cambio TEXT NOT NULL,
    monto_anterior_usd REAL,
    monto_nuevo_usd REAL,
    diferencia_usd REAL,
    solicitante_id TEXT,
    aprobador_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Materiales (catalogo local pequeno)
CREATE TABLE IF NOT EXISTS materiales (
    codigo TEXT PRIMARY KEY,
    descripcion TEXT,
    unidad TEXT,
    precio_usd REAL,
    activo BOOLEAN DEFAULT TRUE
);

-- Equivalencias de materiales (tabla local)
CREATE TABLE IF NOT EXISTS material_equivalencias (
    id_equivalencia SERIAL PRIMARY KEY,
    codigo_original TEXT NOT NULL,
    codigo_equivalente TEXT NOT NULL,
    compatibilidad_pct REAL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);
