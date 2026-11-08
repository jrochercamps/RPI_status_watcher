# Seguridad y acceso remoto

## Principios

- Restrinja la exposición de Netdata y del backend a las redes y clientes necesarios. Verifique las interfaces de escucha y las reglas de red efectivas en el servidor; no asuma que Docker o un túnel las protegen automáticamente.
- Mantenga secretos fuera del repositorio, de la imagen, de las URL y de los registros. Limite sus permisos, rote cualquier secreto expuesto y use mecanismos de gestión apropiados para su entorno.
- Actualice y supervise el sistema y sus dependencias conforme a sus políticas. Revise los permisos de Docker: acceso al daemon equivale en la práctica a privilegios elevados en el host.

## Cloudflare Access

Si se utiliza Cloudflare Tunnel, cree la aplicación Cloudflare Access con políticas explícitas y de mínimo privilegio **antes de publicar la ruta**: sin Access, la aplicación publicada podría quedar accesible en Internet. Active **Protect with Access** en cloudflared para validar el JWT de Access, o implemente la validación de tokens en el origen. Compruebe el rechazo de un usuario no autorizado y de solicitudes sin token válido donde corresponda, y el acceso de un usuario autorizado. Proteja también las rutas alternativas hacia el origen: la validación en cloudflared no protege accesos directos que lo eviten.

No dé por hecho que la presencia de un túnel habilita Access. Revise las políticas, el DNS, las rutas de ingreso y la configuración del origen en Cloudflare y en el servidor objetivo. Evite publicar el panel de Netdata directamente salvo que exista una necesidad y protección explícitas. Para accesos no interactivos, use el mecanismo de identidad apropiado y proteja sus credenciales. Si el origen debe confiar en la identidad de Access, implemente y verifique la validación correspondiente según la documentación vigente de Cloudflare; no confíe ciegamente en cabeceras aportadas por el cliente.

Si se configura `localhost:8765` como origen, solo apunta al loopback del host cuando cloudflared comparte su namespace de red. Si cloudflared está en otro contenedor con red bridge, `localhost` apunta a ese contenedor y un puerto publicado únicamente en loopback del host no es accesible automáticamente. Verifique la topología y el mecanismo de conexión permitido antes de configurar el origen. No cambie la escucha a `0.0.0.0` sin evaluar el impacto de seguridad y obtener autorización.

El diagnóstico local no verifica la configuración remota de Cloudflare ni la de la Raspberry Pi. No registre tokens de túnel, claves ni credenciales al inspeccionarlas.

Referencia: [publicación de aplicaciones self-hosted de Cloudflare](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/). Estas medidas no se han verificado como configuradas en el proyecto.
