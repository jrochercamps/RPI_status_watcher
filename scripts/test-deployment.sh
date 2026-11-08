#!/bin/sh
# Ensayo aislado. Elimina únicamente el proyecto y el volumen temporales creados aquí.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
command -v docker >/dev/null 2>&1 || { echo 'Falta Docker.' >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo 'Falta Docker Compose.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'No hay acceso al daemon Docker.' >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo 'Falta Python 3.' >&2; exit 1; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/rpi-status-test.XXXXXXXX")
project="rpi-status-test-$(date +%s)-$$"
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
cat > "$tmp/test.env" <<EOF
PORT=$port
NETDATA_URL=http://127.0.0.1:1
NETDATA_CHARTS=
POLL_INTERVAL_SECONDS=30
HISTORY_RETENTION_DAYS=30
TZ=Europe/Madrid
EOF
cat > "$tmp/override.yaml" <<'EOF'
services:
  app:
    environment:
      NETDATA_TOKEN: ""
      ALERT_RULES: "[]"
EOF
compose() { docker compose --project-directory "$ROOT" -p "$project" --env-file "$tmp/test.env" -f "$ROOT/compose.yaml" -f "$tmp/override.yaml" "$@"; }
cleanup() {
  result=$?
  trap - EXIT HUP INT TERM
  if ! compose down --volumes --remove-orphans --rmi local; then
    echo "No se pudieron retirar los recursos temporales del proyecto $project." >&2
    result=1
  fi
  rm -f "$tmp/test.env" "$tmp/override.yaml"
  rmdir "$tmp" 2>/dev/null || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
echo "Proyecto temporal: $project; puerto local: $port"
compose config -q
compose up -d --build --wait --wait-timeout 90
compose exec -T app python -c 'import urllib.request; assert urllib.request.urlopen("http://127.0.0.1:8765/api/health", timeout=5).status == 200; assert urllib.request.urlopen("http://127.0.0.1:8765/", timeout=5).status == 200'
python3 - "$port" <<'PY'
import json, sys, urllib.request
with urllib.request.urlopen(f"http://127.0.0.1:{sys.argv[1]}/api/health", timeout=5) as response:
    assert json.load(response)["status"] == "ok"
PY
compose exec -T app python -c 'import os,sqlite3; c=sqlite3.connect(os.environ["DATABASE_PATH"]); c.execute("CREATE TABLE test_persistencia (valor TEXT)"); c.execute("INSERT INTO test_persistencia VALUES (?)", ("prueba-aislada",)); c.commit(); c.close()'
compose restart app
compose up -d --wait --wait-timeout 90
compose exec -T app python -c 'import os,sqlite3; c=sqlite3.connect(os.environ["DATABASE_PATH"]); assert c.execute("SELECT valor FROM test_persistencia").fetchone()[0] == "prueba-aislada"; assert c.execute("PRAGMA integrity_check").fetchone()[0] == "ok"; c.close()'
echo 'OK: construcción, arranque, healthcheck, API, frontend y persistencia tras reinicio.'
echo 'No se prueban Netdata real, Cloudflare, ARM64 ni los scripts de actualización/restauración.'
