#!/bin/sh
. "$(dirname -- "$0")/common.sh"
umask 077
mkdir -p backups
tmp=$(mktemp "$ROOT/backups/.sqlite-backup.XXXXXXXX")
trap 'rm -f "$tmp"' EXIT HUP INT TERM
# SQLite backup toma una instantánea coherente incluso en modo WAL. El archivo
# temporal dentro del contenedor se elimina aun si se interrumpe la lectura.
compose exec -T app python -c '
import os, sqlite3, sys, tempfile
source = os.environ.get("DATABASE_PATH", "/data/status.db")
if not os.path.isabs(source) or not os.path.isfile(source):
    sys.exit("DATABASE_PATH debe apuntar a una base de datos existente")
fd, path = tempfile.mkstemp(suffix=".sqlite3")
os.close(fd)
try:
    from pathlib import Path
    with sqlite3.connect(Path(source).as_uri() + "?mode=ro", uri=True) as src:
        with sqlite3.connect(path) as dst:
            src.backup(dst)
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            sys.stdout.buffer.write(chunk)
finally:
    os.unlink(path)
' > "$tmp"
test -s "$tmp"
destination="$ROOT/backups/status-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite3"
mv "$tmp" "$destination"
trap - EXIT HUP INT TERM
echo "Copia SQLite creada: $destination"
