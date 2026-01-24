# Plan de Mejoras - SPMSystem2.0

**Fecha:** 2026-01-23
**Basado en:** Auditoría Técnica Integral

---

## Resumen de Cambios Implementados

### Paquete S1: Seguridad Crítica ✅

| Cambio | Archivo | Estado |
|--------|---------|--------|
| Remover DISABLE_RATE_LIMIT | `infra/.env.production.server` | ✅ Completado |
| Documentar remediación de secretos | `docs/SECURITY-REMEDIATION.md` | ✅ Creado |

### Paquete S2: Backend ✅

| Cambio | Archivo | Estado |
|--------|---------|--------|
| Activar PRAGMA foreign_keys | `backend/core/db.py` | ✅ Completado |
| Corregir bare except handlers | `backend/routes/database.py` | ✅ Completado |
| Agregar whitelist SQL | `backend/routes/equivalencias.py` | ✅ Completado |
| Validar queries en explain | `backend/core/db_optimization.py` | ✅ Completado |

### Paquete S3: Frontend ✅

| Verificación | Estado |
|--------------|--------|
| Logger centralizado existe | ✅ Ya implementado (`utils/logger.js`) |
| ErrorBoundary existe | ✅ Ya implementado con Sentry |
| Console.log silenciados en prod | ✅ Logger lo maneja automáticamente |

### Paquete S4: Thread-Safety ✅

| Cambio | Archivo | Estado |
|--------|---------|--------|
| Lock para cache de respuestas | `backend/routes/vertex_ia.py` | ✅ Completado |
| Lock para verificación de tablas | `backend/routes/vertex_ia.py` | ✅ Completado |
| Documentar limitación multi-worker | `backend/services/temp_data_service.py` | ✅ Completado |

---

## Cambios Pendientes (Por Prioridad)

### Alta Prioridad - Requiere Acción del Usuario

| # | Tarea | Descripción | Referencia |
|---|-------|-------------|------------|
| 1 | Revocar API keys | Revocar y regenerar Google AI API key | Ver `docs/SECURITY-REMEDIATION.md` |
| 2 | Cambiar credenciales BD | Cambiar password PostgreSQL en producción | Ver `docs/SECURITY-REMEDIATION.md` |
| 3 | Limpiar historial Git | Eliminar secretos del historial con git filter-repo | Ver `docs/SECURITY-REMEDIATION.md` |
| 4 | Configurar secrets manager | Mover secretos a GitHub Secrets o Azure Key Vault | Ver `docs/SECURITY-REMEDIATION.md` |

### Media Prioridad - Mejoras de Código

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|------------|----------|
| 1 | Reemplazar print() por logger | 57 archivos backend | 2-3 horas |
| 2 | Eliminar console.log debug | 55 archivos frontend | 2-3 horas |
| 3 | Refactorizar planner.py | `backend/routes/planner.py` (2,453 líneas) | 1 día |
| 4 | Dividir useMaterials.js | `frontend/src/hooks/useMaterials.js` (590 líneas) | 3 horas |
| 5 | Thread-safety completo temp_data | `backend/services/temp_data_service.py` | 4 horas |
| 6 | Migrar temp_data a Redis | `backend/services/temp_data_service.py` | 1 día |

### Baja Prioridad - Limpieza

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|----------|
| 1 | Eliminar imports try/except | 15+ instancias duplicadas | 1 hora |
| 2 | Actualizar dependencias | axios, psycopg2-binary | 30 min |
| 3 | Agregar HEALTHCHECK Docker | `infra/Dockerfile` | 15 min |
| 4 | Migración ON DELETE CASCADE | Nueva migración para notificaciones | 30 min |

---

## Roadmap Sugerido

### Sprint 1 (Inmediato)
- [ ] Usuario ejecuta pasos de `SECURITY-REMEDIATION.md`
- [ ] Verificar que rate limiting funciona en producción
- [ ] Tests pasan después de cambios

### Sprint 2 (1-2 semanas)
- [ ] Reemplazar print() por logger en archivos críticos
- [ ] Actualizar dependencias con vulnerabilidades
- [ ] Agregar HEALTHCHECK a Dockerfile

### Sprint 3 (2-4 semanas)
- [ ] Refactorizar planner.py en módulos
- [ ] Dividir useMaterials.js en hooks más pequeños
- [ ] Completar thread-safety en temp_data_service

### Sprint 4 (1-2 meses)
- [ ] Migrar temp_data a Redis para escalabilidad
- [ ] Agregar tests de data leakage en ML
- [ ] Implementar versionado semántico en model_registry

---

## Verificación de Cambios

### Comandos de Verificación

```bash
# Backend - Tests
pytest tests/ -v

# Frontend - Build y Tests
cd frontend && npm run build && npm test

# Verificar rate limiting activo
curl -s https://planifica-materiales.com/api/auth/login -X POST -d '{}' -H "Content-Type: application/json"
# (Repetir 15+ veces, debería retornar 429)

# Verificar foreign keys en SQLite
python -c "
import sqlite3
conn = sqlite3.connect('data/spm.db')
print(conn.execute('PRAGMA foreign_keys').fetchone())
# Debería retornar (1,)
"
```

### Checklist Pre-Deploy

- [ ] Secretos removidos del código
- [ ] Rate limiting activo (DISABLE_RATE_LIMIT eliminado)
- [ ] Tests backend pasan
- [ ] Build frontend sin errores
- [ ] Foreign keys activas en SQLite
- [ ] Thread-safety implementado en caches

---

## Métricas de Mejora

| Métrica | Antes | Después |
|---------|-------|---------|
| Bare except handlers | 4+ | 0 |
| SQL injection potencial | 3 | 0 |
| Rate limit deshabilitado | Sí | No |
| Foreign keys SQLite | Desactivadas | Activadas |
| Thread-safety caches | No | Sí |
| Secretos en Git | 7 archivos | Documentado para remover |

---

## Documentos Generados

1. `docs/auditoria-tecnica-2026-01-23.md` - Hallazgos completos
2. `docs/plan-mejoras-2026-01-23.md` - Este documento
3. `docs/SECURITY-REMEDIATION.md` - Pasos de remediación de seguridad

---

*Plan generado: 2026-01-23 | Auditoría por Claude Code*
