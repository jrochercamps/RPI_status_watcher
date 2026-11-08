#!/bin/sh
. "$(dirname -- "$0")/common.sh"
if [ "${1:-}" != "--confirm" ] || [ "$#" -ne 1 ]; then
    echo "Uso: $0 --confirm (elimina solo contenedores y red del proyecto; conserva volúmenes y backups)" >&2
    exit 1
fi
compose down
echo "Servicios retirados; volumen y backups conservados."
