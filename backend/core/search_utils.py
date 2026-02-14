"""
Utilidades compartidas para búsqueda por descripción de materiales.

Provee búsqueda case-insensitive, accent-insensitive y multi-palabra
compatible con SQLite y PostgreSQL.
"""

import logging
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Resultado de build_description_search."""

    where_clause: str
    params: list
    order_expr: str | None = None
    order_params: list | None = None


def strip_accents(text: str) -> str:
    """Remove accents from text. 'válvula' → 'valvula', 'TUBERÍA' → 'TUBERIA'."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_search_term(term: str) -> str:
    """Strip accents + uppercase + strip whitespace."""
    return strip_accents(term.strip()).upper()


def build_description_search(
    search_term: str,
    columns: list[str],
    *,
    require_all_words: bool = True,
    include_ranking: bool = False,
    min_term_length: int = 2,
) -> SearchResult | None:
    """
    Build WHERE clause + params for description search.

    Features:
    - Case-insensitive via UPPER()
    - Accent-insensitive via strip_accents() on search term
    - Multi-word: "bomba centrifuga" → each word must match (AND)
    - Optional ranking: exact match in first column > other columns
    - Compatible with SQLite and PostgreSQL

    Args:
        search_term: Raw user input
        columns: List of SQL column expressions to search in
        require_all_words: If True, all words must match (AND); else OR
        include_ranking: If True, generate order_expr for relevance sorting
        min_term_length: Minimum word length to include in search

    Returns:
        SearchResult with where_clause, params, and optional order_expr,
        or None if search_term is empty or all words are too short.
    """
    if not search_term or not search_term.strip() or not columns:
        return None

    normalized = normalize_search_term(search_term)
    words = [w for w in normalized.split() if len(w) >= min_term_length]

    if not words:
        return None

    joiner = " AND " if require_all_words else " OR "

    word_clauses = []
    params = []

    for word in words:
        col_conditions = []
        for col in columns:
            col_conditions.append(f"UPPER({col}) LIKE ?")
            params.append(f"%{word}%")
        word_clauses.append("(" + " OR ".join(col_conditions) + ")")

    where_clause = joiner.join(word_clauses)

    # Wrap in parens if multiple words to keep precedence correct
    if len(word_clauses) > 1:
        where_clause = "(" + where_clause + ")"

    order_expr = None
    order_params = None

    if include_ranking and columns:
        # Ranking: +3 for exact match in first col, +2 starts-with, +1 contains per word
        ranking_parts = []
        order_params = []

        for word in words:
            first_col = columns[0]
            # Exact word match in first column (highest relevance)
            ranking_parts.append(f"(CASE WHEN UPPER({first_col}) LIKE ? THEN 3 ELSE 0 END)")
            order_params.append(f"%{word}%")

            # Additional columns get lower score
            for col in columns[1:]:
                ranking_parts.append(f"(CASE WHEN UPPER({col}) LIKE ? THEN 1 ELSE 0 END)")
                order_params.append(f"%{word}%")

        order_expr = " + ".join(ranking_parts) if ranking_parts else None

    return SearchResult(
        where_clause=where_clause,
        params=params,
        order_expr=order_expr,
        order_params=order_params,
    )


def expand_codes_from_catalog(
    search_term: str,
    *,
    limit: int = 50,
    min_term_length: int = 2,
    min_words: int = 2,
) -> list[str]:
    """
    Search catalogo_materiales.descripcion_larga for material codes
    that would NOT be found by a direct search on ``descripcion``.

    This finds "hidden" matches — materials whose short description doesn't
    contain the search term but whose long description does.

    Only activates when the search has >= ``min_words`` qualifying words,
    because single-word searches on descripcion_larga are too broad
    (e.g. "bomba" matches 5000+ rows).

    Returns a list of material codes (strings), empty if nothing found.
    """
    normalized = normalize_search_term(search_term) if search_term else ""
    words = [w for w in normalized.split() if len(w) >= min_term_length]

    if len(words) < min_words:
        return []

    search_long = build_description_search(
        search_term,
        ["descripcion_larga"],
        min_term_length=min_term_length,
    )
    if not search_long:
        return []

    # Also build filter for descripcion (to EXCLUDE already-matching rows)
    search_short = build_description_search(
        search_term,
        ["descripcion"],
        min_term_length=min_term_length,
    )

    try:
        from backend.core.db import get_db_connection

        db = "master_materiales"
        tabla = "catalogo_materiales"
        col_id = "codigo"

        # Find codes where descripcion_larga matches but descripcion does NOT
        exclude_clause = ""
        all_params = list(search_long.params)
        if search_short:
            exclude_clause = f" AND NOT ({search_short.where_clause})"
            all_params.extend(search_short.params)
        all_params.append(limit)

        with get_db_connection(db) as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT DISTINCT {col_id} FROM {tabla}"
                f" WHERE {search_long.where_clause}{exclude_clause}"
                f" LIMIT ?",
                all_params,
            )
            return [row[0] for row in cur.fetchall() if row[0]]
    except Exception as e:
        logger.debug(f"expand_codes_from_catalog failed: {e}")
        return []


def build_description_search_with_catalog(
    search_term: str,
    desc_columns: list[str],
    material_code_column: str,
    *,
    require_all_words: bool = True,
    min_term_length: int = 2,
) -> SearchResult | None:
    """
    Like build_description_search but also matches via catalogo_materiales.descripcion_larga.

    Combines:
    1. Direct LIKE search on desc_columns (same table)
    2. material_code_column IN (...codes from catalog descripcion_larga...)

    This is useful for tables like stock, materiales_bbdd, consumo_historico
    that don't have their own descripcion_larga column.

    Returns a single SearchResult whose where_clause is the OR of both conditions,
    or None if search_term yields nothing.
    """
    direct = build_description_search(
        search_term,
        desc_columns,
        require_all_words=require_all_words,
        min_term_length=min_term_length,
    )

    catalog_codes = expand_codes_from_catalog(
        search_term, min_term_length=min_term_length
    )

    if not direct and not catalog_codes:
        return None

    parts = []
    params = []

    if direct:
        parts.append(direct.where_clause)
        params.extend(direct.params)

    if catalog_codes:
        placeholders = ", ".join("?" for _ in catalog_codes)
        parts.append(f"{material_code_column} IN ({placeholders})")
        params.extend(catalog_codes)

    where_clause = " OR ".join(parts)
    if len(parts) > 1:
        where_clause = f"({where_clause})"

    return SearchResult(where_clause=where_clause, params=params)
