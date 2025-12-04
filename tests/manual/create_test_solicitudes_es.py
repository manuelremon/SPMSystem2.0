import json
import sqlite3
from datetime import datetime

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Crear 3 solicitudes de prueba para el approver
test_data = [
    {
        "id_usuario": "1",  # admin
        "centro": "Centro 1",
        "sector": "TI",
        "justificacion": "Solicitud de prueba 1 para aprobador",
        "centro_costos": "CC-001",
        "almacen_virtual": "AV-001",
        "criticidad": "Media",
        "fecha_necesidad": "2025-11-10",
        "status": "pendiente_de_aprobacion",
        "total_monto": 1000.00,
    },
    {
        "id_usuario": "1",
        "centro": "Centro 1",
        "sector": "TI",
        "justificacion": "Solicitud de prueba 2 para aprobador",
        "centro_costos": "CC-001",
        "almacen_virtual": "AV-001",
        "criticidad": "Alta",
        "fecha_necesidad": "2025-11-12",
        "status": "pendiente_de_aprobacion",
        "total_monto": 5000.00,
    },
    {
        "id_usuario": "1",
        "centro": "Centro 2",
        "sector": "Logística",
        "justificacion": "Solicitud de prueba 3 para aprobador",
        "centro_costos": "CC-002",
        "almacen_virtual": "AV-002",
        "criticidad": "Baja",
        "fecha_necesidad": "2025-11-15",
        "status": "pendiente_de_aprobacion",
        "total_monto": 500.00,
    },
]

for data in test_data:
    now = datetime.now().isoformat()
    cursor.execute(
        """
        INSERT INTO solicitudes
        (id_usuario, centro, sector, justificacion, centro_costos, almacen_virtual,
         criticidad, fecha_necesidad, data_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            data["id_usuario"],
            data["centro"],
            data["sector"],
            data["justificacion"],
            data["centro_costos"],
            data["almacen_virtual"],
            data["criticidad"],
            data["fecha_necesidad"],
            json.dumps(data),
            data["status"],
            now,
            now,
        ),
    )
    print(f"✓ Solicitud insertada: {data['justificacion']}")

conn.commit()
cursor.close()
conn.close()

print("\n✓ 3 solicitudes de prueba creadas correctamente")
