"""Audit all POST/PUT endpoints for 500 errors."""
import requests
import json
import sys

s = requests.Session()
r = s.post('http://localhost:5000/api/auth/login', json={'username': '1', 'password': 'spm-123'})
token = r.json().get('access_token')
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

tests = [
    # === QUALITY ===
    ('POST', '/api/quality/inspections', {'recepcion_id': 1, 'tipo': 'sample'}),
    ('PUT', '/api/quality/inspections/1/results', {'items': [{'recepcion_item_id': 1, 'resultado': 'pass'}]}),
    ('POST', '/api/quality/ncr', {'descripcion': 'test', 'severidad': 'minor'}),
    ('PUT', '/api/quality/ncr/1/status', {'estado': 'under_investigation'}),
    ('POST', '/api/quality/capa', {'titulo': 'test capa', 'tipo': 'corrective', 'ncr_id': 1}),
    ('PUT', '/api/quality/capa/1/status', {'estado': 'in_progress'}),
    ('PUT', '/api/quality/capa/1/verify', {'efectividad': 'effective'}),

    # === TMS ===
    ('POST', '/api/tms/shipments', {'origen': 'BUE', 'destino': 'CBA', 'tipo_vehiculo': 'camion'}),
    ('PUT', '/api/tms/shipments/1', {'notas': 'test'}),
    ('POST', '/api/tms/shipments/1/transition', {'estado': 'in_transit'}),
    ('POST', '/api/tms/shipments/1/assign', {'vehiculo_id': 1, 'conductor_id': 1}),
    ('POST', '/api/tms/shipments/1/deliver', {}),
    ('POST', '/api/tms/shipments/1/tracking', {'latitud': -34.6, 'longitud': -58.4}),
    ('POST', '/api/tms/consolidations', {'destino': 'CBA'}),
    ('POST', '/api/tms/consolidations/1/add-shipment', {'shipment_id': 1}),
    ('POST', '/api/tms/consolidations/1/remove-shipment', {'shipment_id': 1}),
    ('POST', '/api/tms/routes', {'nombre': 'test', 'origen': 'BUE', 'destino': 'CBA'}),
    ('PUT', '/api/tms/routes/1', {'nombre': 'test2'}),
    ('POST', '/api/tms/shipments/1/costs', {'tipo': 'flete', 'monto': 100}),
    ('POST', '/api/tms/tariffs', {'transportista_cuit': '20-12345678-9', 'tarifa_base': 100}),
    ('PUT', '/api/tms/tariffs/1', {'tarifa_base': 200}),
    ('POST', '/api/tms/shipments/1/settle', {}),
    ('POST', '/api/tms/fuel', {'vehiculo_id': 1, 'litros': 50, 'monto': 5000}),
    ('PUT', '/api/tms/config/max_peso', {'valor': '10000'}),

    # === FMS ===
    ('POST', '/api/fms/vehicles', {'patente': 'TEST001', 'tipo': 'camion', 'marca': 'Ford'}),
    ('PUT', '/api/fms/vehicles/1', {'marca': 'Scania'}),
    ('POST', '/api/fms/vehicles/1/status', {'estado': 'maintenance'}),
    ('POST', '/api/fms/drivers', {'nombre': 'Test Driver', 'licencia': 'A1'}),
    ('PUT', '/api/fms/drivers/1', {'nombre': 'Test2'}),
    ('POST', '/api/fms/work-orders', {'vehiculo_id': 1, 'tipo': 'preventive', 'descripcion': 'test'}),
    ('POST', '/api/fms/work-orders/1/transition', {'estado': 'in_progress'}),
    ('POST', '/api/fms/work-orders/1/parts', {'material_codigo': 'MAT-001', 'cantidad': 1}),
    ('POST', '/api/fms/work-orders/1/request-part', {'material_codigo': 'MAT-001', 'cantidad': 1}),
    ('POST', '/api/fms/vehicles/1/maintenance-plans', {'tipo': 'preventive', 'frecuencia_km': 10000}),
    ('PUT', '/api/fms/maintenance-plans/1', {'frecuencia_km': 15000}),
    ('POST', '/api/fms/maintenance/evaluate', {}),
    ('POST', '/api/fms/inspections', {'vehiculo_id': 1, 'tipo': 'pre_trip'}),
    ('POST', '/api/fms/inspections/1/complete', {'resultado': 'pass'}),
    ('POST', '/api/fms/vehicles/1/documents', {'tipo': 'vtv', 'numero': 'VTV-001', 'vencimiento': '2027-01-01'}),

    # === FREIGHT ===
    ('POST', '/api/freight/invoices', {'transportista_cuit': '20-12345678-9', 'numero_factura': 'F-TEST', 'monto': 1000}),
    ('POST', '/api/freight/invoices/1/audit', {}),
    ('PUT', '/api/freight/invoices/1/approve', {}),
    ('PUT', '/api/freight/invoices/1/dispute', {'motivo': 'test'}),
    ('POST', '/api/freight/tariffs', {'transportista_cuit': '20-12345678-9', 'ruta_origen': 'BUE', 'ruta_destino': 'CBA', 'tarifa_base': 100}),

    # === PACKAGING ===
    ('POST', '/api/packaging/templates', {'nombre': 'test', 'tipo': 'caja'}),
    ('POST', '/api/packaging/packing-lists', {'destino': 'CBA', 'template_id': 1}),
    ('POST', '/api/packaging/packing-lists/1/items', {'material_codigo': 'MAT-001', 'cantidad': 10}),
    ('POST', '/api/packaging/packing-lists/1/optimize', {}),
    ('PUT', '/api/packaging/packing-lists/1/pack', {}),
    ('PUT', '/api/packaging/packing-lists/1/dispatch', {}),
    ('POST', '/api/packaging/packing-lists/1/labels', {}),

    # === RETURNS ===
    ('POST', '/api/returns/', {'proveedor_cuit': '20-12345678-9', 'motivo': 'defecto', 'items': [{'material_codigo': 'MAT-001', 'cantidad': 1}]}),
    ('POST', '/api/returns/from-ncr/1', {}),
    ('PUT', '/api/returns/1/status', {'estado': 'shipped'}),
    ('PUT', '/api/returns/1/credit', {'monto_credito': 100}),

    # === WARRANTY ===
    ('POST', '/api/warranty/', {'material_codigo': 'MAT-001', 'proveedor_cuit': '20-12345678-9', 'tipo': 'standard', 'duracion_meses': 12}),
    ('POST', '/api/warranty/claims', {'garantia_id': 1, 'tipo': 'defecto', 'descripcion': 'test'}),
    ('PUT', '/api/warranty/claims/1/submit', {}),
    ('PUT', '/api/warranty/claims/1/review', {}),
    ('PUT', '/api/warranty/claims/1/approve', {}),
    ('PUT', '/api/warranty/claims/1/reject', {'motivo': 'test'}),
    ('PUT', '/api/warranty/claims/1/resolve', {'resolucion': 'replaced'}),
    ('POST', '/api/warranty/claims/1/documents', {'tipo': 'evidencia', 'url': 'http://test.com/doc.pdf'}),

    # === CONTROL TOWER ===
    ('PUT', '/api/control-tower/alerts/1/acknowledge', {}),
    ('PUT', '/api/control-tower/alerts/1/resolve', {'notas': 'resolved'}),

    # === MATCHING ===
    ('POST', '/api/matching/invoices', {'proveedor_cuit': '20-12345678-9', 'fecha_factura': '2026-01-01', 'monto_total': 1000, 'items': [{'material_codigo': 'MAT-001', 'cantidad': 10, 'precio_unitario': 100}]}),
    ('POST', '/api/matching/invoices/1/match', {}),
    ('PUT', '/api/matching/results/1/resolve', {'notas': 'ok'}),

    # === SPEND ===
    ('POST', '/api/spend/snapshot', {'periodo': '202601'}),

    # === DEMAND PLANNING ===
    ('POST', '/api/demand-planning/cycles', {'nombre': 'test', 'periodo_desde': '2026-01-01', 'periodo_hasta': '2026-03-31'}),
    ('PUT', '/api/demand-planning/cycles/1/status', {'estado': 'collecting'}),
    ('POST', '/api/demand-planning/cycles/1/entries', {'material_codigo': 'MAT-001', 'fuente': 'manual', 'cantidad_pronosticada': 100}),
    ('POST', '/api/demand-planning/cycles/1/baseline', {}),
    ('POST', '/api/demand-planning/cycles/1/consensus', {}),

    # === SUPPLIER FINANCE ===
    ('POST', '/api/supplier-finance/programs', {'nombre': 'test', 'tipo': 'early_payment', 'descuento_base_pct': 2}),
    ('POST', '/api/supplier-finance/programs/1/generate-offers', {}),
    ('PUT', '/api/supplier-finance/offers/1/accept', {}),
    ('PUT', '/api/supplier-finance/offers/1/reject', {}),
    ('PUT', '/api/supplier-finance/offers/1/pay', {}),
    ('PUT', '/api/supplier-finance/payment-terms/20-12345678-9', {'termino_estandar_dias': 30}),
    ('POST', '/api/supplier-finance/simulate', {'escenario': 'test', 'dias_anticipacion': 7, 'descuento_pct': 2, 'porcentaje_facturas_elegibles': 50}),

    # === SUPPLIER RISK ===
    ('POST', '/api/supplier-risk/20-12345678-9/evaluate', {}),
    ('POST', '/api/supplier-risk/recalculate', {}),

    # === LOTS ===
    ('POST', '/api/lots/', {'material_codigo': 'MAT-001', 'numero_lote': 'LOT-TEST-AUDIT', 'cantidad': 100}),
    ('POST', '/api/lots/1/consume', {'cantidad': 10}),
    ('PUT', '/api/lots/1/block', {'motivo': 'test'}),
    ('PUT', '/api/lots/1/unblock', {}),
    ('POST', '/api/lots/genealogy', {'lote_padre_id': 1, 'lote_hijo_id': 2}),
    ('POST', '/api/lots/recalls', {'material_codigo': 'MAT-001', 'motivo': 'defecto'}),
    ('PUT', '/api/lots/recalls/1/lotes/1/recover', {}),

    # === SLOB ===
    # ('POST', '/api/slob/snapshot', {}),  # Excluded: always times out (heavy query)
    ('POST', '/api/slob/disposition', {'material_codigo': 'MAT-001', 'tipo': 'scrap', 'cantidad': 10}),
    ('PUT', '/api/slob/disposition/1/approve', {}),
    ('PUT', '/api/slob/disposition/1/complete', {}),

    # === CUSTOMS ===
    ('POST', '/api/customs/hs-codes', {'codigo': '0101.21.00', 'descripcion': 'test animal'}),
    ('POST', '/api/customs/classifications', {'material_codigo': 'MAT-001', 'hs_code': '0101.21.00'}),
    ('POST', '/api/customs/calculate-duties', {'hs_code': '0101.21.00', 'valor_fob': 1000, 'pais_origen': 'CN'}),
    ('POST', '/api/customs/operations', {'tipo': 'import', 'referencia': 'OP-TEST'}),
    ('PUT', '/api/customs/operations/1', {'estado': 'in_progress'}),
    ('POST', '/api/customs/agreements', {'nombre': 'Mercosur', 'pais': 'BR', 'descuento_pct': 50}),

    # === ORDENES COMPRA ===
    ('POST', '/api/ordenes-compra/', {'proveedor_cuit': '20-12345678-9', 'items': [{'material_codigo': 'MAT-001', 'cantidad': 10, 'precio_unitario': 100}]}),
    ('PUT', '/api/ordenes-compra/1/estado', {'estado': 'aprobada'}),
    ('POST', '/api/ordenes-compra/1/recepcion', {'items': [{'material_codigo': 'MAT-001', 'cantidad': 10}]}),

    # === CONTRACTS ===
    ('POST', '/api/contracts/', {'proveedor_cuit': '20-12345678-9', 'tipo': 'marco', 'fecha_inicio': '2026-01-01', 'fecha_fin': '2027-01-01'}),
    ('PUT', '/api/contracts/1', {'notas': 'updated'}),
    ('PUT', '/api/contracts/1/status', {'estado': 'active'}),
    ('POST', '/api/contracts/1/items', {'items': [{'material_codigo': 'MAT-001', 'precio_unitario': 100}]}),
    ('PUT', '/api/contracts/1/items/1', {'precio_unitario': 150}),
    ('POST', '/api/contracts/1/documents', {'tipo': 'contrato', 'nombre': 'doc.pdf'}),
]

results_500 = []
results_ok = []

for method, url, data in tests:
    try:
        if method == 'POST':
            r = s.post(f'http://localhost:5000{url}', json=data, headers=headers, timeout=10)
        else:
            r = s.put(f'http://localhost:5000{url}', json=data, headers=headers, timeout=10)

        if r.status_code == 500:
            err = ''
            try:
                err = r.json().get('error', '')[:150]
            except Exception:
                err = r.text[:150]
            results_500.append((method, url, r.status_code, err))
        else:
            results_ok.append((method, url, r.status_code))
    except Exception as e:
        results_500.append((method, url, 0, str(e)[:100]))

print(f"\n{'='*70}")
print(f"AUDIT RESULTS: {len(results_ok)} OK/4xx, {len(results_500)} with 500 errors")
print(f"{'='*70}")

if results_500:
    print(f"\n--- 500 ERRORS ({len(results_500)}) ---")
    for m, u, code, e in results_500:
        print(f"\n  {m} {u}")
        print(f"    => {e}")

print(f"\n--- OK/4xx ({len(results_ok)}) ---")
for m, u, code in results_ok:
    tag = "OK" if code < 300 else f"{code}"
    print(f"  {tag:>4} {m} {u}")
