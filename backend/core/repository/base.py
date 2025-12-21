"""
Repository Base Module
Shared utilities and connection helpers for all repositories
Sprint: Technical Audit - Phase 3
"""

import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Import with relative path handling
try:
    from backend.core.config import settings
    from backend.core.db import is_using_postgresql, _get_postgres_connection
except ImportError:
    from core.config import settings
    from core.db import is_using_postgresql, _get_postgres_connection


def _db_path() -> Path:
    """Get path to main database from configuration"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    # For PostgreSQL, return path to data directory for secondary DBs
    return Path("data/spm.db")


def _connect():
    """Create connection to main database with row factory enabled

    Returns PostgreSQL connection when configured, SQLite otherwise.
    Both return dict-like rows for compatibility.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _connect_catalogo() -> sqlite3.Connection:
    """Create connection to materials catalog database"""
    catalogo_path = _db_path().parent / "catalogo_materiales.db"
    conn = sqlite3.connect(catalogo_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_equivalentes() -> sqlite3.Connection:
    """Create connection to equivalents database"""
    equiv_path = _db_path().parent / "equivalentes.db"
    conn = sqlite3.connect(equiv_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_sap_data() -> sqlite3.Connection:
    """Create connection to SAP data database"""
    sap_path = _db_path().parent / "sap_data.db"
    conn = sqlite3.connect(sap_path)
    conn.row_factory = sqlite3.Row
    return conn
