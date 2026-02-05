-- Datos iniciales para SPM v3.0 (DATOS ANONIMIZADOS)
-- Todos los usuarios tienen contrasena: "a"

-- Usuarios del sistema
INSERT INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf, mail_respaldo, almacenes) VALUES
('1', 'Admin', 'Demo', 'Admin, Administrador, Aprobador_presupuestos, Aprobador_solicitudes, Planificador', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'admin@demo.local', 'Administrador General', 'Mantenimiento', 'AA101,AA102', NULL, NULL, NULL, '', 'Activo', '', NULL, NULL),
('2', 'Laura', 'Planificador', 'Planificador, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'planner1@demo.local', 'Planificador Senior', 'Planificacion', 'AA104', '6', '6', '7', '', 'Activo', '', NULL, NULL),
('3', 'Sergio', 'Planificador', 'Planificador, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'planner2@demo.local', 'Planificador', 'Mantenimiento', 'AA101,AA102', '6', '6', '7', '', 'Activo', '', NULL, NULL),
('4', 'Carlos', 'Usuario', 'Aprobador_solicitudes, Jefe, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'jefe1@demo.local', 'Jefe de Sector', 'Planificacion', 'AA101,AA102', '6', '6', '7', '', 'Activo', '', NULL, NULL),
('5', 'Maria', 'Aprobador', 'Aprobador_solicitudes, Jefe, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'jefe2@demo.local', 'Jefa de Area', 'Mantenimiento', 'AA101,AA102', '6', '6', '7', '', 'Activo', '', NULL, '["0001"]'),
('6', 'Andres', 'Gerente', 'Aprobador_presupuestos, Aprobador_solicitudes, Gerente1, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'gerente1@demo.local', 'Gerente Regional', 'Mantenimiento', 'AA101,AA102,AA103', '7', NULL, '7', '', 'Activo', '', NULL, NULL),
('7', 'Luis', 'Gerente', 'Aprobador_presupuestos, Aprobador_solicitudes, Gerente2, Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'gerente2@demo.local', 'Director de Operaciones', 'Mantenimiento', 'AA101,AA102,AA103', '1', NULL, NULL, '', 'Activo', '', NULL, NULL),
('8', 'Juan', 'Usuario', 'Solicitante, solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'juanusuario@demo.local', 'Empleado', 'Mantenimiento', 'AA102,AA101', '4', '6', '7', '5550001234', 'Activo', '', '', '0101,0001'),
('9', 'Pedro', 'Usuario', 'Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'pedrousuario@demo.local', 'Tecnico', 'Mantenimiento', 'AA104', '4', '6', '7', '', 'Activo', '', NULL, NULL),
('10', 'Roberto', 'Usuario', 'Solicitante', '$2b$12$VmNDvYxnTQKZfQQU9CmKt.Nr0K9Qui5WG1WqcVBpLI/NxhgJW3xkG', 'robertousuario@demo.local', 'Operador', 'Mantenimiento', 'AA101,AA102', '5', '6', '7', '', 'Activo', '', NULL, NULL)
ON CONFLICT (id_spm) DO NOTHING;

-- Catalogo de Sectores
INSERT INTO catalog_sectores (nombre, activo) VALUES ('Almacenes', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_sectores (nombre, activo) VALUES ('Compras', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_sectores (nombre, activo) VALUES ('Mantenimiento', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_sectores (nombre, activo) VALUES ('Planificacion', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_sectores (nombre, activo) VALUES ('Produccion', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_sectores (nombre, activo) VALUES ('Logistica', 1) ON CONFLICT DO NOTHING;

-- Catalogo de Centros (ANONIMIZADOS)
INSERT INTO catalog_centros (codigo, nombre, activo) VALUES ('AA101', 'Deposito 1', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_centros (codigo, nombre, activo) VALUES ('AA102', 'Deposito 2', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_centros (codigo, nombre, activo) VALUES ('AA103', 'Deposito 3', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_centros (codigo, nombre, activo) VALUES ('AA104', 'Deposito 4', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_centros (codigo, nombre, activo) VALUES ('AA105', 'Deposito 5', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_centros (codigo, nombre, activo) VALUES ('AA106', 'Deposito 6', 1) ON CONFLICT DO NOTHING;

-- Catalogo de Almacenes
INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES ('0001', 'Mantenimiento', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES ('0012', 'Digital', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES ('0101', 'Criticos', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES ('9002', 'Energia', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES ('9003', 'Obras', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES ('9004', 'Produccion', 1) ON CONFLICT DO NOTHING;

-- Catalogo de Roles
INSERT INTO catalog_roles (nombre, activo) VALUES ('Administrador', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_roles (nombre, activo) VALUES ('Solicitante', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_roles (nombre, activo) VALUES ('Solicitante, Aprobador Solicitudes', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_roles (nombre, activo) VALUES ('Solicitante, Aprobador Solicitudes, Aprobador de Presupuesto', 1) ON CONFLICT DO NOTHING;

-- Catalogo de Puestos
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Planificador', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Jefe', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Gerente1', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Gerente2', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Director', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Supervisor', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Analista', 1) ON CONFLICT DO NOTHING;
INSERT INTO catalog_puestos (nombre, activo) VALUES ('Coordinador', 1) ON CONFLICT DO NOTHING;

-- Presupuestos iniciales (CENTROS ANONIMIZADOS)
INSERT INTO presupuestos (centro, sector, monto_usd, saldo_usd, version, monto_cents, saldo_cents) VALUES
('AA101', 'Mantenimiento', 2100110.0, 2047565.19, 6, 210011000, 204756519),
('AA102', 'Mantenimiento', 500000.0, 500000.0, 1, 50000000, 50000000),
('AA103', 'Mantenimiento', 300000.0, 300000.0, 1, 30000000, 30000000),
('AA104', 'Mantenimiento', 200000.0, 200000.0, 1, 20000000, 20000000)
ON CONFLICT (centro, sector) DO NOTHING;

-- Configuracion de scores de equivalencia
INSERT INTO config_equivalencia_scores (tipo_equiv, compatibilidad_pct, descripcion, activo) VALUES
('E0_DUPLICADO', 100, 'Duplicado tecnico - mismo material', 1),
('E1_ESTRICTA', 95, 'Equivalencia tecnica estricta 1:1', 1),
('E2_SUPLIBLE', 85, 'Suplible bajo condiciones', 1)
ON CONFLICT (tipo_equiv) DO NOTHING;

-- Configuracion SLA inicial
INSERT INTO sla_configuracion (tipo_solicitud, criticidad, tiempo_limite_horas, activo) VALUES
('Normal', 'Normal', 72, true),
('Normal', 'Urgente', 24, true),
('Normal', 'Critica', 8, true),
('Proyecto', 'Normal', 168, true),
('Proyecto', 'Urgente', 72, true)
ON CONFLICT DO NOTHING;

-- Reglas de aprobacion iniciales
INSERT INTO reglas_aprobacion (rol_solicitante, monto_minimo, monto_maximo, rol_aprobador, niveles_requeridos, activo) VALUES
('Solicitante', 0, 1000, 'Jefe', 1, true),
('Solicitante', 1000, 10000, 'Gerente1', 1, true),
('Solicitante', 10000, 50000, 'Gerente2', 2, true),
('Solicitante', 50000, NULL, 'Admin', 3, true)
ON CONFLICT DO NOTHING;

-- Asignaciones de planificadores (CENTROS ANONIMIZADOS)
INSERT INTO planificador_asignaciones (planificador_id, centro, sector, almacen_virtual, prioridad, activo) VALUES
('2', 'AA104', 'Mantenimiento', NULL, 1, true),
('2', 'AA104', 'Planificacion', NULL, 1, true),
('3', 'AA101', 'Mantenimiento', NULL, 1, true),
('3', 'AA102', 'Mantenimiento', NULL, 1, true),
('1', 'AA101', NULL, NULL, 2, true),
('1', 'AA102', NULL, NULL, 2, true)
ON CONFLICT DO NOTHING;

-- Proveedores externos de ejemplo (ANONIMIZADOS)
INSERT INTO proveedores_externos (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion, activo) VALUES
('30-12345678-9', 'Proveedor Industrial A', 'Av. Industrial 1234', 'Ciudad Norte', 'Pais Demo', 'local', 7, 'Ferreteria', 'cumplidor', true),
('30-98765432-1', 'Proveedor Tecnico B', 'Ruta 22 Km 5', 'Ciudad Sur', 'Pais Demo', 'local', 14, 'Bombas', 'cumplidor', true),
('30-11223344-5', 'Proveedor Importador C', 'Zona Franca Lote 10', 'Ciudad Norte', 'Pais Demo', 'exterior', 45, 'Repuestos', 'sin_calificar', true)
ON CONFLICT (cuit) DO NOTHING;

-- Proveedores internos (almacenes internos - ANONIMIZADOS)
INSERT INTO proveedores_internos (centro, almacen, centro_nombre, almacen_nombre, sector, responsable_centro, referente_id, activo) VALUES
('AA101', '0001', 'Deposito 1', 'Mantenimiento', 'Almacenes', 'Responsable A', '3', true),
('AA101', '0101', 'Deposito 1', 'Criticos', 'Almacenes', 'Responsable A', '3', true),
('AA102', '0001', 'Deposito 2', 'Mantenimiento', 'Almacenes', 'Responsable B', '3', true),
('AA104', '0001', 'Deposito 4', 'Mantenimiento', 'Almacenes', 'Responsable C', '2', true)
ON CONFLICT (centro, almacen) DO NOTHING;

-- Configuracion de almacenes (ANONIMIZADOS)
INSERT INTO config_almacenes (centro, almacen, nombre, libre_disponibilidad, excluido) VALUES
('AA101', '0001', 'Mantenimiento D1', 1, 0),
('AA101', '0101', 'Criticos D1', 0, 0),
('AA102', '0001', 'Mantenimiento D2', 1, 0),
('AA104', '0001', 'Mantenimiento D4', 1, 0)
ON CONFLICT (centro, almacen) DO NOTHING;
