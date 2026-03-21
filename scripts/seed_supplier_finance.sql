-- Seed supplier finance data for production
-- Tables: programa_descuento, oferta_descuento, terminos_pago_proveedor

-- =====================================================
-- programa_descuento (discount programs)
-- =====================================================
INSERT INTO programa_descuento (nombre, tipo, descuento_base_pct, dias_anticipacion, formula, estado, presupuesto_anual, utilizado_anual, created_at) VALUES
('Pronto Pago Q1 2026', 'prompt_payment', 2.5, 15, 'descuento_base * (dias_anticipacion / 30)', 'active', 500000, 45200, NOW() - INTERVAL '60 days'),
('Descuento por Volumen Anual', 'volume_rebate', 3.0, NULL, 'IF volumen > 1M THEN 3% ELSE IF volumen > 500K THEN 2% ELSE 1%', 'active', 800000, 123500, NOW() - INTERVAL '45 days'),
('Pago Anticipado Proveedores Criticos', 'early_payment', 1.8, 30, 'descuento_base * (dias_restantes / dias_totales)', 'active', 300000, 67800, NOW() - INTERVAL '30 days'),
('Programa RF Materiales Importados', 'early_payment', 2.0, 20, 'tasa_base + spread_riesgo', 'active', 1000000, 215000, NOW() - INTERVAL '20 days'),
('Rebate Trimestral Insumos', 'volume_rebate', 1.5, NULL, 'volumen_trimestre * tasa_rebate', 'paused', 200000, 0, NOW() - INTERVAL '10 days');

-- =====================================================
-- oferta_descuento (discount offers)
-- =====================================================
INSERT INTO oferta_descuento (programa_id, factura_id, proveedor_cuit, monto_factura, descuento_ofrecido_pct, monto_descuento, fecha_pago_original, fecha_pago_anticipado, estado, created_at) VALUES
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pronto Pago%' LIMIT 1), NULL, 'SEED_002', 125000, 2.5, 3125, '2026-04-15', '2026-03-20', 'pendiente', NOW() - INTERVAL '5 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pronto Pago%' LIMIT 1), NULL, 'SEED_003', 87500, 2.5, 2187.5, '2026-04-10', '2026-03-18', 'aceptada', NOW() - INTERVAL '10 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pago Anticipado%' LIMIT 1), NULL, 'SEED_004', 340000, 1.8, 6120, '2026-05-01', '2026-03-25', 'pendiente', NOW() - INTERVAL '3 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pago Anticipado%' LIMIT 1), NULL, 'SEED_005', 195000, 1.8, 3510, '2026-04-20', '2026-03-15', 'aceptada', NOW() - INTERVAL '15 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pago Anticipado%' LIMIT 1), NULL, 'SEED_006', 78000, 1.8, 1404, '2026-04-25', '2026-03-22', 'pagada', NOW() - INTERVAL '20 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Programa RF%' LIMIT 1), NULL, 'SEED_007', 520000, 2.0, 10400, '2026-05-10', '2026-04-01', 'pendiente', NOW() - INTERVAL '2 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Programa RF%' LIMIT 1), NULL, 'SEED_008', 415000, 2.0, 8300, '2026-05-05', '2026-03-28', 'aceptada', NOW() - INTERVAL '7 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pronto Pago%' LIMIT 1), NULL, 'SEED_004', 62000, 2.5, 1550, '2026-04-08', '2026-03-15', 'pagada', NOW() - INTERVAL '25 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Descuento por Volumen%' LIMIT 1), NULL, 'SEED_002', 950000, 3.0, 28500, '2026-06-01', '2026-04-15', 'pendiente', NOW() - INTERVAL '1 day'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Descuento por Volumen%' LIMIT 1), NULL, 'SEED_003', 680000, 2.0, 13600, '2026-05-20', '2026-04-10', 'aceptada', NOW() - INTERVAL '8 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Pronto Pago%' LIMIT 1), NULL, 'SEED_005', 145000, 2.5, 3625, '2026-04-12', '2026-03-22', 'rechazada', NOW() - INTERVAL '12 days'),
((SELECT id FROM programa_descuento WHERE nombre LIKE 'Programa RF%' LIMIT 1), NULL, 'SEED_009', 275000, 2.0, 5500, '2026-04-28', '2026-03-30', 'pendiente', NOW());

-- =====================================================
-- terminos_pago_proveedor (payment terms)
-- =====================================================
INSERT INTO terminos_pago_proveedor (proveedor_cuit, termino_estandar_dias, termino_negociado_dias, descuento_pronto_pago_pct, historico_cumplimiento_pct, ultima_revision, created_at) VALUES
('SEED_002', 60, 45, 2.5, 94.5, '2026-02-15', NOW() - INTERVAL '30 days'),
('SEED_003', 60, 30, 3.0, 88.2, '2026-01-20', NOW() - INTERVAL '45 days'),
('SEED_004', 90, 60, 1.5, 96.8, '2026-03-01', NOW() - INTERVAL '12 days'),
('SEED_005', 30, 30, 2.0, 78.5, '2026-02-01', NOW() - INTERVAL '40 days'),
('SEED_006', 60, 45, 2.0, 91.3, '2026-02-20', NOW() - INTERVAL '22 days'),
('SEED_007', 90, 75, 1.0, 85.7, '2026-01-15', NOW() - INTERVAL '55 days'),
('SEED_008', 60, 45, 2.5, 97.1, '2026-03-05', NOW() - INTERVAL '8 days'),
('SEED_009', 45, 30, 3.5, 82.4, '2026-02-10', NOW() - INTERVAL '32 days');
