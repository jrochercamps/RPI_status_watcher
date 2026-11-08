"""Servidor Netdata simulado para pruebas locales, nunca para producción."""
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/v1/charts":
            body = {"charts": {"system.cpu": {"id": "system.cpu", "name": "system.cpu", "title": "CPU", "units": "percentage", "dimensions": {"user": {"name": "user"}}}}}
        elif url.path == "/api/v1/data":
            query = parse_qs(url.query)
            now = int(time.time())
            body = {"labels": ["time", "user"], "data": [[now, 12.0], [now - 30, 11.0]], "chart": query.get("chart", [""])[0]}
        elif url.path == "/api/v1/alarms":
            body = {"status": True, "alarms": {}}
        elif url.path == "/api/v1/info":
            body = {"hostname": "fixture", "version": "fixture"}
        else:
            self.send_error(404)
            return
        payload = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 19998), Handler).serve_forever()
