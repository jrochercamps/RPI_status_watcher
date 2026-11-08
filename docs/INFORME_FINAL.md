# Informe de verificación — trabajo en curso

**Estado: no terminado ni listo para producción.** El equipo de desarrollo es x86_64. Tras habilitar acceso al daemon se ha construido y arrancado la aplicación localmente. La Raspberry Pi, sus servicios y Cloudflare no se han modificado ni inspeccionado de forma remota.

## Verificado en el equipo de desarrollo

- Cinco pruebas unitarias del backend mediante `python -m unittest discover -s backend/tests -v`.
- Una prueba de la fuente simulada Netdata mediante `python -m unittest discover -s tests -v`.
- API, consulta de datos y escritura de instantáneas SQLite contra Netdata simulado; los datos persistieron tras reiniciar el proceso Python. Esto no comprueba volúmenes Docker.
- Una regla de alerta de umbral con datos simulados pasó a `firing` y registró su transición en `/api/rule-alerts/history`.
- Frontend: `npm install` y `npm run build` con Node.js 22.16.0 aislado. `frontend/smoke.cjs` probó una serie y navegación por las once secciones en Chrome con fuente simulada, a 1440 × 900 y 390 × 844, sin errores JavaScript ni desbordamiento horizontal.
- Sintaxis de scripts mediante `sh -n`; configuración de Compose validada sin daemon mediante `docker compose --env-file .env.example config -q`.
- Tras habilitar Docker, imagen amd64 construida; `./install.sh` pasó dos ejecuciones consecutivas, el contenedor quedó `healthy` y API y frontend respondieron. Se generó una copia SQLite con `integrity_check` correcto. Sin Netdata local, `/api/charts` respondió HTTP 502.
- `./scripts/test-deployment.sh` pasó dos veces en un proyecto Compose aislado amd64: construcción, arranque, healthcheck, API, frontend, reinicio y persistencia de SQLite. Los contenedores, red, volumen e imagen de prueba se eliminaron al terminar.
- Manual generado con Typst aislado e inspeccionado mediante `pdfinfo` y `pdftotext`. Consultar el PDF para la versión documental más reciente.

## Limitaciones importantes

- No se ha construido ni probado la imagen ARM64 ni verificado actualización y restauración en Docker. Tampoco se ha medido el impacto en producción.
- Se requiere verificar Netdata real, permisos, IDs de gráficos, conectividad del contenedor y origen de las métricas en la Raspberry Pi. Los gráficos recogidos deben configurarse; sin IDs no se guardan muestras de gráficos.
- El frontend ofrece once secciones y muestra instantáneas SQLite, pero no implementa todas las funciones pedidas. La gráfica de series representa datos de Netdata; los inventarios de Docker y servicios y la configuración visual están pendientes.
- Hay reglas de alertas configurables por JSON y eventos de transición, pero no existe configuración visual, notificación Telegram/correo ni el conjunto completo de alertas solicitado. Las series históricas detalladas/agregadas/resúmenes con las tres retenciones pedidas aún no están implementadas.
- La API no implementa autenticación propia. No publicar el hostname hasta configurar Cloudflare Access, proteger el origen y verificar acceso autorizado y denegado. La topología de red de cloudflared y la configuración existente no se conocen.
- Faltan pruebas automatizadas del ciclo Docker, contenido funcional completo de las secciones y recuperación aislada. El script de actualización no implementa rollback automático; la desinstalación conserva los datos y no ofrece borrado de volumen.

Las instrucciones, características y resultados efectivos deben revisarse antes de cualquier instalación. Véanse `PROGRESO.md`, `LIMITACIONES-INFRA.md`, `backend/README.md` y `frontend/README.md`.
