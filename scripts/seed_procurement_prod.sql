-- Seed procurement data for production
-- Tables: auditoria_proveedor, auditoria_hallazgo, financiamiento_proveedor

-- =====================================================
-- auditoria_proveedor (supplier audits)
-- =====================================================
INSERT INTO auditoria_proveedor (proveedor_cuit, tipo, titulo, auditor_id, fecha_programada, fecha_realizada, estado, resultado, score, hallazgos_criticos, hallazgos_mayores, hallazgos_menores, plan_accion, proxima_auditoria, created_at) VALUES
('SEED_002', 'on_site', 'Auditoria ISO 9001 - Garcia Suarez', 1, '2026-01-15', '2026-01-20', 'completed', 'pass', 87.5, 0, 1, 3, 'Mejorar trazabilidad en almacen', '2026-07-20', NOW() - INTERVAL '45 days'),
('SEED_003', 'on_site', 'Auditoria Ambiental - Moreno Herrera', 1, '2026-02-01', '2026-02-05', 'completed', 'conditional_pass', 72.0, 0, 2, 4, 'Implementar gestion de residuos RAEE', '2026-08-05', NOW() - INTERVAL '35 days'),
('SEED_004', 'remote', 'Auditoria Social SA8000 - Silva Quiroga', 1, '2026-02-10', '2026-02-14', 'completed', 'pass', 91.0, 0, 0, 2, NULL, '2026-08-14', NOW() - INTERVAL '27 days'),
('SEED_005', 'on_site', 'Auditoria de Proceso - Ramirez Bustos', 1, '2026-02-20', '2026-02-22', 'completed', 'fail', 45.0, 2, 3, 5, 'Corregir no conformidades criticas en linea de produccion', '2026-05-22', NOW() - INTERVAL '19 days'),
('SEED_006', 'documentary', 'Auditoria Financiera - Sanchez Ojeda', 1, '2026-03-01', '2026-03-03', 'completed', 'pass', 88.0, 0, 1, 1, NULL, '2026-09-03', NOW() - INTERVAL '11 days'),
('SEED_007', 'on_site', 'Auditoria ISO 14001 - Gonzalez Fernandez', 1, '2026-03-10', NULL, 'scheduled', NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-10', NOW() - INTERVAL '4 days'),
('SEED_008', 'remote', 'Auditoria de Emisiones - Bustos Ayala', 1, '2026-03-20', NULL, 'scheduled', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW() - INTERVAL '1 day'),
('SEED_002', 'on_site', 'Revision Cumplimiento Laboral - Garcia Suarez', 1, '2026-03-05', '2026-03-07', 'completed', 'pass', 82.0, 0, 1, 3, 'Capacitar al personal en protocolos de seguridad', '2026-09-07', NOW() - INTERVAL '7 days'),
('SEED_003', 'documentary', 'Re-auditoria Calidad - Moreno Herrera', 1, '2026-04-01', NULL, 'scheduled', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
('SEED_005', 'on_site', 'Seguimiento NC - Ramirez Bustos', 1, '2026-03-25', NULL, 'in_progress', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW());

-- Hallazgos for completed audits
INSERT INTO auditoria_hallazgo (auditoria_id, tipo, descripcion, area, accion_requerida, estado, created_at)
SELECT a.id, 'mayor', 'Documentacion desactualizada en area de calidad', 'Calidad', 'Actualizar toda la documentacion ISO antes del 30/03', 'open', NOW()
FROM auditoria_proveedor a WHERE a.titulo LIKE '%Garcia Suarez%' AND a.tipo = 'quality' LIMIT 1;

INSERT INTO auditoria_hallazgo (auditoria_id, tipo, descripcion, area, accion_requerida, estado, created_at)
SELECT a.id, 'menor', 'Etiquetado incompleto en estanterias', 'Almacen', 'Completar etiquetado en 15 dias', 'resolved', NOW()
FROM auditoria_proveedor a WHERE a.titulo LIKE '%Garcia Suarez%' AND a.tipo = 'quality' LIMIT 1;

INSERT INTO auditoria_hallazgo (auditoria_id, tipo, descripcion, area, accion_requerida, estado, created_at)
SELECT a.id, 'critico', 'Falta de calibracion en equipos de medicion', 'Produccion', 'Calibrar todos los equipos inmediatamente', 'open', NOW()
FROM auditoria_proveedor a WHERE a.resultado = 'rejected' LIMIT 1;

INSERT INTO auditoria_hallazgo (auditoria_id, tipo, descripcion, area, accion_requerida, estado, created_at)
SELECT a.id, 'critico', 'Contaminacion cruzada en linea de ensamblaje', 'Produccion', 'Instalar barreras de separacion', 'open', NOW()
FROM auditoria_proveedor a WHERE a.resultado = 'rejected' LIMIT 1;

INSERT INTO auditoria_hallazgo (auditoria_id, tipo, descripcion, area, accion_requerida, estado, created_at)
SELECT a.id, 'mayor', 'Residuos peligrosos sin clasificacion adecuada', 'Medio Ambiente', 'Implementar sistema de clasificacion', 'open', NOW()
FROM auditoria_proveedor a WHERE a.titulo LIKE '%Ambiental%' LIMIT 1;

-- financiamiento_proveedor already seeded (8 records)
