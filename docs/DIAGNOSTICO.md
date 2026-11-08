# Diagnóstico inicial — 7 de noviembre de 2026

La inspección se realizó exclusivamente mediante consultas de lectura, antes de instalar o desarrollar. El equipo accesible **no era la Raspberry Pi objetivo**: los resultados corresponden a un equipo local de desarrollo, no a la infraestructura de producción. Se han anonimizado los nombres de equipo y rutas personales para su publicación.

| Componente | Resultado comprobado |
|---|---|
| Sistema | Ubuntu 26.04.1 LTS, Linux x86_64 |
| Raspberry Pi | No detectada; modelo de CPU AMD Ryzen 7 9800X3D, 16 CPU lógicas |
| Memoria | 30 GiB RAM, 25 GiB disponibles; 511 MiB swap |
| Docker | Cliente 29.1.3; acceso al socket denegado; versión del servidor desconocida |
| Compose | 2.40.3 |
| Contenedores, redes y volúmenes | No verificables: permiso denegado al consultar el daemon |
| Puertos | `ss -lntup` no muestra ningún listener TCP en 8765 ni 19999 en este equipo; los procesos de otros usuarios pueden no ser identificables |
| Netdata | Unidad local inactiva; API local 127.0.0.1:19999 no responde; no puede descartarse una instalación en otro host |
| Cloudflared | Unidad local no encontrada; no se detectaron directorios de configuración locales en las rutas consultadas; configuración remota y túnel de la Raspberry no verificables |
| Tailscale | Unidad local inactiva; estado de la Raspberry desconocido |
| Almacenamiento | Se comprobó el espacio disponible en el equipo de desarrollo; se omiten rutas y capacidades concretas por privacidad. |

## Límites y acciones pendientes

Es imprescindible repetir el diagnóstico en la Raspberry Pi Debian 12 ARM64 con acceso de lectura a Docker y a Netdata, sin imprimir tokens ni secretos de Cloudflare. No se han modificado servicios, firewall, configuración de túneles, redes ni volúmenes. La inaccesibilidad de Docker impide construir o verificar imágenes y contenedores en este entorno; no implica que Docker esté ausente en el servidor objetivo.
