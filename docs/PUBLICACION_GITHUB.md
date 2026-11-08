# Publicación en GitHub

Este proyecto es un prototipo: antes de publicarlo, revise su contenido y el estado de las pruebas. El diagnóstico de desarrollo está anonimizado. Nunca publique datos de producción, copias de seguridad, claves, tokens ni archivos `.env` reales. La copia de la Raspberry puede tener configuraciones distintas y también debe revisarse.

## Crear el repositorio

En GitHub, cree un repositorio público vacío. No seleccione README, `.gitignore` ni licencia en la pantalla de creación, porque el proyecto ya tiene archivos propios. Copie la URL HTTPS del repositorio.

## Preparar el repositorio local

Desde la raíz del proyecto:

```sh
git init
git branch -M main
git status --short --ignored
```

Revise los archivos antes de añadirlos. `.env`, `backups/`, dependencias instaladas y bases de datos deben estar ignorados. No incluya capturas, registros ni diagnósticos de producción sin inspeccionarlos.

```sh
git add .
git status --short
git diff --cached --stat
git diff --cached
```

Inspeccione también los archivos binarios como el PDF; `git diff` no muestra su contenido. Si aparece cualquier secreto, no haga commit: retírelo del índice y, si se ha compartido, rótelo. Añadirlo después a `.gitignore` no lo elimina del historial.

```sh
git commit -m "Versión inicial del dashboard"
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Sustituya la URL por la que muestra GitHub. Configure su nombre y correo de Git si el commit los solicita; el correo puede hacerse público, así que considere la dirección `noreply` de GitHub. Para autenticación use GitHub CLI o el gestor de credenciales, siguiendo las instrucciones que muestre GitHub. GitHub no acepta la contraseña normal de la cuenta para `git push` por HTTPS. No escriba tokens en el código, en la URL remota ni en mensajes.

Si Git muestra que el repositorio ya existe o la rama remota contiene commits, deténgase y revise el estado antes de ejecutar otros comandos: no fuerce el push ni reescriba el historial.

## Licencia

La publicación pública no concede automáticamente una licencia de código abierto. La elección de una licencia corresponde al titular de los derechos; revise también las licencias de dependencias antes de añadirla.
