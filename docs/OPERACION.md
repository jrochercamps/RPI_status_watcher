# Despliegue y operación

## Alcance

La arquitectura prevista comprende Netdata como fuente de métricas, FastAPI como backend, React como interfaz y Docker para el despliegue. Confirme en el código y en los archivos de configuración disponibles cómo se conectan estos componentes, qué variables necesitan y qué funcionalidades están realmente implementadas. Este documento no acredita que el sistema se haya desplegado ni probado en la Raspberry Pi.

Las métricas de un contenedor no equivalen necesariamente a las del anfitrión. Considere no disponibles los datos del anfitrión que Netdata o la implementación no expongan o no hayan podido verificar; no los interprete como cero.

## Antes del despliegue

1. Revise `DIAGNOSTICO.md` y repita las comprobaciones pertinentes en la Raspberry Pi objetivo. No publique credenciales ni salidas que las contengan.
2. Compruebe arquitectura, espacio libre, Docker y Compose, acceso autorizado al daemon y conectividad con la API de Netdata. Compruebe también que los puertos elegidos estén libres y sean apropiados para la configuración real.
3. Inspeccione los archivos de Compose, variables de entorno y scripts presentes antes de ejecutarlos. Use únicamente los nombres, rutas y comandos definidos por la implementación. No incluya secretos en archivos versionados.
4. Revise [SEGURIDAD.md](SEGURIDAD.md) antes de habilitar acceso remoto. Prepare copias de seguridad y un procedimiento de recuperación adecuados al entorno.

Si cloudflared utiliza `localhost:8765` para llegar al origen en el host, debe compartir el namespace de red del host. En otro contenedor bridge, `localhost` apunta a ese contenedor y la publicación en loopback del host no es accesible automáticamente. No abra la escucha en `0.0.0.0` sin evaluación de seguridad y autorización.

## Operación y diagnóstico

Consulte el estado y los registros de los servicios con los comandos correspondientes a la configuración de Compose realmente utilizada; evite copiar registros que puedan contener secretos. Si no aparecen métricas, compruebe por separado Netdata, la conectividad desde el backend, los registros del backend y las peticiones del navegador. No exponga Netdata o el backend a Internet para resolver problemas de conectividad.

Los cambios en servicios, túneles, firewall, redes o volúmenes requieren verificar previamente su impacto en el servidor objetivo. El diagnóstico inicial no demuestra el estado actual de esos elementos.

## Manual y scripts

`scripts/generar_manual.sh` compila `docs/manual.typ` en `docs/MANUAL_RPI_STATUS_DASHBOARD.pdf` con Typst local o, si no está disponible, con una imagen Typst local y Docker accesible. Ejecútelo desde cualquier directorio; no instala dependencias ni descarga imágenes. La salida existente se reemplaza. Consulte cada script adicional y sus requisitos directamente en el repositorio antes de ejecutarlo; no se presupone que haya sido probado.
