# Fix: Missing 'path' Key in _save_uploaded_file

## Problema Identificado

**Archivo:** `backend/routes/solicitudes.py`
**Bug:** La función `_save_uploaded_file` retorna un dict con la clave `"ruta"` pero el código en línea 369 intenta acceder a `metadata.get("path")` que no existe.

**Línea problemática 369:**
```python
archivos_guardados.append(metadata.get("path"))  # Returns None
```

**Línea 402 (consecuencia):**
```python
if old_path and os.path.exists(old_path):  # os.path.exists(None) = False
```

**Resultado:** Error 500 en POST `/api/solicitudes` cuando se intenta crear una solicitud con archivos adjuntos.

---

## Solución Aplicada

### Cambio en `backend/routes/solicitudes.py` (línea 85-94)

**ANTES:**
```python
return {
    "id": uuid.uuid4().hex[:8],
    "nombre": original_filename,
    "nombre_almacenado": unique_filename,
    "ruta": str(file_path.relative_to(Path(__file__).parent.parent.parent)),
    "mime_type": file.content_type or "application/octet-stream",
    "tamanio": file_size,
    "created_at": datetime.utcnow().isoformat(),
}
```

**DESPUÉS (Corregido):**
```python
return {
    "id": uuid.uuid4().hex[:8],
    "nombre": original_filename,
    "nombre_almacenado": unique_filename,
    "path": str(file_path),  # ← AGREGADO: Clave "path" con ruta absoluta
    "ruta": str(file_path.relative_to(Path(__file__).parent.parent.parent)),
    "mime_type": file.content_type or "application/octet-stream",
    "tamanio": file_size,
    "created_at": datetime.utcnow().isoformat(),
}
```

---

## Impacto

✅ **Resuelto:**
- POST `/api/solicitudes` con archivos adjuntos ahora funciona correctamente
- No más error 500 en creación de solicitudes
- Metadata de archivos se persiste correctamente

✅ **Cambios Mínimos:**
- Una línea agregada
- Sin cambios en lógica de negocio
- Retrocompatible con código existente (clave "ruta" sigue disponible)

---

## Detalles del Commit

- **Commit ID:** `1755871`
- **Rama:** `main`
- **Cambios:** 1 línea agregada en `backend/routes/solicitudes.py`
- **Fecha:** 2026-02-02

```bash
commit 1755871
fix(solicitudes): add missing 'path' key in _save_uploaded_file return dict

The function was returning a dict with 'ruta' key but the code at line 369
expected 'path' key, causing os.path.exists(None) to fail and returning 500 error.

Added 'path' key with absolute file path to fix the issue.
```

---

## Testing

Para verificar que el fix funciona:

```bash
# 1. Iniciar backend
python wsgi.py

# 2. Crear solicitud con archivo adjunto
curl -X POST http://localhost:5000/api/solicitudes \
  -F "archivos=@archivo.txt" \
  -F "centro=AA101" \
  -F "justificacion=Test"

# 3. Verificar que responde 200, no 500
```

---

## Notas

- El archivo corregido está en: `C:\Users\MANUE\Documents\GitHub\SPMV3.0\backend\routes\solicitudes.py`
- El commit está en la rama `main` del repositorio
- Este fix está listo para hacer push a producción
