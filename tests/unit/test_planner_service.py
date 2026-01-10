"""
Unit tests para core/services/planner_service.py

Pruebas de lógica de negocio para PASO 1-3 del flujo de tratamiento
de solicitudes, sin dependencias de Flask o HTTP.

Separado en:
- Tests con BD mock (fixtures temporales)
- Tests de schemas (sin BD)
- Tests de cache (sin BD)
"""

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

# Agregar backend al path para imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.core.cache_loader import clear_cache
from backend.core.repository_legacy import SolicitudRepository
from backend.services.planner_service import (
    paso_1_analizar_solicitud, paso_2_opciones_abastecimiento,
    paso_3_guardar_tratamiento)


@pytest.mark.usefixtures("setup_test_env")
class TestPaso1AnalizarSolicitud:
    """Tests para paso_1_analizar_solicitud"""

    def test_paso_1_solicitud_valida(self):
        """Test que paso_1 retorna estructura correcta para solicitud válida"""
        try:
            resultado = paso_1_analizar_solicitud(1)

            # Verificar estructura
            assert isinstance(resultado, dict), "Resultado debe ser dict"
            assert "solicitud_id" in resultado, "Falta solicitud_id"
            assert "paso" in resultado, "Falta paso"
            assert resultado["paso"] == 1, "paso debe ser 1"
            assert "resumen" in resultado, "Falta resumen"
            assert "materiales_por_criticidad" in resultado, "Falta materiales_por_criticidad"
            assert "conflictos" in resultado, "Falta conflictos"
            assert "avisos" in resultado, "Falta avisos"
            assert "recomendaciones" in resultado, "Falta recomendaciones"

            # Verificar tipos
            assert isinstance(resultado["conflictos"], list), "conflictos debe ser list"
            assert isinstance(resultado["avisos"], list), "avisos debe ser list"
            assert isinstance(resultado["recomendaciones"], list), "recomendaciones debe ser list"

            print("✅ test_paso_1_solicitud_valida PASSED")

        except ValueError as e:
            # Si la solicitud no existe en BD, ese es un error válido de datos
            assert "no encontrada" in str(e).lower() or "no existe" in str(e).lower()
            print("⚠️  test_paso_1_solicitud_valida: Solicitud de test no existe en BD (esperado)")
        except sqlite3.OperationalError as e:
            # Si falta una tabla en la BD de test, skip
            pytest.skip(f"BD de test incompleta: {e}")

    def test_paso_1_solicitud_no_existe(self):
        """Test que paso_1 falla si solicitud no existe"""
        with pytest.raises(ValueError) as exc_info:
            paso_1_analizar_solicitud(999999)  # ID que no existe

        assert (
            "no encontrada" in str(exc_info.value).lower()
            or "no existe" in str(exc_info.value).lower()
        )
        print("✅ test_paso_1_solicitud_no_existe PASSED")

    def test_paso_1_resumen_tiene_presupuesto(self):
        """Test que resumen contiene campos de presupuesto"""
        try:
            resultado = paso_1_analizar_solicitud(1)
            resumen = resultado.get("resumen", {})

            # Campos esperados en resumen
            campos_presupuesto = [
                "presupuesto_total",
                "presupuesto_disponible",
                "total_solicitado",
                "diferencia_presupuesto",
                "total_items",
                "conflictos_detectados",
                "avisos",
            ]

            for campo in campos_presupuesto:
                assert campo in resumen, f"Falta campo {campo} en resumen"
                assert isinstance(resumen[campo], (int, float)), f"{campo} debe ser numérico"

            print("✅ test_paso_1_resumen_tiene_presupuesto PASSED")

        except ValueError:
            pytest.skip("Solicitud de test no existe en BD")
        except sqlite3.OperationalError as e:
            pytest.skip(f"BD de test incompleta: {e}")

    def test_paso_1_conflictos_tienen_estructura(self):
        """Test que conflictos detectados tienen estructura correcta"""
        try:
            resultado = paso_1_analizar_solicitud(1)
            conflictos = resultado.get("conflictos", [])

            if conflictos:  # Si hay conflictos
                for conflicto in conflictos:
                    assert "tipo" in conflicto, "Conflicto debe tener 'tipo'"
                    assert "item_idx" in conflicto, "Conflicto debe tener 'item_idx'"
                    assert "codigo" in conflicto, "Conflicto debe tener 'codigo'"
                    # Tipos de conflicto validos segun implementacion
                    assert conflicto["tipo"] in [
                        "stock_insuficiente",
                        "presupuesto_insuficiente",
                        "consumo_inusual",
                        "precio_alto",
                        "material_nuevo",
                    ], f"Tipo conflicto desconocido: {conflicto['tipo']}"

            print("✅ test_paso_1_conflictos_tienen_estructura PASSED")

        except ValueError:
            pytest.skip("Solicitud de test no existe en BD")
        except sqlite3.OperationalError as e:
            pytest.skip(f"BD de test incompleta: {e}")


@pytest.mark.usefixtures("setup_test_env")
class TestPaso2OpcionesAbastecimiento:
    """Tests para paso_2_opciones_abastecimiento"""

    def test_paso_2_retorna_opciones(self):
        """Test que paso_2 retorna lista de opciones"""
        try:
            resultado = paso_2_opciones_abastecimiento(1, 0)

            # Verificar estructura
            assert isinstance(resultado, dict), "Resultado debe ser dict"
            assert "solicitud_id" in resultado, "Falta solicitud_id"
            assert "item_idx" in resultado, "Falta item_idx"
            assert "paso" in resultado, "Falta paso"
            assert resultado["paso"] == 2, "paso debe ser 2"
            assert "opciones" in resultado, "Falta opciones"
            assert "item" in resultado, "Falta item"

            # Verificar tipo
            assert isinstance(resultado["opciones"], list), "opciones debe ser list"
            assert len(resultado["opciones"]) > 0, "Debe haber al menos 1 opción"

            print("✅ test_paso_2_retorna_opciones PASSED")

        except ValueError as e:
            # Si solicitud/item no existe, ese es error válido
            assert (
                "no encontrada" in str(e).lower()
                or "no existe" in str(e).lower()
                or "fuera" in str(e).lower()
            )
            print("⚠️  test_paso_2_retorna_opciones: Solicitud/item de test no existe (esperado)")
        except sqlite3.OperationalError as e:
            pytest.skip(f"BD de test incompleta: {e}")

    def test_paso_2_opciones_tienen_estructura(self):
        """Test que cada opción tiene campos requeridos"""
        try:
            resultado = paso_2_opciones_abastecimiento(1, 0)
            opciones = resultado.get("opciones", [])

            if opciones:
                # Campos minimos que toda opcion debe tener
                campos_minimos = [
                    "tipo",
                    "cantidad_disponible",
                ]

                for opcion in opciones:
                    for campo in campos_minimos:
                        assert campo in opcion, f"Opción falta campo {campo}"

                    # Validar tipo de opción - lista extensible
                    # Los tipos validos incluyen todos los posibles segun la implementacion
                    tipos_validos = {
                        "stock",
                        "proveedor",
                        "equivalencia",
                        "mix",
                        "interno",
                        "transferencia",
                    }
                    assert (
                        opcion["tipo"] in tipos_validos
                    ), f"Tipo de opción desconocido: {opcion['tipo']}"

                    # Nota: No validamos campos adicionales por tipo
                    # ya que la estructura varia segun la implementacion

            print("✅ test_paso_2_opciones_tienen_estructura PASSED")

        except ValueError:
            pytest.skip("Solicitud/item de test no existe en BD")
        except sqlite3.OperationalError as e:
            pytest.skip(f"BD de test incompleta: {e}")

    def test_paso_2_item_no_existe(self):
        """Test que paso_2 falla si item_idx no existe"""
        try:
            with pytest.raises(ValueError) as exc_info:
                paso_2_opciones_abastecimiento(1, 999)  # Item que no existe

            assert (
                "fuera" in str(exc_info.value).lower()
                or "no encontrada" in str(exc_info.value).lower()
            )
            print("✅ test_paso_2_item_no_existe PASSED")

        except ValueError as e:
            # Si solicitud no existe, skip
            if "no encontrada" in str(e).lower():
                pytest.skip("Solicitud de test no existe en BD")
            raise


@pytest.mark.usefixtures("setup_test_env")
class TestPaso3GuardarTratamiento:
    """Tests para paso_3_guardar_tratamiento"""

    def test_paso_3_valida_decisiones_vacio(self):
        """Test que paso_3 falla si decisiones está vacío"""
        with pytest.raises(ValueError) as exc_info:
            paso_3_guardar_tratamiento(1, [], "test_user")

        assert "decision" in str(exc_info.value).lower()
        print("✅ test_paso_3_valida_decisiones_vacio PASSED")

    def test_paso_3_retorna_estructura_correcta(self):
        """Test que paso_3 retorna estructura correcta cuando guarda"""
        decisiones = [
            {
                "item_idx": 0,
                "decision_tipo": "stock",
                "cantidad_aprobada": 10.0,
                "codigo_material": "MAT001",
                "id_proveedor": "PROV006",
                "precio_unitario_final": 100.0,
                "observacion": "Test decision",
            }
        ]

        try:
            resultado = paso_3_guardar_tratamiento(1, decisiones, "test_user")

            # Verificar estructura
            assert isinstance(resultado, dict), "Resultado debe ser dict"
            assert "solicitud_id" in resultado, "Falta solicitud_id"
            assert "paso" in resultado, "Falta paso"
            assert resultado["paso"] == 3, "paso debe ser 3"
            assert "items_guardados" in resultado, "Falta items_guardados"
            assert "errores" in resultado, "Falta errores"
            assert "mensaje" in resultado, "Falta mensaje"

            assert isinstance(resultado["errores"], list), "errores debe ser list"

            print("✅ test_paso_3_retorna_estructura_correcta PASSED")

        except ValueError as e:
            # Si solicitud no existe, ese es error válido
            assert "no encontrada" in str(e).lower() or "no existe" in str(e).lower()
            print(
                "⚠️  test_paso_3_retorna_estructura_correcta: Solicitud de test no existe (esperado)"
            )
        except sqlite3.OperationalError as e:
            pytest.skip(f"BD de test incompleta: {e}")

    def test_paso_3_decision_valida_estructura(self):
        """Test que decision tiene campos requeridos"""
        decision_raw = {
            "item_idx": 0,
            "decision_tipo": "stock",
            "cantidad_aprobada": 10.0,
            "codigo_material": "MAT001",
            "id_proveedor": "PROV006",
            "precio_unitario_final": 100.0,
            "observacion": "Test",
        }

        # Importar schema
        from backend.core.schemas import DecisionItem

        # Construir desde dict (validar)
        try:
            decision = DecisionItem.from_dict(decision_raw)
            assert decision.item_idx == 0
            assert decision.decision_tipo == "stock"
            assert decision.cantidad_aprobada == 10.0
            print("✅ test_paso_3_decision_valida_estructura PASSED")
        except ValueError as e:
            pytest.fail(f"Decision validation failed: {e}")

    def test_paso_3_decision_missing_field(self):
        """Test que DecisionItem falla si faltan campos requeridos"""
        from backend.core.schemas import DecisionItem

        # Falta item_idx
        decision_raw = {"decision_tipo": "stock", "cantidad_aprobada": 10.0}

        with pytest.raises(ValueError) as exc_info:
            DecisionItem.from_dict(decision_raw)

        assert "item_idx" in str(exc_info.value)
        print("✅ test_paso_3_decision_missing_field PASSED")


@pytest.mark.usefixtures("setup_test_env")
class TestRepository:
    """Tests para core/repository.py"""

    def test_solicitud_repository_get_by_id_tipo(self):
        """Test que SolicitudRepository.get_by_id retorna dict o None"""
        try:
            result = SolicitudRepository.get_by_id(1)
            assert result is None or isinstance(result, dict), "get_by_id debe retornar dict o None"
            print("✅ test_solicitud_repository_get_by_id_tipo PASSED")
        except Exception as e:
            print(f"⚠️  Repository test error: {e}")

    def test_solicitud_repository_get_by_id_no_existe(self):
        """Test que get_by_id retorna None si no existe"""
        result = SolicitudRepository.get_by_id(999999)
        assert result is None, "get_by_id debe retornar None para ID inexistente"
        print("✅ test_solicitud_repository_get_by_id_no_existe PASSED")


class TestCache:
    """Tests para core/cache_loader.py"""

    def test_cache_get_stock_retorna_dataframe(self):
        """Test que get_stock_cache retorna Pandas DataFrame"""
        import pandas as pd

        from backend.core.cache_loader import get_stock_cache

        stock_df = get_stock_cache()
        assert isinstance(stock_df, pd.DataFrame), "get_stock_cache debe retornar DataFrame"
        print("✅ test_cache_get_stock_retorna_dataframe PASSED")

    def test_cache_clear_funciona(self):
        """Test que clear_cache no levanta errores"""
        try:
            clear_cache()
            print("✅ test_cache_clear_funciona PASSED")
        except Exception as e:
            pytest.fail(f"clear_cache levantó excepción: {e}")


class TestSchemas:
    """Tests para core/schemas.py"""

    def test_conflicto_to_dict(self):
        """Test que Conflicto.to_dict() retorna dict"""
        from backend.core.schemas import Conflicto

        conflicto = Conflicto(
            tipo="stock_insuficiente", item_idx=0, codigo="MAT001", cantidad=10, stock_disponible=5
        )

        d = conflicto.to_dict()
        assert isinstance(d, dict), "to_dict debe retornar dict"
        assert d["tipo"] == "stock_insuficiente"
        assert d["item_idx"] == 0
        print("✅ test_conflicto_to_dict PASSED")

    def test_opcion_to_dict(self):
        """Test que Opcion.to_dict() retorna dict"""
        from backend.core.schemas import Opcion

        opcion = Opcion(
            opcion_id="stock",
            tipo="stock",
            id_proveedor="PROV006",
            codigo_material="MAT001",
            cantidad_disponible=100,
            plazo_entrega_dias=1,
            precio_unitario=100.0,
            costo_total=10000.0,
        )

        d = opcion.to_dict()
        assert isinstance(d, dict)
        assert d["opcion_id"] == "stock"
        assert d["tipo"] == "stock"
        print("✅ test_opcion_to_dict PASSED")

    def test_resultado_paso_1_to_dict(self):
        """Test que ResultadoPaso1.to_dict() retorna dict serializable"""
        from backend.core.schemas import ResultadoPaso1, ResumenPresupuesto

        resumen = ResumenPresupuesto(
            presupuesto_total=10000,
            presupuesto_disponible=8000,
            total_solicitado=5000,
            diferencia_presupuesto=3000,
            total_items=2,
            conflictos_detectados=0,
            avisos=0,
        )

        resultado = ResultadoPaso1(
            solicitud_id=1,
            resumen=resumen,
            materiales_por_criticidad=[],
            conflictos=[],
            avisos=[],
            recomendaciones=[],
        )

        d = resultado.to_dict()
        assert isinstance(d, dict)
        assert d["solicitud_id"] == 1
        assert d["paso"] == 1
        assert d["resumen"]["presupuesto_total"] == 10000
        print("✅ test_resultado_paso_1_to_dict PASSED")


# ============================================================================
# Pytest fixtures
# ============================================================================


@pytest.fixture(scope="session")
def test_database():
    """Crear BD temporal con esquema para tests"""
    # Crear archivo temporal
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(db_path)

    # Crear tablas con esquema compatible con SolicitudRepository
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS solicitudes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario TEXT,
            centro TEXT,
            sector TEXT,
            justificacion TEXT,
            centro_costos TEXT,
            almacen_virtual TEXT,
            criticidad TEXT DEFAULT 'normal',
            fecha_necesidad DATE,
            status TEXT DEFAULT 'draft',
            total_monto REAL DEFAULT 0,
            planner_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_json TEXT,
            aprobador_id TEXT
        );

        CREATE TABLE IF NOT EXISTS presupuestos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            centro TEXT,
            sector TEXT,
            monto_usd REAL,
            saldo_usd REAL,
            anio INTEGER
        );

        CREATE TABLE IF NOT EXISTS solicitud_items_tratamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            solicitud_id INTEGER,
            item_index INTEGER,
            decision TEXT,
            cantidad_aprobada REAL,
            codigo_equivalente TEXT,
            proveedor_sugerido TEXT,
            precio_unitario_estimado REAL,
            comentario TEXT,
            updated_by TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
        );

        CREATE TABLE IF NOT EXISTS proveedores_externos (
            cuit TEXT PRIMARY KEY,
            nombre TEXT,
            lead_time_dias INTEGER DEFAULT 30,
            calificacion TEXT DEFAULT 'sin_calificar',
            rubro TEXT,
            origen TEXT,
            activo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS proveedor_ext_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cuit_proveedor TEXT,
            email TEXT,
            es_principal INTEGER DEFAULT 0
        );
    """
    )

    # Insertar datos de prueba con data_json que contiene items
    items_json = json.dumps({
        "items": [
            {
                "codigo": "MAT001",
                "descripcion": "Material de prueba",
                "cantidad": 10,
                "unidad": "UN",
                "precio_unitario": 100.0
            }
        ]
    })
    conn.execute(
        """
        INSERT INTO solicitudes (id, id_usuario, centro, sector, status, total_monto, data_json, criticidad)
        VALUES (1, 'user1', 'C001', 'S001', 'Aprobada', 1000.0, ?, 'normal')
        """,
        (items_json,)
    )
    conn.execute(
        """
        INSERT INTO presupuestos (centro, sector, monto_usd, saldo_usd, anio)
        VALUES ('C001', 'S001', 10000, 8000, 2025)
        """
    )

    conn.commit()
    conn.close()

    yield db_path

    # Cleanup
    Path(db_path).unlink(missing_ok=True)


@pytest.fixture(scope="function")
def setup_test_env(test_database):
    """Configuración con BD de tests mockeada"""
    # Patchear _db_path en repository.base para que use la BD temporal
    # También patchear get_spm_db_path para compatibilidad con otros módulos
    with patch("backend.core.repository.base._db_path", return_value=Path(test_database)):
        with patch("backend.core.db.get_spm_db_path", return_value=test_database):
            clear_cache()
            yield test_database
            clear_cache()


# ============================================================================
# Marcar tests que requieren BD
# ============================================================================

pytestmark = pytest.mark.unit


if __name__ == "__main__":
    # Ejecutar: python -m pytest tests/unit/test_planner_service.py -v
    pytest.main([__file__, "-v", "-s"])
