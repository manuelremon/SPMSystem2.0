BEGIN;

-- Drivers adicionales (18 nuevos, evitar duplicados por codigo)
INSERT INTO fms_drivers (codigo, nombre, apellido, documento, licencia_tipo, licencia_vencimiento, telefono, email, estado, costo_dia, calificacion)
SELECT v.* FROM (VALUES
  ('DRV-013', 'Juan', 'Martinez', 'DNI-30111013', 'A', '2026-08-15'::date, '+54-11-5555-0013', 'jmartinez@empresa.com', 'disponible', 120.0, 4.5),
  ('DRV-014', 'Pedro', 'Gonzalez', 'DNI-30111014', 'B', '2026-09-20'::date, '+54-11-5555-0014', 'pgonzalez@empresa.com', 'disponible', 130.0, 4.2),
  ('DRV-015', 'Luis', 'Fernandez', 'DNI-30111015', 'C', '2026-10-10'::date, '+54-11-5555-0015', 'lfernandez@empresa.com', 'disponible', 140.0, 4.8),
  ('DRV-016', 'Carlos', 'Ramirez', 'DNI-30111016', 'A', '2026-07-25'::date, '+54-11-5555-0016', 'cramirez@empresa.com', 'en_viaje', 125.0, 4.0),
  ('DRV-017', 'Miguel', 'Torres', 'DNI-30111017', 'B', '2026-11-30'::date, '+54-11-5555-0017', 'mtorres@empresa.com', 'disponible', 135.0, 4.6),
  ('DRV-018', 'Roberto', 'Diaz', 'DNI-30111018', 'C', '2026-06-18'::date, '+54-11-5555-0018', 'rdiaz@empresa.com', 'en_viaje', 145.0, 4.3),
  ('DRV-019', 'Andres', 'Lopez', 'DNI-30111019', 'A', '2027-01-10'::date, '+54-11-5555-0019', 'alopez@empresa.com', 'disponible', 115.0, 4.7),
  ('DRV-020', 'Fernando', 'Castro', 'DNI-30111020', 'B', '2026-12-05'::date, '+54-11-5555-0020', 'fcastro@empresa.com', 'disponible', 128.0, 4.1),
  ('DRV-021', 'Ricardo', 'Moreno', 'DNI-30111021', 'C', '2026-08-22'::date, '+54-11-5555-0021', 'rmoreno@empresa.com', 'no_disponible', 138.0, 3.9),
  ('DRV-022', 'Diego', 'Herrera', 'DNI-30111022', 'A', '2027-02-14'::date, '+54-11-5555-0022', 'dherrera@empresa.com', 'disponible', 122.0, 4.4),
  ('DRV-023', 'Sergio', 'Vargas', 'DNI-30111023', 'B', '2026-09-30'::date, '+54-11-5555-0023', 'svargas@empresa.com', 'disponible', 132.0, 4.6),
  ('DRV-024', 'Pablo', 'Mendez', 'DNI-30111024', 'C', '2026-11-15'::date, '+54-11-5555-0024', 'pmendez@empresa.com', 'en_viaje', 142.0, 4.2),
  ('DRV-025', 'Alejandro', 'Rios', 'DNI-30111025', 'A', '2027-03-20'::date, '+54-11-5555-0025', 'arios@empresa.com', 'disponible', 118.0, 4.8),
  ('DRV-026', 'Gustavo', 'Pena', 'DNI-30111026', 'B', '2026-10-25'::date, '+54-11-5555-0026', 'gpena@empresa.com', 'disponible', 126.0, 4.0),
  ('DRV-027', 'Hector', 'Romero', 'DNI-30111027', 'C', '2027-04-10'::date, '+54-11-5555-0027', 'hromero@empresa.com', 'no_disponible', 136.0, 3.8),
  ('DRV-028', 'Oscar', 'Navarro', 'DNI-30111028', 'A', '2026-12-18'::date, '+54-11-5555-0028', 'onavarro@empresa.com', 'disponible', 124.0, 4.5),
  ('DRV-029', 'Raul', 'Aguirre', 'DNI-30111029', 'B', '2027-05-05'::date, '+54-11-5555-0029', 'raguirre@empresa.com', 'disponible', 134.0, 4.3),
  ('DRV-030', 'Victor', 'Medina', 'DNI-30111030', 'C', '2026-07-30'::date, '+54-11-5555-0030', 'vmedina@empresa.com', 'disponible', 144.0, 4.7)
) AS v(codigo, nombre, apellido, documento, licencia_tipo, licencia_vencimiento, telefono, email, estado, costo_dia, calificacion)
WHERE NOT EXISTS (SELECT 1 FROM fms_drivers d WHERE d.codigo = v.codigo);

-- Work Orders: 5 por cada uno de los primeros 5 vehiculos (IDs 16-20)
INSERT INTO fms_work_orders (vehicle_id, codigo, tipo, estado, prioridad, descripcion, fecha_programada, costo_estimado, costo_mano_obra, costo_repuestos, costo_total, taller, mecanico, created_by) VALUES
(16, 'WO-2026-001', 'preventivo', 'completada', 2, 'Cambio de aceite y filtros', '2026-01-15', 150.00, 80.00, 70.00, 150.00, 'Taller Central', 'Jose Garcia', '1'),
(16, 'WO-2026-002', 'correctivo', 'completada', 1, 'Reparacion sistema de frenos', '2026-01-20', 800.00, 400.00, 550.00, 950.00, 'Taller Central', 'Jose Garcia', '1'),
(17, 'WO-2026-003', 'preventivo', 'completada', 3, 'Rotacion de neumaticos', '2026-02-01', 80.00, 40.00, 40.00, 80.00, 'Taller Externo', 'Miguel Lopez', '1'),
(17, 'WO-2026-004', 'preventivo', 'completada', 2, 'Inspeccion tecnica vehicular', '2026-02-10', 200.00, 120.00, 60.00, 180.00, 'Taller Central', 'Jose Garcia', '1'),
(18, 'WO-2026-005', 'correctivo', 'en_progreso', 1, 'Falla en transmision', '2026-03-01', 2500.00, 1200.00, 0.00, 0.00, 'Taller Especializado', 'Roberto Sanchez', '1'),
(18, 'WO-2026-006', 'preventivo', 'completada', 3, 'Cambio de correas', '2026-01-25', 350.00, 150.00, 200.00, 350.00, 'Taller Central', 'Jose Garcia', '1'),
(19, 'WO-2026-007', 'preventivo', 'pendiente', 2, 'Servicio de 50000 km', '2026-03-15', 500.00, 0.00, 0.00, 0.00, 'Taller Central', 'Jose Garcia', '1'),
(19, 'WO-2026-008', 'correctivo', 'completada', 1, 'Reemplazo de radiador', '2026-02-05', 1200.00, 500.00, 700.00, 1200.00, 'Taller Especializado', 'Roberto Sanchez', '1'),
(20, 'WO-2026-009', 'preventivo', 'completada', 2, 'Cambio de aceite y filtros', '2026-02-15', 150.00, 80.00, 70.00, 150.00, 'Taller Central', 'Miguel Lopez', '1'),
(20, 'WO-2026-010', 'preventivo', 'pendiente', 3, 'Revision general de suspension', '2026-03-20', 600.00, 0.00, 0.00, 0.00, 'Taller Central', 'Jose Garcia', '1'),
(21, 'WO-2026-011', 'correctivo', 'completada', 1, 'Cambio de embrague', '2026-01-10', 1800.00, 800.00, 1000.00, 1800.00, 'Taller Especializado', 'Roberto Sanchez', '1'),
(21, 'WO-2026-012', 'preventivo', 'completada', 2, 'Alineacion y balanceo', '2026-02-20', 120.00, 80.00, 40.00, 120.00, 'Taller Externo', 'Miguel Lopez', '1'),
(22, 'WO-2026-013', 'preventivo', 'en_progreso', 2, 'Cambio de pastillas de freno', '2026-03-05', 400.00, 200.00, 0.00, 0.00, 'Taller Central', 'Jose Garcia', '1'),
(23, 'WO-2026-014', 'correctivo', 'completada', 1, 'Reparacion de alternador', '2026-01-30', 650.00, 300.00, 350.00, 650.00, 'Taller Central', 'Jose Garcia', '1'),
(24, 'WO-2026-015', 'preventivo', 'pendiente', 3, 'Revision de sistema electrico', '2026-03-25', 300.00, 0.00, 0.00, 0.00, 'Taller Central', 'Miguel Lopez', '1'),
(25, 'WO-2026-016', 'preventivo', 'completada', 2, 'Cambio de aceite y filtros', '2026-02-08', 150.00, 80.00, 70.00, 150.00, 'Taller Central', 'Jose Garcia', '1'),
(26, 'WO-2026-017', 'correctivo', 'en_progreso', 1, 'Reparacion sistema hidraulico', '2026-03-08', 1500.00, 700.00, 0.00, 0.00, 'Taller Especializado', 'Roberto Sanchez', '1'),
(27, 'WO-2026-018', 'preventivo', 'completada', 2, 'Servicio de 30000 km', '2026-01-18', 450.00, 200.00, 250.00, 450.00, 'Taller Central', 'Jose Garcia', '1'),
(28, 'WO-2026-019', 'preventivo', 'pendiente', 3, 'Cambio de bateria', '2026-03-28', 250.00, 0.00, 0.00, 0.00, 'Taller Central', 'Miguel Lopez', '1'),
(29, 'WO-2026-020', 'correctivo', 'completada', 2, 'Reparacion aire acondicionado', '2026-02-12', 700.00, 350.00, 350.00, 700.00, 'Taller Central', 'Jose Garcia', '1'),
(30, 'WO-2026-021', 'preventivo', 'completada', 2, 'Cambio de aceite y filtros', '2026-02-25', 150.00, 80.00, 70.00, 150.00, 'Taller Central', 'Miguel Lopez', '1'),
(16, 'WO-2026-022', 'preventivo', 'pendiente', 2, 'Revision de frenos traseros', '2026-04-01', 350.00, 0.00, 0.00, 0.00, 'Taller Central', 'Jose Garcia', '1'),
(17, 'WO-2026-023', 'correctivo', 'en_progreso', 1, 'Fuga de aceite motor', '2026-03-10', 900.00, 500.00, 0.00, 0.00, 'Taller Especializado', 'Roberto Sanchez', '1'),
(18, 'WO-2026-024', 'preventivo', 'pendiente', 3, 'Cambio filtro de aire cabina', '2026-04-05', 60.00, 0.00, 0.00, 0.00, 'Taller Central', 'Miguel Lopez', '1'),
(19, 'WO-2026-025', 'preventivo', 'completada', 2, 'Cambio de aceite y filtros', '2026-01-05', 150.00, 80.00, 70.00, 150.00, 'Taller Central', 'Jose Garcia', '1');

-- Maintenance Plans: 1 por cada vehiculo (15 planes)
INSERT INTO fms_maintenance_plans (vehicle_id, nombre, tipo, descripcion, frecuencia_km, frecuencia_dias, ultimo_servicio, proximo_servicio, costo_estimado, activo) VALUES
(16, 'Cambio de Aceite', 'preventivo', 'Aceite sintetico 10W40 + filtro', 5000, 90, '2026-01-15', '2026-04-15', 150.00, true),
(17, 'Revision de Frenos', 'preventivo', 'Pastillas y discos delanteros', 15000, 180, '2025-12-01', '2026-06-01', 400.00, true),
(18, 'Cambio de Neumaticos', 'preventivo', 'Juego completo 4 ruedas', 40000, 365, '2025-06-15', '2026-06-15', 1200.00, true),
(19, 'Servicio Mayor', 'preventivo', 'Servicio completo de motor', 30000, 365, '2025-09-01', '2026-09-01', 800.00, true),
(20, 'Cambio de Aceite', 'preventivo', 'Aceite sintetico 10W40 + filtro', 5000, 90, '2026-02-15', '2026-05-15', 150.00, true),
(21, 'Revision de Suspension', 'preventivo', 'Amortiguadores y bujes', 20000, 180, '2025-11-01', '2026-05-01', 600.00, true),
(22, 'Cambio de Aceite', 'preventivo', 'Aceite sintetico 10W40 + filtro', 5000, 90, '2026-01-20', '2026-04-20', 150.00, true),
(23, 'Revision de Frenos', 'preventivo', 'Sistema completo de frenado', 15000, 180, '2025-10-15', '2026-04-15', 450.00, true),
(24, 'Cambio de Correas', 'preventivo', 'Correa de distribucion y accesorios', 60000, 730, '2025-01-01', '2027-01-01', 500.00, true),
(25, 'Cambio de Aceite', 'preventivo', 'Aceite sintetico 10W40 + filtro', 5000, 90, '2026-02-08', '2026-05-08', 150.00, true),
(26, 'Servicio Mayor', 'preventivo', 'Servicio completo de motor', 30000, 365, '2025-08-01', '2026-08-01', 800.00, true),
(27, 'Cambio de Aceite', 'preventivo', 'Aceite sintetico 10W40 + filtro', 5000, 90, '2026-01-18', '2026-04-18', 150.00, true),
(28, 'Revision de Frenos', 'preventivo', 'Pastillas traseras y delanteras', 15000, 180, '2025-12-15', '2026-06-15', 400.00, true),
(29, 'Cambio de Aceite', 'preventivo', 'Aceite sintetico 10W40 + filtro', 5000, 90, '2026-02-12', '2026-05-12', 150.00, true),
(30, 'Revision General', 'preventivo', 'Revision completa anual', 50000, 365, '2025-07-01', '2026-07-01', 1000.00, true);

-- Vehicle Documents: 3 por cada uno de los primeros 5 vehiculos (15 docs)
INSERT INTO fms_vehicle_documents (vehicle_id, tipo, numero, nombre, fecha_emision, fecha_vencimiento, notas) VALUES
(16, 'seguro', 'POL-2026-0016', 'Seguro todo riesgo', '2026-01-01', '2027-01-01', 'Cobertura contra todo riesgo'),
(16, 'vtv', 'VTV-2026-0016', 'VTV anual', '2025-06-01', '2026-06-01', 'Verificacion tecnica vehicular'),
(16, 'habilitacion', 'HAB-2026-0016', 'Habilitacion transporte', '2026-01-01', '2027-01-01', 'Habilitacion CNRT'),
(17, 'seguro', 'POL-2026-0017', 'Seguro todo riesgo', '2026-01-01', '2027-01-01', 'Cobertura contra todo riesgo'),
(17, 'vtv', 'VTV-2026-0017', 'VTV anual', '2025-07-01', '2026-07-01', 'Verificacion tecnica vehicular'),
(17, 'habilitacion', 'HAB-2026-0017', 'Habilitacion transporte', '2026-01-01', '2027-01-01', 'Habilitacion CNRT'),
(18, 'seguro', 'POL-2026-0018', 'Seguro todo riesgo', '2026-01-01', '2027-01-01', 'Cobertura contra todo riesgo'),
(18, 'vtv', 'VTV-2026-0018', 'VTV anual', '2025-08-01', '2026-08-01', 'Verificacion tecnica vehicular'),
(18, 'habilitacion', 'HAB-2026-0018', 'Habilitacion transporte', '2026-02-01', '2027-02-01', 'Habilitacion CNRT'),
(19, 'seguro', 'POL-2026-0019', 'Seguro todo riesgo', '2026-01-01', '2027-01-01', 'Cobertura contra todo riesgo'),
(19, 'vtv', 'VTV-2026-0019', 'VTV anual', '2025-09-01', '2026-09-01', 'Verificacion tecnica vehicular'),
(19, 'habilitacion', 'HAB-2026-0019', 'Habilitacion transporte', '2026-01-01', '2027-01-01', 'Habilitacion CNRT'),
(20, 'seguro', 'POL-2026-0020', 'Seguro todo riesgo', '2026-01-01', '2027-01-01', 'Cobertura contra todo riesgo'),
(20, 'vtv', 'VTV-2026-0020', 'VTV anual', '2025-10-01', '2026-10-01', 'Verificacion tecnica vehicular'),
(20, 'habilitacion', 'HAB-2026-0020', 'Habilitacion transporte', '2026-02-01', '2027-02-01', 'Habilitacion CNRT');

-- Inspections: ~20 distribuidas entre vehiculos
INSERT INTO fms_inspections (vehicle_id, tipo, fecha, inspector_id, estado, resultado, observaciones, created_by) VALUES
(16, 'pre_viaje', '2026-03-01', '1', 'completada', 'aprobado', 'Vehiculo en buen estado general', '1'),
(16, 'seguridad', '2026-02-15', '1', 'completada', 'aprobado', 'Todos los sistemas de seguridad OK', '1'),
(17, 'mensual', '2026-02-01', '1', 'completada', 'aprobado', 'Revision mensual completada sin observaciones', '1'),
(17, 'pre_viaje', '2026-03-02', '1', 'completada', 'aprobado', 'Listo para viaje', '1'),
(18, 'anual', '2026-01-10', '1', 'completada', 'observaciones', 'Requiere atencion en suspension trasera', '1'),
(18, 'pre_viaje', '2026-03-03', '1', 'completada', 'aprobado', 'Vehiculo operativo', '1'),
(19, 'seguridad', '2026-02-20', '1', 'completada', 'aprobado', 'Extintores y luces de emergencia OK', '1'),
(19, 'pre_viaje', '2026-03-04', '1', 'completada', 'aprobado', 'Sin novedades', '1'),
(20, 'mensual', '2026-03-01', '1', 'completada', 'aprobado', 'Revision mensual OK', '1'),
(20, 'pre_viaje', '2026-03-05', '1', 'completada', 'aprobado', 'Operativo', '1'),
(21, 'pre_viaje', '2026-03-01', '1', 'completada', 'aprobado', 'Sin observaciones', '1'),
(22, 'seguridad', '2026-02-25', '1', 'completada', 'aprobado', 'Sistemas de seguridad verificados', '1'),
(23, 'mensual', '2026-03-01', '1', 'completada', 'observaciones', 'Nivel de aceite bajo - rellenar', '1'),
(24, 'pre_viaje', '2026-03-06', '1', 'completada', 'aprobado', 'Vehiculo en condiciones', '1'),
(25, 'anual', '2026-02-10', '1', 'completada', 'aprobado', 'Revision anual aprobada', '1'),
(26, 'pre_viaje', '2026-03-07', '1', 'completada', 'aprobado', 'OK para salida', '1'),
(27, 'seguridad', '2026-02-28', '1', 'completada', 'aprobado', 'Cumple normativa vigente', '1'),
(28, 'pre_viaje', '2026-03-05', '1', 'completada', 'rechazado', 'Luz de freno trasera quemada - reparar antes de salir', '1'),
(29, 'mensual', '2026-03-01', '1', 'completada', 'aprobado', 'Todo en orden', '1'),
(30, 'pre_viaje', '2026-03-06', '1', 'completada', 'aprobado', 'Vehiculo listo', '1');

COMMIT;
