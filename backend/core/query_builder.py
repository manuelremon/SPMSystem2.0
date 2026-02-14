from sqlalchemy import Table, MetaData, Column, Integer, String, Boolean, DateTime, Text, select, text, and_, or_, union
from sqlalchemy.sql import selectable
from typing import List, Any, Dict, Optional, Union

# Metadata container
metadata = MetaData()

# Define tables explicitly for Core usage (partial definition focused on what we need)
dashboard_table = Table(
    'dashboard', metadata,
    Column('id', Integer, primary_key=True),
    Column('uuid', String),
    Column('nombre', String),
    Column('descripcion', String),
    Column('owner_id', String),
    Column('grupo_id', Integer),
    Column('es_publico', Integer), # SQLite uses Integer for boolean often, or Check constraint
    Column('es_favorito', Integer),
    Column('tipo', String),
    Column('icono', String),
    Column('color', String),
    Column('config', Text),
    Column('created_at', String),
    Column('updated_at', String),
    Column('version', Integer)
)

dashboard_grupo_table = Table(
    'dashboard_grupo', metadata,
    Column('id', Integer, primary_key=True),
    Column('nombre', String),
    Column('descripcion', String),
    Column('owner_id', String),
    Column('es_publico', Integer),
    Column('icono', String),
    Column('color', String),
    Column('orden', Integer)
)

dashboard_permiso_table = Table(
    'dashboard_permiso', metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer),
    Column('usuario_id', String),
    Column('permiso', String)
)

class QueryBuilder:
    """
    Wrapper and utilities for SQLAlchemy Core queries.
    """
    
    @staticmethod
    def get_dashboard_list_query(owner_id: str, grupo_id: Optional[int] = None, include_shared: bool = True):
        """
        Builds the complex UNION query for listing dashboards.
        """
        # Alias for cleaner SQL usage if needed, but simple tables work here
        d = dashboard_table
        g = dashboard_grupo_table
        p = dashboard_permiso_table
        
        # Columns to select (d.* plus group name)
        # Note: SQLAlchemy select(d) selects all columns of d. 
        # We also want g.nombre.
        cols = [d] + [g.c.nombre.label("grupo_nombre")]
        
        # Helper to join group
        def base_select():
             return select(*cols).select_from(d.outerjoin(g, d.c.grupo_id == g.c.id))

        # 1. Own dashboards
        q1 = base_select().where(d.c.owner_id == owner_id)
        if grupo_id is not None:
            q1 = q1.where(d.c.grupo_id == grupo_id)

        queries = [q1]

        if include_shared:
            # 2. Public dashboards
            q2 = base_select().where(d.c.es_publico == 1)
            if grupo_id is not None:
                q2 = q2.where(d.c.grupo_id == grupo_id)
            queries.append(q2)
            
            # 3. Shared via permissions
            # Join permissions table
            q3 = select(*cols).select_from(
                d.outerjoin(g, d.c.grupo_id == g.c.id)
                 .join(p, d.c.id == p.c.dashboard_id)
            ).where(p.c.usuario_id == owner_id)
            
            if grupo_id is not None:
                q3 = q3.where(d.c.grupo_id == grupo_id)
            queries.append(q3)

        # Union all
        if len(queries) > 1:
            final_q = union(*queries)
        else:
            final_q = queries[0]
            
        # Order by updated_at DESC
        # Note: union creates a compound select, we need to order the result
        final_q = final_q.order_by(d.c.updated_at.desc())
        
        # Compile with literal binds NOT enabled because we want parameters
        return final_q

