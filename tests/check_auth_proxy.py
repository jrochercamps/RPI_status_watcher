"""Comprueba el rechazo anónimo del proxy; no prueba el inicio de sesión.

Ejemplo: python3 tests/check_auth_proxy.py --port 8766 --status-host status.example.com --auth-host auth.example.com
Usar únicamente contra una instancia de prueba controlada. No imprime cookies.
"""
import argparse
import http.client
from urllib.parse import urlsplit


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--status-host", required=True)
    parser.add_argument("--auth-host", required=True)
    args = parser.parse_args()
    cases = [
        ("/", {}),
        ("/api/health", {}),
        ("/api/charts", {}),
        ("/api/history?kind=alerts", {}),
        ("/api/health", {"Remote-User": "admin", "X-Forwarded-User": "admin", "X-Forwarded-For": "127.0.0.1", "X-Forwarded-Proto": "https"}),
        ("/api/health", {"X-Forwarded-Host": "attacker.invalid", "X-Forwarded-Uri": "/", "X-Forwarded-Method": "GET"}),
    ]
    for path, extra in cases:
        connection = http.client.HTTPConnection("127.0.0.1", args.port, timeout=5)
        try:
            connection.request("GET", path, headers={"Host": args.status_host, **extra})
            response = connection.getresponse()
            location = response.getheader("Location", "")
            status = response.status
            response.read()
        finally:
            connection.close()
        if status in (301, 302, 303, 307, 308):
            target = urlsplit(location)
            if target.scheme != "https" or target.hostname != args.auth_host:
                raise RuntimeError(f"Redirección inesperada en {path}: {target.scheme}://{target.hostname}")
        elif status not in (401, 403):
            raise RuntimeError(f"Acceso anónimo no rechazado correctamente en {path}: HTTP {status}")
        print(f"OK {path}: HTTP {status}")


if __name__ == "__main__":
    run()
