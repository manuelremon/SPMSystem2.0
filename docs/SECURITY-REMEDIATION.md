# Remediación de Seguridad - SPMSystem2.0

**Fecha:** 2026-01-23
**Prioridad:** CRÍTICA
**Estado:** Requiere acción inmediata del propietario

---

## Resumen del Problema

Durante la auditoría técnica se identificaron secretos de producción expuestos en el repositorio Git. Aunque el `.gitignore` está correctamente configurado, los archivos fueron commiteados antes de agregar las reglas de exclusión.

### Archivos Comprometidos

| Archivo | Contenido Sensible |
|---------|-------------------|
| `infra/.env.production` | PostgreSQL password, SECRET_KEY, JWT_SECRET_KEY |
| `infra/.env.production.server` | Mismo contenido (duplicado) |
| `.env.staging` | JWT_SECRET_KEY de staging |
| `.env` | Google AI API Key |
| `data/vapid/vapid_private_key.pem` | VAPID private key |

---

## Acciones Requeridas (Orden de Ejecución)

### PASO 1: Revocar Credenciales Externas (INMEDIATO)

#### 1.1 Google AI API Key

```bash
# En Google Cloud Console:
# 1. Ir a https://console.cloud.google.com/apis/credentials
# 2. Encontrar la API key: AIzaSyDXqwJfuSir8vzn1GitaeNhXkMdHz24iK8
# 3. Click "Delete" o "Revoke"
# 4. Crear nueva API key
# 5. Guardar en secrets manager (NO en archivo)
```

#### 1.2 Cambiar Contraseña PostgreSQL

```bash
# En el servidor de producción (<SERVER_IP>):
sudo -u postgres psql

# Ejecutar:
ALTER USER spm WITH PASSWORD 'NUEVA_CONTRASEÑA_SEGURA_AQUI';

# Generar contraseña segura:
openssl rand -base64 32
```

---

### PASO 2: Regenerar Secretos de Aplicación

```bash
# Generar nuevos secretos:
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"

# Actualizar en servidor de producción (NO en Git):
# - Variable de entorno del sistema
# - O secrets manager (recomendado)
```

---

### PASO 3: Regenerar VAPID Keys

```bash
# En servidor de producción:
cd /path/to/app

# Generar nuevas VAPID keys:
npx web-push generate-vapid-keys

# Guardar en variables de entorno (NO en archivos):
export VAPID_PUBLIC_KEY="nueva_clave_publica"
export VAPID_PRIVATE_KEY="nueva_clave_privada"
```

---

### PASO 4: Eliminar Archivos del Tracking de Git

```bash
# Primero, asegurar que .gitignore tiene las reglas (ya está)

# Luego, dejar de trackear los archivos:
git rm --cached infra/.env.production
git rm --cached infra/.env.production.server
git rm --cached .env.staging
git rm --cached .env
git rm --cached data/vapid/vapid_private_key.pem
git rm --cached data/vapid_private_key.pem

# Commit:
git commit -m "security: remove sensitive files from tracking"
```

---

### PASO 5: Limpiar Historial de Git (CRÍTICO)

**ADVERTENCIA:** Este paso reescribe el historial. Todos los colaboradores deberán hacer `git fetch --all && git reset --hard origin/main`.

```bash
# Instalar git-filter-repo (si no está):
pip install git-filter-repo

# Limpiar archivos del historial:
git filter-repo --invert-paths --path infra/.env.production
git filter-repo --invert-paths --path infra/.env.production.server
git filter-repo --invert-paths --path .env.staging
git filter-repo --invert-paths --path .env
git filter-repo --invert-paths --path data/vapid/vapid_private_key.pem
git filter-repo --invert-paths --path data/vapid_private_key.pem

# Push forzado (requiere permisos):
git push origin --force --all
git push origin --force --tags
```

**Alternativa más simple (un solo comando):**

```bash
# Crear archivo con paths a eliminar:
cat > paths-to-remove.txt << EOF
infra/.env.production
infra/.env.production.server
.env.staging
.env
data/vapid/vapid_private_key.pem
data/vapid_private_key.pem
EOF

# Ejecutar limpieza:
git filter-repo --invert-paths --paths-from-file paths-to-remove.txt
```

---

### PASO 6: Configurar Secrets Manager

#### Opción A: GitHub Secrets (para CI/CD)

```bash
# En GitHub Repository Settings > Secrets:
# Agregar:
# - POSTGRES_PASSWORD
# - SECRET_KEY
# - JWT_SECRET_KEY
# - GOOGLE_AI_API_KEY
# - VAPID_PUBLIC_KEY
# - VAPID_PRIVATE_KEY
```

#### Opción B: Azure Key Vault

```bash
# Crear Key Vault:
az keyvault create --name spm-secrets --resource-group spm-rg

# Agregar secretos:
az keyvault secret set --vault-name spm-secrets --name "postgres-password" --value "..."
az keyvault secret set --vault-name spm-secrets --name "secret-key" --value "..."
```

#### Opción C: Variables de Entorno del Sistema

```bash
# En /etc/environment o ~/.bashrc del servidor:
export SPM_SECRET_KEY="..."
export SPM_JWT_SECRET_KEY="..."
export SPM_POSTGRES_PASSWORD="..."
```

---

### PASO 7: Actualizar Aplicación en Producción

```bash
# En servidor de producción:
cd /path/to/app

# Pull cambios:
git fetch origin
git reset --hard origin/main

# Reiniciar servicios:
sudo systemctl restart spm-backend
# O si usa Docker:
docker-compose down && docker-compose up -d
```

---

## Verificación Post-Remediación

### Checklist

- [ ] Google AI API key revocada y regenerada
- [ ] PostgreSQL password cambiado
- [ ] SECRET_KEY regenerado
- [ ] JWT_SECRET_KEY regenerado
- [ ] VAPID keys regeneradas
- [ ] Archivos eliminados del tracking (`git status` limpio)
- [ ] Historial limpiado (`git log` no muestra archivos sensibles)
- [ ] Secrets en manager (no en archivos)
- [ ] Aplicación funciona correctamente
- [ ] Login funciona (JWT nuevo)
- [ ] Push notifications funcionan (VAPID nuevo)

### Comandos de Verificación

```bash
# Verificar que archivos no están trackeados:
git status

# Verificar que no hay secretos en historial:
git log --all --full-history -- infra/.env.production
# (Debería no retornar nada)

# Verificar que aplicación responde:
curl -I https://planifica-materiales.com/api/health

# Verificar rate limiting activo:
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://planifica-materiales.com/api/auth/login -X POST; done
# (Debería ver 429 después de varios intentos)
```

---

## Acciones Ya Implementadas

| Acción | Estado | Archivo |
|--------|--------|---------|
| Remover DISABLE_RATE_LIMIT | ✅ Completado | `infra/.env.production.server` |
| Documentar hallazgos | ✅ Completado | `docs/auditoria-tecnica-2026-01-23.md` |
| Crear guía de remediación | ✅ Completado | Este archivo |

---

## Contacto de Emergencia

Si se detecta actividad sospechosa:

1. Revocar TODAS las API keys inmediatamente
2. Cambiar contraseña PostgreSQL
3. Invalidar todos los JWT (cambiar JWT_SECRET_KEY)
4. Revisar logs de acceso
5. Notificar a usuarios si hubo breach

---

*Documento generado: 2026-01-23 | Auditoría de Seguridad SPMSystem2.0*
