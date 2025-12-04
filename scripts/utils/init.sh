#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

echo "Stopping existing containers..."
docker compose -f "$COMPOSE_FILE" down

echo "Starting SPM stack..."
docker compose -f "$COMPOSE_FILE" up --build -d

sleep 3

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:5000 >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open http://localhost:5000 >/dev/null 2>&1 &
fi

echo "SPM disponible en http://localhost:5000"
