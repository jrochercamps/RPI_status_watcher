# Progreso

## Fase actual
Integración y verificación de un prototipo. **No está terminado ni listo para producción.** El desarrollo se realiza en un equipo distinto de la Raspberry Pi.

## Completado y verificado
- Diagnóstico de lectura del equipo de desarrollo en `docs/DIAGNOSTICO.md`.
- Backend FastAPI: consulta Netdata, almacena instantáneas SQLite y evalúa reglas por umbral. Cinco pruebas unitarias aprobadas.
- Integración local con Netdata simulado: API, histórico conservado tras reiniciar el proceso Python y transición de una alerta a `firing` comprobados.
- Frontend compilado con Node aislado; prueba real en Chrome de una gráfica y navegación de once secciones con datos simulados en escritorio y móvil, sin desbordamiento horizontal ni errores JavaScript.
- Compose validado sintácticamente sin daemon; scripts comprobados con `sh -n`.
- Manual PDF generado con Typst aislado y examinado con `pdfinfo` y `pdftotext`.
- Tras conceder acceso a Docker: imagen construida en amd64, instalador ejecutado dos veces, contenedor sano, API y frontend accesibles; copia SQLite creada y `integrity_check` correcto. El Netdata local no está disponible y `/api/charts` responde 502, como corresponde.
- Añadidos `deploy.sh` y `scripts/test-deployment.sh`. La prueba aislada pasó dos veces en amd64, incluidos reinicio del contenedor y persistencia de SQLite, con eliminación de sus propios recursos temporales.
- Preparación para publicación: anonimizado el diagnóstico local y ampliadas las exclusiones de bases de datos, credenciales y archivos generados. Añadida guía de publicación; una revisión automática no garantiza la ausencia de secretos.

## Pendientes y limitaciones
- Pendientes pruebas Docker de restauración y actualización; ARM64 y Netdata real sin verificar. La construcción, arranque y persistencia tras reinicio comprobados son exclusivamente amd64 en el PC de desarrollo.
- La Raspberry y la configuración real de Cloudflare Tunnel y Access no han sido inspeccionadas ni modificadas. Configurar Access y proteger el origen antes de publicar.
- La interfaz y el histórico no cubren aún todos los requisitos, las tres retenciones ni las vistas y alertas solicitadas. Ver `docs/INFORME_FINAL.md` y `LIMITACIONES-INFRA.md`.
- Actualización sin rollback automático; desinstalación conserva datos y no incluye borrado de volumen; no se han ejecutado pruebas de instalación y recuperación aislada con Docker.
- La conexión predeterminada a Netdata desde Docker necesita que el servicio sea accesible desde su red; no funciona si escucha únicamente en loopback del host.

## Siguiente acción
Finalizar la integración, ampliar las funciones pendientes y ejecutar las pruebas Docker en un entorno aislado autorizado antes de considerar la instalación en la Raspberry Pi.
