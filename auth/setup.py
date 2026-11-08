#!/usr/bin/env python3
"""Create local Authelia configuration without exposing passwords to processes."""
import ctypes
import ctypes.util
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import sys

RUNTIME = Path(os.environ.get("AUTH_DATA_DIR", str(Path.home() / ".local/share/rpi-status-auth")))


def hostname(label, default):
    value = input(f"{label} [{default}]: ").strip().lower() or default
    if len(value) > 253 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+", value):
        raise ValueError("Nombre DNS inválido")
    return value


def password_hash(password):
    library = ctypes.util.find_library("argon2")
    if not library:
        raise RuntimeError("Falta libargon2 (por ejemplo, paquete libargon2-1)")
    lib = ctypes.CDLL(library)
    function = lib.argon2id_hash_encoded
    function.argtypes = [ctypes.c_uint32, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_char_p, ctypes.c_size_t]
    function.restype = ctypes.c_int
    raw = password.encode("utf-8")
    salt = secrets.token_bytes(16)
    result = ctypes.create_string_buffer(256)
    if function(3, 65536, 4, raw, len(raw), salt, len(salt), 32, result, len(result)):
        raise RuntimeError("No se pudo generar el hash Argon2id")
    return result.value.decode("ascii")


def main():
    if not sys.stdin.isatty():
        raise RuntimeError("Se necesita una terminal interactiva")
    if os.geteuid() == 0:
        raise RuntimeError("No ejecute este asistente como root o con sudo; utilice un usuario con acceso a Docker")
    if not RUNTIME.is_absolute() or RUNTIME.resolve().is_relative_to(Path(__file__).resolve().parent.parent):
        raise ValueError("AUTH_DATA_DIR debe ser absoluto y estar fuera del repositorio")
    if any(c in str(RUNTIME) for c in "\n\r#$'"):
        raise ValueError("AUTH_DATA_DIR contiene caracteres no admitidos")
    if RUNTIME.exists():
        raise RuntimeError("El directorio de datos ya existe; no se sobrescriben datos existentes")
    if not RUNTIME.parent.is_dir():
        raise RuntimeError("El directorio padre de AUTH_DATA_DIR debe existir")
    auth = hostname("Host del portal", "auth.example.com")
    status = hostname("Host protegido", "status.example.com")
    domain = hostname("Dominio común de cookie", ".".join(auth.split(".")[-2:]))
    if auth == status or not all(host.endswith("." + domain) for host in (auth, status)):
        raise ValueError("Los hosts deben ser distintos y subdominios del dominio de cookie")
    user = input("Usuario exclusivo de Authelia: ").strip()
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}", user):
        raise ValueError("Usuario inválido")
    password = getpass.getpass("Contraseña larga y única (mínimo 16 caracteres): ")
    confirm = getpass.getpass("Confirmar contraseña: ")
    if len(password) < 16 or password != confirm:
        raise ValueError("Contraseña demasiado corta o confirmación incorrecta")
    digest = password_hash(password)
    del password, confirm
    config = {
        "theme": "auto",
        "server": {"address": "tcp://0.0.0.0:9091"},
        "log": {"level": "info"},
        "identity_validation": {"reset_password": {"jwt_secret": secrets.token_hex(32)}},
        "authentication_backend": {"password_reset": {"disable": True}, "file": {"path": "/config/users.json"}},
        "access_control": {"default_policy": "deny", "rules": [{"domain": status, "policy": "one_factor"}]},
        "session": {"secret": secrets.token_hex(32), "cookies": [{"domain": domain, "authelia_url": "https://" + auth, "default_redirection_url": "https://" + status}]},
        "regulation": {"max_retries": 5, "find_time": "2m", "ban_time": "15m"},
        "storage": {"encryption_key": secrets.token_hex(32), "local": {"path": "/config/db.sqlite3"}},
        "notifier": {"filesystem": {"filename": "/config/notifications.txt"}},
    }
    os.umask(0o077)
    RUNTIME.mkdir(mode=0o700)
    (RUNTIME / "configuration.yml").write_text(json.dumps(config, indent=2) + "\n")
    (RUNTIME / "users.json").write_text(json.dumps({"users": {user: {"displayname": user, "password": digest, "groups": []}}}, indent=2) + "\n")
    (RUNTIME / "compose.env").write_text(f"AUTH_HOST={auth}\nSTATUS_HOST={status}\nAUTH_UID={os.getuid()}\nAUTH_GID={os.getgid()}\nAUTH_DATA_DIR='{RUNTIME}'\n")
    print("Configuración creada. Consulte auth/README.md antes de ponerla en marcha.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, EOFError, KeyboardInterrupt) as error:
        print(f"No se completó la configuración: {error}", file=sys.stderr)
        sys.exit(1)
