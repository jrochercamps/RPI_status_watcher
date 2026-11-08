#!/bin/sh
# Compartido por los scripts; no evalúa ni ejecuta el contenido de .env.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
if [ ! -f .env ]; then
    echo "Falta .env; copie .env.example y configure la aplicación." >&2
    exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "Se necesitan Docker y el complemento Docker Compose." >&2
    exit 1
fi
compose() { docker compose --project-directory "$ROOT" --env-file "$ROOT/.env" "$@"; }
