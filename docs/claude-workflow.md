# Claude Workflow - Setup de Lujo para SPMSystem2.0

Este documento define el workflow estructurado y los prompts reutilizables para trabajar con Claude Code en el proyecto SPMSystem2.0. El objetivo es maximizar la eficiencia, mantener consistencia y evitar errores costosos siguiendo un proceso disciplinado.

---

## Checklist de Inicio de Sesion

Ejecutar siempre al iniciar Claude en este proyecto:

1. **git status** - Ver estado actual del repo
2. **Objetivo de la sesion** - Definir en 1 linea que vamos a hacer
3. **Correr tests** - Si aplica, verificar que todo pasa antes de empezar
4. **Usar Prompt Base** - Copiar y pegar el prompt de arranque (ver abajo)

```
git status
```

---

## Prompt Base de Arranque

Copia y pega este prompt al iniciar cada sesion de trabajo:

```
Contexto: Trabajo en SPMSystem2.0, un sistema de gestion de solicitudes con:
- Backend: Flask (Python) en /backend
- Frontend: React + Vite en /frontend
- Base de datos: SQLite (dev) / PostgreSQL (prod)
- ML/IA: Modulos de forecasting en /backend/agent

Reglas de esta sesion:
1. Lee CLAUDE.md antes de proponer cambios
2. No ejecutes comandos destructivos sin confirmacion explicita
3. Explica tu plan antes de modificar codigo
4. Cambios pequenos y controlados
5. Usa el sistema i18n para textos de UI

Tarea de hoy: [DESCRIBIR TAREA]
```

---

## Prompts Reutilizables

### Analisis de Proyecto

```
Analiza la estructura actual del proyecto enfocandote en:
- Organizacion de carpetas y archivos
- Patrones de codigo utilizados
- Dependencias principales
- Posibles areas de mejora

No hagas cambios, solo reporta hallazgos.
```

```
Revisa el archivo [RUTA_ARCHIVO] y explicame:
1. Que hace este modulo
2. Sus dependencias
3. Como se integra con el resto del sistema
4. Posibles problemas o deuda tecnica
```

```
Busca en el codebase todas las ocurrencias de [PATRON/FUNCION/VARIABLE] y dame un resumen de donde y como se usa.
```

### Arquitectura / Refactor

```
Necesito refactorizar [MODULO/ARCHIVO]. Antes de proponer cambios:
1. Lee el codigo actual completo
2. Identifica responsabilidades mezcladas
3. Propone una estructura mejorada
4. Lista los archivos que se verian afectados
5. Evalua el riesgo del cambio

No escribas codigo todavia, solo el plan.
```

```
Quiero extraer [FUNCIONALIDAD] a un modulo separado. Analiza:
- Que funciones/clases deben moverse
- Que imports se afectan
- Como mantener backward compatibility
- Tests que deben actualizarse
```

```
Evalua si este patron de codigo es consistente en todo el proyecto:
[PEGAR EJEMPLO DE CODIGO]

Reporta variaciones y sugiere estandarizacion.
```

### Docker / Infra

#### Solo Analisis (modo seguro)

```
Analiza la configuracion Docker actual sin ejecutar nada:
- Revisa Dockerfile y docker-compose.yml
- Identifica posibles mejoras
- Verifica best practices
- Detecta problemas de seguridad

Solo lectura, no ejecutes comandos Docker.
```

```
Revisa la configuracion de [nginx/postgres/redis] en infra/ y sugiere mejoras sin aplicar cambios.
```

#### Modo Accion (requiere confirmacion explicita)

```
MODO ACCION DOCKER - Confirmacion requerida

Necesito que ejecutes comandos Docker para: [TAREA]

Antes de cada comando destructivo (down, rm, prune), pedime confirmacion explicita.
Mostra el comando que vas a ejecutar y espera mi OK.
```

### Feature Nueva

```
Quiero implementar: [DESCRIPCION DE LA FEATURE]

Antes de escribir codigo:
1. Analiza donde encaja en la arquitectura actual
2. Lista los archivos que hay que crear/modificar
3. Identifica dependencias necesarias
4. Propone estructura de datos si aplica
5. Define endpoints API si es backend
6. Considera tests necesarios

Dame el plan completo antes de empezar.
```

```
Para la feature [NOMBRE], necesito:
- Backend: [endpoints/servicios requeridos]
- Frontend: [paginas/componentes requeridos]
- Base de datos: [cambios de esquema si aplica]

Propone la implementacion paso a paso.
```

### Debugging

```
Tengo este error: [PEGAR ERROR COMPLETO]

Contexto:
- Archivo/linea donde ocurre: [RUTA]
- Que estaba haciendo: [ACCION]
- Desde cuando falla: [CONTEXTO]

Analiza el error y propone solucion sin modificar codigo todavia.
```

```
El comportamiento esperado es [X] pero ocurre [Y].

1. Identifica los archivos involucrados en este flujo
2. Traza el camino del codigo
3. Encuentra donde se rompe la logica
4. Propone fix con minimo impacto
```

```
Revisa los logs de [backend/frontend] y busca:
- Errores recurrentes
- Warnings ignorados
- Patrones problematicos

Resume los hallazgos.
```

### Git / Control de Cambios

```
Revisa los cambios pendientes (git status/diff) y:
1. Agrupa los cambios por proposito
2. Sugiere commits atomicos con mensajes descriptivos
3. Identifica archivos que no deberian commitearse
4. Verifica que no haya secretos expuestos
```

```
Necesito hacer un commit de los cambios actuales.
- Revisa que cambio
- Propone mensaje de commit siguiendo conventional commits
- No hagas push automaticamente
```

```
Antes de mergear a main, verifica:
- Que los tests pasen
- Que no haya conflictos
- Que el build compile
- Que no haya console.log/print de debug
```

---

## Workflow Fijo SPMSystem2.0

> **Regla de Oro**: Nunca empieces escribiendo codigo. Primero analisis y plan.

### Paso 1: Contexto

Establecer el contexto de la tarea actual.

```
Tarea: [DESCRIPCION]
Archivos involucrados: [LISTA O "por determinar"]
Prioridad: [alta/media/baja]
Restricciones: [limitaciones conocidas]
```

### Paso 2: Observacion

Claude analiza el estado actual sin modificar nada.

- Lee los archivos relevantes
- Busca patrones similares en el codebase
- Identifica dependencias
- Revisa tests existentes

**Output esperado**: Resumen de hallazgos y comprension del problema.

### Paso 3: Diagnostico

Identificar la causa raiz o el mejor approach.

- Para bugs: trazar el flujo hasta encontrar el problema
- Para features: evaluar donde encaja en la arquitectura
- Para refactors: medir el impacto del cambio

**Output esperado**: Diagnostico claro con evidencia del codebase.

### Paso 4: Propuesta

Presentar el plan de accion antes de ejecutar.

- Lista de archivos a crear/modificar/eliminar
- Cambios especificos en cada archivo
- Orden de ejecucion
- Riesgos identificados
- Tests a agregar/modificar

**Output esperado**: Plan detallado esperando aprobacion.

### Paso 5: Validacion

El usuario revisa y aprueba el plan.

- Confirmar que el approach es correcto
- Ajustar si hay preferencias especificas
- Dar luz verde para proceder

**Checkpoint**: No avanzar sin aprobacion explicita.

### Paso 6: Accion

Ejecutar los cambios aprobados.

- Cambios pequenos e incrementales
- Verificar cada paso antes de continuar
- Mantener commits atomicos
- Correr tests despues de cada cambio significativo

**Durante la ejecucion**: Reportar progreso y cualquier problema encontrado.

### Paso 7: Cierre

Verificar que todo funciona y documentar.

- Confirmar que la tarea esta completa
- Listar archivos modificados
- Sugerir tests adicionales si aplica
- Documentar decisiones importantes

**Output final**: Resumen de lo realizado y proximos pasos si los hay.

---

## Como Usar Este Documento

- **Al iniciar sesion**: Copia el "Prompt Base de Arranque" y personaliza la tarea
- **Durante el trabajo**: Usa los prompts reutilizables segun la necesidad
- **Siempre**: Sigue el workflow de 7 pasos para tareas no triviales

---

## Buenas Practicas

1. **Lee antes de escribir**: Siempre pedi que Claude lea los archivos relevantes antes de proponer cambios.

2. **Cambios atomicos**: Preferi muchos cambios pequenos a un cambio gigante. Es mas facil de revisar y revertir.

3. **Confirma antes de ejecutar**: Para comandos destructivos (git reset, docker down, rm), siempre pedi confirmacion explicita.

4. **Usa el sistema de i18n**: Nunca hardcodees textos en espanol o ingles en el frontend. Usa siempre `t('clave')`.

5. **Tests primero para bugs**: Antes de fixear un bug, pedi que Claude escriba un test que lo reproduzca. Asi te aseguras que no vuelve.

6. **Documenta decisiones**: Si un cambio tiene multiples opciones validas, documenta por que elegiste una sobre otra.

---

## Comandos Rapidos

| Necesidad | Prompt Corto |
|-----------|--------------|
| Ver estructura | `Mostrame la estructura de [carpeta]` |
| Buscar codigo | `Busca donde se usa [funcion/variable]` |
| Explicar archivo | `Explicame que hace [archivo]` |
| Plan de cambio | `Quiero cambiar [X], dame el plan primero` |
| Revisar cambios | `Revisa git status y propone commits` |
| Correr tests | `Corre los tests de [modulo]` |
| Verificar build | `Verifica que el frontend compila` |

---

*Ultima actualizacion: 2026-01-23*
