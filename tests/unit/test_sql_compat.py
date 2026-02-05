"""
Tests para helpers de compatibilidad SQL SQLite/PostgreSQL.

Verifica que las funciones en db.py generan expresiones SQL válidas
para ambos motores de base de datos.
"""

import pytest
from unittest.mock import patch


class TestSqlDateRelative:
    """Tests para sql_date_relative()"""

    def test_sqlite_days_negative(self):
        """SQLite: días negativos genera date('now', '-7 days')"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_date_relative

            result = sql_date_relative(days=-7)
            assert "date('now'" in result
            assert "-7 days" in result

    def test_sqlite_months_negative(self):
        """SQLite: meses negativos genera date('now', '-6 months')"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_date_relative

            result = sql_date_relative(months=-6)
            assert "date('now'" in result
            assert "-6 months" in result

    def test_postgres_days_negative(self):
        """PostgreSQL: días negativos genera CURRENT_DATE - INTERVAL"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_date_relative

            result = sql_date_relative(days=-7)
            assert "CURRENT_DATE" in result
            assert "INTERVAL" in result
            assert "7 days" in result

    def test_postgres_months_negative(self):
        """PostgreSQL: meses negativos genera CURRENT_DATE - INTERVAL"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_date_relative

            result = sql_date_relative(months=-6)
            assert "CURRENT_DATE" in result
            assert "INTERVAL" in result
            assert "6 months" in result


class TestSqlDateDiffDays:
    """Tests para sql_date_diff_days()"""

    def test_sqlite_julianday(self):
        """SQLite: usa julianday() para diferencia de fechas"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_date_diff_days

            result = sql_date_diff_days("updated_at", "created_at")
            assert "julianday(updated_at)" in result
            assert "julianday(created_at)" in result

    def test_postgres_extract_epoch(self):
        """PostgreSQL: usa EXTRACT(EPOCH FROM ...) para diferencia"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_date_diff_days

            result = sql_date_diff_days("updated_at", "created_at")
            assert "EXTRACT(EPOCH" in result
            assert "86400" in result  # Segundos por día


class TestSqlFormatDate:
    """Tests para sql_format_date()"""

    def test_sqlite_strftime(self):
        """SQLite: usa strftime() para formatear fechas"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_format_date

            result = sql_format_date("created_at", "%Y-%m")
            assert "strftime('%Y-%m', created_at)" in result

    def test_postgres_to_char(self):
        """PostgreSQL: usa TO_CHAR() con formato convertido"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_format_date

            result = sql_format_date("created_at", "%Y-%m")
            assert "TO_CHAR(created_at" in result
            assert "YYYY-MM" in result  # Formato PostgreSQL


class TestSqlPatternIsNumeric:
    """Tests para sql_pattern_is_numeric()"""

    def test_sqlite_glob(self):
        """SQLite: usa GLOB para pattern matching"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_pattern_is_numeric

            result = sql_pattern_is_numeric("id_spm")
            assert "GLOB" in result
            assert "[0-9]*" in result

    def test_postgres_regex(self):
        """PostgreSQL: usa operador regex ~"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_pattern_is_numeric

            result = sql_pattern_is_numeric("id_spm")
            assert "~" in result
            assert "^[0-9]+$" in result


class TestSqlDatetimeNow:
    """Tests para sql_datetime_now() (existente)"""

    def test_sqlite_datetime(self):
        """SQLite: retorna datetime('now')"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_datetime_now

            result = sql_datetime_now()
            assert result == "datetime('now')"

    def test_postgres_now(self):
        """PostgreSQL: retorna NOW()"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_datetime_now

            result = sql_datetime_now()
            assert result == "NOW()"


class TestSqlCurrentDate:
    """Tests para sql_current_date()"""

    def test_sqlite_date_now(self):
        """SQLite: retorna date('now')"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_current_date

            result = sql_current_date()
            assert result == "date('now')"

    def test_postgres_current_date(self):
        """PostgreSQL: retorna CURRENT_DATE"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_current_date

            result = sql_current_date()
            assert result == "CURRENT_DATE"


class TestSqlNowMinus:
    """Tests para sql_now_minus() (existente)"""

    def test_sqlite_datetime_minus(self):
        """SQLite: datetime('now', '-interval')"""
        with patch("backend.core.db.is_using_postgresql", return_value=False):
            from backend.core.db import sql_now_minus

            result = sql_now_minus("5 seconds")
            assert "datetime('now'" in result
            assert "-5 seconds" in result

    def test_postgres_now_minus_interval(self):
        """PostgreSQL: NOW() - INTERVAL 'X'"""
        with patch("backend.core.db.is_using_postgresql", return_value=True):
            from backend.core.db import sql_now_minus

            result = sql_now_minus("5 seconds")
            assert "NOW() - INTERVAL" in result
            assert "5 seconds" in result
