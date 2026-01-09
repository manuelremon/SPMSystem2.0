#!/usr/bin/env bash
#
# ask_helpers.sh - Consulta a Gemini y Codex CLI con un mismo prompt
#
# Uso:
#   ./tools/ask_helpers.sh "tu pregunta aqui"
#   echo "tu pregunta" | ./tools/ask_helpers.sh
#
set -euo pipefail

# =============================================================================
# CONFIGURACION (editar si los comandos cambian en tu maquina)
# =============================================================================
GEMINI_CMD="${GEMINI_CMD:-gemini}"
CODEX_CMD="${CODEX_CMD:-codex}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
LOG="${LOG:-0}"

# =============================================================================
# FUNCIONES AUXILIARES
# =============================================================================
log() {
    [[ "$LOG" == "1" ]] && echo "[$(date '+%H:%M:%S')] $*" >&2
}

detect_timeout_cmd() {
    if command -v timeout &>/dev/null; then
        echo "timeout"
    elif command -v gtimeout &>/dev/null; then
        echo "gtimeout"
    else
        echo ""
    fi
}

detect_gemini() {
    for cmd in "$GEMINI_CMD" "gemini" "google-gemini"; do
        if command -v "$cmd" &>/dev/null; then
            echo "$cmd"
            return 0
        fi
    done
    return 1
}

detect_codex() {
    for cmd in "$CODEX_CMD" "codex"; do
        if command -v "$cmd" &>/dev/null; then
            echo "$cmd"
            return 0
        fi
    done
    return 1
}

run_with_timeout() {
    local timeout_cmd="$1"
    shift
    if [[ -n "$timeout_cmd" ]]; then
        "$timeout_cmd" "${TIMEOUT_SECONDS}s" "$@" 2>&1 || echo "[TIMEOUT o ERROR]"
    else
        "$@" 2>&1 || echo "[ERROR]"
    fi
}

# =============================================================================
# OBTENER PROMPT
# =============================================================================
if [[ $# -gt 0 ]]; then
    PROMPT="$*"
else
    log "Leyendo prompt desde stdin..."
    PROMPT=$(cat)
fi

if [[ -z "$PROMPT" ]]; then
    echo "Error: No se proporciono prompt." >&2
    echo "Uso: $0 \"tu pregunta\"" >&2
    echo "  o: echo \"tu pregunta\" | $0" >&2
    exit 1
fi

log "Prompt recibido: ${PROMPT:0:50}..."

# =============================================================================
# DETECTAR HERRAMIENTAS
# =============================================================================
TIMEOUT_CMD=$(detect_timeout_cmd)
GEMINI=$(detect_gemini) || GEMINI=""
CODEX=$(detect_codex) || CODEX=""

[[ -n "$TIMEOUT_CMD" ]] && log "Timeout disponible: $TIMEOUT_CMD"
[[ -n "$GEMINI" ]] && log "Gemini detectado: $GEMINI"
[[ -n "$CODEX" ]] && log "Codex detectado: $CODEX"

if [[ -z "$GEMINI" && -z "$CODEX" ]]; then
    echo "Error: No se encontro ni Gemini ni Codex CLI." >&2
    exit 1
fi

# =============================================================================
# EJECUTAR CONSULTAS
# =============================================================================
echo "# Consulta a Asistentes IA"
echo ""
echo "> **Prompt:** ${PROMPT:0:200}..."
echo ""
echo "---"
echo ""

# --- GEMINI ---
echo "## Gemini"
echo ""
if [[ -n "$GEMINI" ]]; then
    log "Consultando Gemini..."
    echo '```'
    run_with_timeout "$TIMEOUT_CMD" "$GEMINI" "$PROMPT"
    echo '```'
else
    echo "*Gemini CLI no disponible. Instalar con: npm install -g @google/gemini-cli*"
fi
echo ""

# --- CODEX ---
echo "## Codex"
echo ""
if [[ -n "$CODEX" ]]; then
    log "Consultando Codex..."
    echo '```'
    run_with_timeout "$TIMEOUT_CMD" "$CODEX" exec "$PROMPT"
    echo '```'
else
    echo "*Codex CLI no disponible. Instalar con: npm install -g @openai/codex*"
fi
echo ""

# --- RESUMEN ---
echo "---"
echo ""
echo "## Resumen (por Claude)"
echo ""
echo "*[Aqui Claude analiza las respuestas, detecta conflictos y justifica su decision]*"
echo ""
