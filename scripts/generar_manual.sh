#!/bin/sh
set -eu

raiz=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
salida="$raiz/docs/MANUAL_RPI_STATUS_DASHBOARD.pdf"

if [ -n "${TYPST_BIN:-}" ]; then
    "$TYPST_BIN" compile "$raiz/docs/manual.typ" "$salida"
elif command -v typst >/dev/null 2>&1; then
    typst compile "$raiz/docs/manual.typ" "$salida"
elif command -v docker >/dev/null 2>&1 && docker image inspect "${TYPST_DOCKER_IMAGE:-ghcr.io/typst/typst:latest}" >/dev/null 2>&1; then
    temporal=$(mktemp -d "${TMPDIR:-/tmp}/manual-typst.XXXXXXXX")
    trap 'rm -rf -- "$temporal"' EXIT HUP INT TERM
    docker run --rm --pull=never --network none --read-only --cap-drop ALL \
        --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
        --mount "type=bind,src=$raiz/docs/manual.typ,dst=/input/manual.typ,readonly" \
        --mount "type=bind,src=$temporal,dst=/output" \
        --entrypoint typst "${TYPST_DOCKER_IMAGE:-ghcr.io/typst/typst:latest}" \
        compile /input/manual.typ /output/manual.pdf
    cp "$temporal/manual.pdf" "$salida"
else
    printf '%s\n' 'Error: instale Typst, indique TYPST_BIN o prepare una imagen local de Typst y Docker accesible.' >&2
    exit 1
fi
printf 'Manual generado: %s\n' "$salida"
