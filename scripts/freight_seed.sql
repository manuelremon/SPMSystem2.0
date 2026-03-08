BEGIN;

-- Tarifas de flete (freight_tarifa)
INSERT INTO freight_tarifa (transportista_cuit, ruta_origen, ruta_destino, tipo_vehiculo, tarifa_base, tarifa_por_km, tarifa_por_kg, vigencia_desde, vigencia_hasta)
SELECT v.* FROM (VALUES
  ('20-30567890-1', 'Buenos Aires', 'Cordoba', 'camion', 15000.00, 45.50, 2.80, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-30567890-1', 'Buenos Aires', 'Rosario', 'camion', 8500.00, 38.00, 2.50, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-30567890-1', 'Buenos Aires', 'Mendoza', 'semirremolque', 28000.00, 52.00, 3.20, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-31234567-8', 'Buenos Aires', 'Tucuman', 'camion', 32000.00, 48.00, 3.00, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-31234567-8', 'Cordoba', 'Rosario', 'camioneta', 6500.00, 35.00, 2.20, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-31234567-8', 'Buenos Aires', 'Mar del Plata', 'furgon', 9800.00, 40.00, 2.60, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-32456789-3', 'Buenos Aires', 'Bahia Blanca', 'camion', 14500.00, 42.00, 2.70, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-32456789-3', 'Rosario', 'Mendoza', 'semirremolque', 22000.00, 50.00, 3.10, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-32456789-3', 'Buenos Aires', 'Santa Fe', 'camion', 11000.00, 39.50, 2.40, '2026-02-01'::timestamp, '2026-12-31'::timestamp),
  ('20-33678901-5', 'Buenos Aires', 'Neuquen', 'semirremolque', 45000.00, 55.00, 3.50, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-33678901-5', 'Buenos Aires', 'Cordoba', 'furgon', 12000.00, 43.00, 2.60, '2026-01-01'::timestamp, '2026-12-31'::timestamp),
  ('20-33678901-5', 'Cordoba', 'Tucuman', 'camion', 18000.00, 46.00, 2.90, '2026-02-01'::timestamp, '2026-12-31'::timestamp)
) AS v(transportista_cuit, ruta_origen, ruta_destino, tipo_vehiculo, tarifa_base, tarifa_por_km, tarifa_por_kg, vigencia_desde, vigencia_hasta)
WHERE NOT EXISTS (
  SELECT 1 FROM freight_tarifa ft
  WHERE ft.transportista_cuit = v.transportista_cuit
    AND ft.ruta_origen = v.ruta_origen
    AND ft.ruta_destino = v.ruta_destino
);

-- Facturas de flete (factura_flete)
INSERT INTO factura_flete (numero_factura, transportista_cuit, monto_facturado, concepto, fecha_factura, estado, monto_aprobado, diferencia)
SELECT v.* FROM (VALUES
  ('FF-2026-0001', '20-30567890-1', 18500.00, 'flete', '2026-01-15'::timestamp, 'approved', 18500.00, 0.00),
  ('FF-2026-0002', '20-30567890-1', 9200.00, 'flete', '2026-01-20'::timestamp, 'approved', 8500.00, 700.00),
  ('FF-2026-0003', '20-31234567-8', 35000.00, 'flete', '2026-01-25'::timestamp, 'approved', 34200.00, 800.00),
  ('FF-2026-0004', '20-32456789-3', 15800.00, 'flete', '2026-02-01'::timestamp, 'approved', 15800.00, 0.00),
  ('FF-2026-0005', '20-30567890-1', 31500.00, 'flete', '2026-02-05'::timestamp, 'audited', NULL, 0.00),
  ('FF-2026-0006', '20-33678901-5', 48000.00, 'flete', '2026-02-08'::timestamp, 'approved', 45000.00, 3000.00),
  ('FF-2026-0007', '20-31234567-8', 7200.00, 'flete', '2026-02-10'::timestamp, 'approved', 7200.00, 0.00),
  ('FF-2026-0008', '20-32456789-3', 24500.00, 'flete', '2026-02-12'::timestamp, 'disputed', NULL, 0.00),
  ('FF-2026-0009', '20-30567890-1', 12300.00, 'seguro', '2026-02-15'::timestamp, 'approved', 12300.00, 0.00),
  ('FF-2026-0010', '20-33678901-5', 13500.00, 'flete', '2026-02-18'::timestamp, 'approved', 12000.00, 1500.00),
  ('FF-2026-0011', '20-31234567-8', 10500.00, 'flete', '2026-02-20'::timestamp, 'paid', 10500.00, 0.00),
  ('FF-2026-0012', '20-32456789-3', 11800.00, 'flete', '2026-02-22'::timestamp, 'approved', 11000.00, 800.00),
  ('FF-2026-0013', '20-30567890-1', 9800.00, 'peaje', '2026-02-25'::timestamp, 'pending', NULL, 0.00),
  ('FF-2026-0014', '20-33678901-5', 19500.00, 'flete', '2026-02-28'::timestamp, 'pending', NULL, 0.00),
  ('FF-2026-0015', '20-31234567-8', 42000.00, 'flete', '2026-03-01'::timestamp, 'pending', NULL, 0.00),
  ('FF-2026-0016', '20-32456789-3', 8900.00, 'flete', '2026-03-03'::timestamp, 'pending', NULL, 0.00),
  ('FF-2026-0017', '20-30567890-1', 16200.00, 'flete', '2026-03-05'::timestamp, 'audited', NULL, 0.00),
  ('FF-2026-0018', '20-33678901-5', 5400.00, 'recargo_combustible', '2026-03-06'::timestamp, 'pending', NULL, 0.00),
  ('FF-2026-0019', '20-31234567-8', 28000.00, 'flete', '2026-03-07'::timestamp, 'pending', NULL, 0.00),
  ('FF-2026-0020', '20-32456789-3', 14200.00, 'flete', '2026-03-07'::timestamp, 'pending', NULL, 0.00)
) AS v(numero_factura, transportista_cuit, monto_facturado, concepto, fecha_factura, estado, monto_aprobado, diferencia)
WHERE NOT EXISTS (
  SELECT 1 FROM factura_flete ff WHERE ff.numero_factura = v.numero_factura
);

COMMIT;
