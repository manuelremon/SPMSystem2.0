# Validacion de Correcciones - Auditoria SPM 2.0

**Fecha:** 2026-01-02
**Prerequisitos:** Acceso SSH al servidor, curl instalado

---

## P0-1: Security Headers

### Verificacion Local (post-deploy)
```bash
# Headers en pagina principal
curl -sI https://planifica-materiales.com/ | grep -iE "x-frame|x-content|x-xss|referrer|permissions"

# Resultado esperado:
# x-frame-options: DENY
# x-content-type-options: nosniff
# x-xss-protection: 1; mode=block
# referrer-policy: strict-origin-when-cross-origin
# permissions-policy: camera=(), microphone=(), geolocation=()
```

### Headers en archivos estaticos
```bash
curl -sI https://planifica-materiales.com/assets/index-*.js | grep -iE "x-frame|cache"
# Debe mostrar Cache-Control y X-Frame-Options
```

---

## P0-2: Rate Limiting

### Verificacion en servidor
```bash
ssh ubuntu@<SERVER_IP>
grep "DISABLE_RATE_LIMIT" /home/ubuntu/SPMv2.0/.env
# Debe mostrar: DISABLE_RATE_LIMIT=0 (o no existir)
```

### Test de rate limiting
```bash
# Hacer 15 requests rapidos a login
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://planifica-materiales.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}';
done
# Ultimos requests deben dar 429
```

---

## P0-3: Secretos en .gitignore

### Verificacion
```bash
grep -E "\.env\.production|\.env\.staging" .gitignore
# Debe mostrar:
# infra/.env.production
# infra/.env.production.server
# infra/.env.staging
# infra/.env
```

### Verificar que no hay secretos en git
```bash
git ls-files | grep -E "\.env\.(production|staging)"
# No debe mostrar ningun archivo
```

---

## P0-4: robots.txt y sitemap.xml

### Verificacion
```bash
curl -s https://planifica-materiales.com/robots.txt
# Debe mostrar contenido del robots.txt

curl -s https://planifica-materiales.com/sitemap.xml
# Debe mostrar XML del sitemap
```

---

## P1-1: SEO Dinamico

### Verificacion en navegador
1. Abrir https://planifica-materiales.com/
2. Ir a Dashboard
3. Verificar que el titulo de la pagina cambia a "Dashboard | SPM"
4. Inspeccionar `<head>` para ver meta tags

### Verificacion con curl
```bash
curl -s https://planifica-materiales.com/ | grep -oP '<title>.*?</title>'
# Debe mostrar titulo dinamico despues de hydration (renderizado client-side)
```

---

## P1-2: Accesibilidad Modal

### Verificacion manual
1. Abrir cualquier modal (ej: crear solicitud)
2. Presionar Tab repetidamente
3. El foco debe quedarse dentro del modal (focus trap)
4. Presionar Escape debe cerrar el modal

### Verificacion de codigo
```bash
grep -n "aria-modal\|role=\"dialog\"" frontend/src/components/ui/Modal.jsx
# Debe encontrar atributos de accesibilidad
```

---

## P1-3: Print Statements

### Verificacion
```bash
grep -rn "^\s*print(" backend/ --include="*.py" | grep -v "migrations/" | grep -v "scripts/"
# No debe mostrar resultados
```

---

## P1-6: Cache CSRF

### Verificacion de codigo
```bash
grep -A 10 "CSRF_EXPIRY" frontend/src/services/csrf.js
# Debe mostrar logica de cache con localStorage
```

---

## P2-6: Dependencias

### Frontend
```bash
cd frontend && npm audit
# Vulnerabilidades deben ser solo en devDependencies
```

### Backend
```bash
# Verificar versiones actualizadas
grep -E "Flask|PyJWT|Werkzeug" backend/requirements.txt
# Flask>=3.1.0, PyJWT>=2.10.0, Werkzeug>=3.1.0
```

---

## Checklist Completo

- [ ] P0-1: Security headers visibles con curl
- [ ] P0-2: Rate limiting activo (429 despues de 10 intentos)
- [ ] P0-3: No hay secretos en git
- [ ] P0-4: robots.txt y sitemap.xml accesibles
- [ ] P1-1: SEO component integrado en Dashboard
- [ ] P1-2: Modal tiene focus trap
- [ ] P1-3: Sin print() en codigo de produccion
- [ ] P1-6: CSRF token cacheado
- [ ] P2-6: Dependencias auditadas

---

## Comandos de Deploy

### Desplegar cambios
```bash
# Desde maquina local
./scripts/deploy-full.sh

# O manualmente
git add -A
git commit -m "fix: auditoria integral - security headers, SEO, logs"
git push origin main
ssh ubuntu@<SERVER_IP> "cd /home/ubuntu/SPMv2.0 && git pull && docker-compose up -d --build"
```

### Verificar deploy
```bash
curl -s https://planifica-materiales.com/api/health
# Debe retornar {"status": "ok"}
```
