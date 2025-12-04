#!/usr/bin/env python3
"""
Test direct del endpoint approver via código Python
"""

import sys

sys.path.insert(0, "/d/GitHub/SPMv1.0")

from src.backend.app import create_app

# Crear app y contexto
app = create_app()

with app.test_client() as client:
    # Primero, revisar que el backend está bien
    print("=" * 70)
    print("TEST: Backend approver endpoints")
    print("=" * 70)

    print("\n1. Verificar health...")
    resp = client.get("/api/health")
    print(f"  Status: {resp.status_code}")

    # Para hacer requests autenticados, necesitamos autenticarnos primero
    # Pero el test client puede usar AUTH_BYPASS
    print("\n2. Verificar solicitudes en BD...")
    from src.backend.core.db import get_connection

    with get_connection() as con:
        c.execute(
            """
            SELECT COUNT(*) as count
            FROM solicitudes
            WHERE status = 'pending_approval'
        """
        )
        result = con.execute(
            """
            SELECT COUNT(*) as count
            FROM solicitudes
            WHERE status = 'pending_approval'
        """
        ).fetchone()
        count = result["count"] if result else 0
        print(f"  ✓ Solicitudes pending_approval: {count}")
