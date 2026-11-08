import contextlib
from http.cookies import SimpleCookie
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
import uuid
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("auth_setup", ROOT / "setup.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class AuthTests(unittest.TestCase):
    def test_configuration_and_docker_validation(self):
        with tempfile.TemporaryDirectory(prefix="rpi-auth-test-") as tmp:
            runtime = Path(tmp) / "data"
            inputs = iter(["auth.example.test", "status.example.test", "example.test", "testuser"])
            with patch.object(setup, "RUNTIME", runtime), patch("sys.stdin.isatty", return_value=True), patch("builtins.input", side_effect=lambda _: next(inputs)), patch("getpass.getpass", return_value="test-only-long-password"), contextlib.redirect_stdout(io.StringIO()):
                setup.main()
                with self.assertRaises(RuntimeError):
                    setup.main()
            self.assertEqual(runtime.stat().st_mode & 0o777, 0o700)
            self.assertNotIn("test-only-long-password", (runtime / "users.json").read_text())
            subprocess.run(["docker", "run", "--rm", "--network", "none", "-v", f"{runtime}:/config:ro", "authelia/authelia:4.39.15", "authelia", "config", "validate", "--config", "/config/configuration.yml"], check=True)
            subprocess.run(["docker", "run", "--rm", "--network", "none", "-e", "AUTH_HOST=auth.example.test", "-e", "STATUS_HOST=status.example.test", "-v", f"{ROOT / 'Caddyfile'}:/etc/caddy/Caddyfile:ro", "caddy:2.10.2-alpine", "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"], check=True)
            self.check_requests(Path(tmp), runtime)

    def check_requests(self, tmp, runtime):
        compose = {
            "services": {
                "app": {"image": "caddy:2.10.2-alpine", "command": ["caddy", "respond", "--listen", ":8765", "--body", "BACKEND_PRIVATE"]},
                "authelia": {"image": "authelia/authelia:4.39.15", "user": f"{os.getuid()}:{os.getgid()}", "tmpfs": ["/tmp:rw,noexec,nosuid,size=16m"], "cap_drop": ["ALL"], "security_opt": ["no-new-privileges:true"], "volumes": [f"{runtime}:/config"]},
                "caddy": {"image": "caddy:2.10.2-alpine", "user": "65532:65532", "read_only": True, "tmpfs": ["/tmp:rw,noexec,nosuid,size=16m"], "cap_drop": ["ALL"], "cap_add": ["NET_BIND_SERVICE"], "security_opt": ["no-new-privileges:true"], "environment": {"AUTH_HOST": "auth.example.test", "STATUS_HOST": "status.example.test", "XDG_DATA_HOME": "/tmp", "XDG_CONFIG_HOME": "/tmp"}, "volumes": [f"{ROOT / 'Caddyfile'}:/etc/caddy/Caddyfile:ro"], "ports": ["127.0.0.1::8080"]},
            }
        }
        config = tmp / "compose.json"
        config.write_text(json.dumps(compose))
        cmd = ["docker", "compose", "-p", "auth-test-" + uuid.uuid4().hex[:12], "-f", str(config)]
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        opener = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
        try:
            subprocess.run(cmd + ["up", "-d"], check=True, stdout=subprocess.DEVNULL)
            port = subprocess.check_output(cmd + ["port", "caddy", "8080"], text=True).strip().rsplit(":", 1)[1]
            def request(path, headers, host="status.example.test", data=None):
                req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", headers={"Host": host, **headers}, data=data)
                try:
                    response = opener.open(req, timeout=3)
                except urllib.error.HTTPError as error:
                    response = error
                return response.code, response.read(), response.headers
            for attempt in range(3):
                try:
                    code, body, headers = request("/", {})
                    if code in (302, 401, 403):
                        break
                except OSError:
                    pass
                time.sleep(1)
            else:
                subprocess.run(cmd + ["logs", "--no-color"], check=False)
                self.fail("Authelia no respondió a la comprobación")
            for path in ("/", "/api/health", "/api/history"):
                for spoof in ({}, {"X-Forwarded-Proto": "https", "X-Forwarded-Host": "auth.example.test", "X-Forwarded-Uri": "/", "Remote-User": "testuser", "X-Forwarded-For": "127.0.0.1"}):
                    code, body, headers = request(path, spoof)
                    self.assertIn(code, (302, 401, 403))
                    self.assertNotIn(b"BACKEND_PRIVATE", body)
                    if code == 302:
                        self.assertTrue(headers["Location"].startswith("https://auth.example.test/"))

            # Authelia's first-factor endpoint accepts JSON. Cookies are held only
            # in memory; HTTPS Secure cookies must be replayed explicitly here
            # because this isolated origin uses HTTP on loopback, without TLS.
            def login(password):
                payload = json.dumps({"username": "testuser", "password": password, "targetURL": "https://status.example.test/", "requestMethod": "GET", "keepMeLoggedIn": False}).encode()
                return request("/api/firstfactor", {"Content-Type": "application/json", "Origin": "https://auth.example.test", "Referer": "https://auth.example.test/"}, host="auth.example.test", data=payload)

            code, body, headers = login("test-only-long-password")
            self.assertEqual(code, 200, "El inicio de sesión válido debe tener éxito")
            self.assertEqual(json.loads(body).get("status"), "OK")
            cookies = SimpleCookie()
            for value in headers.get_all("Set-Cookie", []):
                cookies.load(value)
            self.assertTrue(cookies, "Authelia debe emitir una cookie de sesión")
            for cookie in cookies.values():
                self.assertTrue(cookie["secure"], "La cookie debe exigir HTTPS")
                self.assertTrue(cookie["httponly"], "La cookie debe ser HttpOnly")
            cookie_header = "; ".join(f"{key}={morsel.value}" for key, morsel in cookies.items())
            for path in ("/", "/api/health", "/api/history"):
                code, body, _ = request(path, {"Cookie": cookie_header})
                self.assertEqual(code, 200, "La sesión válida debe permitir acceso")
                self.assertEqual(body, b"BACKEND_PRIVATE")

            # Fresh requests: do not reuse the authenticated session. Each call
            # is made exactly once so failures are counted deterministically.
            for _ in range(5):
                code, _, _ = login("incorrect-test-password")
                self.assertEqual(code, 401, "La contraseña incorrecta debe rechazarse")
            code, _, headers = login("test-only-long-password")
            self.assertEqual(code, 401, "La cuenta debe quedar bloqueada")
            self.assertFalse(headers.get_all("Set-Cookie"), "El bloqueo no debe crear una sesión")
            code, body, _ = request("/api/health", {})
            self.assertIn(code, (302, 401, 403))
            self.assertNotIn(b"BACKEND_PRIVATE", body)

            subprocess.run(cmd + ["stop", "authelia"], check=True, stdout=subprocess.DEVNULL)
            for headers in ({}, {"Cookie": cookie_header}):
                code, body, _ = request("/api/health", headers)
                self.assertIn(code, (502, 503))
                self.assertNotIn(b"BACKEND_PRIVATE", body)
        finally:
            subprocess.run(cmd + ["down", "--remove-orphans"], check=True, stdout=subprocess.DEVNULL)


if __name__ == "__main__":
    unittest.main()
