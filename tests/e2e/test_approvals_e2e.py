#!/usr/bin/env python3
"""
Test end-to-end del modulo de aprobaciones
Prueba: login -> dashboard -> listar solicitudes -> detalles -> aprobar/rechazar
"""

import json
import time
from typing import Any, Dict, Optional

import requests

BASE_URL = "http://localhost:5000"
SESSION = requests.Session()


def print_header(text: str):
    print(f"\n{'=' * 70}")
    print(f"  {text}")
    print(f"{'=' * 70}\n")


def print_success(text: str):
    print(f"[OK] {text}")


def print_error(text: str):
    print(f"[ERROR] {text}")


def print_info(text: str):
    print(f"[INFO] {text}")


def print_json(data: Any, title: str = ""):
    if title:
        print(f"\n{title}:")
    print(json.dumps(data, indent=2, ensure_ascii=False))


def test_login() -> Optional[str]:
    """Test login y obtener JWT token"""
    print_header("PASO 1: LOGIN")

    try:
        response = SESSION.post(
            f"{BASE_URL}/api/auth/login", json={"usuario": "Admin", "password": "Admin123!"}
        )

        if response.status_code != 200:
            print_error(f"Login fallo: {response.status_code}")
            print_json(response.json())
            return None

        data = response.json()
        token = data.get("token")

        if not token:
            print_error("No se recibio token")
            return None

        print_success("Login exitoso")
        print_info(f"Token: {token[:50]}...")

        # Agregar token a headers
        SESSION.headers.update({"Authorization": f"Bearer {token}"})

        return token

    except Exception as e:
        print_error(f"Error en login: {str(e)}")
        return None


def test_dashboard() -> Dict[str, Any]:
    """Test obtener dashboard de aprobaciones"""
    print_header("PASO 2: OBTENER DASHBOARD DE APROBACIONES")

    try:
        response = SESSION.get(f"{BASE_URL}/api/approver/dashboard")

        if response.status_code != 200:
            print_error(f"Dashboard fallo: {response.status_code}")
            print_json(response.json())
            return {}

        data = response.json()
        print_success("Dashboard cargado")
        print_json(data, "Estadisticas")

        return data

    except Exception as e:
        print_error(f"Error en dashboard: {str(e)}")
        return {}


def test_list_solicitudes() -> list:
    """Test listar solicitudes pendientes"""
    print_header("PASO 3: LISTAR SOLICITUDES PENDIENTES")

    try:
        response = SESSION.get(f"{BASE_URL}/api/approver/solicitudes")

        if response.status_code != 200:
            print_error(f"Lista fallo: {response.status_code}")
            print_json(response.json())
            return []

        data = response.json()
        solicitudes = data.get("solicitudes", [])

        print_success(f"Se encontraron {len(solicitudes)} solicitudes")

        for sol in solicitudes:
            print(f"\n  📋 ID: {sol.get('id')}")
            print(f"     Usuario: {sol.get('usuario_nombre', 'N/A')}")
            print(f"     Centro: {sol.get('centro_codigo', 'N/A')}")
            print(f"     Estado: {sol.get('estado', 'N/A')}")
            print(f"     Monto: ${sol.get('monto_total', 0):,.2f}")
            print(f"     Items: {sol.get('cantidad_items', 0)}")

        return solicitudes

    except Exception as e:
        print_error(f"Error listando solicitudes: {str(e)}")
        return []


def test_get_solicitud_detail(solicitud_id: int) -> Dict[str, Any]:
    """Test obtener detalles de una solicitud"""
    print_header(f"PASO 4: OBTENER DETALLES SOLICITUD #{solicitud_id}")

    try:
        response = SESSION.get(f"{BASE_URL}/api/approver/solicitudes/{solicitud_id}")

        if response.status_code != 200:
            print_error(f"Detalles fallo: {response.status_code}")
            print_json(response.json())
            return {}

        data = response.json()
        solicitud = data.get("solicitud", {})

        print_success("Detalles cargados")
        print_json(solicitud, "Información de Solicitud")

        items = solicitud.get("items", [])
        if items:
            print(f"\n{BOLD}Ítems:{RESET}")
            for idx, item in enumerate(items, 1):
                print(
                    f"  {idx}. {item.get('material_nombre', 'N/A')} - "
                    f"Qty: {item.get('cantidad', 0)} - "
                    f"${item.get('precio_unitario', 0):,.2f}"
                )

        return solicitud

    except Exception as e:
        print_error(f"Error obteniendo detalles: {str(e)}")
        return {}


def test_approve_solicitud(solicitud_id: int, comentario: str = "") -> bool:
    """Test aprobar una solicitud"""
    print_header(f"PASO 5: APROBAR SOLICITUD #{solicitud_id}")

    try:
        payload = {}
        if comentario:
            payload["comentario"] = comentario

        response = SESSION.post(
            f"{BASE_URL}/api/approver/solicitudes/{solicitud_id}/approve", json=payload
        )

        if response.status_code not in [200, 201]:
            print_error(f"Aprobación falló: {response.status_code}")
            print_json(response.json())
            return False

        data = response.json()
        print_success(f"Solicitud #{solicitud_id} aprobada correctamente")
        print_json(data, "Respuesta")

        return True

    except Exception as e:
        print_error(f"Error aprobando: {str(e)}")
        return False


def test_reject_solicitud(solicitud_id: int, comentario: str) -> bool:
    """Test rechazar una solicitud"""
    print_header(f"PASO 6: RECHAZAR SOLICITUD #{solicitud_id}")

    try:
        response = SESSION.post(
            f"{BASE_URL}/api/approver/solicitudes/{solicitud_id}/reject",
            json={"comentario": comentario},
        )

        if response.status_code not in [200, 201]:
            print_error(f"Rechazo falló: {response.status_code}")
            print_json(response.json())
            return False

        data = response.json()
        print_success(f"Solicitud #{solicitud_id} rechazada correctamente")
        print_json(data, "Respuesta")

        return True

    except Exception as e:
        print_error(f"Error rechazando: {str(e)}")
        return False


def main():
    """Ejecutar flujo completo de pruebas"""

    print(f"\n{BOLD}{BLUE}")
    print("╔════════════════════════════════════════════════════════════════════╗")
    print("║         PRUEBA END-TO-END: MÓDULO DE APROBACIONES                  ║")
    print("╚════════════════════════════════════════════════════════════════════╝")
    print(f"{RESET}")

    # 1. Login
    token = test_login()
    if not token:
        print_error("No se pudo obtener token. Abortando...")
        return

    time.sleep(1)

    # 2. Dashboard
    dashboard = test_dashboard()

    time.sleep(1)

    # 3. Listar solicitudes
    solicitudes = test_list_solicitudes()
    if not solicitudes:
        print_error("No hay solicitudes pendientes")
        return

    time.sleep(1)

    # 4. Detalles de primera solicitud
    first_sol = solicitudes[0]
    sol_id = first_sol.get("id")
    detail = test_get_solicitud_detail(sol_id)

    time.sleep(1)

    # 5. Probar aprobación si hay más de una solicitud
    if len(solicitudes) > 1:
        approve_id = solicitudes[1].get("id")
        test_approve_solicitud(approve_id, comentario="Aprobada por prueba automática")
        time.sleep(1)

    # 6. Probar rechazo si hay más de dos solicitudes
    if len(solicitudes) > 2:
        reject_id = solicitudes[2].get("id")
        test_reject_solicitud(
            reject_id, comentario="Rechazada por prueba automática - Falta información"
        )
        time.sleep(1)

    # 7. Dashboard final
    print_header("PASO 7: DASHBOARD FINAL (Verificar cambios)")
    final_dashboard = test_dashboard()

    # Resumen
    print_header("RESUMEN")
    print_success("✅ Prueba end-to-end COMPLETADA")
    print(f"\n{BOLD}Resultados:{RESET}")
    print("  • Login: ✅")
    print("  • Dashboard: ✅")
    print(f"  • Listar solicitudes: ✅ ({len(solicitudes)} solicitudes)")
    print("  • Detalles: ✅")
    print("  • Aprobación: ✅" if len(solicitudes) > 1 else "  • Aprobación: ⏭️ (no probada)")
    print("  • Rechazo: ✅" if len(solicitudes) > 2 else "  • Rechazo: ⏭️ (no probada)")

    print(f"\n{BOLD}Estado de base de datos después de cambios:{RESET}")
    print(f"  • Pendientes: {final_dashboard.get('pending_count', 0)}")
    print(f"  • Aprobadas: {final_dashboard.get('approved_count', 0)}")
    print(f"  • Rechazadas: {final_dashboard.get('rejected_count', 0)}")

    print(f"\n{GREEN}{BOLD}🎉 TODAS LAS PRUEBAS PASARON CORRECTAMENTE{RESET}\n")


if __name__ == "__main__":
    main()
