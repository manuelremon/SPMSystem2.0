-- Schema para SPM v2.0
-- Este archivo se ejecuta automáticamente si la BD está vacía

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    payload TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id_spm)
);

-- Catálogo de materiales
CREATE TABLE IF NOT EXISTS materiales(
    codigo TEXT PRIMARY KEY,
    descripcion TEXT NOT NULL,
    descripcion_larga TEXT,
    centro TEXT,
    sector TEXT,
    unidad TEXT,
    precio_usd REAL DEFAULT 0
);

-- Solicitudes de materiales
CREATE TABLE IF NOT EXISTS solicitudes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario TEXT NOT NULL,
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
    planner_id TEXT,
    total_monto REAL DEFAULT 0,
    notificado_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(id_usuario) REFERENCES usuarios(id_spm),
    FOREIGN KEY(planner_id) REFERENCES usuarios(id_spm)
);

-- Asignaciones de planificadores
CREATE TABLE IF NOT EXISTS planificador_asignaciones(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planificador_id TEXT NOT NULL,
    centro TEXT,
    sector TEXT,
    almacen_virtual TEXT,
    prioridad INTEGER DEFAULT 1,
    activo BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(planificador_id, centro, sector, almacen_virtual)
);

-- Notificaciones del sistema
CREATE TABLE IF NOT EXISTS notificaciones(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinatario_id TEXT NOT NULL,
    solicitud_id INTEGER,
    mensaje TEXT NOT NULL,
    leido INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT DEFAULT 'info',
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id)
);

-- Incorporaciones de presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_incorporaciones(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro TEXT NOT NULL,
    sector TEXT,
    monto REAL NOT NULL,
    motivo TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    solicitante_id TEXT NOT NULL,
    aprobador_id TEXT,
    comentario TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY(solicitante_id) REFERENCES usuarios(id_spm),
    FOREIGN KEY(aprobador_id) REFERENCES usuarios(id_spm)
);

-- Archivos adjuntos de solicitudes
CREATE TABLE IF NOT EXISTS archivos_adjuntos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    nombre_archivo TEXT NOT NULL,
    nombre_original TEXT NOT NULL,
    tipo_mime TEXT,
    tamano_bytes INTEGER,
    ruta_archivo TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id_spm)
);

-- Tratamiento de items de solicitud
CREATE TABLE IF NOT EXISTS solicitud_items_tratamiento(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    decision TEXT NOT NULL,
    cantidad_aprobada REAL NOT NULL,
    codigo_equivalente TEXT,
    proveedor_sugerido TEXT,
    precio_unitario_estimado REAL,
    comentario TEXT,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(solicitud_id, item_index),
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
);

-- Eventos de tratamiento
CREATE TABLE IF NOT EXISTS solicitud_tratamiento_eventos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    planner_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
);

-- Log de tratamiento
CREATE TABLE IF NOT EXISTS solicitud_tratamiento_log(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    item_index INTEGER,
    actor_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    estado TEXT,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
);

-- Traslados
CREATE TABLE IF NOT EXISTS traslados(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    material TEXT NOT NULL,
    um TEXT,
    cantidad REAL NOT NULL CHECK (cantidad>0),
    origen_centro TEXT NOT NULL,
    origen_almacen TEXT NOT NULL,
    origen_lote TEXT,
    destino_centro TEXT NOT NULL,
    destino_almacen TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planificado',
    referencia TEXT,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
);

-- Solicitudes de pedido
CREATE TABLE IF NOT EXISTS solpeds(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    material TEXT NOT NULL,
    um TEXT,
    cantidad REAL NOT NULL CHECK (cantidad>0),
    precio_unitario_est REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'creada',
    numero TEXT,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
);

-- Órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solped_id INTEGER NOT NULL,
    solicitud_id INTEGER NOT NULL,
    proveedor_email TEXT,
    proveedor_nombre TEXT,
    numero TEXT,
    status TEXT NOT NULL DEFAULT 'emitida',
    subtotal REAL DEFAULT 0,
    moneda TEXT DEFAULT 'USD',
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solped_id) REFERENCES solpeds(id) ON DELETE CASCADE,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
);

-- Cola de emails
CREATE TABLE IF NOT EXISTS outbox_emails(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments_json TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
);

-- Migraciones
CREATE TABLE IF NOT EXISTS schema_migrations(
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK(tipo IN ('externo', 'almacen_interno')) NOT NULL,
    plazo_entrega_dias INTEGER NOT NULL,
    rating REAL CHECK(rating >= 0 AND rating <= 5) NOT NULL,
    activo BOOLEAN DEFAULT 1,
    descripcion TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Equivalencias de materiales
CREATE TABLE IF NOT EXISTS material_equivalencias (
    id_equivalencia INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_original TEXT NOT NULL,
    codigo_equivalente TEXT NOT NULL,
    compatibilidad_pct INTEGER CHECK(compatibilidad_pct >= 0 AND compatibilidad_pct <= 100) NOT NULL,
    descripcion TEXT,
    notas TEXT,
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (codigo_original) REFERENCES materiales(codigo),
    FOREIGN KEY (codigo_equivalente) REFERENCES materiales(codigo),
    UNIQUE(codigo_original, codigo_equivalente)
);

-- Mensajes entre usuarios
CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remitente_id TEXT NOT NULL,
    destinatario_id TEXT NOT NULL,
    solicitud_id INTEGER,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    parent_id INTEGER,
    leido INTEGER DEFAULT 0,
    tipo TEXT DEFAULT 'mensaje',
    metadata_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(remitente_id) REFERENCES usuarios(id_spm),
    FOREIGN KEY(destinatario_id) REFERENCES usuarios(id_spm),
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id),
    FOREIGN KEY(parent_id) REFERENCES mensajes(id)
);

-- Ledger de presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Solicitudes de actualización de presupuesto (BUR)
CREATE TABLE IF NOT EXISTS budget_update_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Catálogos
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Foro - posts
CREATE TABLE IF NOT EXISTS foro_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    autor_id TEXT NOT NULL,
    autor_nombre TEXT NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    categoria TEXT DEFAULT 'general',
    likes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Foro - respuestas
CREATE TABLE IF NOT EXISTS foro_respuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    autor_id TEXT NOT NULL,
    autor_nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES foro_posts(id) ON DELETE CASCADE
);

-- Foro - likes
CREATE TABLE IF NOT EXISTS foro_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES foro_posts(id) ON DELETE CASCADE
);

-- Configuración de almacenes
CREATE TABLE IF NOT EXISTS config_almacenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro TEXT NOT NULL,
    almacen TEXT NOT NULL,
    nombre TEXT,
    libre_disponibilidad INTEGER DEFAULT 0,
    responsable_id TEXT,
    excluido INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(centro, almacen)
);

-- Lotes excluidos
CREATE TABLE IF NOT EXISTS config_lotes_excluidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lote TEXT NOT NULL UNIQUE,
    motivo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Usuario administrador inicial
-- Usuario: admin / Contraseña: admin123
INSERT OR IGNORE INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, estado_registro)
VALUES (
    'admin',
    'Administrador',
    'Sistema',
    'admin',
    '$2b$12$yEQ7Qu304MtjuLOLwRkkRe3JGGP8Bd8D./AGJfI0JqSg8wktF2Qii',
    'admin@spm.local',
    'activo'
);

-- Roles básicos
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('admin', 1);
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('coordinador', 1);
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('usuario', 1);
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('planner', 1);
