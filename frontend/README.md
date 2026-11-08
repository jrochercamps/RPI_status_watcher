# Frontend Pi Monitor

Dashboard React + TypeScript + Vite en español. Los valores desconocidos se indican explícitamente; no se generan datos de ejemplo. El catálogo y las métricas dependen de la configuración de Netdata; el frontend no puede determinar si Netdata mide el anfitrión o un contenedor.

## Desarrollo

```sh
npm install
npm run dev
npm run build
```

Vite redirige `/api` a `http://localhost:8765`; `API_PROXY_TARGET` permite cambiar el destino. En producción, el servidor o proxy debe dirigir `/api/...` al backend. Las fuentes externas son opcionales.

## Contrato con el backend

Se usan rutas relativas al mismo origen, sin credenciales ni cabeceras especiales, con formato original Netdata API v1:

- `GET /api/charts`: catálogo con `hostname` opcional y `charts`, objeto indexado por ID. Cada gráfico puede proporcionar `title`, `units`, `name`, `family` y `context`. El frontend presenta todos los IDs recibidos, sin presuponer IDs concretos. Se consulta al iniciar y periódicamente; por defecto cada cinco minutos. Un error se muestra y conserva el último catálogo, marcado como potencialmente desactualizado.
- `GET /api/data?chart=ID&after=-3600&before=0&points=360`: serie del gráfico seleccionado; `after` cambia con el intervalo elegido. Se esperan `labels` (primera columna temporal y siguientes dimensiones) y `data` (filas de números o null). ECharts ordena por tiempo, representa cada dimensión con un color y conserva los huecos. Muestra ejes, valores y estadísticas calculadas sobre las muestras recibidas; la última muestra no necesariamente es instantánea. Las unidades proceden de Netdata. Se actualiza según el intervalo del navegador y la disponibilidad histórica depende de la retención de Netdata.
- `GET /api/alerts?all=true`: respuesta con objeto `alarms`, cuyos valores pueden contener `name`, `chart`, `status`, `info` y `value_string`. Se muestran alertas de estado `WARNING` o `CRITICAL`. Si falla, se indica que las alertas no están disponibles.

`/api/health` solo comprueba el proceso del backend, no la conexión con Netdata, por lo que no se usa como indicador de disponibilidad de métricas. La sección Históricos consulta las instantáneas de `/api/history`, mientras que el gráfico usa la serie de `/api/data`. Alertas consulta también `/api/rule-alerts/history`. No se usa `/api/status`. El indicador de conexión refleja la consulta al catálogo, no la salud de cada servicio. No hay autenticación ni acciones de administración; el backend debe protegerse según su documentación.

En Configuración el usuario elige cada cuánto se actualiza automáticamente ese navegador: 1, 2, 5, 10 o 30 minutos, con cinco minutos por defecto. Se recuerda en `localStorage` cuando está disponible. La apertura, navegación, cambio de gráfica o intervalo y actualización manual pueden generar peticiones adicionales. Esto no modifica `POLL_INTERVAL_SECONDS` ni la recogida del backend.

## Verificación

Con Node.js 22.16.0 aislado se ejecutaron `npm install` y `npm run build`. `node smoke.cjs` comprobó en Chrome, a 1440 × 900 y 390 × 844, valores y estadísticas de una serie de Netdata simulado, cambio de intervalo, las cinco frecuencias de actualización, persistencia de la opción, visualización de una alerta simulada y navegación por las once secciones, sin errores JavaScript ni desbordamiento horizontal. Requiere el backend de pruebas en `TEST_URL` (por defecto puerto 18765) y Chrome en `CHROME_PATH` (por defecto `/usr/bin/google-chrome`). La nueva gráfica aún debe comprobarse en la Raspberry con Netdata real y tras reconstruir la imagen.
