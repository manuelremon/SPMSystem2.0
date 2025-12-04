# 🔐 GUÍA RÁPIDA - Sistema de Cambios y Backups

## ⚡ Comandos Más Usados

### 1️⃣ Ver estado de cambios
```powershell
.\scripts\dev\cambios.ps1 -accion status
```
**Resultado:** Te muestra qué cambios hay, qué backups disponibles, etc.

---

### 2️⃣ Crear backup antes de empezar

```powershell
# Backup de todos los archivos principales
.\scripts\dev\cambios.ps1 -accion backup

# O de un archivo específico
.\scripts\dev\cambios.ps1 -accion backup -archivo "app.js"
```

**Resultado:** Crea un archivo `app.js.backup-2025-11-08-143022` en `src/frontend/backups/`

---

### 3️⃣ Si algo sale mal: revertir

```powershell
# Revertir al backup más reciente
.\scripts\dev\cambios.ps1 -accion revert -archivo "app.js"

# O a una fecha específica
.\scripts\dev\cambios.ps1 -accion revert -archivo "app.js" -fecha "2025-11-08-143022"
```

**Resultado:** Restaura el archivo a su estado anterior

---

### 4️⃣ Ver backups disponibles

```powershell
.\scripts\dev\cambios.ps1 -accion list-backups
```

**Resultado:**
```
📦 app.js.backup-2025-11-08-143022 | 145,230 bytes | 2025-11-08 14:30:22
📦 index.html.backup-2025-11-08-143022 | 5,421 bytes | 2025-11-08 14:30:22
```

---

### 5️⃣ Ver información de Git

```powershell
.\scripts\dev\cambios.ps1 -accion git-info
```

**Resultado:**
- Últimos 10 commits
- Cambios sin guardar
- Rama actual

---

## 📋 FLUJO COMPLETO DE UN CAMBIO

### Paso 1: Crear backup
```powershell
.\scripts\dev\cambios.ps1 -accion backup
```

### Paso 2: Hacer el cambio
- Edita el archivo que necesites en VS Code

### Paso 3: Validar que funciona
- Prueba en el navegador
- Revisa que no hay errores (F12)

### Paso 4: Documentar cambio
- Abre `docs/history/CAMBIOS_REGISTRO.md`
- Agrega la entrada [CAMBIO-NNN] ✅ COMPLETADO

### Paso 5: Commit a Git
```bash
git add -A
git commit -m "Refactor: [descripción del cambio]"
git push
```

---

## 🚨 SI ALGO SALE MAL

### Opción 1: Revertir rápidamente (local)
```powershell
.\scripts\dev\cambios.ps1 -accion revert -archivo "app.js"
```

### Opción 2: Volver atrás en Git (más seguro)
```bash
# Ver últimos commits
git log --oneline -5

# Revertir el último cambio
git revert HEAD

# O volver a un commit anterior
git reset --hard [COMMIT-ID]
```

### Opción 3: Ver cambios exactos
```bash
# Qué cambió en un archivo
git diff src/frontend/app.js

# Qué cambió en el último commit
git show HEAD:src/frontend/app.js
```

---

## 📝 DOCUMENTACIÓN DE CAMBIOS

Cada cambio va en `docs/history/CAMBIOS_REGISTRO.md` así:

```markdown
## [CAMBIO-001] - 8 de noviembre - ✅ COMPLETADO

**Archivo:** src/frontend/_layout.html
**Tipo:** CREACIÓN
**Descripción:** Crear layout base con navbar persistente
**Líneas afectadas:** N/A (nuevo archivo)

**Qué se hizo:**
- Creé el archivo _layout.html
- Agregué estructura base
- Integré navbar reutilizable

**Validación:**
- ✅ App carga sin errores
- ✅ Navbar visible
- ✅ Links funcionan

**Reversión:**
```powershell
Remove-Item "src/frontend/_layout.html"
```
```

---

## 🔍 MONITOREO

### Checklist después de cada cambio:

```
Funcionalidad:
- [ ] App carga sin errores
- [ ] Console sin errores rojos (F12)
- [ ] Navbar visible y funcional
- [ ] Links funcionan
- [ ] API calls responden

Técnico:
- [ ] Backup creado
- [ ] Cambio documentado en docs/history/CAMBIOS_REGISTRO.md
- [ ] Código validado
- [ ] Listo para commit a Git
```

---

## 💡 TIPS

### Tip 1: Ver cambios en tiempo real
```powershell
# Terminal 1: Backend corriendo
python wsgi.py

# Terminal 2: Frontend corriendo
npm run dev

# Terminal 3: Monitorear cambios
npm run build
```

### Tip 2: Revertir múltiples archivos
```powershell
# Si rompiste varios archivos, revertir todos
.\scripts\dev\cambios.ps1 -accion revert -archivo "app.js"
.\scripts\dev\cambios.ps1 -accion revert -archivo "index.html"
.\scripts\dev\cambios.ps1 -accion revert -archivo "styles.css"
```

### Tip 3: Limpiar backups viejos
```powershell
# Elimina backups más antiguos de 30 días
.\scripts\dev\cambios.ps1 -accion clean-old
```

### Tip 4: Usar Git como "time machine"
```bash
# Ver el estado de un archivo en el commit anterior
git show HEAD~1:src/frontend/app.js

# Comparar con la versión actual
git diff HEAD~1 src/frontend/app.js
```

---

## 🆘 PREGUNTAS FRECUENTES

**P: ¿Puedo perder los cambios?**
R: No. Los cambios se guardan en:
- Backups locales (`.backup-*`)
- Git history (`.git/` folder)
- Tu máquina (el archivo original)

**P: ¿Cuánto espacio ocupan los backups?**
R: Muy poco. Un HTML = ~5KB, un JS = ~150KB

**P: ¿Qué pasa si elimino un backup?**
R: Aún está en Git history. Puedes recuperarlo con `git checkout`.

**P: ¿Necesito estar en la carpeta raíz?**
R: Sí. El script asume que estás en `d:\GitHub\SPMv1.0`

**P: ¿Puedo automatizar los backups?**
R: Sí, usando Task Scheduler en Windows.

---

## 📞 REFERENCIAS

| Necesito... | Comando |
|-------------|---------|
| Ver cambios | `git status` |
| Ver historial | `git log` |
| Deshacer último cambio | `git revert HEAD` |
| Revertir archivo | `.\scripts\dev\cambios.ps1 -accion revert -archivo "app.js"` |
| Crear backup | `.\scripts\dev\cambios.ps1 -accion backup` |
| Ver backups | `.\scripts\dev\cambios.ps1 -accion list-backups` |

---

**Creado:** 8 de noviembre de 2025
**Última actualización:** 8 de noviembre de 2025
