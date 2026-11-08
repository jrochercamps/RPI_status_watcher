#!/bin/sh
. "$(dirname -- "$0")/common.sh"
if [ "$#" -ne 2 ] || [ "$1" != "--confirm" ] || [ ! -f "$2" ]; then
    echo "Uso: $0 --confirm archivo.sqlite3 (requiere aplicación activa; crea backup previo)" >&2
    exit 1
fi
input=$(CDPATH= cd -- "$(dirname -- "$2")" && pwd)/$(basename -- "$2")
# Validar antes de parar; no aceptar una base ajena o dañada.
compose run --rm --no-deps -T app python -c '
import sqlite3, sys, tempfile
with tempfile.NamedTemporaryFile() as f:
    while chunk := sys.stdin.buffer.read(1048576): f.write(chunk)
    f.flush()
    with sqlite3.connect("file:" + f.name + "?mode=ro", uri=True) as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok": sys.exit("Copia dañada")
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type=\"table\" AND name=\"snapshots\"").fetchone(): sys.exit("No es una copia del historial")
' < "$input"
"$ROOT/scripts/backup.sh"
compose stop app
echo "Servicios detenidos. Si falla la restauración, permanecen detenidos; consulte el backup previo." >&2
compose run --rm --no-deps -T app python -c '
import os, sqlite3, sys, tempfile
with tempfile.NamedTemporaryFile() as f:
    while chunk := sys.stdin.buffer.read(1048576): f.write(chunk)
    f.flush()
    with sqlite3.connect("file:" + f.name + "?mode=ro", uri=True) as src:
        with sqlite3.connect(os.environ["DATABASE_PATH"]) as dst: src.backup(dst)
' < "$input"
compose up -d
echo "Restauración completada; compruebe scripts/verify.sh."
