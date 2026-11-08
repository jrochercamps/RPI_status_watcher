#!/bin/sh
# Despliegue del proyecto: el instalador mantiene .env y los datos existentes.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$ROOT/install.sh" "$@"
