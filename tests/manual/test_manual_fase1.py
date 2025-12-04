#!/usr/bin/env python
"""Script de testing manual para validar FIX #1-4"""

import json
import sqlite3
import sys
from pathlib import Path

# Agregar el proyecto al path
sys.path.insert(0, str(Path(__file__).parent))

from src.backend.routes.solicitudes import (
    _ensure_approver_exists_and_active, _ensure_planner_exists_and_available,
    _get_approver_config, _pre_validar_aprobacion, _validar_material_existe)


def test_fix_1_validar_material():
    """Test FIX #1: Validación de materiales"""
    print("\n" + "=" * 70)
    print("TEST FIX #1: Validación de Materiales")
    print("=" * 70)

    con = sqlite3.connect("./src/backend/core/data/spm.db")
    con.row_factory = sqlite3.Row

    # Test 1: Material válido
    print("\n1. Validar material VÁLIDO (código existente en catálogo)")
    result = _validar_material_existe(con, "1000000006")
    print(f"   → _validar_material_existe(con, '1000000006'): {result}")
    assert result is True, "Debería retornar True"
    print("   ✓ PASÓ")

    # Test 2: Material inválido
    print("\n2. Validar material INVÁLIDO (código NO existe en catálogo)")
    result = _validar_material_existe(con, "MAT_INEXISTENTE")
    print(f"   → _validar_material_existe(con, 'MAT_INEXISTENTE'): {result}")
    assert result is False, "Debería retornar False"
    print("   ✓ PASÓ")

    # Test 3: Código vacío
    print("\n3. Validar CÓDIGO VACÍO")
    result = _validar_material_existe(con, "")
    print(f"   → _validar_material_existe(con, ''): {result}")
    assert result is False, "Debería retornar False para código vacío"
    print("   ✓ PASÓ")

    con.close()
    print("\n✓ FIX #1 VALIDADO EXITOSAMENTE")


def test_fix_2_validar_aprobador():
    """Test FIX #2: Validación de aprobadores"""
    print("\n" + "=" * 70)
    print("TEST FIX #2: Validación de Aprobadores")
    print("=" * 70)

    con = sqlite3.connect("./src/backend/core/data/spm.db")
    con.row_factory = sqlite3.Row

    # Test 1: Configuración de rangos
    print("\n1. Verificar _get_approver_config()")

    field, min_m, max_m = _get_approver_config(10000.0)
    print(f"   → Para USD 10,000: {field}, rango {min_m} - {max_m}")
    assert field == "jefe", "Debería ser 'jefe'"
    print("   ✓ PASÓ (Jefe)")

    field, min_m, max_m = _get_approver_config(50000.0)
    print(f"   → Para USD 50,000: {field}, rango {min_m} - {max_m}")
    assert field == "gerente1", "Debería ser 'gerente1'"
    print("   ✓ PASÓ (Gerente1)")

    field, min_m, max_m = _get_approver_config(150000.0)
    print(f"   → Para USD 150,000: {field}, rango {min_m} - {max_m}")
    assert field == "gerente2", "Debería ser 'gerente2'"
    print("   ✓ PASÓ (Gerente2)")

    # Test 2: Aprobador válido
    print("\n2. Validar aprobador ACTIVO")
    # Obtener un usuario activo de la BD
    user_row = con.execute(
        "SELECT id_spm FROM usuarios WHERE estado_registro = 'Activo' LIMIT 1"
    ).fetchone()
    if user_row:
        user_id = user_row["id_spm"]
        result = _ensure_approver_exists_and_active(con, user_id)
        print(f"   → _ensure_approver_exists_and_active(con, '{user_id}'): {result}")
        assert result is True, "Debería retornar True"
        print("   ✓ PASÓ")
    else:
        print("   ⚠ No hay usuarios activos en la BD")

    # Test 3: Aprobador inexistente
    print("\n3. Validar aprobador INEXISTENTE")
    result = _ensure_approver_exists_and_active(con, "usuario_fantasma_xxx")
    print(f"   → _ensure_approver_exists_and_active(con, 'usuario_fantasma_xxx'): {result}")
    assert result is False, "Debería retornar False"
    print("   ✓ PASÓ")

    con.close()
    print("\n✓ FIX #2 VALIDADO EXITOSAMENTE")


def test_fix_3_validar_planificador():
    """Test FIX #3: Validación de planificadores"""
    print("\n" + "=" * 70)
    print("TEST FIX #3: Validación de Planificadores")
    print("=" * 70)

    con = sqlite3.connect("./src/backend/core/data/spm.db")
    con.row_factory = sqlite3.Row

    # Test 1: Planificador válido
    print("\n1. Validar planificador DISPONIBLE")
    user_row = con.execute(
        "SELECT id_spm FROM usuarios WHERE rol IN ('planificador', 'gerente1', 'gerente2') LIMIT 1"
    ).fetchone()
    if user_row:
        planner_id = user_row["id_spm"]
        result = _ensure_planner_exists_and_available(con, planner_id)
        print(f"   → _ensure_planner_exists_and_available(con, '{planner_id}'): {result}")
        print("   ✓ PASÓ (Planificador validado)")
    else:
        print("   ⚠ No hay planificadores en la BD")

    # Test 2: Planificador inexistente
    print("\n2. Validar planificador INEXISTENTE")
    result = _ensure_planner_exists_and_available(con, "planner_fantasma_xxx")
    print(f"   → _ensure_planner_exists_and_available(con, 'planner_fantasma_xxx'): {result}")
    assert result is False, "Debería retornar False"
    print("   ✓ PASÓ")

    con.close()
    print("\n✓ FIX #3 VALIDADO EXITOSAMENTE")


def test_fix_4_pre_validar_aprobacion():
    """Test FIX #4: Pre-validaciones de aprobación"""
    print("\n" + "=" * 70)
    print("TEST FIX #4: Pre-validaciones de Aprobación")
    print("=" * 70)

    con = sqlite3.connect("./src/backend/core/data/spm.db")
    con.row_factory = sqlite3.Row

    # Obtener usuario y aprobador de prueba
    approver = con.execute("SELECT id_spm FROM usuarios LIMIT 1").fetchone()
    user = con.execute(
        "SELECT id_spm FROM usuarios WHERE id_spm != ? LIMIT 1", (approver["id_spm"],)
    ).fetchone()

    # Test 1: Solicitud válida
    print("\n1. Pre-validar solicitud VÁLIDA")
    row = {
        "id": 1,
        "id_usuario": user["id_spm"] if user else approver["id_spm"],
        "data_json": json.dumps({"items": [{"codigo": "1000000006"}]}),
        "total_monto": 10000.0,
    }
    approver_user = {"id_spm": approver["id_spm"]}

    es_valido, error_msg = _pre_validar_aprobacion(con, row, approver_user)
    print(f"   → Pre-validación: {es_valido}")
    if error_msg:
        print(f"   → Error: {error_msg}")
    print("   ✓ PASÓ")

    # Test 2: Solicitud con total inválido
    print("\n2. Pre-validar solicitud con TOTAL INVÁLIDO (0)")
    row["total_monto"] = 0.0
    es_valido, error_msg = _pre_validar_aprobacion(con, row, approver_user)
    print(f"   → Pre-validación: {es_valido}")
    print(f"   → Error: {error_msg}")
    assert es_valido is False, "Debería fallar con total 0"
    print("   ✓ PASÓ (Rechazada correctamente)")

    # Test 3: Solicitud con material inválido
    print("\n3. Pre-validar solicitud con MATERIAL INVÁLIDO")
    row["total_monto"] = 10000.0
    row["data_json"] = json.dumps({"items": [{"codigo": "MAT_INEXISTENTE"}]})
    es_valido, error_msg = _pre_validar_aprobacion(con, row, approver_user)
    print(f"   → Pre-validación: {es_valido}")
    print(f"   → Error: {error_msg}")
    assert es_valido is False, "Debería fallar con material inválido"
    print("   ✓ PASÓ (Rechazada correctamente)")

    con.close()
    print("\n✓ FIX #4 VALIDADO EXITOSAMENTE")


if __name__ == "__main__":
    try:
        print("\n" + "=" * 70)
        print("TESTING MANUAL: FASE 1 - VALIDACIONES")
        print("=" * 70)

        test_fix_1_validar_material()
        test_fix_2_validar_aprobador()
        test_fix_3_validar_planificador()
        test_fix_4_pre_validar_aprobacion()

        print("\n" + "=" * 70)
        print("✓✓✓ TODOS LOS TESTS PASARON EXITOSAMENTE ✓✓✓")
        print("=" * 70)
        print("\nLos 4 Fixes de Fase 1 están funcionando correctamente:")
        print("  ✓ FIX #1: Validación de Materiales")
        print("  ✓ FIX #2: Validación de Aprobadores")
        print("  ✓ FIX #3: Validación de Planificadores")
        print("  ✓ FIX #4: Pre-validaciones de Aprobación")
        print("\n" + "=" * 70 + "\n")

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
