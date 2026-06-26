from sqlalchemy.dialects import postgresql, sqlite

from backend.core.query_builder import QueryBuilder


def test_generation():
    print("Testing QueryBuilder SQL Generation...")
    
    # Test parameters
    owner_id = "user123"
    grupo_id = 5
    
    # 1. SQLite Generation
    print("\n[SQLite]")
    try:
        query = QueryBuilder.get_dashboard_list_query(owner_id, grupo_id, include_shared=True)
        compiled = query.compile(dialect=sqlite.dialect())
        print("SQL:", compiled)
        print("Params:", compiled.params)
    except Exception as e:
        print(f"SQLite Error: {e}")
        
    # 2. Postgres Generation
    print("\n[PostgreSQL]")
    try:
        query = QueryBuilder.get_dashboard_list_query(owner_id, grupo_id, include_shared=True)
        compiled = query.compile(dialect=postgresql.dialect())
        print("SQL:", compiled)
        print("Params:", compiled.params)
    except Exception as e:
        print(f"Postgres Error: {e}")

if __name__ == "__main__":
    test_generation()
