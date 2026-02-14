"""Tests for backend.core.search_utils — shared description search utilities."""

import pytest

from unittest.mock import MagicMock, patch

from backend.core.search_utils import (
    SearchResult,
    build_description_search,
    build_description_search_with_catalog,
    expand_codes_from_catalog,
    normalize_search_term,
    strip_accents,
)


# =============================================================================
# strip_accents
# =============================================================================

class TestStripAccents:
    def test_spanish_accents(self):
        assert strip_accents("válvula") == "valvula"

    def test_uppercase_accents(self):
        assert strip_accents("TUBERÍA") == "TUBERIA"

    def test_mixed_accents(self):
        assert strip_accents("señal eléctrica") == "senal electrica"

    def test_no_accents(self):
        assert strip_accents("BOMBA CENTRIFUGA") == "BOMBA CENTRIFUGA"

    def test_empty_string(self):
        assert strip_accents("") == ""

    def test_numbers_and_symbols(self):
        assert strip_accents("ABC-123/456") == "ABC-123/456"

    def test_enie(self):
        assert strip_accents("año") == "ano"

    def test_dieresis(self):
        assert strip_accents("pingüino") == "pinguino"


# =============================================================================
# normalize_search_term
# =============================================================================

class TestNormalizeSearchTerm:
    def test_strip_upper_accents(self):
        assert normalize_search_term("  válvula  ") == "VALVULA"

    def test_already_normalized(self):
        assert normalize_search_term("BOMBA") == "BOMBA"

    def test_mixed_case_with_accents(self):
        assert normalize_search_term("Tubería Galvanizada") == "TUBERIA GALVANIZADA"


# =============================================================================
# build_description_search — basic cases
# =============================================================================

class TestBuildDescriptionSearchBasic:
    def test_returns_none_for_empty(self):
        assert build_description_search("", ["col"]) is None

    def test_returns_none_for_whitespace(self):
        assert build_description_search("   ", ["col"]) is None

    def test_returns_none_for_no_columns(self):
        assert build_description_search("test", []) is None

    def test_returns_none_for_short_words(self):
        # All words shorter than min_term_length should be filtered
        assert build_description_search("a b c", ["col"], min_term_length=2) is None

    def test_single_word_single_column(self):
        result = build_description_search("bomba", ["descripcion"])
        assert result is not None
        assert "UPPER(descripcion) LIKE ?" in result.where_clause
        assert len(result.params) == 1
        assert result.params[0] == "%BOMBA%"

    def test_single_word_multiple_columns(self):
        result = build_description_search("bomba", ["descripcion", "descripcion_larga"])
        assert result is not None
        assert "UPPER(descripcion) LIKE ?" in result.where_clause
        assert "UPPER(descripcion_larga) LIKE ?" in result.where_clause
        assert " OR " in result.where_clause
        assert len(result.params) == 2
        assert all(p == "%BOMBA%" for p in result.params)


# =============================================================================
# build_description_search — multi-word
# =============================================================================

class TestBuildDescriptionSearchMultiWord:
    def test_multi_word_and(self):
        result = build_description_search("bomba centrifuga", ["descripcion"])
        assert result is not None
        # Should have AND between word groups
        assert " AND " in result.where_clause
        assert len(result.params) == 2
        assert "%BOMBA%" in result.params
        assert "%CENTRIFUGA%" in result.params

    def test_multi_word_or(self):
        result = build_description_search(
            "bomba centrifuga", ["descripcion"], require_all_words=False
        )
        assert result is not None
        assert " OR " in result.where_clause
        # Should NOT have AND
        assert " AND " not in result.where_clause

    def test_multi_word_multi_column(self):
        result = build_description_search(
            "bomba centrifuga", ["descripcion", "descripcion_larga"]
        )
        assert result is not None
        # 2 words × 2 columns = 4 params
        assert len(result.params) == 4

    def test_filters_short_words(self):
        result = build_description_search("bomba de agua", ["col"], min_term_length=3)
        assert result is not None
        # "de" is filtered (len=2 < min=3), only "bomba" and "agua" remain
        assert len(result.params) == 2
        assert "%BOMBA%" in result.params
        assert "%AGUA%" in result.params

    def test_accent_insensitive(self):
        result = build_description_search("válvula eléctrica", ["col"])
        assert result is not None
        assert "%VALVULA%" in result.params
        assert "%ELECTRICA%" in result.params


# =============================================================================
# build_description_search — ranking
# =============================================================================

class TestBuildDescriptionSearchRanking:
    def test_no_ranking_by_default(self):
        result = build_description_search("bomba", ["descripcion"])
        assert result is not None
        assert result.order_expr is None
        assert result.order_params is None

    def test_ranking_single_column(self):
        result = build_description_search(
            "bomba", ["descripcion"], include_ranking=True
        )
        assert result is not None
        assert result.order_expr is not None
        assert result.order_params is not None
        assert "CASE WHEN" in result.order_expr
        assert len(result.order_params) == 1

    def test_ranking_multi_column(self):
        result = build_description_search(
            "bomba", ["descripcion", "descripcion_larga"], include_ranking=True
        )
        assert result is not None
        # First col gets score 3, second col gets score 1
        assert "CASE WHEN" in result.order_expr
        # 1 word × 2 columns = 2 ranking params
        assert len(result.order_params) == 2

    def test_ranking_multi_word(self):
        result = build_description_search(
            "bomba centrifuga", ["descripcion", "descripcion_larga"],
            include_ranking=True
        )
        assert result is not None
        # 2 words × 2 columns = 4 ranking params
        assert len(result.order_params) == 4


# =============================================================================
# build_description_search — param count consistency
# =============================================================================

class TestBuildDescriptionSearchParamCount:
    def test_placeholder_count_matches_params(self):
        """Number of ? in where_clause must equal len(params)."""
        result = build_description_search(
            "bomba centrifuga hidraulica",
            ["descripcion", "descripcion_larga", "codigo"],
        )
        assert result is not None
        placeholder_count = result.where_clause.count("?")
        assert placeholder_count == len(result.params)

    def test_ranking_placeholder_count_matches(self):
        """Number of ? in order_expr must equal len(order_params)."""
        result = build_description_search(
            "bomba centrifuga",
            ["descripcion", "descripcion_larga"],
            include_ranking=True,
        )
        assert result is not None
        if result.order_expr:
            rank_placeholder_count = result.order_expr.count("?")
            assert rank_placeholder_count == len(result.order_params)

    @pytest.mark.parametrize("term,cols", [
        ("x", ["a"]),  # single short word → None
        ("ab", ["a"]),  # single word at min length
        ("ab cd", ["a", "b"]),  # multi-word, multi-col
        ("ab cd ef", ["a", "b", "c"]),  # 3 words, 3 cols
    ])
    def test_various_combinations(self, term, cols):
        result = build_description_search(term, cols)
        if result is not None:
            assert result.where_clause.count("?") == len(result.params)


# =============================================================================
# build_description_search — wrapping behavior
# =============================================================================

class TestBuildDescriptionSearchWrapping:
    def test_single_word_no_outer_parens(self):
        result = build_description_search("bomba", ["col"])
        assert result is not None
        # Single word clause should not have extra outer parens
        assert not result.where_clause.startswith("((")

    def test_multi_word_has_outer_parens(self):
        result = build_description_search("bomba centrifuga", ["col"])
        assert result is not None
        # Multi-word should be wrapped for safe AND precedence
        assert result.where_clause.startswith("(")
        assert result.where_clause.endswith(")")


# =============================================================================
# expand_codes_from_catalog
# =============================================================================

class TestExpandCodesFromCatalog:
    @patch("backend.core.db.is_using_postgresql", return_value=False)
    @patch("backend.core.db.get_db_connection")
    def test_returns_codes_from_catalog(self, mock_conn, mock_pg):
        """Should query catalogo_materiales.descripcion_larga and return codes."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [("MAT001",), ("MAT002",)]
        mock_ctx = MagicMock()
        mock_ctx.cursor.return_value = mock_cursor
        mock_conn.return_value.__enter__ = lambda s: mock_ctx
        mock_conn.return_value.__exit__ = lambda s, *a: None

        # Needs 2+ words to activate (min_words=2 default)
        result = expand_codes_from_catalog("bomba centrifuga")

        assert mock_cursor.execute.called
        sql_called = mock_cursor.execute.call_args[0][0]
        assert "descripcion_larga" in sql_called
        assert "catalogo_materiales" in sql_called
        assert result == ["MAT001", "MAT002"]

    def test_returns_empty_for_empty_term(self):
        result = expand_codes_from_catalog("")
        assert result == []

    def test_returns_empty_for_single_word(self):
        """Single words are too broad for descripcion_larga — skip."""
        result = expand_codes_from_catalog("bomba")
        assert result == []

    def test_returns_empty_for_short_words(self):
        result = expand_codes_from_catalog("a b c d", min_term_length=3)
        assert result == []

    @patch("backend.core.db.is_using_postgresql", return_value=False)
    @patch("backend.core.db.get_db_connection", side_effect=Exception("DB error"))
    def test_returns_empty_on_db_error(self, mock_conn, mock_pg):
        result = expand_codes_from_catalog("bomba centrifuga")
        assert result == []

    @patch("backend.core.db.is_using_postgresql", return_value=False)
    @patch("backend.core.db.get_db_connection")
    def test_override_min_words(self, mock_conn, mock_pg):
        """Can override min_words to allow single-word searches."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [("MAT001",)]
        mock_ctx = MagicMock()
        mock_ctx.cursor.return_value = mock_cursor
        mock_conn.return_value.__enter__ = lambda s: mock_ctx
        mock_conn.return_value.__exit__ = lambda s, *a: None

        result = expand_codes_from_catalog("bomba", min_words=1)
        assert result == ["MAT001"]


# =============================================================================
# build_description_search_with_catalog
# =============================================================================

class TestBuildDescriptionSearchWithCatalog:
    @patch("backend.core.search_utils.expand_codes_from_catalog", return_value=[])
    def test_no_catalog_codes_falls_back_to_direct(self, mock_expand):
        """When catalog returns nothing, should still do direct search."""
        result = build_description_search_with_catalog(
            "bomba", ["descripcion"], "codigo_material"
        )
        assert result is not None
        assert "UPPER(descripcion) LIKE ?" in result.where_clause
        # No IN clause since no catalog codes
        assert "IN" not in result.where_clause

    @patch("backend.core.search_utils.expand_codes_from_catalog", return_value=["MAT001", "MAT002"])
    def test_combines_direct_and_catalog(self, mock_expand):
        """Should OR the direct search with IN (catalog codes)."""
        result = build_description_search_with_catalog(
            "bomba centrifuga", ["descripcion"], "codigo_material"
        )
        assert result is not None
        assert "UPPER(descripcion) LIKE ?" in result.where_clause
        assert "codigo_material IN (?, ?)" in result.where_clause
        assert " OR " in result.where_clause
        # 2-word direct search (2 params) + 2 catalog codes = 4 total
        assert len(result.params) == 4
        assert "MAT001" in result.params
        assert "MAT002" in result.params

    @patch("backend.core.search_utils.expand_codes_from_catalog", return_value=["MAT001"])
    def test_only_catalog_when_direct_empty(self, mock_expand):
        """If direct search returns None (short term), catalog codes still work."""
        result = build_description_search_with_catalog(
            "a", ["descripcion"], "codigo_material", min_term_length=3
        )
        assert result is not None
        assert "codigo_material IN (?)" in result.where_clause
        assert result.params == ["MAT001"]

    @patch("backend.core.search_utils.expand_codes_from_catalog", return_value=[])
    def test_returns_none_when_both_empty(self, mock_expand):
        result = build_description_search_with_catalog(
            "", ["descripcion"], "codigo_material"
        )
        assert result is None

    @patch("backend.core.search_utils.expand_codes_from_catalog", return_value=["MAT001"])
    def test_placeholder_count_matches_params(self, mock_expand):
        """All ? placeholders must have corresponding params."""
        result = build_description_search_with_catalog(
            "bomba centrifuga", ["descripcion", "desc_larga"], "codigo"
        )
        assert result is not None
        assert result.where_clause.count("?") == len(result.params)
