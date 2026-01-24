# Claude Prompts - SPMSystem2.0

Coleccion de prompts especificos para trabajar con Claude Code en SPMSystem2.0. Cada prompt esta disenado para producir una salida concreta y accionable.

**Proyecto:** Flask + React + SQLite/PostgreSQL + ML/Forecasting

---

## Como Usar Estos Prompts

- **Copia el prompt completo** incluyendo el bloque de codigo
- **Reemplaza los placeholders** entre corchetes `[EJEMPLO]`
- **Espera una salida estructurada**: pasos, checklist, o diff sugerido
- **Combina prompts** si la tarea es compleja (ej: crear endpoint + tests)
- **Lee primero**: si el prompt modifica codigo existente, pedi que lea el archivo antes

---

## Convenciones del Proyecto (SPMSystem2.0)

Reglas especificas que Claude debe seguir en este proyecto:

- **Idioma de mensajes al usuario**: Espanol. Logs y errores tecnicos pueden ser en ingles.
- **Python**: snake_case para variables/funciones, PascalCase para clases.
- **React**: PascalCase para componentes, camelCase para funciones/variables.
- **Nombres de archivos**: snake_case en backend (`mi_servicio.py`), PascalCase en frontend (`MiComponente.jsx`).
- **Endpoints**: van en `backend/routes/[dominio].py`, registrados en `core/blueprints.py`.
- **Servicios**: logica de negocio en `backend/services/[nombre]_service.py`.
- **Schemas**: validacion Pydantic en `backend/core/schemas.py` o `*_schemas.py`.
- **Roles y auth**: usar `@require_auth`, `has_any_role()`, `is_admin()` de `core/roles.py`.
- **Errores backend**: try/except con logging, nunca exponer stacktrace al cliente.
- **Textos UI**: siempre usar `useI18n()` y `t('clave')`, nunca hardcodear.
- **Antes de cambios grandes**: pedir confirmacion explicita, mostrar plan primero.
- **SQL**: siempre parametrizado (`?` o `%s`), nunca f-strings con datos de usuario.

---

## Backend (Flask)

### Crear Endpoint

```
Crea un nuevo endpoint en backend/routes/[MODULO].py

Especificaciones:
- Ruta: [METHOD] /api/[PATH]
- Proposito: [DESCRIPCION]
- Parametros: [QUERY/BODY/PATH PARAMS]
- Respuesta esperada: [ESTRUCTURA JSON]
- Roles permitidos: [admin/coordinador/usuario/planner/jefe]

Requisitos:
1. Usar Blueprint existente o crear uno nuevo
2. Decorar con @require_auth y @rate_limit si aplica
3. Validar entrada con schemas de core/schemas.py
4. Manejar errores con try/except y logging
5. Documentar con docstring OpenAPI-compatible

Dame el codigo completo del endpoint.
```

### Agregar Validacion

```
Agrega validacion al endpoint [RUTA] en backend/routes/[ARCHIVO].py

Campos a validar:
- [CAMPO_1]: [TIPO, REGLAS - ej: string, min 3 chars, required]
- [CAMPO_2]: [TIPO, REGLAS]

Usa el patron existente en core/schemas.py o core/item_schemas.py.
Incluye mensajes de error claros en espanol.
Muestra el diff del cambio.
```

### Manejo de Errores

```
Revisa el manejo de errores en backend/routes/[ARCHIVO].py

Busca:
1. Bare except (except: sin tipo)
2. Errores que exponen detalles internos al cliente
3. Falta de logging en excepciones
4. Transacciones sin rollback en caso de error

Para cada problema encontrado, muestra:
- Linea actual
- Problema
- Codigo corregido
```

### Paginacion

```
Agrega paginacion al endpoint [GET /api/RUTA] en backend/routes/[ARCHIVO].py

Parametros query:
- page: int (default 1)
- per_page: int (default 20, max 100)

Respuesta:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "pages": 8
  }
}

Usa el patron de paginacion existente en el proyecto.
```

### Filtros

```
Agrega filtros al endpoint [GET /api/RUTA] en backend/routes/[ARCHIVO].py

Filtros requeridos:
- [CAMPO_1]: [TIPO - exact/contains/range/in]
- [CAMPO_2]: [TIPO]
- fecha_desde / fecha_hasta: rango de fechas

Requisitos:
1. Filtros opcionales (query params)
2. SQL parametrizado (sin f-strings)
3. Combinar filtros con AND
4. Ignorar filtros vacios

Muestra el codigo SQL y el endpoint modificado.
```

### Auth y Roles

```
Revisa la autorizacion del endpoint [RUTA] en backend/routes/[ARCHIVO].py

Verifica:
1. Tiene @require_auth?
2. Valida ownership de los datos? (usuario solo ve sus datos)
3. Usa has_any_role() o is_admin() correctamente?
4. Rate limiting en endpoints sensibles?

Si falta algo, muestra el codigo corregido.
```

### Logging

```
Mejora el logging en backend/[RUTA_ARCHIVO].py

Agrega logs para:
1. Inicio de operaciones importantes (INFO)
2. Datos de entrada relevantes (DEBUG)
3. Errores con contexto (ERROR + exception info)
4. Metricas de tiempo si aplica (INFO)

Usa el patron:
logger = logging.getLogger(__name__)
logger.info("mensaje", extra={"user_id": ..., "action": ...})

Muestra los cambios sugeridos.
```

### Estructura de Servicio

```
Quiero crear un nuevo servicio: backend/services/[NOMBRE]_service.py

Proposito: [DESCRIPCION]

Funcionalidades:
- [FUNCION_1]: [QUE HACE]
- [FUNCION_2]: [QUE HACE]

Sigue el patron de ai_service.py o mrp_service.py:
1. Clase con metodos estaticos o instancia singleton
2. Documentacion con docstrings
3. Logging estructurado
4. Manejo de errores con excepciones custom
5. Type hints

Dame la estructura base del servicio.
```

### Documentacion de Endpoint

```
Documenta el endpoint [RUTA] en backend/routes/[ARCHIVO].py para OpenAPI/Swagger.

Incluye:
1. Docstring con descripcion, params, responses
2. Ejemplo de request body si aplica
3. Codigos de respuesta (200, 400, 401, 404, 500)
4. Ejemplo de respuesta exitosa

Formato compatible con core/openapi.py.
```

### Tests para Endpoint

```
Crea tests para el endpoint [METHOD /api/PATH] en backend/routes/[ARCHIVO].py

Tests requeridos:
1. Happy path - respuesta exitosa con datos validos
2. Auth/Roles - sin token, token invalido, rol no autorizado
3. Validacion - campos faltantes, tipos incorrectos, valores fuera de rango
4. Edge cases - lista vacia, IDs inexistentes, limites de paginacion
5. Errores esperados - 400, 401, 403, 404 segun corresponda

Requisitos:
1. Usar pytest con fixtures de tests/conftest.py
2. Cliente de test Flask (client fixture)
3. Mocks para dependencias externas si aplica
4. Assertions claras con mensajes descriptivos

Fixtures recomendadas:
- client: cliente Flask de test
- auth_headers: headers con token valido
- sample_[entidad]: datos de ejemplo

Ubicacion: tests/integration/test_[modulo].py

Dame el codigo completo de los tests.
Comando para ejecutar: pytest tests/integration/test_[modulo].py -v
```

---

## Frontend (React/Vite)

### Crear Componente

```
Crea un nuevo componente: frontend/src/components/[CARPETA]/[Nombre].jsx

Proposito: [DESCRIPCION]
Props esperadas: [LISTA DE PROPS CON TIPOS]

Requisitos:
1. Usar componentes UI de components/ui/ (Button, Card, Input, etc.)
2. Usar useI18n() para todos los textos visibles
3. Manejar estados de loading y error
4. PropTypes o comentarios de tipos

Sigue el patron de componentes existentes en el proyecto.
```

### Estado con Hooks

```
Crea un custom hook: frontend/src/hooks/use[Nombre].js

Proposito: [DESCRIPCION]
Estado que maneja: [LISTA]
Efectos secundarios: [API CALLS, SUBSCRIPTIONS, ETC.]

Sigue el patron de useMaterials.js:
1. Estado inicial claro
2. Handlers como funciones memorizadas si es necesario
3. Cleanup en useEffect
4. Retornar objeto con estado y handlers

Dame el hook completo.
```

### Estado Global / Store

```
Necesito manejar estado global para: [DESCRIPCION]

Datos a compartir: [LISTA DE DATOS]
Componentes que lo usan: [LISTA O "multiples paginas"]

Primero detecta que patron de estado global usa el proyecto:
- Busca en frontend/src/store/ (Zustand)
- Busca en frontend/src/context/ (React Context)
- Revisa imports en componentes existentes

Luego:
1. Crea el store/context siguiendo el patron existente
2. Define estado inicial, acciones/setters
3. Maneja loading y error si hay llamadas async
4. Muestra como integrar en componentes (Provider si es Context)
5. Ejemplo de uso en un componente

Ubicacion sugerida:
- Zustand: frontend/src/store/[nombre]Store.js
- Context: frontend/src/context/[Nombre]Context.jsx

Dame el codigo completo del store y un ejemplo de uso.
```

### Formularios

```
Crea un formulario en frontend/src/pages/[Pagina].jsx o components/[Componente].jsx

Campos:
- [CAMPO_1]: [TIPO INPUT - text/select/textarea/checkbox]
- [CAMPO_2]: [TIPO INPUT]

Requisitos:
1. Validacion en cliente antes de submit
2. Estado de loading durante submit
3. Mostrar errores de validacion por campo
4. Mensaje de exito/error del servidor
5. Limpiar formulario tras exito (si aplica)
6. Usar Input, Button, Alert de components/ui/

Muestra el codigo del formulario.
```

### Tablas con Filtrado

```
Crea una tabla con filtros en frontend/src/pages/[Pagina].jsx

Columnas: [LISTA DE COLUMNAS]
Filtros: [LISTA DE FILTROS]
Acciones por fila: [VER/EDITAR/ELIMINAR/CUSTOM]

Requisitos:
1. Usar ModernDataTable de components/features/DataTable si aplica
2. Paginacion del lado del servidor
3. Debounce en filtros de texto (useDebounced)
4. Loading state durante fetch
5. Mensaje si no hay resultados

Dame el codigo completo.
```

### Llamadas a API

```
Implementa la llamada a API para [ENDPOINT] en frontend/src/services/[archivo].js

Metodo: [GET/POST/PUT/DELETE]
Ruta: /api/[PATH]
Body: [ESTRUCTURA SI APLICA]

Requisitos:
1. Usar el cliente api.js existente
2. Manejar errores (try/catch)
3. Retornar datos o lanzar error con mensaje claro
4. Exportar funcion nombrada

Muestra la funcion y un ejemplo de uso en componente.
```

### Manejo de Errores UI

```
Mejora el manejo de errores en frontend/src/pages/[Pagina].jsx

Revisa:
1. Hay ErrorBoundary envolviendo el componente?
2. Los errores de API se muestran al usuario?
3. Hay retry para errores de red?
4. Loading y error son estados separados?

Muestra las mejoras sugeridas con diff.
```

### Rutas

```
Agrega una nueva ruta en frontend/src/App.jsx

Ruta: /[PATH]
Componente: [NOMBRE]
Protegida: [SI/NO]
Roles permitidos: [LISTA O "todos"]

Requisitos:
1. Usar ProtectedRoute si requiere auth
2. Lazy loading con React.lazy si es pagina pesada
3. Agregar a Sidebar.jsx si debe aparecer en menu

Muestra los cambios en App.jsx y Sidebar.jsx.
```

### Performance

```
Revisa la performance de frontend/src/pages/[Pagina].jsx

Busca:
1. Re-renders innecesarios (useCallback, useMemo faltantes)
2. Llamadas API duplicadas o en loop
3. Listas grandes sin virtualizacion
4. Imagenes sin lazy loading
5. Bundle size (imports pesados que podrian ser dinamicos)

Lista los problemas con prioridad y solucion sugerida.
```

---

## Base de Datos (SQLite/PostgreSQL)

### Disenar Esquema

```
Disena el esquema para la nueva entidad: [NOMBRE_ENTIDAD]

Campos:
- [CAMPO_1]: [TIPO, CONSTRAINTS]
- [CAMPO_2]: [TIPO, CONSTRAINTS]

Relaciones:
- [RELACION CON TABLA_X - FK, 1:N, N:M]

Requisitos:
1. Primary key (id INTEGER)
2. Timestamps (created_at, updated_at)
3. Indices para campos de busqueda frecuente
4. Constraints de integridad

Dame el CREATE TABLE y los indices.
```

### Migracion

```
Modo: ANALISIS PRIMERO. No ejecutes cambios ni apliques diffs hasta mi confirmacion.

Crea una migracion para: [DESCRIPCION DEL CAMBIO]

Cambios:
- [AGREGAR/MODIFICAR/ELIMINAR COLUMNA/TABLA]

Requisitos:
1. Script compatible con SQLite Y PostgreSQL
2. Migracion reversible (up y down)
3. Sin perder datos existentes
4. Nombre: migrations/[NUMERO]_[descripcion].sql

Compatibilidad SQLite vs PostgreSQL:
- Placeholders: SQLite usa ?, PostgreSQL usa %s
- ALTER TABLE en SQLite es limitado (no DROP COLUMN directo)
- Usa IF EXISTS / IF NOT EXISTS con cuidado (sintaxis varia)
- Evita tipos especificos de un motor (ej: SERIAL -> usar INTEGER + AUTOINCREMENT)

Muestra el script completo para ambos motores si difieren.
```

### Query Optimizado

```
Optimiza esta query o escribe una nueva para: [DESCRIPCION]

Tablas involucradas: [LISTA]
Filtros: [CONDICIONES]
Ordenamiento: [CAMPOS]
Limite: [SI/NO]

Requisitos:
1. SQL parametrizado (sin f-strings)
2. JOINs eficientes
3. Indices sugeridos si faltan
4. Compatible SQLite y PostgreSQL

Nota de compatibilidad:
- Placeholders: usa ? para SQLite, %s para PostgreSQL (o indica cual usar)
- Funciones de fecha: SQLite usa strftime(), PostgreSQL usa DATE_TRUNC(), EXTRACT()
- LIMIT/OFFSET: funciona igual en ambos

Dame la query y explica el plan de ejecucion esperado.
```

### Indices

```
Revisa los indices de la tabla [NOMBRE_TABLA]

Consultas frecuentes:
- [QUERY_1 - ej: WHERE estado = ? AND fecha > ?]
- [QUERY_2]

Sugiere:
1. Indices faltantes
2. Indices compuestos si benefician
3. Indices a eliminar si son redundantes

Dame los CREATE INDEX sugeridos.
```

### Integridad Referencial

```
Modo: ANALISIS PRIMERO. No ejecutes cambios ni apliques diffs hasta mi confirmacion.

Revisa la integridad referencial de las tablas: [LISTA]

Verifica:
1. Foreign keys definidas correctamente
2. ON DELETE/ON UPDATE apropiados (CASCADE, SET NULL, RESTRICT)
3. Constraints CHECK donde aplique
4. Datos huerfanos existentes

Lista problemas y scripts de correccion.
No ejecutes los scripts de correccion sin mi aprobacion.
```

### Debugging de Datos

```
Modo: ANALISIS PRIMERO. No ejecutes cambios ni apliques diffs hasta mi confirmacion.

Ayudame a debuggear un problema de datos en [TABLA/ENTIDAD]

Sintoma: [DESCRIPCION DEL PROBLEMA]
Datos esperados: [QUE DEBERIA PASAR]
Datos actuales: [QUE ESTA PASANDO]

Dame queries para:
1. Identificar registros problematicos
2. Verificar relaciones rotas
3. Encontrar duplicados si aplica
4. Script de correccion (con backup previo)

No ejecutes scripts de correccion automaticamente.
```

### Seeds

```
Modo: ANALISIS PRIMERO. No ejecutes cambios ni apliques diffs hasta mi confirmacion.

Crea datos de seed para desarrollo/testing de [TABLA]

Cantidad: [N REGISTROS]
Variedad: [DIFERENTES ESTADOS, FECHAS, ETC.]

Requisitos:
1. Datos realistas pero no sensibles
2. IDs predecibles para tests
3. Cubrir edge cases (nulls, limites, etc.)
4. Compatible con data/spm.db

Compatibilidad SQLite vs PostgreSQL:
- Usa INSERT con valores explicitos (no DEFAULT para IDs si difiere)
- Fechas: formato ISO 'YYYY-MM-DD HH:MM:SS' funciona en ambos
- Strings: comillas simples en ambos motores

Dame el script INSERT (indicando si hay diferencias entre motores).
```

---

## Forecasting / ML

### Pipeline de Prediccion

```
Revisa/crea el pipeline de prediccion para [TIPO - demanda/stock/etc.]

Ubicacion: backend/agent/pipelines/[archivo].py

Etapas:
1. Carga de datos (DataLoader)
2. Preprocesamiento (features, limpieza)
3. Entrenamiento/prediccion
4. Post-procesamiento
5. Persistencia de resultados

Usa el patron de demand_forecast.py o forecast/.
Muestra el codigo o las mejoras sugeridas.
```

### Evaluacion de Modelos

```
Evalua el modelo [NOMBRE] en backend/agent/pipelines/forecast/[archivo].py

Metricas a calcular:
- MAE, RMSE, MAPE
- Sesgo (bias)
- Cobertura de intervalos de confianza

Compara con baseline (naive, promedio movil).
Visualiza residuos si es posible.

Dame el codigo de evaluacion.
```

### Validacion Temporal

```
Implementa validacion temporal (time series cross-validation) para [MODELO]

Requisitos:
1. Split respetando orden temporal
2. Gap entre train y test (evitar leakage)
3. Multiples folds (expanding window o sliding window)
4. Agregar resultados por fold

Usa backtesting.py como referencia.
```

### Deteccion de Leakage

```
Revisa el pipeline [ARCHIVO] buscando data leakage:

1. Features que usan datos futuros
2. Normalizacion con datos de test
3. Target encoding sin validacion temporal
4. Features derivadas del target

Lista cada caso encontrado con linea y solucion.
```

### Feature Engineering

```
Sugiere features para predecir [TARGET] de [ENTIDAD]

Datos disponibles:
- [TABLA_1]: [COLUMNAS RELEVANTES]
- [TABLA_2]: [COLUMNAS RELEVANTES]

Tipos de features:
1. Lag features (valores pasados)
2. Rolling stats (media, std, min, max)
3. Calendario (dia semana, mes, feriados)
4. Categoricas (one-hot, target encoding)

Dame el codigo de generacion de features.
```

### Backtesting

```
Configura backtesting para el modelo [NOMBRE]

Periodo historico: [FECHA_INICIO] a [FECHA_FIN]
Horizonte de prediccion: [N PERIODOS]
Frecuencia de reentrenamiento: [CADA N PERIODOS]

Usa backend/agent/pipelines/forecast/backtesting.py.
Muestra configuracion y como ejecutar.
```

### Persistencia de Modelos

```
Implementa persistencia para el modelo [NOMBRE]

Requisitos:
1. Guardar modelo entrenado (pickle/joblib)
2. Guardar metadata (fecha, metricas, params)
3. Versionado de modelos
4. Carga rapida para inferencia

Usa model_registry.py como referencia.
```

### Reproducibilidad

```
Mejora la reproducibilidad del pipeline [ARCHIVO]

Verifica:
1. Seeds fijos para random
2. Versiones de dependencias fijas
3. Datos de entrada versionados o hasheados
4. Logging de hiperparametros usados
5. Guardado de metricas de cada run

Lista lo que falta y como agregarlo.
```

---

## Debugging & Observabilidad

### Reproducir Bug

```
Necesito reproducir este bug: [DESCRIPCION]

Pasos reportados:
1. [PASO_1]
2. [PASO_2]
3. [RESULTADO_INESPERADO]

Ayudame a:
1. Identificar archivos involucrados
2. Crear un caso de test minimo
3. Agregar logs temporales para tracear
4. Encontrar la linea exacta donde falla
```

### Aislar Causa

```
Tengo un error en [MODULO/FEATURE] pero no se donde esta la causa.

Sintoma: [DESCRIPCION]
Funciona: [CUANDO FUNCIONA]
Falla: [CUANDO FALLA]

Guiame para aislar la causa:
1. Que archivos revisar primero
2. Que logs habilitar
3. Que datos inspeccionar
4. Como descartar hipotesis
```

### Leer Logs

```
Analiza estos logs y decime que esta pasando:

[PEGAR LOGS]

Busca:
1. Errores y excepciones
2. Secuencia de eventos
3. Tiempos anormales
4. Patrones repetidos
5. Causa raiz probable
```

### Checklist Troubleshooting

```
Dame un checklist de troubleshooting para: [TIPO DE PROBLEMA]

Tipos:
- API retorna 500
- Frontend no carga datos
- Query lenta
- Autenticacion falla
- WebSocket se desconecta
- Modelo ML da predicciones malas

Para cada paso indica que comando correr o que archivo revisar.
```

### Identificar Regressions

```
Algo que funcionaba dejo de funcionar despues de [CAMBIO/COMMIT/DEPLOY]

Feature afectada: [DESCRIPCION]
Ultimo commit bueno conocido: [HASH O FECHA]

Ayudame a:
1. Identificar commits sospechosos (git log/diff)
2. Bisect si es necesario
3. Encontrar el cambio que rompio
4. Proponer fix minimo
```

---

## Refactor y Calidad

### Detectar Duplicacion

```
Busca codigo duplicado en [CARPETA O ARCHIVO]

Reporta:
1. Bloques de codigo repetidos (>5 lineas)
2. Funciones que hacen casi lo mismo
3. Patrones copy-paste

Para cada caso sugiere como consolidar.
```

### Mejorar Nombres

```
Revisa los nombres en [ARCHIVO] y sugiere mejoras:

1. Variables/funciones poco descriptivas
2. Nombres inconsistentes (camelCase vs snake_case)
3. Abreviaciones confusas
4. Nombres que no reflejan el proposito

Muestra el nombre actual y el sugerido.
```

### Reducir Acoplamiento

```
Analiza el acoplamiento de [MODULO/CLASE/ARCHIVO]

Busca:
1. Dependencias circulares
2. Imports de implementacion interna de otros modulos
3. God objects (clases que hacen demasiado)
4. Feature envy (metodos que usan mas datos de otra clase)

Propone como desacoplar con minimo impacto.
```

### Tests Sugeridos

```
Sugiere tests para [ARCHIVO/FUNCION/ENDPOINT]

Cubre:
1. Happy path
2. Edge cases (nulls, vacios, limites)
3. Errores esperados
4. Integracion con dependencias

Para cada test dame:
- Nombre descriptivo
- Setup necesario
- Assertion principal

Usa pytest para backend, vitest/jest para frontend.
```

### Deuda Tecnica

```
Lista la deuda tecnica en [CARPETA/MODULO] ordenada por prioridad.

Para cada item:
1. Ubicacion (archivo:linea si aplica)
2. Tipo (duplicacion, complejidad, seguridad, performance)
3. Impacto si no se arregla
4. Esfuerzo estimado (bajo/medio/alto)
5. Sugerencia de fix

Prioriza por: impacto alto + esfuerzo bajo primero.
```

---

## Git & Entrega

### Preparar PR

```
Prepara un PR para los cambios actuales.

1. Revisa git status y git diff
2. Agrupa cambios logicamente
3. Sugiere titulo del PR (max 72 chars)
4. Escribe descripcion con:
   - Resumen (que y por que)
   - Cambios principales (bullet points)
   - Como probar
   - Screenshots si hay cambios UI

Formato: Markdown listo para GitHub.
```

### Checklist Pre-Merge

```
Modo: ANALISIS PRIMERO. No ejecutes cambios ni apliques diffs hasta mi confirmacion.

Revisa que todo este listo para mergear a main:

- [ ] Tests pasan (pytest, npm test)
- [ ] Build compila sin errores
- [ ] No hay console.log/print de debug
- [ ] No hay secretos hardcodeados
- [ ] Migraciones de BD incluidas si aplica
- [ ] Documentacion actualizada si cambia API
- [ ] No hay conflictos con main

Ejecuta las verificaciones de solo lectura y reporta estado.
No hagas merge ni push sin mi confirmacion explicita.
```

### Mensaje de Commit

```
Escribe un mensaje de commit para los cambios actuales.

Formato conventional commits:
- feat: nueva funcionalidad
- fix: correccion de bug
- refactor: cambio sin modificar comportamiento
- docs: documentacion
- test: tests
- chore: mantenimiento

Estructura:
tipo(scope): descripcion corta (max 50 chars)

Cuerpo opcional (que y por que, no como)

Dame el mensaje completo.
```

### Release Notes

```
Genera release notes para los cambios desde [TAG/COMMIT_ANTERIOR]

Formato:
## [VERSION] - FECHA

### Nuevas Funcionalidades
- ...

### Correcciones
- ...

### Cambios Internos
- ...

### Breaking Changes (si hay)
- ...

Agrupa por tipo y escribe para usuarios finales (no tecnicos).
```

---

## Prompts Ultra-Cortos

Comandos de una linea para tareas frecuentes:

```
Busca donde se define [FUNCION/CLASE/VARIABLE]
```

```
Explicame el flujo de [FEATURE/ENDPOINT/PAGINA]
```

```
Mostra los riesgos de cambiar [ARCHIVO/FUNCION]
```

```
Lista los archivos que importan [MODULO]
```

```
Que hace esta funcion: [NOMBRE] en [ARCHIVO]
```

```
Busca TODOs y FIXMEs en [CARPETA]
```

```
Compara [ARCHIVO_1] con [ARCHIVO_2]
```

```
Lista endpoints que no tienen tests
```

```
Busca queries SQL sin parametrizar
```

```
Encuentra componentes sin useI18n
```

```
Lista hooks que no limpian efectos
```

```
Busca imports no usados en [CARPETA]
```

```
Muestra el schema de la tabla [NOMBRE]
```

```
Que endpoints usan [SERVICIO/FUNCION]
```

```
Encuentra bare except en backend/
```

```
Lista archivos modificados en ultimos 7 dias
```

```
Busca console.log en frontend/src/
```

```
Muestra dependencias de [ARCHIVO]
```

```
Encuentra funciones con mas de 50 lineas
```

```
Lista tests que tardan mas de 5 segundos
```

---

## Plantilla de Solicitud de Cambio

Copia y completa esta plantilla antes de pedir un cambio:

```
## Solicitud de Cambio

### Objetivo
[Que quiero lograr en 1-2 oraciones]

### Alcance
- Archivos a modificar: [LISTA O "por determinar"]
- Archivos a crear: [LISTA O "ninguno"]
- Archivos a eliminar: [LISTA O "ninguno"]

### Contexto
[Por que es necesario este cambio, background relevante]

### Constraints
- No modificar: [ARCHIVOS/FUNCIONALIDADES QUE NO DEBEN CAMBIAR]
- Mantener compatibilidad con: [VERSIONES/SISTEMAS]
- Tiempo disponible: [SI HAY URGENCIA]

### Criterio de Aceptacion
- [ ] [CRITERIO_1 - verificable]
- [ ] [CRITERIO_2 - verificable]
- [ ] Tests pasan
- [ ] Build compila

### Notas Adicionales
[Cualquier otra informacion relevante]
```

---

*Ultima actualizacion: 2026-01-23*
