# Autenticación opcional: Authelia y Caddy

Despliegue independiente; no altera la aplicación, Cloudflared, DNS ni otros servicios. Requiere Docker Compose, Python 3.9+ y `libargon2` (en Debian/Raspberry Pi OS, `libargon2-1`). La red externa `rpi-status-dashboard_default` y su servicio `app` deben existir. Las imágenes fijadas deben ser compatibles con la arquitectura de la Raspberry; revisar actualizaciones de seguridad periódicamente.

## Preparación

Ejecutar desde la raíz con un usuario capaz de crear el directorio de datos y acceder a Docker:

```sh
./scripts/setup-auth.sh
```

Por defecto se crea `$HOME/.local/share/rpi-status-auth` con permisos 0700 y archivos 0600. Su directorio padre debe existir. No ejecute el asistente como root ni con sudo: el usuario debe tener acceso a Docker. Puede elegir otro directorio absoluto **fuera del repositorio** con `AUTH_DATA_DIR=/ruta/privada/nueva ./scripts/setup-auth.sh`. El directorio no debe existir: nunca se sobrescribe. Una ejecución interrumpida después de crearlo puede dejarlo incompleto; inspeccionarlo y gestionarlo explícitamente antes de reintentar. No usar rutas accesibles a otros usuarios, ni respaldos públicos. Guardar una copia segura del directorio: incluye claves, hash, base SQLite y notificaciones. Perder la clave de cifrado puede impedir recuperar los datos de Authelia.

El asistente pide los dos nombres DNS, dominio común de cookie, un usuario propio de Authelia y una contraseña larga y única (mínimo 16 caracteres) dos veces sin eco. No utiliza cuentas Linux; la contraseña no se pasa como argumento ni se escribe en disco. El hash Argon2id y claves aleatorias se guardan localmente. El dominio de cookie debe ser un dominio controlado, no un sufijo público compartido; sus subdominios deben ser de confianza. El usuario de Docker del host y root tienen acceso a los secretos y al tráfico interno.

## Arranque y conexión

Con el directorio predeterminado, validar y arrancar **únicamente** este proyecto:

```sh
docker compose --env-file "$HOME/.local/share/rpi-status-auth/compose.env" -f auth/compose.yaml config --quiet
docker compose --env-file "$HOME/.local/share/rpi-status-auth/compose.env" -f auth/compose.yaml up -d
```

Si se eligió otro directorio, sustituir la ubicación de `compose.env` en estos comandos. Para detener solo este proyecto usar el mismo comando con `stop`; no borrar datos ni volúmenes como parte de una parada.

Caddy escucha exclusivamente en `127.0.0.1:8766`; Authelia no publica puertos y solo está en la red interna de autenticación. Para habilitar el acceso externo, el administrador debe configurar **manualmente** Cloudflared para dirigir ambos nombres HTTPS al mismo origen HTTP `http://127.0.0.1:8766`, conservando el Host correspondiente, y verificar TLS/HTTPS externo. No se crea ni publica ninguna ruta automáticamente. El puerto de la aplicación original sigue disponible en loopback y en su red Docker: cualquier túnel, proxy, proceso local o contenedor que acceda a él directamente **evita Authelia**. Antes de considerar segura la instalación, retirar o proteger las rutas alternativas existentes sin afectar servicios ajenos; esto no se hace automáticamente. Docker y los usuarios locales autorizados son de confianza.

## Seguridad y comprobaciones

La política por defecto es `deny`; el host protegido requiere `one_factor` para todas las rutas, incluidas las API. No hay excepciones ni ACL basadas en IP. Tras cinco fallos de contraseña en dos minutos, Authelia bloquea la cuenta durante 15 minutos; no se promete bloqueo por IP ni identificación de IP real. Caddy no confía en proxies por rango y fuerza `X-Forwarded-Proto: https` y el host configurado hacia Authelia, tanto en el portal como en forward-auth, sin aceptar esos valores del cliente. Cloudflare puede preservar `X-Forwarded-For` proporcionado por el cliente: no usarlo como identidad ni como bypass. La suposición HTTPS solo es válida si el acceso público se restringe a HTTPS y el origen loopback es de confianza. Caddy deniega el acceso si Authelia falla; cualquier respuesta exitosa requiere autorización previa.

Pruebas aisladas disponibles: `python3 -m unittest discover -s auth -p 'test_*.py' -v`. Crean y eliminan únicamente un proyecto Docker temporal, sin conectar a la red de producción; requieren imágenes y Docker. Se validan las configuraciones con los binarios oficiales, la negativa sin sesión en raíz y API con y sin cabeceras forjadas, inicio de sesión y cookie, bloqueo tras cinco fallos y fallo cerrado al detener Authelia incluso con una cookie válida. La prueba usa datos ficticios fuera del repositorio y comprueba cookie Secure manualmente sobre HTTP local, no en navegador HTTPS.

**Pendiente en el entorno real antes de habilitarlo:** verificar portal, inicio de sesión válido, cookies seguras y redirección HTTPS a través de Cloudflare, acceso a API tras autenticación, bloqueo tras cinco intentos y su duración, ausencia de rutas alternativas, reinicio y recuperación. También comprobar las peticiones con cabeceras forjadas y Authelia detenido a través del túnel real. No se han probado Raspberry, Cloudflare ni el flujo completo de inicio de sesión en producción. Un factor único no sustituye MFA; considerar un segundo factor para protección adicional.
