# ⚡ INICIO RÁPIDO - SPM Frontend

## 🎯 La Solución (En 30 Segundos)

**El problema:** Accedías a `http://localhost:5000/` y veías un placeholder
**La razón:** Deberías acceder a `http://localhost:5173/`
**La solución:** Ya está corregida

---

## 🚀 AHORA: Ejecuta Esto

### Opción 1: Automático (RECOMENDADO)

```powershell
.\start_dev_servers.ps1
```

✅ Inicia todo automáticamente
✅ Abre navegador a `http://localhost:5173`
✅ Backend + Frontend listos

---

### Opción 2: Manual (Si la anterior falla)

**Terminal 1:**
```powershell
python wsgi.py
```

**Terminal 2:**
```powershell
npm run dev
```

**Luego:** Abre `http://localhost:5173` en navegador

---

## ✅ ¿Funciona?

Debería ver:
- ✅ Página de login normal
- ✅ Sin mensaje de "placeholder"
- ✅ Puedes ingresar usuario/contraseña
- ✅ Sin errores en consola (F12)

---

## 📌 Recuerda

| Acceso | URL | Resultado |
|--------|-----|-----------|
| ✅ Correcto | `http://localhost:5173` | Página de login |
| ❌ Incorrecto | `http://localhost:5000` | No funciona bien |

---

## 🆘 Si Aún Falla

```powershell
# Terminal nueva - Limpia e instala de nuevo
npm install
npm run dev
```

Y en otra terminal:
```powershell
python wsgi.py
```

---

**¿Ya funciona? ¡Listo! Puedes seguir trabajando con la app.**
