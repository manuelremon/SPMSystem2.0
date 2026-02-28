"""
Carga datos de referencia existentes en la BD para que los módulos
de seed puedan crear FKs válidas.
"""

import random


class RefData:
    """Contenedor de datos de referencia cargados de la BD."""

    def __init__(self):
        self.user_ids = []
        self.admin_ids = []
        self.planner_ids = []
        self.centros = []
        self.sectores = []
        self.almacenes = []
        self.material_codes = []
        self.proveedor_cuits = []
        self.solicitud_ids = []
        self.solicitud_approved_ids = []
        self.solicitud_processing_ids = []

    def rand_user(self):
        return random.choice(self.user_ids) if self.user_ids else "1"

    def rand_admin(self):
        return random.choice(self.admin_ids) if self.admin_ids else "1"

    def rand_planner(self):
        return random.choice(self.planner_ids) if self.planner_ids else "1"

    def rand_centro(self):
        return random.choice(self.centros) if self.centros else "1000"

    def rand_sector(self):
        return random.choice(self.sectores) if self.sectores else "Operaciones"

    def rand_almacen(self):
        return random.choice(self.almacenes) if self.almacenes else "0001"

    def rand_material(self):
        return random.choice(self.material_codes) if self.material_codes else "MAT-001"

    def rand_proveedor(self):
        return random.choice(self.proveedor_cuits) if self.proveedor_cuits else "20-12345678-9"

    def rand_solicitud(self):
        return random.choice(self.solicitud_ids) if self.solicitud_ids else 1

    def rand_solicitud_approved(self):
        return random.choice(self.solicitud_approved_ids) if self.solicitud_approved_ids else 1

    def rand_solicitud_processing(self):
        return random.choice(self.solicitud_processing_ids) if self.solicitud_processing_ids else 1


def load_refs(conn, verbose=False) -> RefData:
    """Carga datos de referencia existentes desde la BD."""
    refs = RefData()
    cursor = conn.cursor()

    def _log(msg):
        if verbose:
            print(f"  [refs] {msg}")

    # Usuarios
    try:
        cursor.execute("SELECT id_spm, rol FROM usuarios WHERE LOWER(estado_registro) = 'activo' LIMIT 200")
        rows = cursor.fetchall()
        for row in rows:
            uid = row[0] if not isinstance(row, dict) else row.get('id_spm', row[0])
            rol = row[1] if not isinstance(row, dict) else row.get('rol', row[1])
            refs.user_ids.append(uid)
            if rol and 'admin' in str(rol).lower():
                refs.admin_ids.append(uid)
            if rol and 'plan' in str(rol).lower():
                refs.planner_ids.append(uid)
        _log(f"Usuarios: {len(refs.user_ids)} (admin: {len(refs.admin_ids)}, planner: {len(refs.planner_ids)})")
    except Exception as e:
        _log(f"Warning cargando usuarios: {e}")
        refs.user_ids = ["1"]
        refs.admin_ids = ["1"]
        refs.planner_ids = ["1"]

    # Asegurar que siempre hay al menos un admin y planner
    if not refs.admin_ids:
        refs.admin_ids = refs.user_ids[:1] or ["1"]
    if not refs.planner_ids:
        refs.planner_ids = refs.user_ids[:1] or ["1"]

    # Centros
    try:
        cursor.execute("SELECT codigo FROM catalog_centros WHERE activo = true LIMIT 50")
        refs.centros = [r[0] for r in cursor.fetchall()]
        _log(f"Centros: {len(refs.centros)}")
    except Exception:
        refs.centros = ["1000", "1100", "1200", "1300", "1400"]

    # Sectores
    try:
        cursor.execute("SELECT nombre FROM catalog_sectores WHERE activo = true LIMIT 50")
        refs.sectores = [r[0] for r in cursor.fetchall()]
        _log(f"Sectores: {len(refs.sectores)}")
    except Exception:
        refs.sectores = ["Operaciones", "Mantenimiento", "Produccion", "Logistica"]

    # Almacenes
    try:
        cursor.execute("SELECT codigo FROM catalog_almacenes WHERE activo = true LIMIT 50")
        refs.almacenes = [r[0] for r in cursor.fetchall()]
        _log(f"Almacenes: {len(refs.almacenes)}")
    except Exception:
        refs.almacenes = ["0001", "0002", "0003"]

    # Materiales (solo una muestra para FKs)
    try:
        cursor.execute("SELECT codigo_material FROM sap_materiales_bbdd LIMIT 500")
        refs.material_codes = [r[0] for r in cursor.fetchall()]
        _log(f"Materiales: {len(refs.material_codes)}")
    except Exception:
        refs.material_codes = [f"MAT-{i:05d}" for i in range(1, 101)]

    # Proveedores externos
    try:
        cursor.execute("SELECT cuit FROM proveedores_externos WHERE activo = true LIMIT 100")
        refs.proveedor_cuits = [r[0] for r in cursor.fetchall()]
        _log(f"Proveedores: {len(refs.proveedor_cuits)}")
    except Exception:
        refs.proveedor_cuits = [f"20-{random.randint(10000000, 99999999)}-{random.randint(0, 9)}" for _ in range(10)]

    # Solicitudes existentes
    try:
        cursor.execute("SELECT id, status FROM solicitudes ORDER BY id DESC LIMIT 200")
        for row in cursor.fetchall():
            sid = row[0]
            status = row[1] if not isinstance(row, dict) else row.get('status', row[1])
            refs.solicitud_ids.append(sid)
            if status == 'approved':
                refs.solicitud_approved_ids.append(sid)
            elif status == 'processing':
                refs.solicitud_processing_ids.append(sid)
        _log(f"Solicitudes: {len(refs.solicitud_ids)} (approved: {len(refs.solicitud_approved_ids)})")
    except Exception:
        refs.solicitud_ids = [1, 2, 3]
        refs.solicitud_approved_ids = [1]
        refs.solicitud_processing_ids = [2]

    if not refs.solicitud_approved_ids:
        refs.solicitud_approved_ids = refs.solicitud_ids[:5] or [1]
    if not refs.solicitud_processing_ids:
        refs.solicitud_processing_ids = refs.solicitud_ids[:5] or [1]

    return refs
