# Sprint 49: QR/Barcode Scanner + Materiales Favoritos

**Fecha:** 2026-02-15
**Estado:** Completado

## Resumen

Se implementaron dos funcionalidades clave para mejorar la experiencia de usuario en la selección de materiales:

1. **Scanner QR/Códigos de Barras**: Permite escanear códigos usando la cámara del dispositivo
2. **Materiales Favoritos**: Sistema de favoritos para acceso rápido a materiales frecuentes

## Cambios Implementados

### Backend

#### 1. Migración de Base de Datos

**Archivo:** `backend/migrations/043_user_favorites.py`

- Crea tabla `user_material_favorito` con:
  - `id` (PK)
  - `user_id` (TEXT, NOT NULL)
  - `material_codigo` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMP)
  - Constraint UNIQUE(user_id, material_codigo)
- Índices en `user_id` y `material_codigo` para búsquedas rápidas
- Soporte dual SQLite/PostgreSQL

#### 2. Endpoints de Favoritos

**Archivo:** `backend/routes/materiales.py`

Nuevos endpoints:

- `GET /api/materiales/favoritos` - Lista favoritos del usuario con detalles del catálogo
- `POST /api/materiales/favoritos` - Agrega material a favoritos (body: `{material_codigo}`)
- `DELETE /api/materiales/favoritos/<codigo>` - Elimina favorito

**Características:**
- Requieren autenticación (`@require_auth`)
- Validación de ownership (solo los favoritos del usuario)
- Join con `catalogo_materiales` para obtener datos completos
- Manejo de duplicados con `ON CONFLICT DO NOTHING`

### Frontend

#### 1. Componente BarcodeScanner

**Archivo:** `frontend/src/components/materials/BarcodeScanner.jsx`

**Características:**
- Usa la API nativa del navegador `BarcodeDetector` (Chrome/Edge)
- Acceso a cámara con `getUserMedia` (preferencia cámara trasera)
- Soporte de formatos: code_128, code_39, ean_13, ean_8, qr_code, upc_a, upc_e
- Detección automática cada 500ms cuando la cámara está activa
- Fallback a entrada manual si BarcodeDetector no está disponible
- Vista previa de video en aspect ratio 16:9
- Indicador visual de escaneo (borde pulsante verde)
- Control para detener/iniciar cámara
- Cleanup automático al cerrar el modal

**UX:**
- Modal MUI con diseño profesional
- Vista previa de cámara en fondo oscuro
- Input manual con código monospace
- Botones claros para usar código/cancelar

#### 2. Integración en Materials.jsx

**Cambios:**
- Botón "Escanear" junto a "Asistente IA" en SearchSection
- Sección de "Acceso rápido" con chips de favoritos (top 10)
- Los favoritos son clickeables para seleccionar el material
- Icono de estrella en cada chip para eliminar favorito
- Load de favoritos al montar el componente
- Pass de favoritos/toggleFavorito a SearchDropdown

#### 3. SearchDropdown - Estrellas en Resultados

**Archivo:** `frontend/src/components/materials/SearchDropdown.jsx`

**Cambios:**
- Iconos de estrella (StarIcon/StarBorderIcon) junto a cada resultado
- Click en estrella llama a `toggleFavorito(codigo)` sin seleccionar el material
- Estrella dorada (warning.main) si es favorito, gris si no
- Props nuevos: `favoritos`, `toggleFavorito`

#### 4. Hook useMaterials

**Archivo:** `frontend/src/hooks/useMaterials.js`

**Nuevos estados:**
- `showScanner` - control de modal del scanner
- `favoritos` - lista de materiales favoritos
- `loadingFavoritos` - loading state

**Nuevas funciones:**
- `loadFavoritos()` - carga lista desde API
- `toggleFavorito(codigo)` - agrega/elimina favorito con feedback toast
- `setShowScanner` - toggle modal scanner

**Retorno ampliado:**
- Expone `showScanner`, `favoritos`, `loadingFavoritos`, `loadFavoritos`, `toggleFavorito`

#### 5. Servicio API

**Archivo:** `frontend/src/services/spm.js`

Nuevos métodos en `materiales`:
- `getFavoritos()` - GET /materiales/favoritos
- `addFavorito(material_codigo)` - POST /materiales/favoritos
- `removeFavorito(codigo)` - DELETE /materiales/favoritos/:codigo

#### 6. i18n

**Archivo:** `frontend/src/context/i18n.jsx`

**Nuevas claves (prefijo `scanner_`):**
- scanner_title, scanner_scan, scanner_manual_input, scanner_manual_input_only
- scanner_no_camera, scanner_code_placeholder, scanner_use_code
- scanner_hint, scanner_scanning, scanner_stop

**Nuevas claves (prefijo `favorites_`):**
- favorites_title, favorites_add, favorites_remove
- favorites_empty, favorites_added, favorites_removed
- favorites_section

## Flujo de Usuario

### Scanner

1. Usuario hace click en botón "Escanear" en Materials.jsx
2. Se abre modal BarcodeScanner
3. Si BarcodeDetector disponible:
   - Usuario hace click en "Iniciar Escaneo"
   - Se solicita permiso de cámara
   - Vista previa aparece con indicador de escaneo
   - Al detectar código, se cierra modal y se setea en searchCodigo
4. Si no disponible o preferencia manual:
   - Usuario ingresa código manualmente
   - Click en "Usar Código" para aplicarlo

### Favoritos

1. **Agregar:**
   - Usuario busca material
   - En dropdown de resultados, hace click en estrella vacía
   - Estrella se vuelve dorada
   - Toast: "Material agregado a favoritos"

2. **Remover:**
   - En dropdown: click en estrella dorada
   - En sección "Acceso rápido": click en estrella del chip
   - Estrella se vacía / chip desaparece
   - Toast: "Material eliminado de favoritos"

3. **Usar favorito:**
   - Click en chip de favorito en sección "Acceso rápido"
   - Material se selecciona automáticamente

## Tecnologías Usadas

- **BarcodeDetector API** (Chrome 83+, Edge 83+)
- **MediaDevices.getUserMedia** (acceso cámara)
- **MUI Components** (Dialog, IconButton, TextField, Chip)
- **React Hooks** (useState, useEffect, useRef, useCallback)
- **Flask** (backend endpoints)
- **SQLite/PostgreSQL** (almacenamiento favoritos)

## Compatibilidad

### Scanner
- **Soportado:** Chrome 83+, Edge 83+, Opera 69+
- **No soportado:** Firefox, Safari (fallback a input manual)
- **Mobile:** Funciona en Chrome Android, Edge Android

### Favoritos
- **Universal:** Funciona en todos los navegadores modernos
- **Requisito:** Usuario autenticado

## Testing

### Backend
- Migración 043 aplicada exitosamente en SQLite
- Ruff check: 0 errores (auto-fix aplicado)

### Frontend
- Build exitoso (Vite)
- ESLint: 17 warnings pre-existentes (bien debajo del límite 100)
- No hay errores de compilación

## Archivos Modificados

### Backend (4 archivos)
1. `backend/migrations/043_user_favorites.py` (nuevo)
2. `backend/routes/materiales.py` (3 endpoints nuevos)

### Frontend (7 archivos)
1. `frontend/src/components/materials/BarcodeScanner.jsx` (nuevo)
2. `frontend/src/components/materials/index.js` (export BarcodeScanner)
3. `frontend/src/components/materials/SearchDropdown.jsx` (estrellas)
4. `frontend/src/pages/Materials.jsx` (sección favoritos, scanner modal, useEffect)
5. `frontend/src/hooks/useMaterials.js` (favoritos state, loadFavoritos, toggleFavorito)
6. `frontend/src/services/spm.js` (3 métodos API)
7. `frontend/src/context/i18n.jsx` (17 claves nuevas)

## Próximos Pasos (Opcional)

1. **Scanner Mejorado:**
   - Agregar zoom control para códigos pequeños
   - Detección de orientación del código
   - Vibración/sonido al detectar código (mobile)
   - Historial de códigos escaneados

2. **Favoritos Avanzados:**
   - Categorías de favoritos personalizadas
   - Ordenar favoritos por arrastre
   - Notas/etiquetas en favoritos
   - Sincronización entre dispositivos

3. **Analytics:**
   - Tracking de materiales más escaneados
   - Materiales más favoritados (admin dashboard)
   - Tasa de éxito de scanner vs manual

## Notas

- BarcodeScanner usa `createPortal` para evitar conflictos de z-index (no, usa Dialog que ya maneja esto)
- Favoritos persisten en BD, no en localStorage
- Toggle de favorito es inmediato (optimistic update) con rollback en error
- Scanner limpia el stream de cámara automáticamente al desmontar
- Favoritos se cargan una sola vez al montar Materials.jsx
- Max 10 favoritos en sección de acceso rápido (resto accesible desde dropdown)
