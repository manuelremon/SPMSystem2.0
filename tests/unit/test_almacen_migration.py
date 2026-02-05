#!/usr/bin/env python3
"""
Tests unitarios para el script de migracion de codigos de almacen.
"""

import importlib.util
import json
import sqlite3
import tempfile
from pathlib import Path

import pytest

# Importar el modulo de migracion directamente usando importlib
MIGRATION_PATH = Path(__file__).parent.parent.parent / "scripts" / "migrations" / "011_fix_almacenes_consistency.py"
spec = importlib.util.spec_from_file_location("migration", MIGRATION_PATH)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class TestTransformAlmacenCode:
    """Tests para la funcion transform_almacen_code."""

    def test_transform_0xxx_to_aaxxx(self):
        """Codigos 0XXX deben transformarse a AAXXX."""
        assert migration.transform_almacen_code("0001") == "AA001"
        assert migration.transform_almacen_code("0012") == "AA012"
        assert migration.transform_almacen_code("0999") == "AA999"
        assert migration.transform_almacen_code("0000") == "AA000"

    def test_transform_9xxx_to_iixxx(self):
        """Codigos 9XXX deben transformarse a IIXXX."""
        assert migration.transform_almacen_code("9001") == "II001"
        assert migration.transform_almacen_code("9002") == "II002"
        assert migration.transform_almacen_code("9003") == "II003"
        assert migration.transform_almacen_code("9999") == "II999"

    def test_no_change_for_other_codes(self):
        """Otros codigos no deben cambiar."""
        assert migration.transform_almacen_code("7777") == "7777"
        assert migration.transform_almacen_code("1001") == "1001"
        assert migration.transform_almacen_code("5555") == "5555"

    def test_already_migrated_codes(self):
        """Codigos ya migrados no deben cambiar."""
        assert migration.transform_almacen_code("AA001") == "AA001"
        assert migration.transform_almacen_code("AA012") == "AA012"
        assert migration.transform_almacen_code("II001") == "II001"
        assert migration.transform_almacen_code("II003") == "II003"

    def test_handles_whitespace(self):
        """Debe manejar espacios en blanco."""
        assert migration.transform_almacen_code(" 0001 ") == "AA001"
        assert migration.transform_almacen_code("  9003  ") == "II003"

    def test_handles_non_4digit_codes(self):
        """Codigos que no son exactamente 4 digitos no deben cambiar."""
        assert migration.transform_almacen_code("001") == "001"
        assert migration.transform_almacen_code("00001") == "00001"
        assert migration.transform_almacen_code("0") == "0"
        assert migration.transform_almacen_code("00") == "00"


class TestCountLegacyCodes:
    """Tests para la funcion count_legacy_codes."""

    def test_count_legacy_in_temp_db(self):
        """Debe contar correctamente codigos legacy."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # Crear tabla de prueba
            cursor.execute("""
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    almacen TEXT
                )
            """)

            # Insertar datos de prueba
            test_data = [
                (1, "0001"),  # Legacy
                (2, "0012"),  # Legacy
                (3, "9003"),  # Legacy
                (4, "AA001"),  # Migrado
                (5, "II003"),  # Migrado
                (6, "7777"),  # Otro
            ]
            cursor.executemany(
                "INSERT INTO test_table (id, almacen) VALUES (?, ?)",
                test_data
            )
            conn.commit()
            conn.close()

            # Verificar conteo
            count = migration.count_legacy_codes(db_path, "test_table", "almacen")
            assert count == 3  # Solo 0001, 0012, 9003

        finally:
            db_path.unlink()

    def test_returns_zero_for_nonexistent_table(self):
        """Debe retornar 0 si la tabla no existe."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        try:
            count = migration.count_legacy_codes(db_path, "nonexistent", "almacen")
            assert count == 0
        finally:
            db_path.unlink()


class TestUpdateSapTable:
    """Tests para la funcion update_sap_table."""

    def test_update_sap_table(self):
        """Debe actualizar correctamente los codigos en tabla SAP."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        # Temporalmente modificar la ruta de SAP_DATA_DB
        original_db = migration.SAP_DATA_DB
        migration.SAP_DATA_DB = db_path

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # Crear tabla de prueba
            cursor.execute("""
                CREATE TABLE consumo_historico (
                    id INTEGER PRIMARY KEY,
                    almacen TEXT,
                    cantidad INTEGER
                )
            """)

            # Insertar datos
            test_data = [
                (1, "0001", 100),
                (2, "0012", 200),
                (3, "9003", 300),
                (4, "AA001", 400),  # Ya migrado
                (5, "7777", 500),  # Otro
            ]
            cursor.executemany(
                "INSERT INTO consumo_historico VALUES (?, ?, ?)",
                test_data
            )
            conn.commit()
            conn.close()

            # Ejecutar migracion
            updated = migration.update_sap_table("consumo_historico", "almacen")

            # Verificar resultados
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT id, almacen FROM consumo_historico ORDER BY id")
            results = cursor.fetchall()
            conn.close()

            assert updated == 3
            assert results[0] == (1, "AA001")
            assert results[1] == (2, "AA012")
            assert results[2] == (3, "II003")
            assert results[3] == (4, "AA001")  # Sin cambio
            assert results[4] == (5, "7777")  # Sin cambio

        finally:
            migration.SAP_DATA_DB = original_db
            db_path.unlink()


class TestUsuariosAlmacenes:
    """Tests para transformacion de campo almacenes en usuarios."""

    def test_transform_json_array(self):
        """Debe transformar arrays JSON correctamente."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        original_db = migration.SPM_DB
        migration.SPM_DB = db_path

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE usuarios (
                    id_spm TEXT PRIMARY KEY,
                    almacenes TEXT
                )
            """)

            # JSON array con codigos legacy
            cursor.execute(
                "INSERT INTO usuarios (id_spm, almacenes) VALUES (?, ?)",
                ("1", '["0001", "0012", "9003"]')
            )
            conn.commit()
            conn.close()

            # Ejecutar migracion
            updated = migration.update_usuarios_almacenes()

            # Verificar
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT almacenes FROM usuarios WHERE id_spm = '1'")
            result = cursor.fetchone()[0]
            conn.close()

            assert updated == 1
            almacenes = json.loads(result)
            assert "AA001" in almacenes
            assert "AA012" in almacenes
            assert "II003" in almacenes

        finally:
            migration.SPM_DB = original_db
            db_path.unlink()

    def test_transform_csv_string(self):
        """Debe transformar strings CSV correctamente."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        original_db = migration.SPM_DB
        migration.SPM_DB = db_path

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE usuarios (
                    id_spm TEXT PRIMARY KEY,
                    almacenes TEXT
                )
            """)

            # CSV string con codigos legacy
            cursor.execute(
                "INSERT INTO usuarios (id_spm, almacenes) VALUES (?, ?)",
                ("1", "0001,0012,9003")
            )
            conn.commit()
            conn.close()

            updated = migration.update_usuarios_almacenes()

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT almacenes FROM usuarios WHERE id_spm = '1'")
            result = cursor.fetchone()[0]
            conn.close()

            assert updated == 1
            assert result == "AA001,AA012,II003"

        finally:
            migration.SPM_DB = original_db
            db_path.unlink()

    def test_transform_single_value(self):
        """Debe transformar valores simples correctamente."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        original_db = migration.SPM_DB
        migration.SPM_DB = db_path

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE usuarios (
                    id_spm TEXT PRIMARY KEY,
                    almacenes TEXT
                )
            """)

            cursor.execute(
                "INSERT INTO usuarios (id_spm, almacenes) VALUES (?, ?)",
                ("1", "0001")
            )
            conn.commit()
            conn.close()

            updated = migration.update_usuarios_almacenes()

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT almacenes FROM usuarios WHERE id_spm = '1'")
            result = cursor.fetchone()[0]
            conn.close()

            assert updated == 1
            assert result == "AA001"

        finally:
            migration.SPM_DB = original_db
            db_path.unlink()


class TestValidateConsistency:
    """Tests para la funcion validate_consistency."""

    def test_validate_clean_database(self):
        """Debe retornar 0 para todas las tablas limpias."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            sap_db = Path(f.name)
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            spm_db = Path(f.name)

        original_sap = migration.SAP_DATA_DB
        original_spm = migration.SPM_DB
        migration.SAP_DATA_DB = sap_db
        migration.SPM_DB = spm_db

        try:
            # Crear tablas limpias en sap_data
            conn = sqlite3.connect(sap_db)
            cursor = conn.cursor()
            for table in ["consumo_historico", "materiales_bbdd", "pedidos_sap", "stock"]:
                cursor.execute(f"""
                    CREATE TABLE {table} (
                        id INTEGER PRIMARY KEY,
                        almacen TEXT
                    )
                """)
                # Solo datos migrados
                cursor.execute(
                    f"INSERT INTO {table} (almacen) VALUES (?)",
                    ("AA001",)
                )
            conn.commit()
            conn.close()

            # Crear tabla usuarios limpia
            conn = sqlite3.connect(spm_db)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE usuarios (
                    id INTEGER PRIMARY KEY,
                    almacenes TEXT
                )
            """)
            cursor.execute(
                "INSERT INTO usuarios (almacenes) VALUES (?)",
                ('["AA001", "II003"]',)
            )
            conn.commit()
            conn.close()

            # Validar
            results = migration.validate_consistency()

            # Todas deben ser 0
            for key, value in results.items():
                assert value == 0, f"{key} tiene {value} registros legacy"

        finally:
            migration.SAP_DATA_DB = original_sap
            migration.SPM_DB = original_spm
            sap_db.unlink()
            spm_db.unlink()
