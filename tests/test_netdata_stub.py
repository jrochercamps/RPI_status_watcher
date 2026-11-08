"""Valida la fuente simulada usada en las pruebas de integración."""
import importlib.util
import json
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path
from urllib.request import urlopen

spec = importlib.util.spec_from_file_location("netdata_stub", Path(__file__).parent / "fixtures" / "netdata_stub.py")
stub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stub)


class NetdataStubTest(unittest.TestCase):
    def test_charts_and_data(self):
        server = HTTPServer(("127.0.0.1", 0), stub.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}/api/v1"
            with urlopen(base + "/charts", timeout=2) as response:
                self.assertIn("system.cpu", json.load(response)["charts"])
            with urlopen(base + "/data?chart=system.cpu", timeout=2) as response:
                self.assertEqual(json.load(response)["chart"], "system.cpu")
            with urlopen(base + "/alarms?all=true", timeout=2) as response:
                self.assertEqual(json.load(response)["alarms"], {})
            with urlopen(base + "/info", timeout=2) as response:
                self.assertEqual(json.load(response)["hostname"], "fixture")
        finally:
            server.shutdown()
            thread.join()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
