# Asistentes IA - Guia de Uso

Script para consultar a Gemini CLI y Codex CLI simultaneamente.

## Instalacion

```bash
# Hacer ejecutable
chmod +x ./tools/ask_helpers.sh

# Verificar CLIs disponibles
which gemini codex
```

## Uso Basico

```bash
# Con argumento
./tools/ask_helpers.sh "Cual es la mejor forma de implementar caching?"

# Desde stdin
echo "Propon 2 enfoques para refactorizar este modulo" | ./tools/ask_helpers.sh

# Con logging
LOG=1 ./tools/ask_helpers.sh "mi pregunta"
```

## Configuracion

Variables de entorno para personalizar comandos:

```bash
export GEMINI_CMD="gemini"      # Comando de Gemini
export CODEX_CMD="codex"        # Comando de Codex
export TIMEOUT_SECONDS=120      # Timeout por consulta
export LOG=1                    # Activar logs
```

Si los comandos no se encuentran, editar las variables al inicio del script.

## Cuando Usar los Asistentes

**SI consultar:**
- Decisiones de arquitectura significativas
- Refactors grandes (>100 lineas)
- Bugs dificiles de diagnosticar
- Diseno de tests para casos complejos
- Optimizacion de performance
- Revisiones de seguridad
- Cuando hay incertidumbre sobre el enfoque

**NO consultar:**
- Tareas triviales (fix typos, agregar logs)
- Cambios menores (<20 lineas)
- Patrones ya establecidos en el proyecto
- Cuando la solucion es obvia

## Ejemplo de Prompt Efectivo

```bash
./tools/ask_helpers.sh "
Contexto: Refactorizando backend/routes/planner.py (2400 lineas)
Objetivo: Dividir en modulos mas pequenos
Restricciones: No romper endpoints existentes, mantener compatibilidad
Pregunta: Propon 2 estrategias de division y sus riesgos
"
```

## Formato de Salida

El script genera Markdown con secciones:
1. **Gemini** - Respuesta de Gemini CLI
2. **Codex** - Respuesta de Codex CLI
3. **Resumen (por Claude)** - Seccion vacia para que Claude complete

## Troubleshooting

| Problema | Solucion |
|----------|----------|
| "command not found" | Verificar PATH o instalar CLI faltante |
| Timeout | Aumentar TIMEOUT_SECONDS |
| Respuesta vacia | Verificar autenticacion de los CLIs |
