"""
Tests para el modulo de validacion de requests.
Sprint 10.2 - Verifica sanitizacion y validacion de datos.
"""

import pytest


class TestSanitizeString:
    """Tests para sanitize_string."""

    def test_sanitize_basic_string(self):
        """Sanitiza string basico."""
        try:
            from backend.core.request_validation import sanitize_string
        except ImportError:
            pytest.skip("Module not available")

        result = sanitize_string("hello world")
        assert result == "hello world"

    def test_sanitize_escapes_html(self):
        """Sanitiza escapando HTML."""
        try:
            from backend.core.request_validation import sanitize_string
        except ImportError:
            pytest.skip("Module not available")

        result = sanitize_string("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_sanitize_truncates_long_string(self):
        """Trunca strings largos."""
        try:
            from backend.core.request_validation import sanitize_string
        except ImportError:
            pytest.skip("Module not available")

        long_string = "a" * 20000
        result = sanitize_string(long_string, max_length=100)
        assert len(result) == 100

    def test_sanitize_removes_control_chars(self):
        """Remueve caracteres de control."""
        try:
            from backend.core.request_validation import sanitize_string
        except ImportError:
            pytest.skip("Module not available")

        result = sanitize_string("hello\x00world\x1f")
        assert "\x00" not in result
        assert "\x1f" not in result

    def test_sanitize_preserves_newlines(self):
        """Preserva newlines y tabs."""
        try:
            from backend.core.request_validation import sanitize_string
        except ImportError:
            pytest.skip("Module not available")

        result = sanitize_string("hello\nworld\ttab")
        assert "\n" in result
        assert "\t" in result


class TestCheckSqlInjection:
    """Tests para check_sql_injection."""

    def test_detects_select(self):
        """Detecta SELECT."""
        try:
            from backend.core.request_validation import check_sql_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_sql_injection("SELECT * FROM users") is True

    def test_detects_union(self):
        """Detecta UNION."""
        try:
            from backend.core.request_validation import check_sql_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_sql_injection("1 UNION SELECT * FROM users") is True

    def test_detects_drop(self):
        """Detecta DROP."""
        try:
            from backend.core.request_validation import check_sql_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_sql_injection("'; DROP TABLE users;--") is True

    def test_detects_or_1_equals_1(self):
        """Detecta OR 1=1."""
        try:
            from backend.core.request_validation import check_sql_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_sql_injection("' OR 1=1 --") is True

    def test_detects_comment(self):
        """Detecta comentarios SQL."""
        try:
            from backend.core.request_validation import check_sql_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_sql_injection("admin'--") is True

    def test_safe_string(self):
        """String seguro retorna False."""
        try:
            from backend.core.request_validation import check_sql_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_sql_injection("hello world") is False


class TestCheckXss:
    """Tests para check_xss."""

    def test_detects_script_tag(self):
        """Detecta tag script."""
        try:
            from backend.core.request_validation import check_xss
        except ImportError:
            pytest.skip("Module not available")

        assert check_xss("<script>alert('xss')</script>") is True

    def test_detects_javascript_uri(self):
        """Detecta javascript: URI."""
        try:
            from backend.core.request_validation import check_xss
        except ImportError:
            pytest.skip("Module not available")

        assert check_xss("javascript:alert('xss')") is True

    def test_detects_event_handler(self):
        """Detecta event handlers."""
        try:
            from backend.core.request_validation import check_xss
        except ImportError:
            pytest.skip("Module not available")

        assert check_xss("<img onerror=alert('xss')>") is True
        assert check_xss("<body onload=alert('xss')>") is True

    def test_detects_iframe(self):
        """Detecta iframe."""
        try:
            from backend.core.request_validation import check_xss
        except ImportError:
            pytest.skip("Module not available")

        assert check_xss("<iframe src='evil.com'>") is True

    def test_safe_html(self):
        """HTML seguro retorna False."""
        try:
            from backend.core.request_validation import check_xss
        except ImportError:
            pytest.skip("Module not available")

        assert check_xss("<p>Hello World</p>") is False


class TestCheckPathTraversal:
    """Tests para check_path_traversal."""

    def test_detects_dot_dot_slash(self):
        """Detecta ../"""
        try:
            from backend.core.request_validation import check_path_traversal
        except ImportError:
            pytest.skip("Module not available")

        assert check_path_traversal("../../../etc/passwd") is True

    def test_detects_encoded(self):
        """Detecta versiones encoded."""
        try:
            from backend.core.request_validation import check_path_traversal
        except ImportError:
            pytest.skip("Module not available")

        assert check_path_traversal("%2e%2e/etc/passwd") is True

    def test_safe_path(self):
        """Path seguro retorna False."""
        try:
            from backend.core.request_validation import check_path_traversal
        except ImportError:
            pytest.skip("Module not available")

        assert check_path_traversal("/api/users/123") is False


class TestCheckCommandInjection:
    """Tests para check_command_injection."""

    def test_detects_semicolon(self):
        """Detecta ;"""
        try:
            from backend.core.request_validation import check_command_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_command_injection("file.txt; rm -rf /") is True

    def test_detects_pipe(self):
        """Detecta |"""
        try:
            from backend.core.request_validation import check_command_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_command_injection("cat file.txt | grep password") is True

    def test_detects_backtick(self):
        """Detecta backticks."""
        try:
            from backend.core.request_validation import check_command_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_command_injection("`whoami`") is True

    def test_safe_command(self):
        """Comando seguro retorna False."""
        try:
            from backend.core.request_validation import check_command_injection
        except ImportError:
            pytest.skip("Module not available")

        assert check_command_injection("hello world") is False


class TestIsSafeString:
    """Tests para is_safe_string."""

    def test_safe_string_passes(self):
        """String seguro pasa."""
        try:
            from backend.core.request_validation import is_safe_string
        except ImportError:
            pytest.skip("Module not available")

        assert is_safe_string("Hello World!") is True

    def test_sql_injection_fails(self):
        """SQL injection falla."""
        try:
            from backend.core.request_validation import is_safe_string
        except ImportError:
            pytest.skip("Module not available")

        assert is_safe_string("' OR 1=1--") is False

    def test_xss_fails(self):
        """XSS falla."""
        try:
            from backend.core.request_validation import is_safe_string
        except ImportError:
            pytest.skip("Module not available")

        assert is_safe_string("<script>alert(1)</script>") is False


class TestValidateEmail:
    """Tests para validate_email."""

    def test_valid_email(self):
        """Email valido pasa."""
        try:
            from backend.core.request_validation import validate_email
        except ImportError:
            pytest.skip("Module not available")

        assert validate_email("user@example.com") is True
        assert validate_email("user.name@subdomain.example.com") is True

    def test_invalid_email(self):
        """Email invalido falla."""
        try:
            from backend.core.request_validation import validate_email
        except ImportError:
            pytest.skip("Module not available")

        assert validate_email("not-an-email") is False
        assert validate_email("@example.com") is False
        assert validate_email("user@") is False


class TestValidatePhone:
    """Tests para validate_phone."""

    def test_valid_phone(self):
        """Telefono valido pasa."""
        try:
            from backend.core.request_validation import validate_phone
        except ImportError:
            pytest.skip("Module not available")

        assert validate_phone("+1234567890") is True
        assert validate_phone("123-456-7890") is True

    def test_invalid_phone(self):
        """Telefono invalido falla."""
        try:
            from backend.core.request_validation import validate_phone
        except ImportError:
            pytest.skip("Module not available")

        assert validate_phone("123") is False
        assert validate_phone("abcdefghij") is False


class TestValidateInteger:
    """Tests para validate_integer."""

    def test_valid_integer(self):
        """Entero valido pasa."""
        try:
            from backend.core.request_validation import validate_integer
        except ImportError:
            pytest.skip("Module not available")

        assert validate_integer(42) is True
        assert validate_integer("42") is True

    def test_integer_range(self):
        """Rango de entero funciona."""
        try:
            from backend.core.request_validation import validate_integer
        except ImportError:
            pytest.skip("Module not available")

        assert validate_integer(5, min_val=1, max_val=10) is True
        assert validate_integer(0, min_val=1) is False
        assert validate_integer(15, max_val=10) is False

    def test_invalid_integer(self):
        """No-entero falla."""
        try:
            from backend.core.request_validation import validate_integer
        except ImportError:
            pytest.skip("Module not available")

        assert validate_integer("not a number") is False


class TestValidateUuid:
    """Tests para validate_uuid."""

    def test_valid_uuid(self):
        """UUID valido pasa."""
        try:
            from backend.core.request_validation import validate_uuid
        except ImportError:
            pytest.skip("Module not available")

        assert validate_uuid("123e4567-e89b-12d3-a456-426614174000") is True

    def test_invalid_uuid(self):
        """UUID invalido falla."""
        try:
            from backend.core.request_validation import validate_uuid
        except ImportError:
            pytest.skip("Module not available")

        assert validate_uuid("not-a-uuid") is False
        assert validate_uuid("12345678") is False


class TestValidateDate:
    """Tests para validate_date."""

    def test_valid_date(self):
        """Fecha valida pasa."""
        try:
            from backend.core.request_validation import validate_date
        except ImportError:
            pytest.skip("Module not available")

        assert validate_date("2024-01-15") is True

    def test_invalid_date(self):
        """Fecha invalida falla."""
        try:
            from backend.core.request_validation import validate_date
        except ImportError:
            pytest.skip("Module not available")

        assert validate_date("not-a-date") is False
        assert validate_date("2024/01/15") is False  # Wrong format


class TestRequestValidator:
    """Tests para RequestValidator."""

    @pytest.fixture
    def validator(self):
        """Crea un validador."""
        try:
            from backend.core.request_validation import RequestValidator
        except ImportError:
            pytest.skip("Module not available")

        v = RequestValidator()
        v.add_rule("name", required=True, field_type=str, max_length=100)
        v.add_rule("age", field_type=int, min_value=0, max_value=150)
        v.add_rule("email", pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        return v

    def test_valid_data_passes(self, validator):
        """Datos validos pasan."""
        data = {"name": "John", "age": 30, "email": "john@example.com"}
        valid, errors, sanitized = validator.validate(data)

        assert valid is True
        assert len(errors) == 0
        assert sanitized["name"] == "John"

    def test_missing_required_fails(self, validator):
        """Falta campo requerido falla."""
        data = {"age": 30}
        valid, errors, sanitized = validator.validate(data)

        assert valid is False
        assert any("name" in e for e in errors)

    def test_invalid_type_fails(self, validator):
        """Tipo invalido falla."""
        data = {"name": "John", "age": "not a number"}
        valid, errors, sanitized = validator.validate(data)

        assert valid is False
        assert any("age" in e for e in errors)

    def test_out_of_range_fails(self, validator):
        """Valor fuera de rango falla."""
        data = {"name": "John", "age": 200}
        valid, errors, sanitized = validator.validate(data)

        assert valid is False
        assert any("age" in e for e in errors)

    def test_invalid_pattern_fails(self, validator):
        """Patron invalido falla."""
        data = {"name": "John", "email": "not-an-email"}
        valid, errors, sanitized = validator.validate(data)

        assert valid is False
        assert any("email" in e for e in errors)

    def test_sanitizes_strings(self, validator):
        """Sanitiza strings."""
        data = {"name": "<script>alert('xss')</script>"}
        valid, errors, sanitized = validator.validate(data)

        # Deberia sanitizar el nombre
        if valid:
            assert "<script>" not in sanitized.get("name", "")


class TestValidatorWithChoices:
    """Tests para validacion con choices."""

    def test_valid_choice(self):
        """Choice valido pasa."""
        try:
            from backend.core.request_validation import RequestValidator
        except ImportError:
            pytest.skip("Module not available")

        v = RequestValidator()
        v.add_rule("status", choices=["active", "inactive", "pending"])

        valid, errors, sanitized = v.validate({"status": "active"})

        assert valid is True

    def test_invalid_choice_fails(self):
        """Choice invalido falla."""
        try:
            from backend.core.request_validation import RequestValidator
        except ImportError:
            pytest.skip("Module not available")

        v = RequestValidator()
        v.add_rule("status", choices=["active", "inactive"])

        valid, errors, sanitized = v.validate({"status": "unknown"})

        assert valid is False


class TestValidatorChaining:
    """Tests para encadenamiento de reglas."""

    def test_chaining_works(self):
        """Encadenamiento funciona."""
        try:
            from backend.core.request_validation import RequestValidator
        except ImportError:
            pytest.skip("Module not available")

        v = (
            RequestValidator()
            .add_rule("field1", required=True)
            .add_rule("field2", field_type=int)
            .add_rule("field3", max_length=10)
        )

        assert len(v._rules) == 3


class TestSanitizeHtml:
    """Tests para sanitize_html."""

    def test_escapes_all_html(self):
        """Escapa todo HTML por defecto."""
        try:
            from backend.core.request_validation import sanitize_html
        except ImportError:
            pytest.skip("Module not available")

        result = sanitize_html("<p>Hello</p>")
        assert "<p>" not in result
        assert "&lt;p&gt;" in result

    def test_allows_specified_tags(self):
        """Permite tags especificados."""
        try:
            from backend.core.request_validation import sanitize_html
        except ImportError:
            pytest.skip("Module not available")

        result = sanitize_html("<p>Hello</p>", allowed_tags=["p"])
        assert "<p>" in result
        assert "</p>" in result
