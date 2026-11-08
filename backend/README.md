# Backend

Python 3.10+: `pip install -r backend/requirements.txt` y `uvicorn backend.app:app --host 127.0.0.1 --port 8765` desde la raíz del proyecto. Documentación interactiva: `/docs`.

Variables: `NETDATA_URL` (por defecto `http://127.0.0.1:19999`), `NETDATA_TOKEN` (opcional, enviado como Bearer), `DATABASE_PATH` (por defecto `backend/history.sqlite3`; el directorio debe existir), `NETDATA_CHARTS` (IDs reales separados por comas; por defecto ninguno), `POLL_INTERVAL_SECONDS` (60) y `HISTORY_RETENTION_DAYS` (30). Consultar `/api/charts` para descubrir IDs reales. La URL es configuración del servidor, no una entrada del cliente; las redirecciones están deshabilitadas. Si Netdata necesita otra autenticación, configurar un proxy seguro; no poner credenciales en la URL.

* `GET /api/health`: estado del proceso, no comprueba Netdata.
* `GET /api/charts`: catálogo original de Netdata.
* `GET /api/data?chart=ID&after=-3600&before=0&points=120`: respuesta original; tiempos según la API v1 de Netdata.
* `GET /api/alerts?all=true`: respuesta original de `/api/v1/alarms`.
* `GET /api/history?kind=chart&name=ID&since=0&until=2147483647&limit=100` o `kind=alerts`: instantáneas guardadas, más recientes primero; fechas en segundos Unix.

El proceso consulta alertas y los gráficos configurados al arrancar y periódicamente; cada gráfico conserva la respuesta Netdata de un punto sobre el intervalo anterior, no una serie de resolución completa. Solo se guardan respuestas válidas y la retención se aplica durante la recogida. No es un registro de cambios de alertas ni envía notificaciones. Un reinicio o fallo de Netdata deja huecos; varias instancias generarían duplicados. No se ha verificado la compatibilidad con la instalación remota. La API no incluye autenticación: mantenerla en localhost o protegerla mediante un proxy autenticado y TLS antes de exponerla.

## Pruebas

Ejecutado con Python 3.14 y dependencias instaladas en un entorno virtual: `python -m unittest discover -s backend/tests -v`, 3 pruebas superadas. La conexión local a Netdata falló como era esperable; la prueba de respuesta usa un cliente simulado. Pendiente: integración con Netdata real en la Raspberry Pi, autenticación de su instalación, persistencia y retención durante funcionamiento prolongado y validación ARM64.
