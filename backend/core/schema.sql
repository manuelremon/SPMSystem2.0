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

-- NOTA: El catálogo de materiales (44,461 items) está en data/catalogo_materiales.db
-- Archivo separado para mejor rendimiento y mantenimiento

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

-- Proveedores (DEPRECATED - mantener para migración, usar proveedores_externos/internos)
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

-- ============================================================================
-- PROVEEDORES V2: Estructura normalizada (Externa + Interna)
-- ============================================================================

-- Proveedores Externos (empresas terceras)
CREATE TABLE IF NOT EXISTS proveedores_externos (
    cuit            TEXT PRIMARY KEY,           -- CUIT/RUT como identificador único
    nombre          TEXT NOT NULL,              -- Razón social
    direccion       TEXT,
    localidad       TEXT,
    pais            TEXT DEFAULT 'Argentina',
    origen          TEXT CHECK(origen IN ('local', 'exterior')),  -- Para identificar importaciones
    lead_time_dias  INTEGER,                    -- Tiempo de entrega estimado
    rubro           TEXT,                       -- Tipo de materiales que provee
    calificacion    TEXT DEFAULT 'sin_calificar' CHECK(calificacion IN ('cumplidor', 'incumplidor', 'sin_calificar')),
    activo          BOOLEAN DEFAULT 1,
    notas           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contactos de proveedores externos (personas)
CREATE TABLE IF NOT EXISTS proveedor_ext_contactos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cuit_proveedor  TEXT NOT NULL,
    nombre          TEXT NOT NULL,
    apellido        TEXT,
    cargo           TEXT,                       -- Ej: "Gerente Comercial", "Ventas"
    es_principal    BOOLEAN DEFAULT 0,          -- Contacto principal
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contactos_cuit ON proveedor_ext_contactos(cuit_proveedor);

-- Emails de proveedores externos
CREATE TABLE IF NOT EXISTS proveedor_ext_emails (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cuit_proveedor  TEXT NOT NULL,
    email           TEXT NOT NULL,
    tipo            TEXT DEFAULT 'comercial',   -- comercial, facturacion, soporte
    es_principal    BOOLEAN DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_emails_cuit ON proveedor_ext_emails(cuit_proveedor);

-- Teléfonos de proveedores externos
CREATE TABLE IF NOT EXISTS proveedor_ext_telefonos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cuit_proveedor  TEXT NOT NULL,
    telefono        TEXT NOT NULL,
    tipo            TEXT DEFAULT 'fijo',        -- fijo, celular, fax
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_telefonos_cuit ON proveedor_ext_telefonos(cuit_proveedor);

-- Proveedores Internos (Almacenes YPF)
-- Diferencia con config_almacenes:
--   proveedores_internos: "Quién es" (datos del almacén, contactos, referentes)
--   config_almacenes: "Cómo opera" (libre disponibilidad, exclusiones)
CREATE TABLE IF NOT EXISTS proveedores_internos (
    centro              TEXT NOT NULL,
    almacen             TEXT NOT NULL,
    centro_nombre       TEXT,                   -- "UP Loma La Lata"
    almacen_nombre      TEXT,                   -- "Mantenimiento", "Energía"
    sector              TEXT,                   -- El sector al que responde este almacén
    contacto_centro     TEXT,                   -- Email del centro
    responsable_centro  TEXT,                   -- Jefe del centro/depósito
    referente_id        TEXT,                   -- FK opcional a usuarios.id_spm
    referente_nombre    TEXT,                   -- Nombre libre si no es usuario SPM
    referente_email     TEXT,                   -- Email del referente
    activo              BOOLEAN DEFAULT 1,
    notas               TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (centro, almacen),
    FOREIGN KEY (referente_id) REFERENCES usuarios(id_spm)
);

-- NOTA: Equivalencias de materiales (34,865 items) están en data/equivalentes.db

-- ============================================================================
-- PRECIOS NEGOCIADOS Y CONFIGURACION DE SCORES
-- ============================================================================

-- Precios negociados con proveedores externos
CREATE TABLE IF NOT EXISTS proveedor_precios_negociados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuit_proveedor TEXT NOT NULL,
    codigo_material TEXT NOT NULL,
    precio_usd REAL NOT NULL,
    moneda TEXT DEFAULT 'USD',
    fecha_vigencia_desde DATE NOT NULL,
    fecha_vigencia_hasta DATE,
    condicion_pago TEXT,
    cantidad_minima INTEGER DEFAULT 1,
    notas TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit),
    UNIQUE(cuit_proveedor, codigo_material, fecha_vigencia_desde)
);
CREATE INDEX IF NOT EXISTS idx_precios_material ON proveedor_precios_negociados(codigo_material);
CREATE INDEX IF NOT EXISTS idx_precios_proveedor ON proveedor_precios_negociados(cuit_proveedor);

-- Configuración de scores por tipo de equivalencia
CREATE TABLE IF NOT EXISTS config_equivalencia_scores (
    tipo_equiv TEXT PRIMARY KEY,
    compatibilidad_pct INTEGER NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1
);
INSERT OR IGNORE INTO config_equivalencia_scores VALUES
    ('E0_DUPLICADO', 100, 'Duplicado tecnico - mismo material'),
    ('E1_ESTRICTA', 95, 'Equivalencia tecnica estricta 1:1'),
    ('E2_SUPLIBLE', 85, 'Suplible bajo condiciones');

-- ============================================================================
-- DECISIONES DE ABASTECIMIENTO (MULTI-FUENTE)
-- ============================================================================

-- Cabecera de decision por item (permite multiples fuentes)
CREATE TABLE IF NOT EXISTS decision_abastecimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    cantidad_solicitada REAL NOT NULL,
    cantidad_total_asignada REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente', 'parcial', 'completo', 'confirmado'
    )),
    comentario TEXT,
    planner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(solicitud_id, item_index),
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE,
    FOREIGN KEY (planner_id) REFERENCES usuarios(id_spm)
);

-- Fuentes seleccionadas para cada decision (N fuentes por item)
CREATE TABLE IF NOT EXISTS decision_abastecimiento_fuentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id INTEGER NOT NULL,
    tipo_fuente TEXT NOT NULL CHECK (tipo_fuente IN (
        'stock', 'transferencia', 'proveedor', 'equivalencia'
    )),
    -- Para stock/transferencia (interno)
    centro_origen TEXT,
    almacen_origen TEXT,
    -- Para proveedor externo
    cuit_proveedor TEXT,
    proveedor_nombre TEXT,
    -- Para equivalencia
    codigo_material_equiv TEXT,
    tipo_equivalencia TEXT,
    -- Cantidades y precios
    cantidad_asignada REAL NOT NULL,
    precio_unitario REAL,
    precio_es_negociado INTEGER DEFAULT 0,
    plazo_dias INTEGER,
    -- Metadata
    score_opcion REAL,
    orden_prioridad INTEGER DEFAULT 1,
    notas TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decision_abastecimiento(id) ON DELETE CASCADE,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit)
);
CREATE INDEX IF NOT EXISTS idx_decision_solicitud ON decision_abastecimiento(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_fuentes_decision ON decision_abastecimiento_fuentes(decision_id);

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
-- DATOS INICIALES (exportados de spm.db local)
-- Todos los usuarios tienen contraseña: "a"
-- ============================================================================

-- Usuarios del sistema
INSERT OR IGNORE INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf, mail_respaldo, almacenes) VALUES
('1', 'Manu', 'Remón', 'Admin, Administrador, Aprobador_presupuestos, Aprobador_solicitudes, Planificador', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'admin@spm.local', 'Administrador General', 'Mantenimiento', '1008,1050', NULL, NULL, NULL, '', 'Activo', '', NULL, NULL),
('2', 'Laura', 'Planner', 'Planificador, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'planner1@spm.local', 'Planificador Senior', 'Planificacion', '1500', '6', '6', '7', '', 'Activo', '', NULL, NULL),
('3', 'Sergio', 'Planner', 'Planificador, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'planner2@spm.local', 'Planificador', 'Mantenimiento', '1008,1050', '6', '6', '7', '', 'Activo', '', NULL, NULL),
('4', 'Carlos', 'Perez', 'Aprobador_solicitudes, Jefe, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'jefe1@spm.local', 'Jefe de Sector', 'Planificacion', '1008,1050', '6', '6', '7', '', 'Activo', '', NULL, NULL),
('5', 'Maria', 'Lopez', 'Aprobador_solicitudes, Jefe, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'jefe2@spm.local', 'Jefa de Area', 'Mantenimiento', '1008,1050', '6', '6', '7', '', 'Activo', '', NULL, '["0001"]'),
('6', 'Andres', 'Garcia', 'Aprobador_presupuestos, Aprobador_solicitudes, Gerente1, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'gerente1@spm.local', 'Gerente Regional', 'Mantenimiento', '1008,1050,1064', '7', NULL, '7', '', 'Activo', '', NULL, NULL),
('7', 'Luis', 'Lopez', 'Aprobador_presupuestos, Aprobador_solicitudes, Gerente2, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'gerente2@spm.local', 'Director de Operaciones', 'Mantenimiento', '1008,1050,1064', '1', NULL, NULL, '', 'Activo', '', NULL, NULL),
('8', 'Juan', 'Levi', 'Solicitante, solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'juanlevi@spm.local', 'Empleado', 'Mantenimiento', '1050,1008', '4', '6', '7', '2994565456', 'Activo', '', '', '0101,0001'),
('9', 'Pedro', 'Mamani', 'Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'pedromamani@spm.local', 'Tecnico', 'Mantenimiento', '1500', '4', '6', '7', '', 'Activo', '', NULL, NULL),
('10', 'Roberto', 'Rosas', 'Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'robertorosas@spm.local', 'Operador', 'Mantenimiento', '1008,1050', '5', '6', '7', '', 'Activo', '', NULL, NULL);

-- Catálogo de Sectores
INSERT OR IGNORE INTO catalog_sectores (nombre, activo) VALUES ('Almacenes', 1);
INSERT OR IGNORE INTO catalog_sectores (nombre, activo) VALUES ('Compras', 1);
INSERT OR IGNORE INTO catalog_sectores (nombre, activo) VALUES ('Mantenimiento', 1);
INSERT OR IGNORE INTO catalog_sectores (nombre, activo) VALUES ('Planificacion', 1);
INSERT OR IGNORE INTO catalog_sectores (nombre, activo) VALUES ('Produccion', 1);
INSERT OR IGNORE INTO catalog_sectores (nombre, activo) VALUES ('Logistica', 1);

-- Catálogo de Centros
INSERT OR IGNORE INTO catalog_centros (codigo, nombre, activo) VALUES ('1008', 'UP Loma La Lata', 1);
INSERT OR IGNORE INTO catalog_centros (codigo, nombre, activo) VALUES ('1050', 'UP UTE Rio Neuquén', 1);
INSERT OR IGNORE INTO catalog_centros (codigo, nombre, activo) VALUES ('1064', 'UP Añelo', 1);
INSERT OR IGNORE INTO catalog_centros (codigo, nombre, activo) VALUES ('1500', 'MID Loma La Lata', 1);
INSERT OR IGNORE INTO catalog_centros (codigo, nombre, activo) VALUES ('1501', 'MID Sierra Barrosa', 1);
INSERT OR IGNORE INTO catalog_centros (codigo, nombre, activo) VALUES ('1502', 'MID El Portón', 1);

-- Catálogo de Almacenes
INSERT OR IGNORE INTO catalog_almacenes (codigo, nombre, activo) VALUES ('0001', 'Mantenimiento', 1);
INSERT OR IGNORE INTO catalog_almacenes (codigo, nombre, activo) VALUES ('0012', 'Yacimiento Digital', 1);
INSERT OR IGNORE INTO catalog_almacenes (codigo, nombre, activo) VALUES ('0101', 'Críticos', 1);
INSERT OR IGNORE INTO catalog_almacenes (codigo, nombre, activo) VALUES ('9002', 'Energía', 1);
INSERT OR IGNORE INTO catalog_almacenes (codigo, nombre, activo) VALUES ('9003', 'Obras', 1);
INSERT OR IGNORE INTO catalog_almacenes (codigo, nombre, activo) VALUES ('9004', 'Producción', 1);

-- Catálogo de Roles
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('Administrador', 1);
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('Solicitante', 1);
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('Solicitante, Aprobador Solicitudes', 1);
INSERT OR IGNORE INTO catalog_roles (nombre, activo) VALUES ('Solicitante, Aprobador Solicitudes, Aprobador de Presupuesto', 1);

-- Catálogo de Puestos (8 puestos estándar)
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Planificador', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Jefe', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Gerente1', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Gerente2', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Director', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Supervisor', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Analista', 1);
INSERT OR IGNORE INTO catalog_puestos (nombre, activo) VALUES ('Coordinador', 1);

-- Presupuestos iniciales
INSERT OR IGNORE INTO presupuestos (centro, sector, monto_usd, saldo_usd, version, monto_cents, saldo_cents) VALUES ('1008', 'Mantenimiento', 2100110.0, 2047565.19, 6, 210011000, 204756519);
INSERT OR IGNORE INTO presupuestos (centro, sector, monto_usd, saldo_usd, version, monto_cents, saldo_cents) VALUES ('1500', 'Mantenimiento', 200000.0, 200000.0, 1, 20000000, 20000000);
