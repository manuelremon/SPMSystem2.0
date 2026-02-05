#!/usr/bin/env python
"""
Script para indexar materiales en el sistema RAG.

Indexa los materiales del catálogo en ChromaDB para búsqueda semántica.
Ejecutar una vez después de deploy o cuando se actualice el catálogo.

Uso:
    python scripts/index_rag.py
    python scripts/index_rag.py --force  # Reindexar todo aunque ya existan datos
    python scripts/index_rag.py --check  # Solo verificar estado actual
"""

import argparse
import sys
from pathlib import Path

# Agregar backend al path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))


def check_database():
    """Verifica que la base de datos del catálogo existe."""
    db_path = ROOT_DIR / "data" / "catalogo_materiales.db"
    if not db_path.exists():
        print(f"ERROR: Base de datos no encontrada: {db_path}")
        return False

    import sqlite3
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM materiales WHERE activo = 1")
    count = cur.fetchone()[0]
    conn.close()

    print(f"Base de datos encontrada: {count:,} materiales activos")
    return count > 0


def check_rag_status():
    """Verifica el estado actual del sistema RAG."""
    try:
        from backend.agent.rag.material_retriever import get_material_retriever
        retriever = get_material_retriever()
        stats = retriever.get_stats()

        print(f"Materiales indexados: {stats.get('indexed_count', 0):,}")
        print(f"Colección: {stats.get('collection', 'N/A')}")
        print(f"Estado indexado: {'Sí' if stats.get('is_indexed') else 'No'}")

        return stats

    except Exception as e:
        print(f"ERROR verificando RAG: {e}")
        return None


def run_indexation(force: bool = False):
    """Ejecuta la indexación de materiales."""
    try:
        from backend.agent.rag.material_retriever import get_material_retriever

        print("\nIniciando indexación...")
        retriever = get_material_retriever()

        result = retriever.index_from_catalogo(force_reindex=force)

        if result["status"] == "success":
            print(f"\nIndexación exitosa: {result['indexed']:,} materiales")
        elif result["status"] == "skipped":
            print(f"\nIndexación omitida: ya hay {result['indexed']:,} materiales")
            print(f"Razón: {result.get('reason', 'N/A')}")
            print("Usá --force para reindexar")
        else:
            print(f"\nError en indexación: {result.get('reason', 'desconocido')}")

        return result

    except Exception as e:
        print(f"ERROR durante indexación: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "reason": str(e)}


def test_search(query: str = "bomba de agua"):
    """Prueba una búsqueda para verificar que funciona."""
    try:
        from backend.agent.rag.material_retriever import get_material_retriever

        print(f"\nProbando búsqueda: '{query}'")
        retriever = get_material_retriever()

        results = retriever.search(query, n_results=3)

        if results:
            print(f"Encontrados {len(results)} resultados:")
            for r in results:
                print(f"  - {r['codigo']}: {r['descripcion'][:60]}... (score: {r.get('match_percent', 0)}%)")
        else:
            print("No se encontraron resultados")

        return results

    except Exception as e:
        print(f"ERROR en búsqueda: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(
        description='Indexar materiales en el sistema RAG',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python scripts/index_rag.py           # Indexar si no hay datos
  python scripts/index_rag.py --force   # Reindexar todo
  python scripts/index_rag.py --check   # Solo verificar estado
  python scripts/index_rag.py --test    # Verificar y probar búsqueda
        """
    )
    parser.add_argument('--force', action='store_true',
                        help='Forzar reindexación completa')
    parser.add_argument('--check', action='store_true',
                        help='Solo verificar estado actual')
    parser.add_argument('--test', action='store_true',
                        help='Probar búsqueda después de indexar')
    parser.add_argument('--query', type=str, default='bomba de agua',
                        help='Query para prueba de búsqueda (default: bomba de agua)')
    args = parser.parse_args()

    print("=" * 60)
    print("SISTEMA RAG - INDEXACIÓN DE MATERIALES")
    print("=" * 60)

    # 1. Verificar base de datos
    print("\n1. Verificando base de datos del catálogo...")
    if not check_database():
        sys.exit(1)

    # 2. Verificar estado RAG actual
    print("\n2. Verificando estado del sistema RAG...")
    stats = check_rag_status()

    # Si solo check, terminar
    if args.check:
        print("\n" + "=" * 60)
        print("VERIFICACIÓN COMPLETADA")
        print("=" * 60)
        sys.exit(0)

    # 3. Ejecutar indexación
    print("\n3. Indexación de materiales...")
    result = run_indexation(force=args.force)

    if result["status"] == "error":
        sys.exit(1)

    # 4. Verificación final
    print("\n4. Verificación final...")
    final_stats = check_rag_status()

    # 5. Test opcional
    if args.test:
        print("\n5. Prueba de búsqueda...")
        test_search(args.query)

    print("\n" + "=" * 60)
    print("PROCESO COMPLETADO")
    print("=" * 60)


if __name__ == "__main__":
    main()
