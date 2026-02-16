# Configuraciones Docker Compose

Este directorio contiene tres configuraciones de Docker Compose para diferentes escenarios de despliegue.

## 📋 Archivos Disponibles

### 1. `docker-compose.yml` (Desarrollo local)
**Uso:** Desarrollo local estándar

**Características:**
- Backend Flask en puerto 5000
- Frontend Vite en modo desarrollo
- PostgreSQL con volumen persistente
- Redis para caché
- Celery worker y beat
- Network bridge para comunicación interna

**Ejecutar:**
```bash
cd infra
docker-compose up -d
```

**URLs:**
- Backend: http://localhost:5000
- Frontend: http://localhost:5173

---

### 2. `docker-compose.ip.yml` (Desarrollo con IP estática)
**Uso:** Desarrollo con acceso desde otros dispositivos en la red local

**Diferencias con `docker-compose.yml`:**
- Configuración de red con IP estática
- Útil para testing cross-device (mobile, tablets)
- Permite acceso desde otros dispositivos en la misma LAN

**Ejecutar:**
```bash
cd infra
docker-compose -f docker-compose.ip.yml up -d
```

**Configurar IP estática:**
1. Editar `docker-compose.ip.yml`
2. Buscar la sección `networks`
3. Ajustar la subnet y gateway según tu red

---

### 3. `docker-compose.prod.yml` (Producción)
**Uso:** Despliegue en producción o staging

**Características:**
- Variables de entorno desde `.env.production`
- Sin volúmenes de código (usa imagen built)
- Frontend en modo build (servido por backend)
- PostgreSQL con configuración de producción
- Redis con persistencia AOF
- Healthchecks habilitados
- Restart policy: `always`
- Security opts habilitados

**Ejecutar:**
```bash
cd infra
docker-compose -f docker-compose.prod.yml up -d
```

**Requisitos previos:**
1. Crear `.env.production` con variables de producción
2. Build de imagen de producción:
   ```bash
   docker build -t spm:latest .
   ```

**Variables críticas en `.env.production`:**
```env
FLASK_ENV=production
DEBUG=0
SECRET_KEY=<secret-key-seguro-min-32-chars>
JWT_SECRET_KEY=<jwt-secret-key-min-32-chars>
DATABASE_URL=postgresql://user:password@postgres:5432/spm
CORS_ORIGINS=https://tu-dominio.com
SENTRY_DSN=<tu-sentry-dsn>
```

---

## 🔧 Comandos Útiles

### Iniciar servicios
```bash
docker-compose up -d                    # Desarrollo
docker-compose -f <archivo> up -d       # Específico
```

### Ver logs
```bash
docker-compose logs -f                  # Todos los servicios
docker-compose logs -f backend          # Solo backend
```

### Detener servicios
```bash
docker-compose down                     # Detener y remover containers
docker-compose down -v                  # Detener y remover volumes
```

### Rebuild
```bash
docker-compose up -d --build            # Rebuild y restart
```

### Ejecutar comandos en containers
```bash
docker-compose exec backend bash        # Shell en backend
docker-compose exec postgres psql -U spm  # PostgreSQL CLI
```

---

## 🗃️ Volúmenes Persistentes

### Desarrollo
- `postgres_data`: Base de datos PostgreSQL
- `redis_data`: Persistencia Redis
- Código mapeado desde host (hot-reload)

### Producción
- `postgres_data_prod`: Base de datos PostgreSQL (producción)
- `redis_data_prod`: Persistencia Redis (producción)
- Sin mapeo de código (usa imagen)

---

## 🌐 Networking

### Bridge Network (docker-compose.yml)
- Network: `spm_network`
- Driver: bridge
- Services se comunican por nombre

### Producción
- Configuración adicional de seguridad
- Exposición limitada de puertos
- Healthchecks para auto-recovery

---

## 📊 Healthchecks

### Backend
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### PostgreSQL
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U spm"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

## 🔐 Seguridad

### Producción (docker-compose.prod.yml)
- ✅ No expone puertos innecesarios
- ✅ Healthchecks habilitados
- ✅ Restart policy configurado
- ✅ Variables de entorno desde archivo
- ✅ No mapea código desde host

### Desarrollo
- ⚠️ Puertos expuestos para debugging
- ⚠️ Código mapeado desde host
- ⚠️ DEBUG=1 habilitado

---

## 📝 Notas

1. **Primera ejecución**: La base de datos se inicializa automáticamente con migraciones
2. **Migrations**: Se ejecutan al iniciar el container backend
3. **Celery Beat**: Requiere un solo worker beat (no escalar)
4. **Redis**: Usado para caché L2 y Celery broker

---

## 🆘 Troubleshooting

### Error: Port already in use
```bash
# Verificar procesos usando el puerto
lsof -ti:5000  # Backend
lsof -ti:5173  # Frontend

# Detener servicios
docker-compose down
```

### Error: Cannot connect to database
```bash
# Verificar que PostgreSQL está corriendo
docker-compose ps postgres

# Ver logs de PostgreSQL
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres
```

### Error: Migrations not applied
```bash
# Ejecutar migraciones manualmente
docker-compose exec backend python -m backend.migrations.runner
```

### Limpiar todo y empezar de nuevo
```bash
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

---

## 📚 Referencias

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [CLAUDE.md](../CLAUDE.md) - Guía completa del proyecto
- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Guía de despliegue
