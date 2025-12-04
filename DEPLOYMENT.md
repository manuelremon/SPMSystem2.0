# 🚀 SPM Deployment Guide

**Versión:** 1.0
**Última actualización:** 1 de noviembre de 2025
**Audiencia:** DevOps, Administradores de Sistemas

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Preparación para Producción](#preparación-para-producción)
3. [Despliegue Local](#despliegue-local)
4. [Despliegue con Docker](#despliegue-con-docker)
5. [Despliegue en Render](#despliegue-en-render)
6. [Despliegue en AWS](#despliegue-en-aws)
7. [Configuración de Base de Datos](#configuración-de-base-de-datos)
8. [SSL/TLS Certificates](#ssltls-certificates)
9. [Monitoreo y Logs](#monitoreo-y-logs)
10. [Backup y Recovery](#backup-y-recovery)
11. [Troubleshooting](#troubleshooting)

---

## 🔧 Requisitos Previos

### Infraestructura Mínima (Producción)
- **CPU:** 2 cores
- **RAM:** 4GB mínimo, 8GB recomendado
- **Almacenamiento:** 20GB disponibles
- **Ancho de banda:** 1Mbps mínimo

### Software Requerido
```bash
# Verificar versiones
python --version          # 3.11+ required
node --version           # 18+ recommended
docker --version         # 24+ for production
docker-compose --version # 2.0+ recommended
```

---

## 🛠️ Preparación para Producción

### 1. Variables de Entorno

Crear `.env.production`:
```bash
# Security
SPM_ENV=production
SPM_DEBUG=0
SPM_SECRET_KEY=<generate-secure-random-key-min-32-chars>

# Database
SPM_DATABASE_URL=postgresql://user:password@prod-db.example.com:5432/spm_prod
SPM_DB_POOL_SIZE=10
SPM_DB_POOL_RECYCLE=3600

# Logging
SPM_LOG_LEVEL=WARNING
SPM_LOG_PATH=/var/log/spm/app.log

# File uploads
SPM_UPLOAD_DIR=/var/spm/uploads
SPM_MAX_UPLOAD_SIZE=52428800  # 50MB

# CORS
CORS_ORIGINS=https://your-domain.com

# JWT
JWT_EXPIRATION_HOURS=24

# Email
SMTP_SERVER=<production-smtp-server>
SMTP_PORT=587
SMTP_USERNAME=<production-email>
SMTP_PASSWORD=<production-password>
SMTP_FROM=noreply@your-domain.com

# Monitoring (Optional)
SENTRY_DSN=https://your-sentry-key@sentry.io/project
DATADOG_API_KEY=<datadog-api-key>
```

### 2. Security Checklist

```bash
# Generar SECRET_KEY segura
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Verificar permisos de archivos
chmod 600 .env.production
chmod 700 /var/spm
chmod 700 /var/spm/uploads
chmod 755 /var/spm/logs

# Verificar no hay datos sensibles en git
git log -p --all | grep -i "password\|secret\|key" || echo "✅ No secrets found"
```

### 3. Dependencias Python

```bash
# Crear ambiente virtual
python -m venv venv_prod
source venv_prod/bin/activate

# Instalar dependencias (sin dev tools)
pip install -r requirements.txt
pip install gunicorn

# Verificar instalación
python -c "from src.backend.app import create_app; app = create_app(); print('✅ App loads successfully')"
```

---

## 🏠 Despliegue Local

### Opción 1: Desarrollo Simple

```bash
# Setup
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run
python src/backend/app.py
npm run dev  # In another terminal
```

### Opción 2: Producción con Gunicorn

```bash
# Install gunicorn
pip install gunicorn

# Create gunicorn config (gunicorn.conf.py)
workers = 4
worker_class = "sync"
bind = "0.0.0.0:5000"
timeout = 120
accesslog = "/var/log/spm/access.log"
errorlog = "/var/log/spm/error.log"
loglevel = "warning"

# Run
gunicorn -c gunicorn.conf.py 'src.backend.app:create_app()'
```

---

## 🐳 Despliegue con Docker

### Build

```bash
docker build -t spm:1.0 .
docker tag spm:1.0 spm:latest
```

### Run Single Container

```bash
docker run -d \
  --name spm-app \
  -p 5000:5000 \
  -e SPM_ENV=production \
  -e SPM_SECRET_KEY="<your-secret>" \
  -v spm-db:/var/spm/db \
  -v spm-uploads:/var/spm/uploads \
  -v spm-logs:/var/spm/logs \
  spm:latest
```

### Docker Compose

```yaml
version: '3.9'

services:
  app:
    build: .
    container_name: spm-app
    ports:
      - "5000:5000"
    environment:
      SPM_ENV: production
      SPM_SECRET_KEY: "${SPM_SECRET_KEY}"
      SPM_DATABASE_URL: postgresql://spm:password@db:5432/spm
    depends_on:
      - db
    volumes:
      - ./logs:/var/spm/logs
      - ./uploads:/var/spm/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    container_name: spm-db
    environment:
      POSTGRES_USER: spm
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
      POSTGRES_DB: spm
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres-data:
```

**Iniciar:**
```bash
docker-compose up -d
docker-compose logs -f
```

---

## 🌐 Despliegue en Render

Ver `docs/RENDER_DEPLOYMENT_FIXES.md`

### Steps Rápidos

1. Conectar repositorio GitHub a Render
2. Crear Web Service:
   - Runtime: Python 3.12
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn 'src.backend.app:create_app()'`
3. Agregar variables de entorno
4. Deploy

```bash
# Verify deployment
curl https://your-app.onrender.com/api/health
```

---

## ☁️ Despliegue en AWS

### Usando Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p python-3.12 spm-app

# Create environment
eb create spm-prod --instance-type t3.medium

# Deploy
eb deploy

# Monitor
eb logs
eb status
```

### Usando ECS + Fargate

```bash
# Push image to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker tag spm:latest <account-id>.dkr.ecr.<region>.amazonaws.com/spm:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/spm:latest

# Deploy via CloudFormation (optional)
# Or use AWS Console to create Fargate task
```

---

## 💾 Configuración de Base de Datos

### SQLite (Desarrollo)

```bash
python -c "from src.backend.models import db; db.create_all()"
```

### PostgreSQL (Producción)

```bash
# Instalar psycopg2
pip install psycopg2-binary

# Create database
createdb -U postgres spm

# Run migrations
python src/backend/models.py  # Or use Alembic if configured
```

### Backup

```bash
# PostgreSQL
pg_dump -U spm -W spm > spm_backup_$(date +%Y%m%d).sql

# Restore
psql -U spm spm < spm_backup_20251101.sql
```

---

## 🔐 SSL/TLS Certificates

### Let's Encrypt (Gratuito)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Usar con Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 Monitoreo y Logs

### Logs

```bash
# Docker
docker-compose logs -f app

# Systemd
sudo journalctl -u spm-app -f

# File
tail -f /var/log/spm/app.log
```

### Health Check

```bash
curl http://localhost:5000/api/health
# Response: {"status": "ok", "timestamp": "..."}
```

### Métricas (Datadog/New Relic)

```python
# En app.py
from datadog import initialize, api

options = {
    'api_key': os.getenv('DATADOG_API_KEY'),
    'app_key': os.getenv('DATADOG_APP_KEY')
}
initialize(**options)
```

---

## 🔄 Backup y Recovery

### Automatizar Backups

```bash
# Cron job
0 2 * * * /home/deploy/backup.sh

# backup.sh
#!/bin/bash
BACKUP_DIR="/backups/spm"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
pg_dump -U spm spm | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
tar czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/spm/uploads

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -mtime +30 -delete

# Upload to S3
aws s3 sync $BACKUP_DIR s3://spm-backups/
```

### Disaster Recovery

```bash
# Restore database
gunzip -c db_20251101_020000.sql.gz | psql -U spm spm

# Restore uploads
tar xzf uploads_20251101_020000.tar.gz -C /
```

---

## 🔧 Troubleshooting

### Problema: App no inicia

```bash
# Check logs
docker-compose logs app

# Common issues:
# 1. PORT already in use
lsof -i :5000
kill -9 <PID>

# 2. Database connection error
# Verify DATABASE_URL in .env

# 3. Missing environment variables
env | grep SPM_
```

### Problema: 502 Bad Gateway

```bash
# Check if app is running
curl http://localhost:5000

# Check system resources
docker stats

# Increase workers/timeout if needed
```

### Problema: Base de datos bloqueada

```bash
# PostgreSQL
psql -U spm -c "SELECT * FROM pg_stat_activity WHERE datname = 'spm';"
psql -U spm -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'spm';"
```

---

## ✅ Pre-Deployment Checklist

- [ ] Variables de entorno configuradas
- [ ] Base de datos migrada
- [ ] SSL/TLS certificados válidos
- [ ] Backups configurados
- [ ] Monitoreo activado
- [ ] Health checks funcionando
- [ ] Logs configurados
- [ ] CORS configurado correctamente
- [ ] Archivos sensibles (.env) en .gitignore
- [ ] Tests pasados en CI/CD

---

## 📞 Soporte

Para problemas de despliegue:
1. Revisar logs: `docker-compose logs app`
2. Consultar [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. Abrir issue en GitHub con detalles

---

**Última revisión:** 1 de noviembre de 2025
