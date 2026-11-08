"""Read-only Netdata gateway with a small local snapshot history."""
import asyncio
import json
import logging
import math
import os
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from urllib.parse import urlsplit
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles

log = logging.getLogger(__name__)


def settings():
    url = os.getenv("NETDATA_URL", "http://127.0.0.1:19999").rstrip("/")
    parsed = urlsplit(url)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or
            parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("NETDATA_URL must be an HTTP(S) URL without credentials, query or fragment")
    interval = float(os.getenv("POLL_INTERVAL_SECONDS", "60"))
    retention = int(os.getenv("HISTORY_RETENTION_DAYS", "30"))
    if interval <= 0 or retention < 1:
        raise ValueError("POLL_INTERVAL_SECONDS must be positive and HISTORY_RETENTION_DAYS at least 1")
    rules = json.loads(os.getenv("ALERT_RULES", "[]"))
    if not isinstance(rules, list):
        raise ValueError("ALERT_RULES must be a JSON array")
    seen = set()
    for rule in rules:
        if (not isinstance(rule, dict) or not all(isinstance(rule.get(k), str) and rule[k] for k in ("id", "chart", "dimension"))
                or rule.get("operator") not in ("gt", "lt") or isinstance(rule.get("threshold"), bool)
                or not isinstance(rule.get("threshold"), (int, float)) or isinstance(rule.get("duration_seconds", 0), bool)
                or not isinstance(rule.get("duration_seconds", 0), (int, float)) or rule.get("duration_seconds", 0) < 0
                or rule["id"] in seen):
            raise ValueError("Invalid or duplicate alert rule")
        seen.add(rule["id"])
    charts = [x.strip() for x in os.getenv("NETDATA_CHARTS", "").split(",") if x.strip()]
    charts = list(dict.fromkeys(charts + [rule["chart"] for rule in rules]))
    return {"url": url, "db": os.getenv("DATABASE_PATH", "/data/status.db"),
            "charts": charts, "rules": rules,
            "interval": interval, "retention": retention,
            "token": os.getenv("NETDATA_TOKEN", "")}


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=10)
    try:
        db.execute("PRAGMA busy_timeout=10000")
        with db:
            yield db
    finally:
        db.close()


def initialize(path):
    with connect(path) as db:
        db.execute("CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, collected_at INTEGER NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL)")
        db.execute("CREATE INDEX IF NOT EXISTS snapshots_lookup ON snapshots(kind, name, collected_at)")
        db.execute("CREATE TABLE IF NOT EXISTS rule_state (id TEXT PRIMARY KEY, signature TEXT NOT NULL, status TEXT NOT NULL, since INTEGER, updated_at INTEGER NOT NULL, value REAL)")
        db.execute("CREATE TABLE IF NOT EXISTS rule_events (id INTEGER PRIMARY KEY, rule_id TEXT NOT NULL, timestamp INTEGER NOT NULL, status TEXT NOT NULL, value REAL)")


def evaluate_rules(config, chart, payload, now):
    """Use the newest actual Netdata sample; missing data resets continuity."""
    labels = payload.get("labels", []) if isinstance(payload, dict) else []
    rows = payload.get("data", []) if isinstance(payload, dict) else []
    with connect(config["db"]) as db:
        for rule in config["rules"]:
            if rule["chart"] != chart:
                continue
            value = None
            if isinstance(labels, list) and rule["dimension"] in labels and isinstance(rows, list) and rows:
                index = labels.index(rule["dimension"])
                row = rows[0]
                if (isinstance(row, list) and index < len(row) and row and isinstance(row[0], (int, float))
                        and now - config["interval"] * 2 <= row[0] <= now + config["interval"]
                        and isinstance(row[index], (int, float)) and not isinstance(row[index], bool) and math.isfinite(row[index])):
                    value = row[index]
            signature = json.dumps(rule, sort_keys=True)
            previous = db.execute("SELECT signature, status, since, updated_at FROM rule_state WHERE id = ?", (rule["id"],)).fetchone()
            valid = previous and previous[0] == signature and now - previous[3] <= config["interval"] * 2
            triggered = value is not None and (value > rule["threshold"] if rule["operator"] == "gt" else value < rule["threshold"])
            since = (previous[2] if valid and previous[2] is not None else now) if triggered else None
            status = ("firing" if now - since >= rule.get("duration_seconds", 0) else "pending") if triggered else ("ok" if value is not None else "unknown")
            db.execute("INSERT OR REPLACE INTO rule_state VALUES (?, ?, ?, ?, ?, ?)", (rule["id"], signature, status, since, now, value))
            if not previous or previous[1] != status or previous[0] != signature:
                db.execute("INSERT INTO rule_events(rule_id, timestamp, status, value) VALUES (?, ?, ?, ?)", (rule["id"], now, status, value))


async def netdata(app, endpoint, params=None):
    try:
        response = await app.state.client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Netdata request failed: %s", type(exc).__name__)
        raise HTTPException(502, "Netdata no disponible o respuesta inválida") from exc


def save_snapshot(config, kind, name, payload, now=None):
    now = int(time.time()) if now is None else now
    with connect(config["db"]) as db:
        db.execute("INSERT INTO snapshots(collected_at, kind, name, payload) VALUES (?, ?, ?, ?)",
                   (now, kind, name, json.dumps(payload, separators=(',', ':'))))


async def collect(app):
    cfg = app.state.config
    for chart in cfg["charts"]:
        try:
            data = await netdata(app, "data", {"chart": chart, "after": -int(max(cfg["interval"], 1)), "points": 1})
            save_snapshot(cfg, "chart", chart, data)
            evaluate_rules(cfg, chart, data, int(time.time()))
        except HTTPException:
            log.warning("Could not collect chart %s", chart)
            evaluate_rules(cfg, chart, {}, int(time.time()))
    try:
        alerts = await netdata(app, "alarms", {"all": "true"})
        save_snapshot(cfg, "alerts", "", alerts)
    except HTTPException:
        log.warning("Could not collect alerts")
    with connect(cfg["db"]) as db:
        db.execute("DELETE FROM snapshots WHERE collected_at < ?", (int(time.time()) - cfg["retention"] * 86400,))
        db.execute("DELETE FROM rule_events WHERE timestamp < ?", (int(time.time()) - cfg["retention"] * 86400,))


async def poll(app):
    while True:
        try:
            await collect(app)
        except Exception:
            log.exception("Snapshot collection failed")
        await asyncio.sleep(app.state.config["interval"])


@asynccontextmanager
async def lifespan(app):
    cfg = settings()
    initialize(cfg["db"])
    headers = {"Authorization": "Bearer " + cfg["token"]} if cfg["token"] else {}
    async with httpx.AsyncClient(base_url=cfg["url"] + "/api/v1/", headers=headers,
                                 timeout=10, follow_redirects=False, trust_env=False) as client:
        app.state.config, app.state.client = cfg, client
        task = asyncio.create_task(poll(app))
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="RPI Status API", lifespan=lifespan)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/charts")
async def charts(request: Request):
    return await netdata(request.app, "charts")


@app.get("/api/data")
async def data(request: Request, chart: str = Query(..., min_length=1, max_length=512),
               after: int = -3600, before: int = 0, points: int = Query(120, ge=1, le=2000)):
    return await netdata(request.app, "data", {"chart": chart, "after": after, "before": before, "points": points})


@app.get("/api/alerts")
async def alerts(request: Request, all: bool = False):
    return await netdata(request.app, "alarms", {"all": str(all).lower()})


@app.get("/api/rule-alerts")
async def rule_alerts(request: Request):
    config = request.app.state.config
    with connect(config["db"]) as db:
        result = []
        for rule in config["rules"]:
            row = db.execute("SELECT signature, status, since, updated_at, value FROM rule_state WHERE id = ?", (rule["id"],)).fetchone()
            valid = row and row[0] == json.dumps(rule, sort_keys=True) and time.time() - row[3] <= config["interval"] * 2
            result.append({"rule": rule, "status": row[1] if valid else "unknown", "since": row[2] if valid else None,
                           "updated_at": row[3] if row else None, "value": row[4] if valid else None})
    return {"items": result}


@app.get("/api/rule-alerts/history")
async def rule_alert_history(request: Request, since: int = 0, limit: int = Query(100, ge=1, le=1000)):
    with connect(request.app.state.config["db"]) as db:
        rows = db.execute("SELECT rule_id, timestamp, status, value FROM rule_events WHERE timestamp >= ? ORDER BY timestamp DESC, id DESC LIMIT ?", (since, limit)).fetchall()
    return {"items": [{"rule_id": r, "timestamp": t, "status": s, "value": v} for r, t, s, v in rows]}


@app.get("/api/history")
async def history(request: Request, kind: str = Query(..., pattern="^(chart|alerts)$"),
                  name: str = "", since: int = 0, until: int = 2147483647,
                  limit: int = Query(100, ge=1, le=1000)):
    with connect(request.app.state.config["db"]) as db:
        rows = db.execute("SELECT collected_at, name, payload FROM snapshots WHERE kind = ? AND (? = '' OR name = ?) AND collected_at >= ? AND collected_at <= ? ORDER BY collected_at DESC, id DESC LIMIT ?",
                          (kind, name, name, since, until, limit)).fetchall()
    return {"items": [{"collected_at": timestamp, "name": chart, "data": json.loads(payload)}
                      for timestamp, chart, payload in rows]}


# Mounted last so the API and OpenAPI routes always take precedence.
frontend = Path(os.getenv("FRONTEND_DIST", "/app/frontend/dist"))
if frontend.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend), html=True), name="frontend")
