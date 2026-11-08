import os
import tempfile
import time
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from backend import app as module


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"DATABASE_PATH": self.tmp.name + "/test.db", "NETDATA_CHARTS": "cpu.real", "POLL_INTERVAL_SECONDS": "60"})
        self.env.start()
        self.client_context = TestClient(module.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        self.env.stop()
        self.tmp.cleanup()

    def test_history_preserves_payload(self):
        module.save_snapshot(module.app.state.config, "chart", "cpu.real", {"labels": ["time", "real"], "data": [[1, 42]]})
        response = self.client.get("/api/history", params={"kind": "chart", "name": "cpu.real"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["data"]["data"], [[1, 42]])

    def test_upstream_failure_and_validation(self):
        self.assertEqual(self.client.get("/api/data", params={"chart": "x", "points": 0}).status_code, 422)
        self.assertEqual(self.client.get("/api/history", params={"kind": "other"}).status_code, 422)

    def test_upstream_passthrough(self):
        async def mock_get(endpoint, params=None):
            return httpx.Response(200, json={"endpoint": endpoint, "params": params}, request=httpx.Request("GET", "http://netdata/"))
        with patch.object(module.app.state.client, "get", side_effect=mock_get):
            result = self.client.get("/api/data", params={"chart": "actual.chart"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["params"]["chart"], "actual.chart")

    def test_rule_duration_and_missing_data(self):
        config = dict(module.app.state.config)
        config["rules"] = [{"id": "hot", "chart": "real", "dimension": "temperature", "operator": "gt", "threshold": 70, "duration_seconds": 60}]
        now = int(time.time())
        payload = {"labels": ["time", "temperature"], "data": [[now, 80]]}
        module.evaluate_rules(config, "real", payload, now)
        module.evaluate_rules(config, "real", payload, now + 60)
        with module.connect(config["db"]) as db:
            self.assertEqual(db.execute("SELECT status FROM rule_state WHERE id='hot'").fetchone()[0], "firing")
        module.evaluate_rules(config, "real", {}, now + 61)
        with module.connect(config["db"]) as db:
            self.assertEqual(db.execute("SELECT status FROM rule_state WHERE id='hot'").fetchone()[0], "unknown")
            self.assertEqual([r[0] for r in db.execute("SELECT status FROM rule_events ORDER BY id")], ["pending", "firing", "unknown"])

    def test_health(self):
        self.assertEqual(self.client.get("/api/health").json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
