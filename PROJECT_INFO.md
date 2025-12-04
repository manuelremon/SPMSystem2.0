# Proyecto: SPM - Sistema de Solicitudes de Materiales

## 1. Descripción rápida
Sistema web empresarial para gestionar solicitudes de materiales con flujos de aprobación.
Objetivo principal: Automatizar el proceso de solicitud, aprobación y seguimiento de materiales en una organización.

## 2. Tech stack
- **Lenguaje principal**: Python 3.11+ (backend), JavaScript ES2023+ (frontend)
- **Framework backend**: Flask 3.1.2
- **Framework frontend**: React + Vite 5.4.21
- **Base de datos**: SQLite (spm.db)
- **Testing**: pytest (backend), Jest (frontend)
- **Validación**: Pydantic 2.12.3
- **Autenticación**: JWT (PyJWT 2.10.1)
- **Estilos**: Tailwind CSS + CSS Variables
- **i18n**: Implementación custom con React Context

### 2.1. Detalles frontend

#### Internacionalización (i18n)
- **Librería**: Custom React Context (NO react-i18next)
- **Ubicación**: `frontend/src/context/i18n.jsx`
- **API**: `t(key, fallback)` y `setLang(lang)`
- **Idiomas**: es (español), en (inglés)
- **Convención de claves**: `prefijo_nombre` en snake_case
  - Ejemplos: `nav_solicitudes`, `dash_totales`, `materials_buscar`
  - Prefijos comunes: `nav_`, `dash_`, `common_`, `materials_`, `admin_`

#### Sistema de diseño
- **Filosofía**: Linear Dark SAAS (estilo TensorStax)
- **Tailwind config**: `frontend/tailwind.config.js`
- **CSS Variables**: `frontend/src/index.css`
- **Variables principales**:
  - `--bg`, `--surface`, `--card` (fondos)
  - `--fg`, `--fg-muted`, `--fg-subtle` (textos)
  - `--primary` (naranja #FB923C)
  - `--accent` (cyan #22D3EE)
  - `--success`, `--warning`, `--danger`, `--info` (estados)
- **Regla**: Preferir clases Tailwind + variables CSS antes que estilos en línea

## 3. Estructura de carpetas importante
```
SPMv2.0/
├── backend_v2/           -> Código del servidor Flask
│   ├── routes/           -> Endpoints de API
│   ├── services/         -> Lógica de negocio
│   ├── models/           -> Esquemas Pydantic
│   └── core/             -> Configuración y BD
├── frontend/             -> Aplicación React
│   ├── src/
│   │   ├── pages/        -> Páginas principales
│   │   ├── components/   -> Componentes reutilizables
│   │   ├── context/      -> Context providers (auth, i18n)
│   │   └── lib/          -> Utilidades y helpers
├── tests/                -> Tests automatizados
├── config/               -> Configuración
├── docs/                 -> Documentación
└── scripts/              -> Scripts de desarrollo
```

## 4. Reglas de negocio clave
- **Flujo de estados**: draft -> submitted -> approved/rejected -> processing -> dispatched -> closed
- **Roles**: admin (todo), coordinador (aprobar/rechazar), usuario (crear solicitudes), planner (planificar)
- **Solicitudes**: Mínimo 1 item con cantidad > 0, asociadas a un centro y sector
- **Presupuesto**: Se valida saldo disponible por centro/sector antes de aprobar
- **Materiales**: Código SAP único, precio en USD, asociados a centro/sector
- **Autenticación**: JWT con access token (1h) y refresh token
- **Notificaciones**: Se crean automáticamente al cambiar estado de solicitud

## 5. Estilo de código y convenciones
- **Comentarios y nombres**: Español para UI/textos visibles, inglés para código
- **Variables JS/Python**: camelCase (JS), snake_case (Python)
- **Componentes React**: PascalCase
- **Linter/formateador**: No configurado actualmente
- **Preferencias**:
  - Evitar funciones muy largas
  - Dividir lógica en funciones pequeñas y testeables
  - Mantener DRY (no repetir lógica)
  - Usar sistema de traducciones i18n para textos de UI

## 6. Cómo debe ayudarme la IA en este proyecto
Cuando trabajes en este repo, debes:

1. **Explicar SIEMPRE el plan** antes de modificar código.
2. **Hacer cambios pequeños y controlados** (una cosa por vez).
3. **Explicar los cambios** línea por línea cuando yo lo pida.
4. **Proponer tests** cuando toque lógica importante.
5. **Corregir mis errores conceptuales** explicando el porqué.
6. **Ser honesto** si no estás seguro de algo.
7. **Mantener consistencia visual** con el sistema de diseño existente (CSS variables, Tailwind).
8. **Usar el sistema i18n** para cualquier texto visible al usuario.

## 7. Cosas que NO debes hacer
- No cambiar librerías o frameworks grandes sin consultarlo.
- No eliminar código existente sin explicar claramente el motivo.
- No introducir dependencias nuevas pesadas sin justificarlo.
- No romper compatibilidad con Python 3.11+ o Node.js LTS.
- No hardcodear textos en español/inglés - usar siempre i18n.
- No modificar la estructura de la base de datos sin crear migración.
- No cambiar endpoints de API sin actualizar el frontend correspondiente.

## 8. Flujo de trabajo típico
1. Leer la descripción de la tarea que le doy.
2. Proponer un plan de pasos numerados.
3. Pedir confirmación si el cambio es grande.
4. Aplicar cambios en archivos específicos.
5. Explicar lo que hizo.
6. Sugerir pruebas (manuales o automáticas).
7. Verificar que el build compile sin errores.

## 9. URLs de desarrollo
- **Frontend**: http://localhost:5173 (o 5174 si 5173 está ocupado)
- **Backend API**: http://localhost:5000
- **Base de datos**: backend_v2/core/data/spm.db

## 10. Comandos útiles
```bash
# Iniciar backend
python wsgi.py

# Iniciar frontend
cd frontend && npm run dev

# Ejecutar tests
pytest tests/
npm test

# Build de producción
npm run build
```

## 11. Convenciones de fechas, horas y moneda

### Zona horaria de negocio
- **America/Argentina/Buenos_Aires** (UTC-03:00)
- Toda la lógica funcional (plazos, vencimientos, horarios de corte) se piensa en esta zona

### Almacenamiento y API
- Todas las fechas/horas se guardan y exponen en **UTC**, formato ISO 8601
- Formato estándar: `YYYY-MM-DDTHH:MM:SSZ`
- Ejemplo: `2025-12-03T17:30:00Z`

### Frontend
- Siempre convierte de UTC a America/Argentina/Buenos_Aires para mostrar al usuario
- Ejemplo:
  - Valor en API: `2025-12-03T17:30:00Z`
  - Vista usuario (AR): `2025-12-03 14:30` (UTC-03:00)

### Reglas para Claude / backend
- Nunca mezclar UTC con hora local sin aclararlo
- Si se necesita trabajar con hora local, documentar explícitamente la conversión

### Moneda
- Todos los montos de presupuesto y precios se manejan en **USD** con 2 decimales

---
**Última actualización**: 2025-12-03
**Versión**: 2.0
