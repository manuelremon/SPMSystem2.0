"""
Module Service - Manages system module enable/disable state.
"""

import logging
from datetime import datetime, timezone

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)

CORE_MODULES = {"solicitudes", "admin"}


def get_modules():
    """Return all system modules ordered by display_order."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT module_key, label_key, label_fallback, icon, description,
                   enabled, is_core, display_order
            FROM system_modules
            ORDER BY display_order
        """)
        rows = cursor.fetchall()

    modules = []
    for row in rows:
        modules.append({
            "module_key": row["module_key"],
            "label_key": row["label_key"],
            "label_fallback": row["label_fallback"],
            "icon": row["icon"],
            "description": row["description"],
            "enabled": bool(row["enabled"]),
            "is_core": bool(row["is_core"]),
            "display_order": row["display_order"],
        })
    return modules


def update_modules(modules_data):
    """
    Update enabled state for modules.
    Args:
        modules_data: list of {"module_key": str, "enabled": bool}
    Returns:
        list of updated modules
    Raises:
        ValueError if trying to disable a core module
    """
    # Validate: core modules cannot be disabled
    for item in modules_data:
        if item.get("module_key") in CORE_MODULES and not item.get("enabled", True):
            raise ValueError(
                f"El modulo '{item['module_key']}' es obligatorio y no puede deshabilitarse"
            )

    placeholder = "%s" if is_using_postgresql() else "?"
    now = datetime.now(timezone.utc)

    with get_db_transaction() as (conn, cursor):
        for item in modules_data:
            cursor.execute(f"""
                UPDATE system_modules
                SET enabled = {placeholder}, updated_at = {placeholder}
                WHERE module_key = {placeholder}
            """, (item["enabled"], now, item["module_key"]))

        conn.commit()

    return get_modules()
