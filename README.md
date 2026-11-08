# RPi Status Dashboard

Proyecto de dashboard para consultar el estado de una Raspberry Pi mediante Netdata, con backend FastAPI, frontend React y despliegue previsto con Docker. Consulte la implementación y su configuración antes de desplegar: esta documentación no supone que todos los componentes estén terminados o probados.

Compose define un único servicio `app`: el backend `app:app` sirve el frontend compilado y usa `/data/status.db` en el volumen `app_data`. El puerto se publica solo en `127.0.0.1` (8765 por defecto). Netdata debe ser accesible desde el contenedor; el valor predeterminado `host.docker.internal:19999` no alcanza automáticamente un Netdata que escuche solo en el loopback del host. El frontend sigue en desarrollo y la integración con Netdata real está pendiente de validación.

## Instalación y operación

Revise y prepare `.env` a partir de `.env.example` antes de ejecutar `./install.sh`: si falta, el instalador lo crea y **continúa con la instalación**. Requiere Linux, Python 3 y Docker Compose con acceso al daemon; construye y arranca el proyecto, y ejecuta `scripts/verify.sh`. Esta verificación consulta la API y la página principal dentro del contenedor, pero no verifica Netdata.

También puede ejecutar `./deploy.sh` como acceso directo al mismo instalador. Para comprobar la infraestructura sin afectar el despliegue existente, use `./scripts/test-deployment.sh`: crea un proyecto Compose, puerto loopback y volumen temporales, comprueba salud, API, frontend y persistencia tras reinicio, y elimina exclusivamente esos recursos de prueba. Necesita Docker, Compose y Python 3; no prueba Netdata real, ARM64 ni Cloudflare.

Los scripts `start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `logs.sh`, `verify.sh`, `backup.sh`, `restore.sh`, `update.sh` y `uninstall.sh` están en `scripts/`. Restauración y desinstalación requieren `--confirm`; revise el manual antes de ejecutarlas. `update.sh` hace una copia previa y reconstruye desde el código local, sin rollback automático. La desinstalación conserva volúmenes y copias.

La API incluye `/api/health`, `/api/charts`, `/api/data`, `/api/alerts`, `/api/history`, `/api/rule-alerts` y `/api/rule-alerts/history`. La API no proporciona autenticación propia; consulte la guía de seguridad antes de publicar acceso remoto.

**Prototipo no terminado:** se ha compilado el frontend y probado con Netdata simulado; también se ha construido y arrancado la imagen amd64 y creado una copia SQLite. Faltan funciones solicitadas y pruebas con Netdata real, restauración en Docker y validación en Raspberry Pi ARM64. No publicar el servicio hasta configurar y verificar Cloudflare Access.

## Documentación

- [Diagnóstico inicial del entorno](docs/DIAGNOSTICO.md).
- [Despliegue y operación](docs/OPERACION.md).
- [Seguridad y Cloudflare Access](docs/SEGURIDAD.md).
- [Informe de verificación y limitaciones](docs/INFORME_FINAL.md).
- [Publicación segura en GitHub](docs/PUBLICACION_GITHUB.md).
- [Manual editable en Typst](docs/manual.typ).
- [Manual en PDF](docs/MANUAL_RPI_STATUS_DASHBOARD.pdf).

Para generar el PDF, ejecute `./scripts/generar_manual.sh`: utiliza Typst local (opcionalmente `TYPST_BIN`) o una imagen Typst disponible localmente en Docker. Escribe `docs/MANUAL_RPI_STATUS_DASHBOARD.pdf`; consulte el manual para las condiciones del modo Docker.

El diagnóstico incluido corresponde a un equipo de desarrollo, no a la Raspberry Pi. Antes de operar en producción, verifique la configuración real, los puertos, las credenciales y el acceso a Docker en el equipo objetivo.
