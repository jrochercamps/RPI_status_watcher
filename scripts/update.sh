#!/bin/sh
. "$(dirname -- "$0")/common.sh"
# No descarga código ni elimina volúmenes. Si la copia falla, no actualiza.
"$ROOT/scripts/backup.sh"
compose build
compose up -d
"$ROOT/scripts/verify.sh"
echo "Actualización iniciada y verificada."
