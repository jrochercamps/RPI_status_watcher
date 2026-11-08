# Instrucciones para colaboradores

- No modificar servicios, redes, firewall, túneles ni volúmenes ajenos al proyecto.
- No utilizar Docker privilegiado ni montar el socket Docker en la aplicación.
- No confundir métricas del contenedor con métricas del anfitrión. Indicar expresamente los datos no disponibles.
- No incorporar credenciales al repositorio ni a los registros.
- Mantener las operaciones destructivas explícitas y limitadas a recursos propios.
- Actualizar `PROGRESO.md` y documentar qué pruebas se han ejecutado realmente y cuáles quedan pendientes.
