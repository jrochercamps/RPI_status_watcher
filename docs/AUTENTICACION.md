# Protección opcional del acceso externo

La aplicación no tiene autenticación propia. No publique su origen directamente ni exponga la API a Internet. Si se utiliza Authelia con un proxy, todas las rutas del dashboard, incluidas `/api/` y las rutas desconocidas, deben pasar por una comprobación de autorización que rechace el acceso ante errores.

La implementación opcional en `auth/` utiliza una cuenta independiente de Linux, contraseña única y bloqueo de intentos. En pruebas Docker aisladas amd64 se comprobó el rechazo anónimo y de cabeceras falsas, el login con credenciales ficticias, el bloqueo tras cinco fallos y el cierre del acceso cuando Authelia se detiene. La cookie Secure se comprobó manualmente sobre HTTP local, no con un navegador por HTTPS. No se considera desplegado ni seguro en producción hasta comprobar que:

1. Una sesión nueva sin autenticar no recibe contenido del dashboard ni de su API.
2. Un usuario y contraseña válidos permiten el acceso y una contraseña incorrecta lo deniega.
3. El bloqueo por intentos fallidos funciona y deja constancia del periodo de bloqueo.
4. La manipulación de cabeceras de identidad, protocolo, host e IP no permite evitar la autenticación.
5. Si Authelia no está disponible, el proxy deniega el acceso en lugar de reenviarlo.
6. No existe otra ruta pública en Cloudflare, DNS o un proxy que apunte directamente al backend sin autenticación. El puerto local del dashboard solo protege frente a conexiones externas directas; otros usuarios locales y accesos privilegiados al host quedan fuera de esta frontera.
7. Los secretos y hashes no se incorporan al repositorio ni a registros y se respaldan de forma segura. La contraseña de Linux no se reutiliza.

Los servicios y rutas de Cloudflare existentes no deben modificarse ni reiniciarse automáticamente. La validación final debe hacerse en la Raspberry y, cuando el administrador publique las rutas, desde fuera. Véase la [guía de validación de Authelia](https://www.authelia.com/reference/guides/validating-forwarded-authentication/).
