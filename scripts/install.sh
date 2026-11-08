#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
if [ "$(uname -s)" != Linux ]; then
    echo "La instalación automática requiere Linux." >&2
    exit 1
fi
architecture=$(uname -m)
if [ "$architecture" != aarch64 ] && [ "$architecture" != arm64 ]; then
    echo "Aviso: arquitectura $architecture; el objetivo ARM64 debe verificarse en la Raspberry Pi." >&2
fi
available_kb=$(df -Pk . | awk 'NR==2 {print $4}')
if [ -n "$available_kb" ] && [ "$available_kb" -lt 1048576 ]; then
    echo "Espacio insuficiente en el directorio del proyecto: se recomienda al menos 1 GiB libre." >&2
    exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "Se necesitan Docker y el complemento Docker Compose." >&2
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    echo "No se puede acceder al daemon Docker; compruebe servicio y permisos." >&2
    exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
    echo "Se necesita python3 en el host para comprobar el puerto." >&2
    exit 1
fi
if [ ! -f .env ]; then
    umask 077
    # noclobber evita sobrescribir un archivo creado simultáneamente.
    (set -C; cat .env.example > .env) || { echo "No se pudo crear .env sin sobrescribirlo." >&2; exit 1; }
    echo "Creado .env con valores predeterminados; revíselos después de la instalación."
fi
. "$ROOT/scripts/common.sh"
compose config -q
port=$(compose config --format json | python3 -c 'import json,sys; p=json.load(sys.stdin)["services"]["app"]["ports"]; print(next(x["published"] for x in p if x["target"] == 8765 and x.get("host_ip") == "127.0.0.1"))')
existing=$(compose ps -q app)
if [ -n "$existing" ] && docker port "$existing" 8765/tcp 2>/dev/null | grep -Fx "127.0.0.1:$port" >/dev/null; then
    echo "El puerto pertenece al servicio de este proyecto; se conservarán los datos."
else
python3 - "$port" <<'PY'
import socket, sys
try:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", int(sys.argv[1])))
except (OSError, ValueError) as exc:
    print("Puerto no disponible en 127.0.0.1:", exc, file=sys.stderr)
    for candidate in range(8765, 8865):
        try:
            with socket.socket() as alternative:
                alternative.bind(("127.0.0.1", candidate))
            print(f"Puerto alternativo sugerido: {candidate}; ajuste PORT en .env y vuelva a ejecutar.", file=sys.stderr)
            break
        except OSError:
            continue
    sys.exit(1)
PY
fi
compose up -d --build
"$ROOT/scripts/verify.sh"
echo "Instalación iniciada y verificada."
