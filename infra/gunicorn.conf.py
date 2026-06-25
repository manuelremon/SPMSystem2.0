# SPM v3.0 - Gunicorn Configuration
# https://docs.gunicorn.org/en/stable/settings.html

import multiprocessing
import os

# ==============================================================================
# Server Socket
# ==============================================================================
bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:5000")

# ==============================================================================
# Worker Processes
# ==============================================================================
# Cantidad de workers: 2-4 x núcleos CPU es una buena regla general
# Para una VPS pequeña con 2 cores, 4 workers es razonable
workers = int(os.environ.get("GUNICORN_WORKERS", 4))

# Threads por worker: útil para I/O-bound apps con bases de datos
threads = int(os.environ.get("GUNICORN_THREADS", 4))

# Tipo de worker: gthread para soporte de threads
worker_class = "gthread"

# Timeout para workers (segundos)
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 300))

# Graceful timeout para shutdown
graceful_timeout = 30

# Máximo de requests antes de reiniciar worker (previene memory leaks)
max_requests = 1000
max_requests_jitter = 50  # Jitter para evitar restart simultáneo

# ==============================================================================
# Logging
# ==============================================================================
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")

# Formato de access log
access_log_format = '%(h)s - %(u)s [%(t)s] "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s'

# ==============================================================================
# Server Mechanics
# ==============================================================================
# Preload app para compartir código entre workers (ahorra memoria).
# True: el master importa la app y carga el modelo de búsqueda semántica UNA vez;
# los workers lo heredan por copy-on-write. Evita que los N workers carguen el
# modelo en paralelo desde disco al arrancar (saturaba I/O y colgaba /health en
# la VPS pequeña). El hook post_fork recrea el pool PostgreSQL en cada worker,
# por lo que preload es seguro (no se comparten conexiones entre procesos).
preload_app = True

# PID file (opcional)
# pidfile = "/tmp/gunicorn.pid"

# Daemon mode (False para Docker)
daemon = False

# ==============================================================================
# Security
# ==============================================================================
# Límite de tamaño de request (en bytes)
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# ==============================================================================
# Server Hooks
# ==============================================================================


def post_fork(server, worker):
    """
    Hook ejecutado después de que un worker es forked.

    Importante: Reinicializar el pool de conexiones PostgreSQL para
    evitar compartir conexiones entre procesos (causa corruption).
    """
    import logging
    logger = logging.getLogger("gunicorn.worker")

    try:
        from backend.core.db import reset_pg_pool, _init_pg_pool

        # Cerrar pool heredado del proceso padre
        reset_pg_pool()

        # Inicializar pool fresco para este worker
        _init_pg_pool()

        logger.info(f"Worker {worker.pid}: Pool PostgreSQL reinicializado")

    except Exception as e:
        logger.error(f"Worker {worker.pid}: Error reinicializando pool: {e}")


def worker_exit(server, worker):
    """
    Hook ejecutado cuando un worker termina.

    Cerrar conexiones de BD limpiamente.
    """
    import logging
    logger = logging.getLogger("gunicorn.worker")

    try:
        from backend.core.db import close_pg_pool

        close_pg_pool()
        logger.info(f"Worker {worker.pid}: Pool PostgreSQL cerrado")

    except Exception as e:
        logger.warning(f"Worker {worker.pid}: Error cerrando pool: {e}")


def on_starting(server):
    """
    Hook ejecutado al iniciar el servidor.
    """
    import logging
    logger = logging.getLogger("gunicorn.server")
    logger.info("SPM v3.0 Backend iniciando...")


def on_exit(server):
    """
    Hook ejecutado al cerrar el servidor.
    """
    import logging
    logger = logging.getLogger("gunicorn.server")
    logger.info("SPM v3.0 Backend terminando...")
