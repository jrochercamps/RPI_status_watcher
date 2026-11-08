#!/bin/sh
. "$(dirname -- "$0")/common.sh"
compose config -q
compose ps
attempt=0
until compose exec -T app python -c 'import urllib.request; [urllib.request.urlopen("http://127.0.0.1:8765" + path, timeout=5).close() for path in ("/api/health", "/")]' 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
        echo "API o frontend no disponibles tras 30 intentos." >&2
        exit 1
    fi
    sleep 2
done
echo "API y frontend accesibles dentro del contenedor. Netdata no se verifica con health."
