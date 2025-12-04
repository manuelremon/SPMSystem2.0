# 📋 Quick Reference - SPM

Referencia rápida para comandos y ubicaciones comunes.

---

## ⚡ Comandos Rápidos

### Desarrollo

```bash
# Ejecutar backend
python .\src\backend\app.py

# Backend + Frontend en dos terminales
# Terminal 1:
$env:PORT = "10000"
python .\src\backend\app.py

# Terminal 2:
cd src\frontend
npm run dev

# Tests backend
pytest tests/

# Tests frontend
cd src\frontend && npm test
```

### Base de datos

```bash
# Verificar BD
python .\scripts\db\check_db.py

# Actualizar BD
python .\scripts\db\update_db.py

# Crear usuario
python .\scripts\db\create_or_reset_user.py
```

### Entorno

```bash
# Crear .venv
python -m venv .venv

# Activar .venv
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt
```

---

## 📁 Estructura Rápida

```
SPM/
├── src/backend/
│   ├── app.py ⭐ (punto entrada)
│   ├── core/ (config, db, init)
│   ├── api/ (endpoints)
│   ├── middleware/ (auth, csrf)
│   ├── models/ (schemas)
│   └── services/ (lógica)
├── src/frontend/
│   ├── pages/ (html)
│   ├── components/
│   ├── utils/
│   └── __tests__/
├── tests/ (tests integración)
├── database/
│   ├── migrations/ (sql)
│   ├── schemas/
│   └── backup/
├── scripts/dev/ (scripts)
└── config/ (configuración)
```

---

## 🔑 Variables de Entorno

```env
PORT=5000
SPM_SECRET_KEY=dev-key
AUTH_BYPASS=1
SPM_ENV=development
```

---

## 🐳 Docker

```bash
# Ejecutar con Docker
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## 📝 Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `src/backend/app.py` | Punto de entrada |
| `src/backend/core/config.py` | Configuración |
| `.env` | Variables (NO subir) |
| `requirements.txt` | Dependencias Python |
| `package.json` | Dependencias Node |
| `STRUCTURE.md` | Estructura completa |
| `README-dev.md` | Guía desarrollo |

---

## 🆘 Help

- **¿Dónde está X archivo?** → Ver `STRUCTURE.md`
- **¿Cómo ejecuto?** → Ver `README-dev.md`
- **Errores de imports** → Verifica rutas en `src/backend/`

---

**v1.0 - 26 oct 2025**
